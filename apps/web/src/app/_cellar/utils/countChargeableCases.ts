import bottleMillilitres from './bottleMillilitres';

export interface ChargeableStockRow {
  /** Sealed cases */
  quantityCases: number;
  /** Loose bottles from opened cases */
  openBottles: number;
  bottleSize: string | null;
  /** Bottles per sealed case; unknown is treated as twelve */
  caseConfig: number | null;
}

/** A standard bottle, the unit everything is measured in */
const STANDARD_ML = 750;

/**
 * Case units a member is charged storage for, from what they hold
 *
 * Storage is priced the way the London trade prices it: by volume, in 6-bottle
 * and 12-bottle cases (4.5 and 9 litres). Everything is measured in standard
 * 75cl bottles — a magnum is two, an Imperial eight, a half bottle half — and
 * rounded up to the next six, which is the one rule the terms state (s.5):
 *
 * - Each sealed case is rounded up on its own: up to 6 bottles is half a unit,
 *   7 to 12 is one, 13 to 18 one and a half, and so on.
 * - Loose bottles are pooled and rounded up the same way.
 *
 * A 12-bottle case is therefore one case of the allowance and one extra-case
 * charge; a 6-bottle case is half of each.
 *
 * @example
 *   countChargeableCases([{ quantityCases: 2, openBottles: 0, bottleSize: '75cl', caseConfig: 12 }]); // 2
 *   countChargeableCases([{ quantityCases: 2, openBottles: 0, bottleSize: '75cl', caseConfig: 6 }]); // 1
 *
 * @param rows - The member's stock rows
 * @returns Case units, in halves
 */
const countChargeableCases = (rows: ChargeableStockRow[]) => {
  let units = 0;
  let looseBottles = 0;

  for (const row of rows) {
    const bottlesPerBottle = bottleMillilitres(row.bottleSize) / STANDARD_ML;
    const sealed = Math.max(0, row.quantityCases);

    if (sealed > 0) {
      // Rounded so 0.9333… x 6 is not read as just over 6
      const perCase = Math.round(Math.max(1, row.caseConfig ?? 12) * bottlesPerBottle * 1000) / 1000;
      units += sealed * Math.ceil(perCase / 6) * 0.5;
    }

    looseBottles += Math.max(0, row.openBottles) * bottlesPerBottle;
  }

  const loose = Math.round(looseBottles * 1000) / 1000;

  return units + Math.ceil(loose / 6) * 0.5;
};

export default countChargeableCases;
