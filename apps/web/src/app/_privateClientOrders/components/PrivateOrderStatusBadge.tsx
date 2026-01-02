'use client';

import Badge from '@/app/_ui/components/Badge/Badge';
import type { PrivateClientOrder } from '@/database/schema';


type OrderStatus = PrivateClientOrder['status'];

interface StatusConfig {
  label: string;
  colorRole: 'muted' | 'brand' | 'success' | 'warning' | 'danger';
}

const statusConfig: Record<OrderStatus, StatusConfig> = {
  draft: { label: 'Draft', colorRole: 'muted' },
  submitted: { label: 'Submitted', colorRole: 'brand' },
  under_cc_review: { label: 'Under Review', colorRole: 'brand' },
  revision_requested: { label: 'Revision Requested', colorRole: 'warning' },
  cc_approved: { label: 'Approved', colorRole: 'success' },
  awaiting_client_verification: { label: 'Awaiting Verification', colorRole: 'warning' },
  awaiting_client_payment: { label: 'Awaiting Payment', colorRole: 'warning' },
  client_paid: { label: 'Client Paid', colorRole: 'success' },
  awaiting_distributor_payment: { label: 'Awaiting Distributor', colorRole: 'warning' },
  distributor_paid: { label: 'Distributor Paid', colorRole: 'success' },
  awaiting_partner_payment: { label: 'Awaiting Partner', colorRole: 'warning' },
  partner_paid: { label: 'Partner Paid', colorRole: 'success' },
  stock_in_transit: { label: 'In Transit', colorRole: 'brand' },
  with_distributor: { label: 'With Distributor', colorRole: 'brand' },
  out_for_delivery: { label: 'Out for Delivery', colorRole: 'brand' },
  delivered: { label: 'Delivered', colorRole: 'success' },
  cancelled: { label: 'Cancelled', colorRole: 'danger' },
};

interface PrivateOrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Badge component displaying private client order status
 */
const PrivateOrderStatusBadge = ({ status, size }: PrivateOrderStatusBadgeProps) => {
  const config = statusConfig[status] ?? { label: status, colorRole: 'muted' as const };

  return (
    <Badge colorRole={config.colorRole} size={size}>
      {config.label}
    </Badge>
  );
};

export default PrivateOrderStatusBadge;
