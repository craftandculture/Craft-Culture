import type { PrivateClientOrder } from '@/database/schema';

/** The figures between the partner's price and the client's, never sent to a partner */
export type PartnerHiddenField = 'subtotalUsd' | 'dutyUsd' | 'vatUsd' | 'logisticsUsd';

/** An order as a wine partner receives it */
export type PartnerOrder = Omit<PrivateClientOrder, PartnerHiddenField>;

/**
 * An order as a wine partner may see it
 *
 * A partner sees two figures: what their wine costs C&C (their own prices on
 * the lines) and what their client pays (the total). Everything in between —
 * landed duty-free, import duty, transfer and VAT — is C&C's and the
 * distributor's, and is removed here before the order leaves the server, so
 * it is not merely hidden on the page but never sent to a partner at all.
 *
 * @example
 *   return partnerOrderView(updatedOrder);
 *
 * @param order - An order row, or an object spread from one
 * @returns The same order without the price breakdown
 */
const partnerOrderView = <T extends Partial<PrivateClientOrder>>(order: T) => {
  const { subtotalUsd: _landedDutyFree, dutyUsd: _duty, vatUsd: _vat, logisticsUsd: _transfer, ...visible } = order;

  return visible;
};

export default partnerOrderView;
