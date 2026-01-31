import { IconAlertTriangle, IconCalendarDue, IconCheck, IconX } from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface ExpiryBadgeProps {
  /** Expiry date */
  expiryDate: Date | null;
  /** Whether the item is perishable */
  isPerishable?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Show date text */
  showDate?: boolean;
}

/**
 * ExpiryBadge - displays expiry status with color coding
 *
 * Status levels:
 * - expired: Red - past expiry date
 * - critical: Orange - expires within 30 days
 * - warning: Yellow - expires within 90 days
 * - ok: Green - expires beyond 90 days
 * - none: Gray - no expiry (non-perishable)
 *
 * @example
 *   <ExpiryBadge expiryDate={new Date('2026-02-15')} isPerishable />
 *   <ExpiryBadge expiryDate={null} />
 */
const ExpiryBadge = ({ expiryDate, isPerishable = true, size = 'md', showDate = false }: ExpiryBadgeProps) => {
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  let label: string;
  let IconComponent: typeof IconCheck;
  let colorClass: string;
  let bgClass: string;

  if (!isPerishable || !expiryDate) {
    label = 'No expiry';
    IconComponent = IconCheck;
    colorClass = 'text-text-muted';
    bgClass = 'bg-fill-secondary';
  } else if (expiryDate < now) {
    label = 'Expired';
    IconComponent = IconX;
    colorClass = 'text-red-600 dark:text-red-400';
    bgClass = 'bg-red-100 dark:bg-red-900/30';
  } else if (expiryDate <= thirtyDays) {
    label = 'Expiring soon';
    IconComponent = IconAlertTriangle;
    colorClass = 'text-orange-600 dark:text-orange-400';
    bgClass = 'bg-orange-100 dark:bg-orange-900/30';
  } else if (expiryDate <= ninetyDays) {
    label = 'Expiring';
    IconComponent = IconCalendarDue;
    colorClass = 'text-amber-600 dark:text-amber-400';
    bgClass = 'bg-amber-100 dark:bg-amber-900/30';
  } else {
    label = 'OK';
    IconComponent = IconCheck;
    colorClass = 'text-emerald-600 dark:text-emerald-400';
    bgClass = 'bg-emerald-100 dark:bg-emerald-900/30';
  }

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 gap-1',
    md: 'px-2 py-1 gap-1.5',
  };

  const iconSize = size === 'sm' ? 'xs' : 'sm';

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className={`inline-flex items-center rounded ${sizeClasses[size]} ${bgClass}`}>
      <Icon icon={IconComponent} size={iconSize} className={colorClass} />
      <Typography
        variant={size === 'sm' ? 'bodyXs' : 'bodySm'}
        className={`font-medium ${colorClass}`}
      >
        {showDate && expiryDate ? formatDate(expiryDate) : label}
      </Typography>
    </div>
  );
};

export default ExpiryBadge;
