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

import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
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
      // Extract all meaningful keywords from product name (strip vintage, filler words)
      const cleanedName = item.productName.replace(/\b(19|20)\d{2}\b/g, '').trim();

      const fillers = new Set(['the', 'de', 'du', 'des', 'le', 'la', 'les', 'di', 'del', 'and', '&', '-', ',', '.']);
      const allKeywords = cleanedName
        .split(/[\s,]+/)
        .map((w) => w.replace(/[^a-zA-Z0-9À-ÿ]/g, '').trim())
        .filter((w) => w.length >= 2 && !fillers.has(w.toLowerCase()));

      if (allKeywords.length === 0) {
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

      const selectFields = {
        lwin: lwinWines.lwin,
        displayName: lwinWines.displayName,
        producerName: lwinWines.producerName,
        country: lwinWines.country,
        region: lwinWines.region,
        type: lwinWines.type,
      };

      // Step 1: Exact keyword match on displayName — all keywords must appear
      // displayName is "Producer, Wine" so it's the most reliable single field to search.
      // Sorted by shortest displayName to prefer the most generic match
      // (e.g., "Dom Perignon" over "Dom Perignon Oenotheque Side By Side")
      const displayConditions = allKeywords.map((kw) => ilike(lwinWines.displayName, `%${kw}%`));

      let candidates = await db
        .select(selectFields)
        .from(lwinWines)
        .where(
          and(
            ...displayConditions,
            eq(lwinWines.status, 'live'),
          ),
        )
        .orderBy(sql`LENGTH(${lwinWines.displayName}) ASC`)
        .limit(5);

      // Step 2: Fuzzy fallback — only when exact matching finds nothing (handles typos)
      if (candidates.length === 0) {
        const fuzzyQuery = [item.producer, ...allKeywords].filter(Boolean).join(' ');

        candidates = await db
          .select(selectFields)
          .from(lwinWines)
          .where(
            and(
              eq(lwinWines.status, 'live'),
              sql`similarity(${lwinWines.displayName}, ${fuzzyQuery}) > 0.3`,
            ),
          )
          .orderBy(
            desc(sql`similarity(${lwinWines.displayName}, ${fuzzyQuery})`),
            sql`LENGTH(${lwinWines.displayName}) ASC`,
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
