'use client';

import type { SourceRfq } from '@/database/schema';

interface RfqStatusBadgeProps {
  status: SourceRfq['status'];
}

/**
 * Status badge for SOURCE RFQs
 */
const RfqStatusBadge = ({ status }: RfqStatusBadgeProps) => {
  const styles: Record<SourceRfq['status'], { bg: string; text: string; label: string }> = {
    draft: {
      bg: 'bg-fill-muted',
      text: 'text-text-muted',
      label: 'Draft',
    },
    parsing: {
      bg: 'bg-fill-warning/10',
      text: 'text-text-warning',
      label: 'Parsing',
    },
    ready_to_send: {
      bg: 'bg-fill-brand/10',
      text: 'text-text-brand',
      label: 'Ready',
    },
    sent: {
      bg: 'bg-fill-info/10',
      text: 'text-text-info',
      label: 'Sent',
    },
    collecting: {
      bg: 'bg-fill-info/10',
      text: 'text-text-info',
      label: 'Collecting',
    },
    comparing: {
      bg: 'bg-fill-warning/10',
      text: 'text-text-warning',
      label: 'Comparing',
    },
    selecting: {
      bg: 'bg-fill-brand/10',
      text: 'text-text-brand',
      label: 'Selecting',
    },
    client_review: {
      bg: 'bg-fill-warning/10',
      text: 'text-text-warning',
      label: 'Client Review',
    },
    awaiting_confirmation: {
      bg: 'bg-fill-info/10',
      text: 'text-text-info',
      label: 'Awaiting Confirmation',
    },
    confirmed: {
      bg: 'bg-fill-success/10',
      text: 'text-text-success',
      label: 'Confirmed',
    },
    quote_generated: {
      bg: 'bg-fill-success/10',
      text: 'text-text-success',
      label: 'Quote Generated',
    },
    closed: {
      bg: 'bg-fill-muted',
      text: 'text-text-muted',
      label: 'Closed',
    },
    cancelled: {
      bg: 'bg-fill-danger/10',
      text: 'text-text-danger',
      label: 'Cancelled',
    },
  };

  const { bg, text, label } = styles[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bg} ${text}`}
    >
      {label}
    </span>
  );
};

export default RfqStatusBadge;
