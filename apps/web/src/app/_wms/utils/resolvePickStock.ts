import { and, eq, gt, ilike, like, or } from 'drizzle-orm';

import { wmsStock } from '@/database/schema';

interface ResolvePickStockParams {
  /** The ordered line's LWIN18 (dashed or raw); may be empty. */
  lwin18: string | null | undefined;
  /** The ordered line's product name, for the name fallback. */
  productName: string;
  /** Cases still needed for this line. */
  neededCases: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

interface StockRow {
  stockId: string;
  locationId: string | null;
  availableCases: number | null;
  quantityCases: number | null;
  openBottles?: number | null;
  caseConfig: number | null;
  lwin18: string;
}

/**
 * Resolve the best in-stock location for a pick-list line.
 *
 * Matches pack-agnostically by LWIN7 + vintage — the reliable wine identifier
 * that distinguishes lookalike names (e.g. "Talenti, Brunello di Montalcino"
 * from "Talenti, Piero, Brunello di Montalcino") — and requires physical stock
 * (quantity_cases > 0) so an empty pack is never suggested. Prefers the exact
 * ordered pack, then a pack with enough available, then the most stock. Falls
 * back to a strict name + vintage match ONLY when the LWIN yields nothing, and
 * refuses to guess when the name matches more than one distinct wine.
 *
 * @returns The chosen stock (with how it was matched), or null when nothing in
 *   stock matches.
 */
const resolvePickStock = async ({
  lwin18,
  productName,
  neededCases,
  db,
}: ResolvePickStockParams) => {
  const digits = String(lwin18 ?? '').replace(/\D/g, '');
  const lwin7 = digits.length >= 11 ? digits.slice(0, 7) : '';
  const vintageStr = digits.length >= 11 ? digits.slice(7, 11) : '';
  const orderedPack = digits.length === 18 ? Number(digits.slice(11, 13)) : 0;

  const select = {
    stockId: wmsStock.id,
    locationId: wmsStock.locationId,
    availableCases: wmsStock.availableCases,
    quantityCases: wmsStock.quantityCases,
    openBottles: wmsStock.openBottles,
    caseConfig: wmsStock.caseConfig,
    lwin18: wmsStock.lwin18,
  };

  // Rank in-stock rows: exact ordered pack first, then enough available, then
  // the most available. Never returns a zero-quantity row.
  const pick = (rows: StockRow[]) => {
    // Loose bottles from a cracked case are stock too — a single-bottle line
    // is filled from them without touching a sealed case.
    const inStock = rows.filter(
      (s) => (s.quantityCases ?? 0) > 0 || (s.openBottles ?? 0) > 0,
    );
    if (inStock.length === 0) return null;
    const exact =
      orderedPack > 0 ? inStock.filter((s) => s.caseConfig === orderedPack) : [];
    const pool = exact.length > 0 ? exact : inStock;
    return (
      pool.find((s) => (s.availableCases ?? 0) >= neededCases) ??
      [...pool].sort(
        (a, b) => (b.availableCases ?? 0) - (a.availableCases ?? 0),
      )[0]
    );
  };

  // Primary — LWIN7 + vintage, pack-agnostic, in stock.
  if (lwin7 && vintageStr) {
    const rows: StockRow[] = await db
      .select(select)
      .from(wmsStock)
      .where(
        and(
          like(wmsStock.lwin18, `${lwin7}-${vintageStr}-%`),
          or(gt(wmsStock.quantityCases, 0), gt(wmsStock.openBottles, 0)),
        ),
      );
    const best = pick(rows);
    if (best) {
      return {
        stockId: best.stockId,
        locationId: best.locationId,
        lwin18: best.lwin18,
        matchedBy: 'lwin' as const,
      };
    }
  }

  // Fallback — strict name + vintage, in stock. Only trusted when every match
  // shares one LWIN7, so a lookalike cuvée is never picked by accident.
  const terms = productName
    .replace(/\(single bottle\)/gi, '')
    .replace(/\(\d+x\)/gi, '')
    .replace(/\b(19|20)\d{2}\b/g, '')
    .split(/[\s,\-]+/)
    .filter((t) => t.length > 2)
    .slice(0, 8);
  const vintage = Number(vintageStr) || null;
  if (terms.length > 0 && vintage) {
    const rows: StockRow[] = await db
      .select(select)
      .from(wmsStock)
      .where(
        and(
          ...terms.map((t) => ilike(wmsStock.productName, `%${t}%`)),
          eq(wmsStock.vintage, vintage),
          or(gt(wmsStock.quantityCases, 0), gt(wmsStock.openBottles, 0)),
        ),
      );
    const distinctWines = new Set(
      rows.map((r) => r.lwin18.split('-')[0]).filter(Boolean),
    );
    if (distinctWines.size === 1) {
      const best = pick(rows);
      if (best) {
        return {
          stockId: best.stockId,
          locationId: best.locationId,
          lwin18: best.lwin18,
          matchedBy: 'name' as const,
        };
      }
    }
  }

  return null;
};

export default resolvePickStock;
