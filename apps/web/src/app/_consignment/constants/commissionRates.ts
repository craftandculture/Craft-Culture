/**
 * What C&C keeps when it sells a member's wine
 *
 * The rate depends on who buys, not on who is selling — so it cannot be frozen
 * onto a mandate when the member offers. It is resolved at the moment a sale
 * happens and written onto the sale, which is the record that has to stay
 * explicable years later.
 *
 * @example
 *   commissionPctFor('collector'); // 2.5
 */
export const COMMISSION_RATES = {
  /** A sale to another private collector — usually a book transfer in bond */
  collector: 2.5,
  /** Trade buyers and PCO orders */
  trade: 5,
} as const;

export type CommissionAudience = keyof typeof COMMISSION_RATES;

/**
 * The commission rate for a buyer, unless the mandate overrides it
 *
 * @param audience - Who is buying
 * @param overridePct - A rate agreed with this member for this mandate
 * @returns The percentage C&C keeps
 */
export const commissionPctFor = (
  audience: CommissionAudience,
  overridePct?: number | null,
) =>
  typeof overridePct === 'number' && overridePct >= 0
    ? overridePct
    : COMMISSION_RATES[audience];

export default COMMISSION_RATES;
