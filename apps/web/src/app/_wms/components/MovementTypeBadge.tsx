import {
  IconArrowRight,
  IconBoxSeam,
  IconCheck,
  IconClipboardList,
  IconLockOpen,
  IconPackage,
  IconPackages,
  IconRefresh,
  IconTransfer,
  IconTrash,
  IconTruck,
  IconTruckDelivery,
  IconUserDollar,
} from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface MovementTypeBadgeProps {
  /** Movement type from wmsStockMovements */
  movementType:
    | 'receive'
    | 'putaway'
    | 'transfer'
    | 'pick'
    | 'adjust'
    | 'count'
    | 'ownership_transfer'
    | 'repack_out'
    | 'repack_in'
    | 'pallet_add'
    | 'pallet_remove'
    | 'pallet_move'
    | 'pallet_unseal'
    | 'pallet_dissolve'
    | 'pallet_dispatch';
  /** Size variant */
  size?: 'sm' | 'md';
  /** Show label text */
  showLabel?: boolean;
}

const movementConfig: Record<
  MovementTypeBadgeProps['movementType'],
  {
    label: string;
    icon: typeof IconArrowRight;
    colorClass: string;
    bgClass: string;
  }
> = {
  receive: {
    label: 'Received',
    icon: IconTruck,
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
  putaway: {
    label: 'Put Away',
    icon: IconArrowRight,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  transfer: {
    label: 'Transfer',
    icon: IconTransfer,
    colorClass: 'text-purple-600 dark:text-purple-400',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
  },
  pick: {
    label: 'Picked',
    icon: IconCheck,
    colorClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
  },
  adjust: {
    label: 'Adjusted',
    icon: IconRefresh,
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
  },
  count: {
    label: 'Count',
    icon: IconClipboardList,
    colorClass: 'text-cyan-600 dark:text-cyan-400',
    bgClass: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
  ownership_transfer: {
    label: 'Ownership',
    icon: IconUserDollar,
    colorClass: 'text-pink-600 dark:text-pink-400',
    bgClass: 'bg-pink-100 dark:bg-pink-900/30',
  },
  repack_out: {
    label: 'Repack Out',
    icon: IconPackage,
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
  repack_in: {
    label: 'Repack In',
    icon: IconPackages,
    colorClass: 'text-green-600 dark:text-green-400',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
  },
  pallet_add: {
    label: 'Pallet Add',
    icon: IconBoxSeam,
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    bgClass: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  pallet_remove: {
    label: 'Pallet Remove',
    icon: IconBoxSeam,
    colorClass: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-100 dark:bg-rose-900/30',
  },
  pallet_move: {
    label: 'Pallet Move',
    icon: IconBoxSeam,
    colorClass: 'text-violet-600 dark:text-violet-400',
    bgClass: 'bg-violet-100 dark:bg-violet-900/30',
  },
  pallet_unseal: {
    label: 'Pallet Unseal',
    icon: IconLockOpen,
    colorClass: 'text-yellow-600 dark:text-yellow-400',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  pallet_dissolve: {
    label: 'Pallet Dissolve',
    icon: IconTrash,
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
  pallet_dispatch: {
    label: 'Pallet Dispatch',
    icon: IconTruckDelivery,
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
};

/**
 * MovementTypeBadge - displays movement type with icon and color coding
 *
 * @example
 *   <MovementTypeBadge movementType="transfer" />
 *   <MovementTypeBadge movementType="receive" showLabel />
 */
const MovementTypeBadge = ({ movementType, size = 'md', showLabel = true }: MovementTypeBadgeProps) => {
  const config = movementConfig[movementType];

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 gap-1',
    md: 'px-2 py-1 gap-1.5',
  };

  const iconSize = size === 'sm' ? 'xs' : 'sm';

  return (
    <div
      className={`inline-flex items-center rounded ${sizeClasses[size]} ${config.bgClass}`}
    >
      <Icon icon={config.icon} size={iconSize} className={config.colorClass} />
      {showLabel && (
        <Typography
          variant={size === 'sm' ? 'bodyXs' : 'bodySm'}
          className={`font-medium ${config.colorClass}`}
        >
          {config.label}
        </Typography>
      )}
    </div>
  );
};

export default MovementTypeBadge;
