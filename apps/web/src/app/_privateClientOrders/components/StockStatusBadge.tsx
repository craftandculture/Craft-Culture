'use client';

import {
  IconBox,
  IconCheck,
  IconClock,
  IconPackage,
  IconPlane,
  IconSearch,
  IconTruck,
} from '@tabler/icons-react';
import { type VariantProps, tv } from 'tailwind-variants';

import Icon from '@/app/_ui/components/Icon/Icon';

type StockStatus =
  | 'pending'
  | 'confirmed'
  | 'in_transit_to_cc'
  | 'at_cc_bonded'
  | 'in_transit_to_distributor'
  | 'at_distributor'
  | 'delivered';
type StockSource = 'cc_inventory' | 'partner_airfreight' | 'partner_local' | 'manual';

const stockStatusBadgeVariants = tv({
  base: 'inline-flex items-center gap-1.5 text-[11px] font-medium',
  variants: {
    status: {
      pending: 'text-text-muted',
      confirmed: 'text-blue-600 dark:text-blue-400',
      in_transit_to_cc: 'text-amber-600 dark:text-amber-400',
      at_cc_bonded: 'text-purple-600 dark:text-purple-400',
      in_transit_to_distributor: 'text-cyan-600 dark:text-cyan-400',
      at_distributor: 'text-green-600 dark:text-green-400',
      delivered: 'text-green-600 dark:text-green-400',
    },
  },
  defaultVariants: {
    status: 'pending',
  },
});

const stockSourceBadgeVariants = tv({
  base: 'inline-flex items-center gap-1.5 text-[11px] font-medium',
  variants: {
    source: {
      cc_inventory: 'text-purple-600 dark:text-purple-400',
      partner_airfreight: 'text-amber-600 dark:text-amber-400',
      partner_local: 'text-blue-600 dark:text-blue-400',
      manual: 'text-text-muted',
    },
  },
  defaultVariants: {
    source: 'manual',
  },
});

interface StatusConfig {
  label: string;
  shortLabel: string;
  icon: typeof IconClock;
}

const statusConfig: Record<StockStatus, StatusConfig> = {
  pending: { label: 'Sourcing', shortLabel: 'Sourcing', icon: IconSearch },
  confirmed: { label: 'Confirmed', shortLabel: 'Confirmed', icon: IconCheck },
  in_transit_to_cc: { label: 'In Air to Dubai', shortLabel: 'In Air', icon: IconPlane },
  at_cc_bonded: { label: 'At C&C Warehouse', shortLabel: 'At C&C', icon: IconBox },
  in_transit_to_distributor: { label: 'To Distributor', shortLabel: 'To Dist.', icon: IconTruck },
  at_distributor: { label: 'Ready for Delivery', shortLabel: 'Ready', icon: IconCheck },
  delivered: { label: 'Delivered', shortLabel: 'Delivered', icon: IconCheck },
};

const sourceConfig: Record<StockSource, StatusConfig> = {
  cc_inventory: { label: 'C&C Local Stock', shortLabel: 'Local', icon: IconBox },
  partner_airfreight: { label: 'Airfreight', shortLabel: 'Airfreight', icon: IconPlane },
  partner_local: { label: 'Partner Stock', shortLabel: 'Partner', icon: IconPackage },
  manual: { label: 'Manual Entry', shortLabel: 'Manual', icon: IconPackage },
};

export interface StockStatusBadgeProps extends VariantProps<typeof stockStatusBadgeVariants> {
  status: StockStatus;
  showIcon?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Badge showing the current stock status of a line item
 */
const StockStatusBadge = ({ status, showIcon = true, compact = false, className }: StockStatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <span className={stockStatusBadgeVariants({ status, className })}>
      {showIcon && <Icon icon={config.icon} size="xs" />}
      {compact ? config.shortLabel : config.label}
    </span>
  );
};

export interface StockSourceBadgeProps extends VariantProps<typeof stockSourceBadgeVariants> {
  source: StockSource;
  showIcon?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Badge showing the stock source type of a line item
 */
export const StockSourceBadge = ({ source, showIcon = true, compact = false, className }: StockSourceBadgeProps) => {
  const config = sourceConfig[source];

  return (
    <span className={stockSourceBadgeVariants({ source, className })}>
      {showIcon && <Icon icon={config.icon} size="xs" />}
      {compact ? config.shortLabel : config.label}
    </span>
  );
};

export default StockStatusBadge;
