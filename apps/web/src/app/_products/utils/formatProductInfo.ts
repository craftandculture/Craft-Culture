/**
 * Calculate price per bottle from case price
 *
 * @param casePrice - Price for the entire case
 * @param unitCount - Number of bottles in the case
 * @returns Price per bottle
 */
const calculatePricePerBottle = (casePrice: number, unitCount: number) => {
  if (unitCount === 0) return 0;
  return casePrice / unitCount;
};

export default calculatePricePerBottle;
