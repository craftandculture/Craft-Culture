/** The figures on a line that belong to its bottles, and so divide with them */
export interface SplittableAmounts {
  sourceTotal: number | null;
  declaredValueUsd: number | null;
  grossWeightKg: number | null;
  netWeightKg: number | null;
  freightAllocated: number | null;
  handlingAllocated: number | null;
  govFeesAllocated: number | null;
  insuranceAllocated: number | null;
  landedCostTotal: number | null;
}

const FIELDS = [
  'sourceTotal',
  'declaredValueUsd',
  'grossWeightKg',
  'netWeightKg',
  'freightAllocated',
  'handlingAllocated',
  'govFeesAllocated',
  'insuranceAllocated',
  'landedCostTotal',
] as const;

/**
 * Divide a line's totals between it and a second pack size of the same wine
 *
 * One document row, "3x6 + 1x3", is one billed total. Splitting it into two
 * lines must not change what the wine cost: the two totals add back to the
 * original to the cent, so the shipment's value and the document's agree
 * after the split as they did before. The share follows the bottles, so both
 * lines keep the same price per bottle.
 *
 * @example
 *   splitLineAmounts({ sourceTotal: 819, ... }, 18, 3);
 *   // keep.sourceTotal 702, add.sourceTotal 117
 *
 * @param amounts - The line's totals before the split
 * @param keepBottles - Bottles staying on the original line
 * @param addBottles - Bottles going to the new line
 * @returns The totals for the original line and for the new one
 */
const splitLineAmounts = (
  amounts: SplittableAmounts,
  keepBottles: number,
  addBottles: number,
) => {
  // Only these fields, never the whole row: a caller passes the full line,
  // and spreading its id into the new line would insert a duplicate key.
  const keep = {} as SplittableAmounts;
  const add = {} as SplittableAmounts;
  const all = keepBottles + addBottles;

  for (const field of FIELDS) {
    const value = amounts[field];

    if (value == null || all <= 0) {
      keep[field] = value;
      add[field] = null;
      continue;
    }

    const share = Math.round(((value * addBottles) / all) * 100) / 100;
    add[field] = share;
    keep[field] = Math.round((value - share) * 100) / 100;
  }

  return { keep, add };
};

export default splitLineAmounts;
