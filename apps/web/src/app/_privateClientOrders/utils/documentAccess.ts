import type { OrderParty } from './resolveOrderParty';

export type PcoDocumentType =
  | 'partner_invoice'
  | 'partner_sales_order'
  | 'cc_invoice'
  | 'distributor_invoice'
  | 'payment_proof'
  | 'proof_of_delivery';

/**
 * Which documents each party may add to an order
 *
 * A document's type decides who sees it (a partner invoice is never shown to
 * the distributor, for one), so a party may only add the kinds that are theirs
 * to give: the partner their invoice and sales order, the distributor their
 * invoice and proof of delivery, either a payment proof. C&C's own invoice
 * comes from C&C.
 */
export const UPLOADABLE_DOCUMENT_TYPES: Record<
  OrderParty,
  readonly PcoDocumentType[]
> = {
  staff: [
    'partner_invoice',
    'partner_sales_order',
    'cc_invoice',
    'distributor_invoice',
    'payment_proof',
    'proof_of_delivery',
  ],
  partner: ['partner_invoice', 'partner_sales_order', 'payment_proof'],
  distributor: ['distributor_invoice', 'payment_proof', 'proof_of_delivery'],
};

/** Every status from C&C's approval on */
const AFTER_APPROVAL = [
  'cc_approved',
  'awaiting_partner_verification',
  'awaiting_distributor_verification',
  'verification_suspended',
  'awaiting_client_payment',
  'awaiting_payment_verification',
  'client_paid',
  'awaiting_distributor_payment',
  'distributor_paid',
  'awaiting_partner_payment',
  'partner_paid',
  'scheduling_delivery',
  'delivery_scheduled',
  'stock_in_transit',
  'with_distributor',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;

/**
 * From which order statuses a document can no longer be removed by the party
 * that added it. Once the order has moved on because of a document, taking it
 * away would leave the order resting on nothing. C&C can still remove any.
 */
const LOCKED_FROM: Record<PcoDocumentType, readonly string[]> = {
  // The partner's prices, and their sales order, are what C&C approved
  partner_invoice: AFTER_APPROVAL,
  partner_sales_order: AFTER_APPROVAL,
  cc_invoice: [],
  // The client was confirmed as paid against the distributor's invoice
  distributor_invoice: [
    'client_paid',
    'awaiting_distributor_payment',
    'distributor_paid',
    'awaiting_partner_payment',
    'partner_paid',
    'scheduling_delivery',
    'delivery_scheduled',
    'stock_in_transit',
    'with_distributor',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ],
  payment_proof: [
    'client_paid',
    'awaiting_distributor_payment',
    'distributor_paid',
    'awaiting_partner_payment',
    'partner_paid',
    'scheduling_delivery',
    'delivery_scheduled',
    'stock_in_transit',
    'with_distributor',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ],
  proof_of_delivery: ['delivered', 'cancelled'],
};

/**
 * Whether the party that added a document may still remove it
 *
 * @param documentType - The document's type
 * @param orderStatus - The order's status now
 * @returns False once the order has moved past the point the document mattered
 */
export const isDocumentDeletable = (
  documentType: string,
  orderStatus: string,
) =>
  !(LOCKED_FROM[documentType as PcoDocumentType] ?? []).includes(orderStatus);
