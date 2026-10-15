import { describe, expect, it } from 'vitest';

import monthlyMembershipCharge from './monthlyMembershipCharge';

const terms = { membershipFeeAed: 600, includedCases: 20, extraCaseMonthlyAed: 8 };

describe('monthlyMembershipCharge', () => {
  it('charges only the fee within the allowance', () => {
    expect(monthlyMembershipCharge(20, terms)).toEqual({ extraCases: 0, extraAed: 0, totalAed: 600 });
  });

  it('charges each 12-bottle case over the allowance', () => {
    expect(monthlyMembershipCharge(40, terms)).toEqual({ extraCases: 20, extraAed: 160, totalAed: 760 });
  });

  it('charges a 6-bottle case at half', () => {
    expect(monthlyMembershipCharge(20.5, terms)).toEqual({ extraCases: 0.5, extraAed: 4, totalAed: 604 });
  });

  it('rounds anything finer than a half up to the next half', () => {
    expect(monthlyMembershipCharge(20.2, terms).extraCases).toBe(0.5);
  });

  it('charges the fee for an empty cellar', () => {
    expect(monthlyMembershipCharge(0, terms).totalAed).toBe(600);
  });
});
