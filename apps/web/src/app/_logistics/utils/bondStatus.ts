/** Months C&C has, from paying the bond, to claim it back */
export const BOND_CLAIM_MONTHS = 3;

/** Days after arrival before the stamped paperwork is chased */
export const STAMP_CHASE_DAYS = 7;

/** Days after the claim before the refund is chased */
export const REFUND_CHASE_DAYS = 28;

/** Days before the deadline at which an unsubmitted claim is flagged */
export const CLAIM_WARNING_DAYS = [30, 14, 7] as const;

export interface BondDates {
  paidOn: string | null;
  arrivedOn: string | null;
  stampedOn: string | null;
  claimSubmittedOn: string | null;
  refundedOn: string | null;
}

export type BondStep = 'not_paid' | 'in_transit' | 'awaiting_stamp' | 'ready_to_claim' | 'claimed' | 'refunded';

const DAY = 86_400_000;

const toDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/**
 * Add whole months to a date, keeping to the last day of a shorter month
 *
 * @example
 *   addMonths('2026-11-30', 3); // '2027-02-28'
 */
export const addMonths = (iso: string, months: number) => {
  const y = +iso.slice(0, 4);
  const m = +iso.slice(5, 7) - 1 + months;
  const d = +iso.slice(8, 10);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
};

/** Whole days from `from` to `to`; negative when `to` is earlier */
export const daysBetween = (from: string, to: string) => Math.round((toDay(to) - toDay(from)) / DAY);

/**
 * Where a movement bond stands, and how long is left to claim it
 *
 * The deadline runs from the day the bond was paid. Once refunded, nothing is
 * outstanding however the dates fall.
 *
 * @example
 *   bondStatus({ paidOn: '2026-10-05', arrivedOn: null, ... }, '2026-10-20');
 *   // { step: 'in_transit', deadline: '2027-01-05', daysLeft: 77, outstanding: true, ... }
 *
 * @param bond - The bond's step dates
 * @param today - Today, as YYYY-MM-DD in Dubai
 */
export const bondStatus = (bond: BondDates, today: string) => {
  const deadline = bond.paidOn ? addMonths(bond.paidOn, BOND_CLAIM_MONTHS) : null;
  const daysLeft = deadline ? daysBetween(today, deadline) : null;

  let step: BondStep = 'not_paid';
  if (bond.refundedOn) step = 'refunded';
  else if (bond.claimSubmittedOn) step = 'claimed';
  else if (bond.stampedOn) step = 'ready_to_claim';
  else if (bond.arrivedOn) step = 'awaiting_stamp';
  else if (bond.paidOn) step = 'in_transit';

  const outstanding = step !== 'refunded' && step !== 'not_paid';
  // The deadline matters only until the claim is in
  const claimAtRisk = outstanding && step !== 'claimed' && daysLeft !== null;

  return {
    step,
    deadline,
    daysLeft,
    outstanding,
    overdue: claimAtRisk && daysLeft! < 0,
    dueSoon: claimAtRisk && daysLeft! >= 0 && daysLeft! <= CLAIM_WARNING_DAYS[0],
  };
};

export const BOND_STEP_LABEL: Record<BondStep, string> = {
  not_paid: 'Bond not paid',
  in_transit: 'Goods moving',
  awaiting_stamp: 'Awaiting stamped paperwork',
  ready_to_claim: 'Ready to claim',
  claimed: 'Claim submitted',
  refunded: 'Refunded',
};
