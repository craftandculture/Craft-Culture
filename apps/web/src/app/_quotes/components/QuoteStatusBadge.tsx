'use client';

import Badge from '@/app/_ui/components/Badge/Badge';
import type { Quote } from '@/database/schema';

export interface QuoteStatusBadgeProps {
  status: Quote['status'];
  size?: 'xs' | 'sm' | 'md';
  showActionIndicator?: boolean;
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
 * Get the display label for a quote status
 *
 * @param status - The quote status
 * @returns The human-readable label
 */
const getStatusLabel = (status: Quote['status']) => {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'sent':
      return 'Sent';
    case 'buy_request_submitted':
      return 'Pending Review';
    case 'under_cc_review':
      return 'In Review';
    case 'revision_requested':
      return 'Needs Attention';
    case 'cc_confirmed':
      return 'Confirmed';
    case 'awaiting_payment':
      return 'Awaiting Payment';
    case 'paid':
      return 'Paid';
    case 'po_submitted':
      return 'PO Submitted';
    case 'po_confirmed':
      return 'Complete';
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
 *   <QuoteStatusBadge status="under_cc_review" size="sm" showActionIndicator />
 */
const QuoteStatusBadge = ({
  status,
  size = 'md',
  showActionIndicator = false,
}: QuoteStatusBadgeProps) => {
  const needsAction = statusNeedsAction(status);

  return (
    <div className="flex items-center gap-2">
      <Badge colorRole={getStatusColorRole(status)} size={size}>
        {getStatusLabel(status)}
      </Badge>
      {showActionIndicator && needsAction && (
        <span
          className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500"
          title="Action required"
        />
      )}
    </div>
  );
};

export default QuoteStatusBadge;
