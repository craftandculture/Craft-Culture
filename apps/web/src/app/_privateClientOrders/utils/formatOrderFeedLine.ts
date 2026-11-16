import escapeSlackText from '@/lib/slack/escapeSlackText';

/** What the team needs to read about a status, in plain words */
export const ORDER_FEED_STATUS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted, waiting for C&C review',
  under_cc_review: 'Under C&C review',
  revision_requested: 'Sent back for changes',
  cc_approved: 'Approved by C&C',
  awaiting_partner_verification: 'Waiting for the partner to confirm the client',
  awaiting_distributor_verification: 'Waiting for the distributor to verify the client',
  verification_suspended: 'Client verification failed',
  awaiting_client_payment: 'Waiting for the client to pay',
  awaiting_payment_verification: 'Payment to be verified',
  client_paid: 'Client paid',
  awaiting_distributor_payment: 'Waiting for the distributor to pay C&C',
  distributor_paid: 'Distributor paid C&C',
  awaiting_partner_payment: 'Partner payment due',
  partner_paid: 'Partner paid',
  scheduling_delivery: 'Arranging the delivery',
  delivery_scheduled: 'Delivery booked',
  stock_in_transit: 'Stock in transit',
  with_distributor: 'With the distributor',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Events worth a line even when the status does not move */
const ACTION_TEXT: Record<string, string> = {
  distributor_assigned: 'Distributor assigned',
  delivery_scheduled: 'Delivery booked',
  order_cancelled: 'Cancelled',
  revision_requested: 'Sent back for changes',
  cc_paid_partner: 'C&C paid the partner',
  manual_invoice_recorded: 'Invoice recorded',
  stock_received_at_distributor: 'Stock received by the distributor',
};

export interface OrderFeedEvent {
  kind: 'created' | 'activity';
  action: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  orderNumber: string;
  clientName: string | null;
  partnerName: string | null;
  totalUsd: number | null;
  byName: string | null;
  scheduledDate: string | null;
  notes: string | null;
  url: string;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Dubai',
  });

/**
 * One #private-orders line for a PCO event, or null if it is not one the team follows
 *
 * A line leads with what happened, then the order, client and partner, so the
 * channel reads as a running list of where every order stands. Edits that do
 * not move an order (notes, prices, stock flags) are left out: a feed that
 * posts everything gets muted, and then nothing in it is seen.
 *
 * @example
 *   formatOrderFeedLine({ kind: 'activity', action: 'marked_delivered', newStatus: 'delivered', ... });
 *   // '*Delivered* · <url|PCO-2026-00111> · Michael Humphreys-Davies · by Laraine'
 *
 * @param event - The event and the order it belongs to
 * @returns Slack mrkdwn text, or null to skip
 */
const formatOrderFeedLine = (event: OrderFeedEvent) => {
  let headline: string | null = null;

  if (event.kind === 'created') {
    headline = `New order${event.newStatus && event.newStatus !== 'submitted' ? ` (${ORDER_FEED_STATUS[event.newStatus] ?? event.newStatus})` : ''}`;
  } else if (event.newStatus && event.newStatus !== event.previousStatus) {
    headline = ORDER_FEED_STATUS[event.newStatus] ?? event.newStatus.replace(/_/g, ' ');
  } else if (event.action && ACTION_TEXT[event.action]) {
    headline = ACTION_TEXT[event.action]!;
  }

  if (!headline) return null;

  if (event.scheduledDate && (event.action === 'delivery_scheduled' || event.newStatus === 'delivery_scheduled')) {
    headline += ` for ${day(event.scheduledDate)}`;
  }

  const parts = [
    `*${escapeSlackText(headline)}*`,
    `<${event.url}|${escapeSlackText(event.orderNumber)}>`,
    event.clientName ? escapeSlackText(event.clientName) : null,
    event.partnerName ? `via ${escapeSlackText(event.partnerName)}` : null,
    event.kind === 'created' && event.totalUsd
      ? `$${Math.round(event.totalUsd).toLocaleString('en-US')}`
      : null,
    event.byName ? `by ${escapeSlackText(event.byName.split(' ')[0]!)}` : null,
  ].filter(Boolean);

  const note =
    event.notes && (event.action === 'revision_requested' || event.action === 'order_cancelled')
      ? `\n> ${escapeSlackText(event.notes.trim().slice(0, 200))}`
      : '';

  return parts.join(' · ') + note;
};

export default formatOrderFeedLine;
