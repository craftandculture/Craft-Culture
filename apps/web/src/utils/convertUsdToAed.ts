/**
 * Convert USD amount to AED using fixed exchange rate
 *
 * @example
 *   convertUsdToAed(100); // returns 367
 *
 * @param usdAmount - The amount in USD to convert
 * @returns The amount in AED
 */
const convertUsdToAed = (usdAmount: number) => {
  const USD_TO_AED_RATE = 3.67;
  return usdAmount * USD_TO_AED_RATE;
};

export default convertUsdToAed;
