'use client';

import Badge from '@/app/_ui/components/Badge/Badge';
import type { Quote } from '@/database/schema';

export interface QuoteStatusBadgeProps {
  status: Quote['status'];
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Get the color role for a quote status using MINIMAL color palette
 *
 * Design Philosophy:
 * - Gray (muted) = Inactive/informational states
 * - Blue (brand) = Active workflow states
 * - Amber (warning) = Needs attention (not alarming)
 * - NO green/red traffic lights
 *
 * @param status - The quote status
 * @returns The color role for the badge
 */
const getStatusColorRole = (
  status: Quote['status'],
): 'primary' | 'muted' | 'brand' | 'warning' => {
  switch (status) {
    // Inactive states - use muted gray
    case 'draft':
    case 'sent':
    case 'rejected':
    case 'expired':
    case 'po_confirmed':
    case 'delivered':
      return 'muted';

    // Active workflow - use brand blue
    case 'buy_request_submitted':
    case 'under_cc_review':
    case 'cc_confirmed':
    case 'po_submitted':
    case 'accepted':
    case 'paid':
      return 'brand';

    // Needs attention - use warning amber
    case 'revision_requested':
    case 'awaiting_payment':
      return 'warning';

    default:
      return 'muted';
  }
};

/**
 * Get the display label for a quote status (compact version)
 *
 * @param status - The quote status
 * @returns The human-readable label
 */
const getStatusLabel = (status: Quote['status']) => {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'sent':
      return 'Ready';
    case 'buy_request_submitted':
      return 'Pending';
    case 'under_cc_review':
      return 'Reviewing';
    case 'revision_requested':
      return 'Attention';
    case 'cc_confirmed':
      return 'Confirmed';
    case 'awaiting_payment':
      return 'Pay Now';
    case 'paid':
      return 'Paid';
    case 'po_submitted':
      return 'Processing';
    case 'po_confirmed':
      return 'Shipping';
    case 'delivered':
      return 'Delivered';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Rejected';
    case 'expired':
      return 'Expired';
    default:
      return status;
  }
};

/**
 * Get a descriptive subtitle for the status
 */
export const getStatusDescription = (status: Quote['status']): string => {
  switch (status) {
    case 'draft':
      return 'Not yet submitted';
    case 'sent':
      return 'Ready to submit';
    case 'buy_request_submitted':
      return 'C&C is reviewing your order';
    case 'under_cc_review':
      return 'Being processed by our team';
    case 'revision_requested':
      return 'Please review and resubmit';
    case 'cc_confirmed':
      return 'Submit your PO to proceed';
    case 'awaiting_payment':
      return 'Complete payment to proceed';
    case 'paid':
      return 'Preparing your order';
    case 'po_submitted':
      return 'Confirming with supplier';
    case 'po_confirmed':
      return 'On its way to you';
    case 'delivered':
      return 'Order complete';
    default:
      return '';
  }
};

/**
 * Check if a status requires user action
 *
 * @param status - The quote status
 * @returns Whether the status needs action
 */
export const statusNeedsAction = (status: Quote['status']): boolean => {
  return (
    status === 'draft' ||
    status === 'sent' ||
    status === 'revision_requested' ||
    status === 'cc_confirmed' ||
    status === 'awaiting_payment'
  );
};

/**
 * Display a badge showing the current status of a quote
 *
 * Design: Minimal color palette (gray, blue, amber)
 * - Gray = inactive/complete
 * - Blue = active workflow
 * - Amber = needs attention
 *
 * @example
 *   <QuoteStatusBadge status="under_cc_review" size="xs" />
 */
const QuoteStatusBadge = ({
  status,
  size = 'md',
}: QuoteStatusBadgeProps) => {
  return (
    <Badge colorRole={getStatusColorRole(status)} size={size} className="whitespace-nowrap">
      {getStatusLabel(status)}
    </Badge>
  );
};

export default QuoteStatusBadge;
