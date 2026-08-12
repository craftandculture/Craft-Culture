import { and, eq, gt, ilike, isNull, like, or } from 'drizzle-orm';

import { wmsLocations, wmsStock } from '@/database/schema';

import normalizeLwin18 from './normalizeLwin18';
import resolveRepackFromStock from './resolveRepackFromStock';

interface RepackParams {
  name: string;
  sku: string | null;
  description: string | null;
  /** Ordered quantity — cases, or bottles when the unit is a bottle. */
  quantity?: number | null;
  /** The Zoho line unit ('Case'/'Cases'/'Bottle'). */
  unit?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/**
 * Decide whether an order line needs a repack, from which pack, and which bay
 * to pick it from.
 *
 * Loads the candidate stock for one line and hands it to resolveRepackFromStock
 * (which holds the matching and repack rules, shared with the callers that
 * resolve many lines against a single stock fetch). Stock is matched by LWIN
 * (pack-agnostic) OR product name + vintage to catch pre-repacked packs.
 *
 * @example
 *   await resolveLineRepack({ name: 'Duroche ...', sku: '1258617-2023-01-00750', description: '3x75cl', db });
 *   // -> { orderedPack: 3, needsRepack: true, fromPack: 6, hasStock: true, suggestedLocation: 'B-01-01' }
 *
 * @param name - The line item name
 * @param sku - The line item SKU (LWIN-based)
 * @param description - The line pack format, e.g. "3x75cl"
 * @param quantity - Ordered quantity, so the suggested bay holds enough
 * @param unit - The Zoho line unit ('Case'/'Cases'/'Bottle')
 * @param db - Drizzle db handle
 * @returns The ordered pack, the repack decision and the suggested bay
 */
const resolveLineRepack = async ({
  name,
  sku,
  description,
  quantity,
  unit,
  db,
}: RepackParams) => {
  const normalized = normalizeLwin18(String(sku ?? ''));
  const parts = normalized.split('-');
  const lwin7 = parts[0] ?? '';
  const vintageStr = parts[1] ?? (name.match(/\b(19|20)\d{2}\b/)?.[0] ?? '');
  // A mixed-vintage case is NV in LWIN ('0000'/'1000') and its stock row holds
  // no vintage. '1000' must be caught before the Number() — it is truthy, so it
  // would otherwise be compared as if the wine were vintage 1000.
  const isNonVintage = vintageStr === '0000' || vintageStr === '1000';
  const vintage = isNonVintage ? null : Number(vintageStr) || null;

  // Underscores first — `Latour_1993` is one word to the vintage strip and the
  // term split, so the term would be "latour_1993" and match no stock.
  const baseKey = name
    .replace(/_/g, ' ')
    .replace(/\(\s*(?:single bottle|\d+\s*(?:x|pack|packs|bottles?|btl))\s*\)/gi, ' ')
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,\s]+$/, '')
    .trim();

  const conditions = [];
  // Any wine code, not just a 7-digit LWIN — stock received under a supplier
  // code (e.g. `W12008024-2021-06-00750`) is the same wine in the same bay.
  if (lwin7.length >= 3 && vintageStr && parts.length === 4) {
    conditions.push(like(wmsStock.lwin18, `${lwin7}-${vintageStr}-%`));
  }
  // Match on individual name terms (not one contiguous substring) so word-order
  // and trailing punctuation differences — e.g. a stray "-" left by the "- 2022"
  // vintage suffix — don't drop the match. Mirrors the release-to-pick matcher.
  // This is the fallback when the order SKU's LWIN doesn't match the stock LWIN.
  const nameTerms = baseKey
    .split(/[\s,\-]+/)
    .filter((term) => term.length > 2)
    .slice(0, 8);
  if (nameTerms.length > 0 && (vintage || isNonVintage)) {
    conditions.push(
      and(
        ...nameTerms.map((term) =>
          ilike(wmsStock.productName, `%${term.replace(/[^\x20-\x7E]/g, '%')}%`),
        ),
        vintage
          ? eq(wmsStock.vintage, vintage)
          : or(isNull(wmsStock.vintage), eq(wmsStock.vintage, 0)),
      ),
    );
  }
  if (conditions.length === 0) {
    return resolveRepackFromStock([], { name, sku, description, quantity, unit });
  }

  const rows = await db
    .select({
      lwin18: wmsStock.lwin18,
      productName: wmsStock.productName,
      vintage: wmsStock.vintage,
      caseConfig: wmsStock.caseConfig,
      quantityCases: wmsStock.quantityCases,
      availableCases: wmsStock.availableCases,
      locationCode: wmsLocations.locationCode,
    })
    .from(wmsStock)
    .leftJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
    .where(and(gt(wmsStock.quantityCases, 0), or(...conditions)));

  return resolveRepackFromStock(rows, { name, sku, description, quantity, unit });
};

export default resolveLineRepack;
