import { and, eq, gt, ilike, like, or } from 'drizzle-orm';

import { wmsStock } from '@/database/schema';

import normalizeLwin18 from './normalizeLwin18';

interface RepackParams {
  name: string;
  sku: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/**
 * Resolve how a single-bottle order line should be picked from live stock.
 *
 * A single bottle is pulled loose if any loose stock (case config = 1) is
 * available; otherwise the smallest available pack must be broken (repack).
 * The wine's own "description" pack is NOT used — it's unreliable — the actual
 * `wms_stock` case config is. Matches stock by LWIN (pack-agnostic) OR by
 * product name + vintage, to also catch pre-repacked sub-packs.
 *
 * @example
 *   await resolveSingleBottleRepack({ name: 'Duroche ... (Single Bottle)', sku: '1258617-2023-01-00750', db });
 *   // -> { looseAvailable: false, fromPack: 6, configs: [6] }  (break a 6-pack)
 *
 * @param name - The line item name
 * @param sku - The line item SKU (LWIN-based)
 * @param db - Drizzle db handle
 * @returns Whether loose stock exists, the pack to break if not, and all
 *   available case configs
 */
const resolveSingleBottleRepack = async ({ name, sku, db }: RepackParams) => {
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
    return { looseAvailable: false, fromPack: null, configs: [] as number[] };
  }

  const rows = await db
    .select({
      caseConfig: wmsStock.caseConfig,
      available: wmsStock.availableCases,
    })
    .from(wmsStock)
    .where(and(gt(wmsStock.availableCases, 0), or(...conditions)));

  const configs = [
    ...new Set(
      rows
        .map((r: { caseConfig: number | null }) => r.caseConfig)
        .filter((c: number | null): c is number => c != null),
    ),
  ].sort((a, b) => a - b);

  const looseAvailable = configs.includes(1);
  const fromPack = looseAvailable
    ? null
    : configs.length > 0
      ? Math.min(...configs)
      : null;

  return { looseAvailable, fromPack, configs };
};

export default resolveSingleBottleRepack;
