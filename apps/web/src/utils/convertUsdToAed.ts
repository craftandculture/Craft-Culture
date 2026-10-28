import USD_TO_AED from '@/lib/currency/usdToAed';

/**
 * Convert USD amount to AED at the dirham's fixed peg (3.6725)
 *
 * @example
 *   convertUsdToAed(100); // returns 367.25
 *
 * @param usdAmount - The amount in USD to convert
 * @returns The amount in AED
 */
const convertUsdToAed = (usdAmount: number) => {
  return usdAmount * USD_TO_AED;
};

export default convertUsdToAed;
