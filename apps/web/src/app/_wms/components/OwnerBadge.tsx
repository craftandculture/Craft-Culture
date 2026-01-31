import { IconBuilding, IconUser } from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface OwnerBadgeProps {
  /** Owner name */
  ownerName: string;
  /** Whether this is the company's own stock (C&C) */
  isOwnStock?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * OwnerBadge - displays stock owner with visual distinction
 *
 * @example
 *   <OwnerBadge ownerName="Cru Wine" />
 *   <OwnerBadge ownerName="C&C" isOwnStock />
 */
const OwnerBadge = ({ ownerName, isOwnStock = false, size = 'md' }: OwnerBadgeProps) => {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 gap-1',
    md: 'px-2 py-1 gap-1.5',
  };

  const iconSize = size === 'sm' ? 'xs' : 'sm';

  const colorClass = isOwnStock
    ? 'text-blue-600 dark:text-blue-400'
    : 'text-text-primary';
  const bgClass = isOwnStock
    ? 'bg-blue-100 dark:bg-blue-900/30'
    : 'bg-fill-secondary';

  return (
    <div className={`inline-flex items-center rounded ${sizeClasses[size]} ${bgClass}`}>
      <Icon
        icon={isOwnStock ? IconBuilding : IconUser}
        size={iconSize}
        className={colorClass}
      />
      <Typography
        variant={size === 'sm' ? 'bodyXs' : 'bodySm'}
        className={`font-medium ${colorClass}`}
      >
        {ownerName}
      </Typography>
    </div>
  );
};

export default OwnerBadge;
