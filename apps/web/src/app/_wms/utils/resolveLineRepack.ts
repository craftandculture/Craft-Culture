import { and, eq, gt, ilike, like, or } from 'drizzle-orm';

import { wmsStock } from '@/database/schema';

import normalizeLwin18 from './normalizeLwin18';

interface RepackParams {
  name: string;
  sku: string | null;
  description: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/**
 * Decide whether an order line needs a repack, and from which pack.
 *
 * Every line is `quantity` cases of its ordered pack format (from the line
 * `description`, e.g. "3x75cl" = a 3-bottle case). If the ordered pack is
 * already on the shelf in `wms_stock` no repack is needed; otherwise the
 * smallest larger available pack must be broken down to it (e.g. order a
 * 3×75cl, only a 6×75cl in stock → repack the 6-pack). Stock is matched by
 * LWIN (pack-agnostic) OR product name + vintage to catch pre-repacked packs.
 *
 * @example
 *   await resolveLineRepack({ name: 'Duroche ...', sku: '1258617-2023-01-00750', description: '3x75cl', db });
 *   // -> { orderedPack: 3, needsRepack: true, fromPack: 6, hasStock: true }
 *
 * @param name - The line item name
 * @param sku - The line item SKU (LWIN-based)
 * @param description - The line pack format, e.g. "3x75cl"
 * @param db - Drizzle db handle
 * @returns The ordered pack size, whether a repack is needed and from which pack
 */
const resolveLineRepack = async ({ name, sku, description, db }: RepackParams) => {
  // Ordered pack comes from the SKU (the source of truth): an LWIN18 carries the
  // pack in digits 12-13 (strip dashes first so a mis-dashed SKU still parses).
  // Fall back to the description ("6x75cl") only for non-LWIN SKUs, so a drifted
  // description can't misstate the pack.
  const skuDigits = String(sku ?? '').replace(/-/g, '');
  const skuPack = /^\d{18}$/.test(skuDigits) ? Number(skuDigits.slice(11, 13)) : 0;
  const packMatch = /^(\d+)\s*[x×]/i.exec(description ?? '');
  const descPack = packMatch && Number(packMatch[1]) > 0 ? Number(packMatch[1]) : 0;
  const orderedPack = skuPack > 0 ? skuPack : descPack > 0 ? descPack : 1;

  const normalized = normalizeLwin18(String(sku ?? ''));
  const parts = normalized.split('-');
  const lwin7 = parts[0] ?? '';
  const vintageStr = parts[1] ?? (name.match(/\b(19|20)\d{2}\b/)?.[0] ?? '');
  const vintage = Number(vintageStr) || null;

  const baseKey = name
    .replace(/\(single bottle\)/gi, '')
    .replace(/\(\d+x\)/gi, '')
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,\s]+$/, '')
    .trim();

  const conditions = [];
  if (/^\d{7}$/.test(lwin7) && vintageStr) {
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
  if (nameTerms.length > 0 && vintage) {
    conditions.push(
      and(
        ...nameTerms.map((term) => ilike(wmsStock.productName, `%${term}%`)),
        eq(wmsStock.vintage, vintage),
      ),
    );
  }
  if (conditions.length === 0) {
    return {
      orderedPack,
      needsRepack: false,
      fromPack: null,
      mode: null,
      sourceCount: 0,
      hasStock: false,
    };
  }

  // Gate on physical stock (quantityCases), NOT availableCases: a reserved
  // 6-pack is still a 6-pack that must be broken to fill a single. Using
  // availableCases made the repack flag vanish the moment the line's own stock
  // was reserved for the order.
  const rows = await db
    .select({ caseConfig: wmsStock.caseConfig })
    .from(wmsStock)
    .where(and(gt(wmsStock.quantityCases, 0), or(...conditions)));

  const configs: number[] = [
    ...new Set(
      (rows as { caseConfig: number | null }[])
        .map((r) => r.caseConfig)
        .filter((c): c is number => c != null),
    ),
  ].sort((a, b) => a - b);

  if (configs.length === 0) {
    return {
      orderedPack,
      needsRepack: false,
      fromPack: null,
      mode: null,
      sourceCount: 0,
      hasStock: false,
    };
  }
  if (configs.includes(orderedPack)) {
    return {
      orderedPack,
      needsRepack: false,
      fromPack: null,
      mode: null,
      sourceCount: 0,
      hasStock: true,
    };
  }
  const larger = configs.filter((c) => c > orderedPack);
  if (larger.length > 0) {
    // A larger pack on the shelf is broken DOWN (e.g. 6-pack → 3-pack).
    return {
      orderedPack,
      needsRepack: true,
      fromPack: Math.min(...larger),
      mode: 'break' as const,
      sourceCount: 1,
      hasStock: true,
    };
  }
  // Only smaller packs on the shelf → COMBINE them up to the ordered pack (e.g.
  // order a 6-pack, hold 3-packs → combine 2× 3-pack). You cannot break a
  // 3-pack into a 6, which is what the old "largest available" fallback implied.
  const fromPack = Math.max(...configs);
  return {
    orderedPack,
    needsRepack: true,
    fromPack,
    mode: 'combine' as const,
    sourceCount: Math.max(2, Math.ceil(orderedPack / fromPack)),
    hasStock: true,
  };
};

export default resolveLineRepack;
