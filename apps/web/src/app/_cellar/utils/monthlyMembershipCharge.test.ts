import { describe, expect, it } from 'vitest';

import monthlyMembershipCharge from './monthlyMembershipCharge';

const terms = { membershipFeeAed: 600, includedCases: 20, extraCaseMonthlyAed: 30 };

describe('monthlyMembershipCharge', () => {
  it('charges only the fee within the allowance', () => {
    expect(monthlyMembershipCharge(20, terms)).toEqual({ extraCases: 0, extraAed: 0, totalAed: 600 });
  });

  it('charges each case over the allowance', () => {
    expect(monthlyMembershipCharge(26, terms)).toEqual({ extraCases: 6, extraAed: 180, totalAed: 780 });
  });

  it('rounds part cases up', () => {
    expect(monthlyMembershipCharge(20.2, terms).extraCases).toBe(1);
  });

  it('charges the fee for an empty cellar', () => {
    expect(monthlyMembershipCharge(0, terms).totalAed).toBe(600);
  });
});
