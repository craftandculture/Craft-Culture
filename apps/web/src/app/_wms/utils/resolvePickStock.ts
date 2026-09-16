import { and, eq, gt, ilike, isNull, like, or, sql } from 'drizzle-orm';

import { wmsStock } from '@/database/schema';

import normalizeLwin18 from './normalizeLwin18';

interface ResolvePickStockParams {
  /*
    A parcel the line must come from, when the order names one.

    Normally any stock of the same wine, vintage and size will satisfy a pick —
    one bottle we own is as good as another. It is not true of a cellar
    release: the member owns particular bottles, in a particular lot, and a
    neighbouring case is somebody else's wine. When this is set the matcher
    below is skipped entirely rather than consulted and overridden, because a
    "preference" that can be silently improved upon is not a constraint.
  */
  sourceStockId?: string | null;
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
 * When the line names a parcel, that parcel is returned and none of this
 * runs: a cellar release must come from the bottles its owner chose.
 *
 * @returns The chosen stock (with how it was matched), or null when nothing in
 *   stock matches.
 */
const resolvePickStock = async ({
  sourceStockId,
  lwin18,
  productName,
  neededCases,
  db,
}: ResolvePickStockParams) => {
  if (sourceStockId) {
    const [pinned] = await db
      .select({
        stockId: wmsStock.id,
        locationId: wmsStock.locationId,
        availableCases: wmsStock.availableCases,
        quantityCases: wmsStock.quantityCases,
        openBottles: wmsStock.openBottles,
        caseConfig: wmsStock.caseConfig,
        lwin18: wmsStock.lwin18,
      })
      .from(wmsStock)
      .where(eq(wmsStock.id, sourceStockId))
      .limit(1);

    /*
      Returned even when short. Substituting another parcel to make the
      quantity up would hand over wine the owner did not ask for, and a pick
      that comes up short is a conversation, not a thing to solve quietly.
    */
    if (pinned) return { ...pinned, matchedBy: 'pinned' as const };
  }

  /*
    Split the code on its dashes rather than stripping everything that is not a
    digit.

    Plenty of our codes are not numeric — Compass Box ships as
    ORCHARDHOU-0000-06-00700, and supplier W codes look the same. Stripping
    non-digits from that leaves 00000600700, which was then read as wine
    0000006 in vintage 0070: a wine that does not exist, so the lookup found
    nothing and the picker was told there was no location while Stock Explorer
    showed one plainly. Every alphanumeric code failed this way, and so did
    every NV line, whose 0000 vintage also disabled the name fallback below.
  */
  const code = normalizeLwin18(String(lwin18 ?? '').trim());
  const parts = code.split('-');
  const wineCode = parts.length === 4 ? (parts[0] ?? '') : '';
  const vintageStr = parts.length === 4 ? (parts[1] ?? '') : '';
  const orderedPack = parts.length === 4 ? Number(parts[2]) || 0 : 0;

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

  /*
    A code that is not an LWIN at all.

    Zoho items are supposed to carry the LWIN as their SKU, but plenty carry a
    house code instead — SOT-CAS-750-BTL-UAE-BLC against stock shelved as
    SOTCAS750B-0000-06-00700. It has six segments rather than four, so nothing
    below could parse it, and with no vintage to compare the name fallback was
    skipped too. The line arrived at the scanner with no bay and no explanation.

    Stock keeps the supplier's own reference, so try the code as given against
    both that and the LWIN before giving up on it.
  */
  const rawCode = String(lwin18 ?? '').trim();
  if (rawCode && parts.length !== 4) {
    const rows: StockRow[] = await db
      .select(select)
      .from(wmsStock)
      .where(
        and(
          or(
            eq(wmsStock.supplierSku, rawCode),
            eq(wmsStock.lwin18, rawCode),
          ),
          or(gt(wmsStock.quantityCases, 0), gt(wmsStock.openBottles, 0)),
        ),
      );
    const best = pick(rows);
    if (best) {
      return {
        stockId: best.stockId,
        locationId: best.locationId,
        lwin18: best.lwin18,
        caseConfig: best.caseConfig,
        matchedBy: 'supplierSku' as const,
      };
    }
  }

  // Primary — wine code + vintage, pack-agnostic, in stock.
  if (wineCode && vintageStr) {
    const rows: StockRow[] = await db
      .select(select)
      .from(wmsStock)
      .where(
        and(
          like(wmsStock.lwin18, `${wineCode}-${vintageStr}-%`),
          or(gt(wmsStock.quantityCases, 0), gt(wmsStock.openBottles, 0)),
        ),
      );
    const best = pick(rows);
    if (best) {
      return {
        stockId: best.stockId,
        locationId: best.locationId,
        lwin18: best.lwin18,
        // The pack the wine is shelved in — the caller needs it to tell a
        // whole-case pick from cracking a case for bottles.
        caseConfig: best.caseConfig,
        matchedBy: 'lwin' as const,
      };
    }
  }

  // Fallback — strict name + vintage, in stock. Only trusted when every match
  // shares one wine code, so a lookalike cuvée is never picked by accident.
  /*
    Match the producer and the product name together.

    A Zoho line names the wine the way a customer reads it — "Compass Box
    CRIMSON CASKS Blended Malt Scottish Whiskey" — while the shelf holds the
    producer in its own column and the name as "CRIMSON CASKS Blended Malt
    Scottish Whiskey". Requiring every word against product_name alone meant
    "Compass" and "Box" could never match, so an operator standing at the right
    bay with the bottle in hand was told there was no stock. Every producer-
    prefixed line failed this way.
  */
  const terms = productName
    .replace(/\(single bottle\)/gi, '')
    .replace(/\(\d+x\)/gi, '')
    .replace(/\b(19|20)\d{2}\b/g, '')
    .split(/[\s,\-]+/)
    .filter((t) => t.length > 2)
    .slice(0, 8);
  const vintage = Number(vintageStr) || null;
  /*
    NV is a vintage, not a missing one. Treating 0000 as absent skipped this
    fallback entirely for every non-vintage wine and spirit — the products most
    likely to need it, since their codes are the alphanumeric ones.
  */
  const isNonVintage = vintageStr === '0000';
  /*
    No vintage at all — a house SKU carries none. Matching on name alone is
    still safe here because of the single-wine guard below; refusing to try was
    what left these lines with no bay.
  */
  const hasNoVintage = vintageStr === '';
  if (terms.length > 0 && (vintage || isNonVintage || hasNoVintage)) {
    const rows: StockRow[] = await db
      .select(select)
      .from(wmsStock)
      .where(
        and(
          ...terms.map((t) =>
            ilike(
              sql`coalesce(${wmsStock.producer}, '') || ' ' || ${wmsStock.productName}`,
              `%${t}%`,
            ),
          ),
          ...(hasNoVintage
            ? []
            : [
                isNonVintage
                  ? or(isNull(wmsStock.vintage), eq(wmsStock.vintage, 0))
                  : eq(wmsStock.vintage, vintage as number),
              ]),
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
          caseConfig: best.caseConfig,
          matchedBy: 'name' as const,
        };
      }
    }
  }

  return null;
};

export default resolvePickStock;
