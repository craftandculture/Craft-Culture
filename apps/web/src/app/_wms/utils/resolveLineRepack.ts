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
  const packMatch = /^(\d+)\s*[x×]/i.exec(description ?? '');
  const orderedPack =
    packMatch && Number(packMatch[1]) > 0 ? Number(packMatch[1]) : 1;

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
  if (baseKey.length > 3 && vintage) {
    conditions.push(
      and(ilike(wmsStock.productName, `%${baseKey}%`), eq(wmsStock.vintage, vintage)),
    );
  }
  if (conditions.length === 0) {
    return { orderedPack, needsRepack: false, fromPack: null, hasStock: false };
  }

  const rows = await db
    .select({ caseConfig: wmsStock.caseConfig })
    .from(wmsStock)
    .where(and(gt(wmsStock.availableCases, 0), or(...conditions)));

  const configs = [
    ...new Set(
      rows
        .map((r: { caseConfig: number | null }) => r.caseConfig)
        .filter((c: number | null): c is number => c != null),
    ),
  ].sort((a, b) => a - b);

  if (configs.length === 0) {
    return { orderedPack, needsRepack: false, fromPack: null, hasStock: false };
  }
  if (configs.includes(orderedPack)) {
    return { orderedPack, needsRepack: false, fromPack: null, hasStock: true };
  }
  const larger = configs.filter((c) => c > orderedPack);
  const fromPack = larger.length > 0 ? Math.min(...larger) : Math.max(...configs);
  return { orderedPack, needsRepack: true, fromPack, hasStock: true };
};

export default resolveLineRepack;
