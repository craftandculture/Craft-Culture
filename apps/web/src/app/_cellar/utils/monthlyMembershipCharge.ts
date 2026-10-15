export interface MembershipTermsCard {
  membershipFeeAed: number;
  /** Allowance, in 12-bottle cases (a 6-bottle case uses half) */
  includedCases: number;
  /** Price of each 12-bottle case above the allowance; a 6-bottle case is half */
  extraCaseMonthlyAed: number;
}

/**
 * What a member pays for a month, from the case units they held
 *
 * One calculation for the rate editor's example, the member's "This month"
 * figure and the extra cases pushed to Zoho, so the three can never differ.
 * Units come from countChargeableCases: a 12-bottle case is one, a 6-bottle
 * case half, so at AED 8 a 6-bottle case above the allowance costs AED 4.
 *
 * @example
 *   monthlyMembershipCharge(40, { membershipFeeAed: 600, includedCases: 20, extraCaseMonthlyAed: 8 });
 *   // { extraCases: 20, extraAed: 160, totalAed: 760 }
 *
 * @param cases - Case units held in the month
 * @param terms - The member's membership terms
 * @returns Units over the allowance, their charge, and the month's total
 */
const monthlyMembershipCharge = (cases: number, terms: MembershipTermsCard) => {
  // Units come in halves; anything finer is rounded up to the next half
  const held = Math.ceil(Math.max(0, cases) * 2) / 2;
  const extraCases = Math.max(0, held - terms.includedCases);
  const extraAed = Math.round(extraCases * terms.extraCaseMonthlyAed * 100) / 100;

  return { extraCases, extraAed, totalAed: terms.membershipFeeAed + extraAed };
};

export default monthlyMembershipCharge;
