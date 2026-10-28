import type { OrderParty } from './resolveOrderParty';

export type OrderDocumentType =
  | 'partner_invoice'
  | 'partner_sales_order'
  | 'cc_invoice'
  | 'distributor_invoice'
  | 'payment_proof'
  | 'proof_of_delivery';

/**
 * Which of an order's documents each party may see
 *
 * - Staff: all of them.
 * - Partner: their invoice and sales order, the distributor's invoice (to pay),
 *   payment proofs and proof of delivery.
 * - Distributor: their own invoice, payment proofs and proof of delivery. Never
 *   the partner's invoice or sales order, which carry the partner's prices and
 *   so C&C's margin.
 *
 * @param party - The viewer's side of the order
 * @returns The document types they may see
 */
const visibleDocumentTypes = (party: OrderParty): OrderDocumentType[] => {
  if (party === 'staff') {
    return [
      'partner_invoice',
      'partner_sales_order',
      'cc_invoice',
      'distributor_invoice',
      'payment_proof',
      'proof_of_delivery',
    ];
  }

  if (party === 'partner') {
    return [
      'partner_invoice',
      'partner_sales_order',
      'distributor_invoice',
      'payment_proof',
      'proof_of_delivery',
    ];
  }

  return ['distributor_invoice', 'payment_proof', 'proof_of_delivery'];
};

export default visibleDocumentTypes;
