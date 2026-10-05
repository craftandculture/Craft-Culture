import { describe, expect, it } from 'vitest';

import { addMonths, bondStatus, daysBetween } from './bondStatus';

const blank = { paidOn: null, arrivedOn: null, stampedOn: null, claimSubmittedOn: null, refundedOn: null };

describe('addMonths', () => {
  it('adds calendar months', () => expect(addMonths('2026-10-05', 3)).toBe('2027-01-05'));
  it('keeps to the end of a shorter month', () => expect(addMonths('2026-11-30', 3)).toBe('2027-02-28'));
});

describe('daysBetween', () => {
  it('counts forwards and backwards', () => {
    expect(daysBetween('2026-10-05', '2026-10-12')).toBe(7);
    expect(daysBetween('2026-10-12', '2026-10-05')).toBe(-7);
  });
});

describe('bondStatus', () => {
  it('runs the deadline three months from payment', () => {
    const s = bondStatus({ ...blank, paidOn: '2026-10-05' }, '2026-10-05');
    expect(s).toMatchObject({ step: 'in_transit', deadline: '2027-01-05', daysLeft: 92, outstanding: true, dueSoon: false });
  });

  it('flags a claim due within 30 days', () => {
    const s = bondStatus({ ...blank, paidOn: '2026-10-05', arrivedOn: '2026-10-07' }, '2026-12-20');
    expect(s).toMatchObject({ step: 'awaiting_stamp', daysLeft: 16, dueSoon: true, overdue: false });
  });

  it('flags a missed deadline until the claim is in', () => {
    const late = bondStatus({ ...blank, paidOn: '2026-10-05', stampedOn: '2026-10-20' }, '2027-01-06');
    expect(late).toMatchObject({ step: 'ready_to_claim', overdue: true });

    const claimed = bondStatus({ ...blank, paidOn: '2026-10-05', claimSubmittedOn: '2027-01-02' }, '2027-01-06');
    expect(claimed).toMatchObject({ step: 'claimed', overdue: false, outstanding: true });
  });

  it('owes nothing once refunded', () => {
    const s = bondStatus({ ...blank, paidOn: '2026-10-05', refundedOn: '2026-12-01' }, '2027-02-01');
    expect(s).toMatchObject({ step: 'refunded', outstanding: false, overdue: false });
  });
});
