/**
 * Inbound shipment statuses whose lines are no longer edited
 *
 * Receiving has started or the shipment is closed. A line added now would
 * never be received, or would be received against a count already taken.
 */
export const CLOSED_SHIPMENT_STATUSES = ['partially_received', 'delivered', 'cancelled'];
