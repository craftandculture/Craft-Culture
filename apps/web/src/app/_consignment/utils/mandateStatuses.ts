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

export type WithdrawableStatus = (typeof WITHDRAWABLE_STATUSES)[number];

export default WITHDRAWABLE_STATUSES;
