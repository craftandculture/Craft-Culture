/**
 * Validate import items before bulk stock import
 *
 * For each row: validates location codes, auto-matches wine products
 * against the lwin_wines database (208k records), and flags spirits
 * as SKU-based identifiers.
 *
 * @example
 *   await trpcClient.wms.admin.stock.validateImport.mutate({
 *     items: [{ productName: 'Sassicaia 2019', producer: 'Tenuta San Guido', category: 'Wine' }],
 *   });
 */

import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { lwinWines, wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const SPIRIT_CATEGORIES = [
  'whisky',
  'whiskey',
  'rum',
  'vodka',
  'gin',
  'tequila',
  'brandy',
  'beer',
  'cider',
  'liqueur',
  'liquor',
  'rtd',
  'spirit',
  'spirits',
  'mezcal',
  'cognac',
  'sake',
];

const validateItemSchema = z.object({
  productName: z.string(),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  sku: z.string().optional(),
  locationCode: z.string().optional(),
  category: z.string().optional(),
});

const validateImportSchema = z.object({
  items: z.array(validateItemSchema).min(1).max(500),
});

interface LwinCandidate {
  lwin: string;
  displayName: string;
  producerName: string | null;
  country: string | null;
  region: string | null;
  type: string | null;
}

interface ValidationResult {
  rowIndex: number;
  status: 'matched' | 'ambiguous' | 'no_match' | 'spirit' | 'error';
  lwin: LwinCandidate | null;
  candidates: LwinCandidate[];
  locationValid: boolean | null;
  errors: string[];
}

const adminValidateImportItems = adminProcedure
  .input(validateImportSchema)
  .mutation(async ({ input }) => {
    const { items } = input;

    // 1. Batch-validate all unique location codes
    const locationCodes = [
      ...new Set(
        items
          .map((i) => i.locationCode)
          .filter(Boolean) as string[],
      ),
    ];

    const validLocationCodes = new Set<string>();
    if (locationCodes.length > 0) {
      const matchedLocations = await db
        .select({ locationCode: wmsLocations.locationCode })
        .from(wmsLocations)
        .where(inArray(wmsLocations.locationCode, locationCodes));

      for (const loc of matchedLocations) {
        validLocationCodes.add(loc.locationCode);
      }
    }

    // 2. Process each item
    const results: ValidationResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const errors: string[] = [];

      // Check location validity
      const locationValid = item.locationCode
        ? validLocationCodes.has(item.locationCode)
        : null;

      if (item.locationCode && !locationValid) {
        errors.push(`Unrecognized location: ${item.locationCode}`);
      }

      // Check if this is a spirit/non-wine product
      const categoryLower = (item.category ?? '').toLowerCase().trim();
      const isSpirit = SPIRIT_CATEGORIES.some(
        (s) => categoryLower.includes(s),
      );

      if (isSpirit) {
        results.push({
          rowIndex: i,
          status: 'spirit',
          lwin: null,
          candidates: [],
          locationValid,
          errors,
        });
        continue;
      }

      // 3. Search lwin_wines for wine products
      const searchQuery = [item.productName, item.producer]
        .filter(Boolean)
        .join(' ');

      const searchTerms = searchQuery
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length >= 2);

      if (searchTerms.length === 0) {
        results.push({
          rowIndex: i,
          status: 'no_match',
          lwin: null,
          candidates: [],
          locationValid,
          errors: [...errors, 'Product name too short for LWIN lookup'],
        });
        continue;
      }

      // Build ILIKE conditions for each search term
      const searchConditions = searchTerms.map((term) =>
        or(
          ilike(lwinWines.displayName, `%${term}%`),
          ilike(lwinWines.producerName, `%${term}%`),
          ilike(lwinWines.wine, `%${term}%`),
        ),
      );

      let candidates = await db
        .select({
          lwin: lwinWines.lwin,
          displayName: lwinWines.displayName,
          producerName: lwinWines.producerName,
          country: lwinWines.country,
          region: lwinWines.region,
          type: lwinWines.type,
        })
        .from(lwinWines)
        .where(
          and(
            ...searchConditions,
            eq(lwinWines.status, 'live'),
          ),
        )
        .orderBy(
          // Prioritize exact producer matches
          sql`CASE WHEN LOWER(${lwinWines.producerName}) = ${(item.producer ?? '').toLowerCase()} THEN 0 ELSE 1 END`,
          sql`LENGTH(${lwinWines.displayName})`,
        )
        .limit(5);

      // Fuzzy fallback: use word_similarity when ILIKE finds nothing (handles typos)
      if (candidates.length === 0) {
        const productNameLower = item.productName.toLowerCase();
        const producerLower = (item.producer ?? '').toLowerCase();

        candidates = await db
          .select({
            lwin: lwinWines.lwin,
            displayName: lwinWines.displayName,
            producerName: lwinWines.producerName,
            country: lwinWines.country,
            region: lwinWines.region,
            type: lwinWines.type,
          })
          .from(lwinWines)
          .where(
            and(
              eq(lwinWines.status, 'live'),
              or(
                sql`word_similarity(${productNameLower}, ${lwinWines.displayName}) > 0.4`,
                sql`word_similarity(${productNameLower}, ${lwinWines.wine}) > 0.4`,
              ),
            ),
          )
          .orderBy(
            desc(
              sql`word_similarity(${productNameLower}, ${lwinWines.displayName}) + CASE WHEN ${producerLower} != '' THEN similarity(${producerLower}, LOWER(COALESCE(${lwinWines.producerName}, ''))) * 0.5 ELSE 0 END`,
            ),
          )
          .limit(5);
      }

      if (candidates.length === 0) {
        results.push({
          rowIndex: i,
          status: 'no_match',
          lwin: null,
          candidates: [],
          locationValid,
          errors,
        });
      } else if (candidates.length === 1) {
        results.push({
          rowIndex: i,
          status: 'matched',
          lwin: candidates[0]!,
          candidates,
          locationValid,
          errors,
        });
      } else {
        // Multiple matches — check if the top result is a strong match
        // (producer matches AND name is short → likely unique)
        const top = candidates[0]!;
        const producerLc = item.producer?.toLowerCase() ?? '';
        const topProducerLc = top.producerName?.toLowerCase() ?? '';
        const producerMatch =
          item.producer &&
          (topProducerLc.includes(producerLc) ||
            producerLc.includes(topProducerLc));
        const nameMatch =
          top.displayName
            .toLowerCase()
            .includes(item.productName.toLowerCase().slice(0, 10));

        if (producerMatch && nameMatch) {
          results.push({
            rowIndex: i,
            status: 'matched',
            lwin: top,
            candidates: candidates.slice(0, 3),
            locationValid,
            errors,
          });
        } else {
          results.push({
            rowIndex: i,
            status: 'ambiguous',
            lwin: top,
            candidates: candidates.slice(0, 3),
            locationValid,
            errors,
          });
        }
      }
    }

    return {
      results,
      totalItems: items.length,
      matched: results.filter((r) => r.status === 'matched').length,
      ambiguous: results.filter((r) => r.status === 'ambiguous').length,
      noMatch: results.filter((r) => r.status === 'no_match').length,
      spirits: results.filter((r) => r.status === 'spirit').length,
      locationErrors: results.filter((r) => r.locationValid === false).length,
    };
  });

export default adminValidateImportItems;
