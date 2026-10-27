import type { privateClientOrderStatus } from '@/database/schema';

type OrderStatus = (typeof privateClientOrderStatus.enumValues)[number];

/**
 * The status changes that follow the normal course of an order
 *
 * Each status lists the ones an order can move on to next, including the
 * optional steps a flow may skip (no verification for a distributor that does
 * not ask for it, payment that completes before delivery). Anything else —
 * going backwards, jumping several stages, reopening a delivered or cancelled
 * order — is a correction, which C&C can still make but only after confirming
 * it as such.
 */
const ROUTINE_NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: [
    'under_cc_review',
    'cc_approved',
    'revision_requested',
    'cancelled',
  ],
  under_cc_review: ['cc_approved', 'revision_requested', 'cancelled'],
  revision_requested: ['submitted', 'under_cc_review', 'cancelled'],
  cc_approved: [
    'awaiting_partner_verification',
    'awaiting_distributor_verification',
    'awaiting_client_payment',
    'cancelled',
  ],
  awaiting_partner_verification: [
    'awaiting_distributor_verification',
    'verification_suspended',
    'awaiting_client_payment',
    'cancelled',
  ],
  awaiting_distributor_verification: [
    'awaiting_client_payment',
    'verification_suspended',
    'cancelled',
  ],
  verification_suspended: [
    'awaiting_partner_verification',
    'awaiting_distributor_verification',
    'awaiting_client_payment',
    'cancelled',
  ],
  awaiting_client_payment: [
    'awaiting_payment_verification',
    'client_paid',
    'cancelled',
  ],
  awaiting_payment_verification: [
    'client_paid',
    'awaiting_client_payment',
    'cancelled',
  ],
  client_paid: [
    'awaiting_distributor_payment',
    'distributor_paid',
    'scheduling_delivery',
    'delivery_scheduled',
    'cancelled',
  ],
  awaiting_distributor_payment: [
    'distributor_paid',
    'scheduling_delivery',
    'delivery_scheduled',
    'cancelled',
  ],
  distributor_paid: [
    'awaiting_partner_payment',
    'partner_paid',
    'scheduling_delivery',
    'delivery_scheduled',
    'stock_in_transit',
    'with_distributor',
    'out_for_delivery',
  ],
  awaiting_partner_payment: [
    'partner_paid',
    'scheduling_delivery',
    'delivery_scheduled',
    'stock_in_transit',
    'with_distributor',
    'out_for_delivery',
  ],
  partner_paid: [
    'scheduling_delivery',
    'delivery_scheduled',
    'stock_in_transit',
    'with_distributor',
    'out_for_delivery',
  ],
  scheduling_delivery: [
    'delivery_scheduled',
    'stock_in_transit',
    'with_distributor',
    'cancelled',
  ],
  delivery_scheduled: [
    'scheduling_delivery',
    'stock_in_transit',
    'with_distributor',
    'out_for_delivery',
    'delivered',
  ],
  stock_in_transit: ['with_distributor', 'out_for_delivery', 'delivered'],
  with_distributor: [
    'scheduling_delivery',
    'delivery_scheduled',
    'out_for_delivery',
    'delivered',
  ],
  out_for_delivery: ['with_distributor', 'delivered'],
  delivered: [],
  cancelled: [],
};

/**
 * Whether moving an order from one status to another is a routine step
 *
 * @example
 *   isRoutinePcoTransition('submitted', 'cc_approved'); // true
 *   isRoutinePcoTransition('delivered', 'draft'); // false
 *
 * @param from - The order's status now
 * @param to - The status it would move to
 * @returns True when this is a normal next step, false for a correction
 */
const isRoutinePcoTransition = (from: string, to: string) =>
  from === to ||
  (ROUTINE_NEXT[from as OrderStatus] ?? []).includes(to as OrderStatus);

export default isRoutinePcoTransition;
