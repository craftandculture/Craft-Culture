import { BOTTLES_PER_PACKAGE, REPACK_PACKAGE_AED } from '../constants/repackFee';

/**
 * Bottles in one outflow that did not leave in their original sealed case
 *
 * A whole sealed case (bottles = cases × pack) needs no repack. Bottles taken
 * from an opened case, or from single-bottle stock, all go in a package.
 *
 * @example
 *   looseBottlesOf({ lwin18: '1025396-2021-02-00750', quantityCases: 1, quantityBottles: 1 }); // 1
 *   looseBottlesOf({ lwin18: '1035926-2022-06-00750', quantityCases: 2, quantityBottles: 12 }); // 0
 *
 * @param outflow - The movement's code (its pack is the third segment), cases and bottles
 * @returns Loose bottles
 */
export const looseBottlesOf = (outflow: {
  lwin18: string;
  quantityCases: number;
  quantityBottles: number | null;
}) => {
  const pack = Number(outflow.lwin18.split('-')[2]) || 1;
  const cases = Math.abs(outflow.quantityCases);
  const bottles = Math.abs(outflow.quantityBottles ?? cases * pack);
  if (pack > 1 && bottles === cases * pack) return 0;
  return bottles;
};

/**
 * Packages built for one delivery, and what they cost
 *
 * @example
 *   repackCharge(5); // { packages: 1, aed: 25 }
 *   repackCharge(7); // { packages: 2, aed: 50 }
 *
 * @param looseBottles - Loose bottles going out together
 */
export const repackCharge = (looseBottles: number) => {
  const packages = Math.ceil(Math.max(0, looseBottles) / BOTTLES_PER_PACKAGE);
  return { packages, aed: packages * REPACK_PACKAGE_AED };
};
