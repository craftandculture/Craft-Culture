/**
 * Convert an import line quantity to bottles, the canonical triangulation unit
 *
 * Packing lists and Zoho invoices are denominated in cases, City Drinks sales
 * sheets in bottles. Everything is stored as bottles so the five inputs can be
 * summed against each other.
 *
 * @example
 *   toBottles(2, 'case', 6); // returns 12
 *
 * @param quantity - The quantity as stated in the source file
 * @param unit - Whether that quantity is in bottles or cases
 * @param caseConfig - Bottles per case, used only when unit is 'case'
 * @returns The quantity expressed in bottles
 */
const toBottles = (
  quantity: number,
  unit: 'bottle' | 'case',
  caseConfig: number | null | undefined,
) => {
  if (unit === 'bottle') {
    return quantity;
  }

  // A case with no stated pack size would silently zero the line, so fall back
  // to the 6-pack that dominates the Crurated range.
  const packSize = caseConfig && caseConfig > 0 ? caseConfig : 6;

  return quantity * packSize;
};

export default toBottles;
