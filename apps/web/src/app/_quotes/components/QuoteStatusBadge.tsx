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
    case 'po_confirmed':  // Complete, no action needed
      return 'muted';

    // Active workflow - use brand blue
    case 'buy_request_submitted':
    case 'under_cc_review':
    case 'cc_confirmed':
    case 'po_submitted':
    case 'accepted':
      return 'brand';

    // Needs attention - use warning amber (not alarming red)
    case 'revision_requested':
      return 'warning';

    default:
      return 'muted';
  }
};

/**
 * Get the display label for a quote status - simplified and clearer
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
 * Display a badge showing the current status of a quote with minimal, consistent colors
 *
 * REDESIGNED to eliminate "traffic light" effect:
 * - Reduced from 7 colors to just 3 (gray, blue, amber)
 * - Clearer, shorter labels
 * - Consistent visual language
 *
 * @example
 *   <QuoteStatusBadge status="under_cc_review" size="sm" />
 */
const QuoteStatusBadge = ({ status, size = 'md' }: QuoteStatusBadgeProps) => {
  return (
    <Badge colorRole={getStatusColorRole(status)} size={size}>
      {getStatusLabel(status)}
    </Badge>
  );
};

export default QuoteStatusBadge;
