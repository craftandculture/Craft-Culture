export interface ChargeableStockRow {
  /** Sealed cases */
  quantityCases: number;
  /** Loose bottles from opened cases */
  openBottles: number;
  bottleSize: string | null;
}

/**
 * Cases a member is charged storage for, from what they hold
 *
 * A sealed case counts as one whatever it holds. Loose bottles are pooled and
 * every six count as a case, rounded up; a magnum counts as two bottles, and
 * larger formats by how many 75cl bottles they hold.
 *
 * @example
 *   countChargeableCases([{ quantityCases: 3, openBottles: 7, bottleSize: '750ml' }]); // 5
 *
 * @param rows - The member's stock rows
 * @returns Chargeable cases
 */
const countChargeableCases = (rows: ChargeableStockRow[]) => {
  let sealed = 0;
  let looseEquivalent = 0;

  for (const row of rows) {
    sealed += Math.max(0, row.quantityCases);
    const millilitres = Number.parseInt(row.bottleSize ?? '750', 10) || 750;
    looseEquivalent += Math.max(0, row.openBottles) * Math.max(1, Math.round(millilitres / 750));
  }

  return sealed + Math.ceil(looseEquivalent / 6);
};

export default countChargeableCases;
