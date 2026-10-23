/**
 * Convert a duty-free (in-bond) price to its duty-paid equivalent, so it can
 * be benchmarked against competitor lists, which are all quoted duty paid.
 * Uses the house benchmark of duty free + 15%.
 *
 * @example
 *   toDutyPaidPrice(200); // returns 230
 *
 * @param dutyFreePrice - Our duty-free price, in any currency
 * @returns The duty-paid equivalent in the same currency, to 2 decimals
 */
const toDutyPaidPrice = (dutyFreePrice: number) => {
  const DUTY_PAID_UPLIFT = 1.15;
  return Math.round(dutyFreePrice * DUTY_PAID_UPLIFT * 100) / 100;
};

export default toDutyPaidPrice;
