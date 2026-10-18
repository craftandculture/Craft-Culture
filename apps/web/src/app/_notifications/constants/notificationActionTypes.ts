import type { Notification } from '@/database/schema';

/**
 * Notification types that ask the reader to do something
 *
 * The rest only report that something happened. An unread notification of one
 * of these types is what "Needs action" shows and counts, and this list is the
 * one place that decides it: the server count, the server filter and the
 * drawer all read it.
 */
const notificationActionTypes: readonly Notification['type'][] = [
  'action_required',
  'new_user_pending',
  'buy_request_submitted',
  'revision_requested',
  'po_submitted',
  'po_received',
  'po_assigned',
  'payment_proof_submitted',
  'rfq_received',
  'rfq_deadline_reminder',
  'supplier_order_received',
  'supplier_order_reminder',
  'customer_po_received',
  'document_expired',
  'document_expiring_soon',
  'cellar_release_submitted',
  'cellar_release_quoted',
  'cellar_release_revision',
  'mandate_offered',
  'mandate_sent_back',
];

export default notificationActionTypes;
