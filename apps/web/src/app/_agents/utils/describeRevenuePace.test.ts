import { describe, expect, it } from 'vitest';

import describeRevenuePace from './describeRevenuePace';

/*
  The brief on 22 Oct 2026 read "Down 8.3% vs last month, concerning": it had
  set 22 days of October against all 31 of September, in what was close to a
  second record month. These cases pin the like-for-like comparison.
*/
describe('describeRevenuePace', () => {
  const now = new Date(2026, 9, 22);

  it('compares month-to-date with the same point last month', () => {
    const pace = describeRevenuePace({
      now,
      revenueThisMonth: 204_900,
      revenueLastMonthToDate: 160_000,
      revenueLastMonth: 223_500,
      bestMonthUsd: 223_500,
    });

    expect(pace.headline).toBe('+28% vs same point last month');
    expect(pace.detail).toBe("92% of last month's total, 9 days to go");
    expect(pace.isRecord).toBe(false);
  });

  it('calls a month that has passed the best one a record', () => {
    const pace = describeRevenuePace({
      now,
      revenueThisMonth: 230_000,
      revenueLastMonthToDate: 160_000,
      revenueLastMonth: 223_500,
      bestMonthUsd: 223_500,
    });

    expect(pace.headline).toBe('Record month');
    expect(pace.isRecord).toBe(true);
  });

  it('still reports a genuine slowdown at the same point', () => {
    const pace = describeRevenuePace({
      now,
      revenueThisMonth: 90_000,
      revenueLastMonthToDate: 120_000,
      revenueLastMonth: 223_500,
      bestMonthUsd: 223_500,
    });

    expect(pace.headline).toBe('-25% vs same point last month');
  });

  it('copes with no prior month', () => {
    const pace = describeRevenuePace({
      now: new Date(2026, 9, 31),
      revenueThisMonth: 50_000,
      revenueLastMonthToDate: 0,
      revenueLastMonth: 0,
      bestMonthUsd: null,
    });

    expect(pace.headline).toBe('No comparable month yet');
    expect(pace.detail).toBe('last day of the month');
    expect(pace.vsSamePointPct).toBeNull();
  });
});
