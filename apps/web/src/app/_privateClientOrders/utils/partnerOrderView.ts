import type { PrivateClientOrder } from '@/database/schema';

/**
 * Never sent to a partner: the figures between the partner's price and the
 * client's, and the notes C&C and the distributor keep for themselves
 */
export type PartnerHiddenField =
  | 'subtotalUsd'
  | 'dutyUsd'
  | 'vatUsd'
  | 'logisticsUsd'
  | 'ccNotes'
  | 'distributorNotes'
  | 'distributorVerificationNotes';

/** An order as a wine partner receives it */
export type PartnerOrder = Omit<PrivateClientOrder, PartnerHiddenField>;

/**
 * An order as a wine partner may see it
 *
 * A partner sees two figures: what their wine costs C&C (their own prices on
 * the lines) and what their client pays (the total). Everything in between —
 * landed duty-free, import duty, transfer and VAT — is C&C's and the
 * distributor's, and is removed here before the order leaves the server, so
 * it is not merely hidden on the page but never sent to a partner at all. So
 * are C&C's and the distributor's own notes on the order.
 *
 * @example
 *   return partnerOrderView(updatedOrder);
 *
 * @param order - An order row, or an object spread from one
 * @returns The same order without the price breakdown
 */
const partnerOrderView = <T extends Partial<PrivateClientOrder>>(order: T) => {
  const {
    subtotalUsd: _landedDutyFree,
    dutyUsd: _duty,
    vatUsd: _vat,
    logisticsUsd: _transfer,
    ccNotes: _ccNotes,
    distributorNotes: _distributorNotes,
    distributorVerificationNotes: _verificationNotes,
    ...visible
  } = order;

  return visible;
};

export default partnerOrderView;
