/**
 * The money amount of a Zoho discount, whatever shape Zoho sent it in.
 *
 * Zoho returns a flat discount as a number but a percentage as a STRING —
 * `"5.00%"` — on the same `discount` field. Written straight into a numeric
 * column, the string fails the insert and rolls back the whole order: the
 * four TBS orders of 28 Sep 2026 (SO-00150–00153, 5% on every line) never
 * reached the WMS and could not be picked. `discount_amount` carries the
 * money figure in both cases, so it wins when present.
 *
 * @example
 *   discountAmount('5.00%', 9.77); // 9.77
 *   discountAmount(12.5); // 12.5
 *   discountAmount('5.00%'); // null — a rate is not an amount
 */
const discountAmount = (
  discount: number | string | null | undefined,
  amount?: number | null,
) => {
  if (typeof amount === 'number' && Number.isFinite(amount)) return amount;
  if (typeof discount === 'number') {
    return Number.isFinite(discount) ? discount : null;
  }
  if (typeof discount === 'string' && !discount.includes('%')) {
    const parsed = Number(discount.trim());
    return discount.trim() !== '' && Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export default discountAmount;
