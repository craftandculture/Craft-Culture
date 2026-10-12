export interface MembershipTermsCard {
  membershipFeeAed: number;
  includedCases: number;
  extraCaseMonthlyAed: number;
}

/**
 * What a member pays for a month, from the cases they held
 *
 * One calculation for the rate editor's example, the member's "This month"
 * figure and the extra cases pushed to Zoho, so the three can never differ.
 *
 * @example
 *   monthlyMembershipCharge(26, { membershipFeeAed: 600, includedCases: 20, extraCaseMonthlyAed: 30 });
 *   // { extraCases: 6, extraAed: 180, totalAed: 780 }
 *
 * @param cases - Chargeable cases held in the month (the peak)
 * @param terms - The member's membership terms
 * @returns Cases over the allowance, their charge, and the month's total
 */
const monthlyMembershipCharge = (cases: number, terms: MembershipTermsCard) => {
  const extraCases = Math.max(0, Math.ceil(cases) - terms.includedCases);
  const extraAed = extraCases * terms.extraCaseMonthlyAed;

  return { extraCases, extraAed, totalAed: terms.membershipFeeAed + extraAed };
};

export default monthlyMembershipCharge;
