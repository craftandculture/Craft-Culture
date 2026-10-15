import type { PrivateClientOrder } from '@/database/schema';

/** C&C's notes and its payment to the wine partner, never sent to a distributor */
export type DistributorHiddenField =
  | 'ccNotes'
  | 'partnerPaymentNotes'
  | 'partnerPaymentReference'
  | 'partnerPaymentProofUrl';

/** An order as a distributor receives it */
export type DistributorOrder = Omit<PrivateClientOrder, DistributorHiddenField>;

/**
 * An order as a distributor may see it
 *
 * C&C's internal notes and the details of C&C's payment to the wine partner
 * are between C&C and the partner. They are removed here before the order
 * leaves the server, so a distributor is never sent them at all.
 *
 * @example
 *   return distributorOrderView(row.order);
 *
 * @param order - An order row, or an object spread from one
 * @returns The same order without the C&C-only fields
 */
const distributorOrderView = <T extends Partial<PrivateClientOrder>>(order: T) => {
  const {
    ccNotes: _ccNotes,
    partnerPaymentNotes: _partnerPaymentNotes,
    partnerPaymentReference: _partnerPaymentReference,
    partnerPaymentProofUrl: _partnerPaymentProofUrl,
    ...visible
  } = order;

  return visible;
};

export default distributorOrderView;
