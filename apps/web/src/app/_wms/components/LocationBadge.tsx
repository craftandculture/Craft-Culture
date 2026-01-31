import { IconMapPin } from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface LocationBadgeProps {
  /** Location code (e.g., "A-01-02") */
  locationCode: string;
  /** Location type */
  locationType?: 'rack' | 'floor' | 'receiving' | 'shipping';
  /** Whether forklift is required */
  requiresForklift?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * LocationBadge - displays a warehouse location in a compact badge
 *
 * @example
 *   <LocationBadge
 *     locationCode="A-01-02"
 *     locationType="rack"
 *     requiresForklift={true}
 *   />
 */
const LocationBadge = ({
  locationCode,
  locationType,
  requiresForklift,
  size = 'md',
}: LocationBadgeProps) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSize = {
    sm: 'sm' as const,
    md: 'sm' as const,
    lg: 'md' as const,
  };

  const isSpecial = locationType === 'receiving' || locationType === 'shipping';

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg ${sizeClasses[size]} ${
        isSpecial
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
          : 'bg-fill-secondary text-text-primary'
      }`}
    >
      <Icon icon={IconMapPin} size={iconSize[size]} />
      <Typography
        variant={size === 'lg' ? 'headingSm' : 'bodySm'}
        className="font-mono font-semibold"
      >
        {locationCode}
      </Typography>
      {requiresForklift && (
        <span className="rounded bg-amber-100 px-1 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Forklift
        </span>
      )}
    </div>
  );
};

export default LocationBadge;
