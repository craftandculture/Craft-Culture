'use client';

import {
  IconBox,
  IconCheck,
  IconClock,
  IconPackage,
  IconPlane,
  IconTruck,
} from '@tabler/icons-react';
import { type VariantProps, tv } from 'tailwind-variants';

import Icon from '@/app/_ui/components/Icon/Icon';

type StockStatus = 'pending' | 'confirmed' | 'at_cc_bonded' | 'in_transit_to_cc' | 'at_distributor' | 'delivered';
type StockSource = 'cc_inventory' | 'partner_airfreight' | 'partner_local' | 'manual';

const stockStatusBadgeVariants = tv({
  base: 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  variants: {
    status: {
      pending: 'bg-fill-muted/50 text-text-muted',
      confirmed: 'bg-fill-success/10 text-text-success',
      at_cc_bonded: 'bg-fill-success/10 text-text-success',
      in_transit_to_cc: 'bg-fill-warning/10 text-text-warning',
      at_distributor: 'bg-fill-brand/10 text-text-brand',
      delivered: 'bg-fill-success/10 text-text-success',
    },
  },
  defaultVariants: {
    status: 'pending',
  },
});

const stockSourceBadgeVariants = tv({
  base: 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  variants: {
    source: {
      cc_inventory: 'bg-fill-success/10 text-text-success',
      partner_airfreight: 'bg-fill-warning/10 text-text-warning',
      partner_local: 'bg-fill-brand/10 text-text-brand',
      manual: 'bg-fill-muted/50 text-text-muted',
    },
  },
  defaultVariants: {
    source: 'manual',
  },
});

interface StatusConfig {
  label: string;
  icon: typeof IconClock;
}

const statusConfig: Record<StockStatus, StatusConfig> = {
  pending: { label: 'Pending', icon: IconClock },
  confirmed: { label: 'Confirmed', icon: IconCheck },
  at_cc_bonded: { label: 'At C&C', icon: IconBox },
  in_transit_to_cc: { label: 'In Transit', icon: IconPlane },
  at_distributor: { label: 'At Distributor', icon: IconTruck },
  delivered: { label: 'Delivered', icon: IconCheck },
};

const sourceConfig: Record<StockSource, StatusConfig> = {
  cc_inventory: { label: 'Local Stock', icon: IconBox },
  partner_airfreight: { label: 'Airfreight', icon: IconPlane },
  partner_local: { label: 'Partner Stock', icon: IconPackage },
  manual: { label: 'Manual', icon: IconPackage },
};

export interface StockStatusBadgeProps extends VariantProps<typeof stockStatusBadgeVariants> {
  status: StockStatus;
  showIcon?: boolean;
  className?: string;
}

/**
 * Badge showing the current stock status of a line item
 */
const StockStatusBadge = ({ status, showIcon = true, className }: StockStatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <span className={stockStatusBadgeVariants({ status, className })}>
      {showIcon && <Icon icon={config.icon} size="xs" />}
      {config.label}
    </span>
  );
};

export interface StockSourceBadgeProps extends VariantProps<typeof stockSourceBadgeVariants> {
  source: StockSource;
  showIcon?: boolean;
  className?: string;
}

/**
 * Badge showing the stock source type of a line item
 */
export const StockSourceBadge = ({ source, showIcon = true, className }: StockSourceBadgeProps) => {
  const config = sourceConfig[source];

  return (
    <span className={stockSourceBadgeVariants({ source, className })}>
      {showIcon && <Icon icon={config.icon} size="xs" />}
      {config.label}
    </span>
  );
};

export default StockStatusBadge;
