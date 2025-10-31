'use client';

import Badge from '@/app/_ui/components/Badge/Badge';
import type { Quote } from '@/database/schema';

export interface QuoteStatusBadgeProps {
  status: Quote['status'];
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Get the color role for a quote status
 *
 * @param status - The quote status
 * @returns The color role for the badge
 */
const getStatusColorRole = (
  status: Quote['status'],
): 'primary' | 'muted' | 'info' | 'brand' | 'success' | 'danger' | 'warning' => {
  switch (status) {
    case 'draft':
      return 'muted';
    case 'sent':
      return 'info';
    case 'buy_request_submitted':
      return 'warning';
    case 'under_cc_review':
      return 'warning';
    case 'revision_requested':
      return 'danger';
    case 'cc_confirmed':
      return 'success';
    case 'po_submitted':
      return 'brand';
    case 'po_confirmed':
      return 'success';
    case 'accepted':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'expired':
      return 'muted';
    default:
      return 'primary';
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
      return 'Buy Request Submitted';
    case 'under_cc_review':
      return 'Under C&C Review';
    case 'revision_requested':
      return 'Revision Requested';
    case 'cc_confirmed':
      return 'Confirmed by C&C';
    case 'po_submitted':
      return 'PO Submitted';
    case 'po_confirmed':
      return 'PO Confirmed';
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
 * Display a badge showing the current status of a quote
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
