export interface HeldShare {
  quantityCases: number;
  /** Bottles the hold is for; null means its cases in full */
  quantityBottles: number | null;
}

const bottlesFor = (hold: HeldShare, pack: number) => hold.quantityBottles ?? hold.quantityCases * pack;

/**
 * Bottles already held on a stock row that no order is using
 *
 * A by-the-bottle line holds a whole case, so the rest of that case is spare
 * and the next bottle order of the same wine shares it instead of holding a
 * second case. Clos des Carmes went out to a subscription club one bottle per
 * box, and each box held a full case.
 *
 * @example
 *   spareHeldBottles([{ quantityCases: 1, quantityBottles: 1 }], 6); // 5
 */
export const spareHeldBottles = (holds: HeldShare[], pack: number) =>
  Math.max(
    holds.reduce((sum, h) => sum + h.quantityCases * pack - bottlesFor(h, pack), 0),
    0,
  );

/**
 * Of a released hold's cases, how many must stay held for the orders sharing them
 *
 * The holds still active after the release need their bottles covered by held
 * cases. When the released hold carried the case others were sharing, that
 * case is kept back rather than offered for sale.
 *
 * @example
 *   // A held the case and is released; B shares it for one bottle
 *   casesToKeepOnRelease([{ quantityCases: 0, quantityBottles: 1 }], 6, 1); // 1
 *
 * @param stillActive - The row's holds after the release
 * @param pack - Bottles per case on the row
 * @param cases - The released hold's cases
 */
export const casesToKeepOnRelease = (stillActive: HeldShare[], pack: number, cases: number) => {
  const shortfall = stillActive.reduce((sum, h) => sum + bottlesFor(h, pack) - h.quantityCases * pack, 0);

  return Math.min(Math.max(Math.ceil(shortfall / pack), 0), cases);
};
