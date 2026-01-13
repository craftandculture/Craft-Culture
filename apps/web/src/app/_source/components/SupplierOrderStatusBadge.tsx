'use client';

import Badge from '@/app/_ui/components/Badge/Badge';
import type { sourceSupplierOrderStatus } from '@/database/schema';

type SupplierOrderStatus = (typeof sourceSupplierOrderStatus.enumValues)[number];

interface SupplierOrderStatusBadgeProps {
  status: SupplierOrderStatus;
}

const statusConfig: Record<
  SupplierOrderStatus,
  { label: string; colorRole: 'success' | 'warning' | 'danger' | 'primary' | 'brand' }
> = {
  draft: { label: 'Draft', colorRole: 'primary' },
  sent: { label: 'Sent', colorRole: 'brand' },
  pending_confirmation: { label: 'Pending', colorRole: 'warning' },
  confirmed: { label: 'Confirmed', colorRole: 'success' },
  partial: { label: 'Partial', colorRole: 'warning' },
  rejected: { label: 'Rejected', colorRole: 'danger' },
  shipped: { label: 'Shipped', colorRole: 'success' },
  delivered: { label: 'Delivered', colorRole: 'success' },
  cancelled: { label: 'Cancelled', colorRole: 'danger' },
};

/**
 * Badge component for Supplier Order status
 */
const SupplierOrderStatusBadge = ({ status }: SupplierOrderStatusBadgeProps) => {
  const config = statusConfig[status] || { label: status, colorRole: 'primary' as const };

  return (
    <Badge size="sm" colorRole={config.colorRole}>
      {config.label}
    </Badge>
  );
};

export default SupplierOrderStatusBadge;
