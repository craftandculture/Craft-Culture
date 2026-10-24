export interface LiveBayStock {
  stockId: string;
  locationId: string | null;
  locationCode: string | null;
  storageMethod: string | null;
  caseConfig: number | null;
  bottleSize: string | null;
  quantityCases: number;
  availableCases: number;
  openBottles: number;
  /** Cases on this row reserved for the order being picked */
  heldForThisOrder: number;
}

export interface LiveBayLine {
  suggestedLocationId: string | null;
  /** Bottles wanted, on a split-case line; null on a whole-case line */
  quantityBottles: number | null;
  quantityCases: number;
  /** The pack a whole-case line must come from; 0 when unknown */
  linePack: number;
}

/**
 * Pick the bay a line should be picked from, as the stock stands now
 *
 * A pick list fixes its bay when it is created. Over a run of fifteen orders
 * the early ones empty the small-pack bay, and every later list still sends the
 * picker there to be told it holds nothing, while the same wine sits in the
 * next aisle in bigger cases.
 *
 * The stored bay is kept while it can still cover the line, so a picker who has
 * already walked there is not redirected. Otherwise the bay is chosen from
 * those that can cover it on their own:
 *
 * 1. A shelf before a pallet
 * 2. The smallest pack, so the 6s are used up before the 12s are opened and loose
 *    bottles go before any sealed case is cracked
 * 3. The least stock, so the scraps left at the end of a run are drained rather
 *    than stranded
 *
 * Cases reserved for another order are not counted; cases reserved for this one
 * are, matching what the pick itself will accept.
 *
 * @example
 *   chooseLiveBay(line, rows); // { locationId: 'c-01', ..., moved: true }
 *
 * @param line - The unpicked pick-list line
 * @param rows - Every in-stock row of this wine, any pack, any bay
 * @returns The bay to send the picker to, or null when no bay can cover it
 */
const chooseLiveBay = (line: LiveBayLine, rows: LiveBayStock[]) => {
  const isBottleLine = line.quantityBottles != null;
  const need = isBottleLine ? (line.quantityBottles ?? 0) : line.quantityCases;

  const usableCases = (row: LiveBayStock) =>
    Math.max(
      0,
      Math.min(row.quantityCases, row.availableCases + row.heldForThisOrder),
    );

  const fits = (row: LiveBayStock) =>
    isBottleLine ||
    line.linePack === 0 ||
    (row.caseConfig ?? 12) === line.linePack;

  const byBay = new Map<
    string,
    { capacity: number; smallestPack: number; rows: LiveBayStock[] }
  >();

  for (const row of rows) {
    if (!row.locationId || !fits(row)) continue;

    const pack = row.caseConfig ?? 12;
    const capacity = isBottleLine
      ? usableCases(row) * pack + row.openBottles
      : usableCases(row);

    if (capacity <= 0) continue;

    /* Loose bottles are the smallest pack there is. */
    const effectivePack = isBottleLine && row.openBottles > 0 ? 0 : pack;
    const bay = byBay.get(row.locationId) ?? {
      capacity: 0,
      smallestPack: Number.POSITIVE_INFINITY,
      rows: [],
    };

    bay.capacity += capacity;
    bay.smallestPack = Math.min(bay.smallestPack, effectivePack);
    bay.rows.push(row);
    byBay.set(row.locationId, bay);
  }

  const stored = line.suggestedLocationId
    ? byBay.get(line.suggestedLocationId)
    : undefined;

  if (stored && stored.capacity >= need) return null;

  const onPallet = (bay: { rows: LiveBayStock[] }) =>
    bay.rows.every((row) => row.storageMethod === 'pallet') ? 1 : 0;

  const [best] = [...byBay.values()]
    .filter((bay) => bay.capacity >= need)
    .sort(
      (a, b) =>
        onPallet(a) - onPallet(b) ||
        a.smallestPack - b.smallestPack ||
        a.capacity - b.capacity,
    );

  if (!best) return null;

  /* The row the badge describes: the smallest pack in that bay. */
  const [row] = [...best.rows].sort(
    (a, b) =>
      (isBottleLine && b.openBottles > 0 ? 1 : 0) -
        (isBottleLine && a.openBottles > 0 ? 1 : 0) ||
      (a.caseConfig ?? 12) - (b.caseConfig ?? 12),
  );

  if (!row?.locationId) return null;

  return {
    locationId: row.locationId,
    locationCode: row.locationCode,
    stockId: row.stockId,
    caseConfig: row.caseConfig,
    bottleSize: row.bottleSize,
  };
};

export default chooseLiveBay;
