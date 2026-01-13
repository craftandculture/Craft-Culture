'use client';

import Badge from '@/app/_ui/components/Badge/Badge';
import type { sourceCustomerPoStatus } from '@/database/schema';

type CustomerPoStatus = (typeof sourceCustomerPoStatus.enumValues)[number];

interface CustomerPoStatusBadgeProps {
  status: CustomerPoStatus;
}

const statusConfig: Record<
  CustomerPoStatus,
  { label: string; colorRole: 'success' | 'warning' | 'danger' | 'primary' | 'brand' }
> = {
  draft: { label: 'Draft', colorRole: 'primary' },
  parsing: { label: 'Parsing', colorRole: 'primary' },
  matching: { label: 'Matching', colorRole: 'warning' },
  matched: { label: 'Matched', colorRole: 'brand' },
  reviewing: { label: 'Reviewing', colorRole: 'warning' },
  orders_generated: { label: 'Orders Generated', colorRole: 'brand' },
  awaiting_confirmations: { label: 'Awaiting Confirmations', colorRole: 'warning' },
  confirmed: { label: 'Confirmed', colorRole: 'success' },
  closed: { label: 'Closed', colorRole: 'success' },
  cancelled: { label: 'Cancelled', colorRole: 'danger' },
};

/**
 * Badge component for Customer PO status
 */
const CustomerPoStatusBadge = ({ status }: CustomerPoStatusBadgeProps) => {
  const config = statusConfig[status] || { label: status, colorRole: 'primary' as const };

  return (
    <Badge size="sm" colorRole={config.colorRole}>
      {config.label}
    </Badge>
  );
};

export default CustomerPoStatusBadge;
