/**
 * While a member may still change their mind
 *
 * Wine that is offered or listed is still in bond with us, so withdrawing it
 * costs nothing and puts it straight back on hold. Once it is `placed` with a
 * distributor it is duty-paid and out of the building, and there is nothing to
 * withdraw it from — which is why the offer screen has to say so before the
 * member commits, not at the point we place it.
 */
export const WITHDRAWABLE_STATUSES = ['offered', 'listed'] as const;

/** Statuses where the wine is available to buy from the pool */
export const SELLABLE_STATUSES = [
  'listed',
  'placed',
  'partially_sold',
] as const;

/**
 * While a mandate still has a claim on the bottles it names
 *
 * Availability on a stock row does not fall when wine is offered — the bottles
 * are still there, still the member's, and nothing has moved. So a parcel that
 * is already spoken for looks entirely free to a second offer, and the same six
 * bottles can be offered twice, listed twice and sold twice.
 *
 * Anything reading availability for the purpose of committing bottles has to
 * subtract what these mandates already hold.
 *
 * `draft` is excluded deliberately: a sent-back offer has been refused and must
 * be re-made, so it holds nothing in the meantime.
 */
export const COMMITTING_STATUSES = [
  'offered',
  'listed',
  'placed',
  'partially_sold',
] as const;

export type WithdrawableStatus = (typeof WITHDRAWABLE_STATUSES)[number];

export default WITHDRAWABLE_STATUSES;
