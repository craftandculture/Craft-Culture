import Typography from '@/app/_ui/components/Typography/Typography';

export interface CapacityBarProps {
  /** Current number of cases */
  currentCases: number;
  /** Maximum capacity in cases (optional - if not set, shows count only) */
  maxCapacity?: number | null;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show percentage label */
  showPercent?: boolean;
  /** Show count label */
  showCount?: boolean;
}

/**
 * CapacityBar - displays location capacity utilization
 *
 * Color coding:
 * - Green: < 70% utilized
 * - Yellow: 70-90% utilized
 * - Red: > 90% utilized
 *
 * @example
 *   <CapacityBar currentCases={15} maxCapacity={20} />
 *   <CapacityBar currentCases={45} showCount />
 */
const CapacityBar = ({
  currentCases,
  maxCapacity,
  size = 'md',
  showPercent = false,
  showCount = true,
}: CapacityBarProps) => {
  const hasCapacity = maxCapacity && maxCapacity > 0;
  const percent = hasCapacity ? Math.min(100, (currentCases / maxCapacity) * 100) : 0;

  let colorClass: string;
  let bgColorClass: string;

  if (!hasCapacity) {
    colorClass = 'bg-blue-500';
    bgColorClass = 'bg-blue-100 dark:bg-blue-900/30';
  } else if (percent >= 90) {
    colorClass = 'bg-red-500';
    bgColorClass = 'bg-red-100 dark:bg-red-900/30';
  } else if (percent >= 70) {
    colorClass = 'bg-amber-500';
    bgColorClass = 'bg-amber-100 dark:bg-amber-900/30';
  } else {
    colorClass = 'bg-emerald-500';
    bgColorClass = 'bg-emerald-100 dark:bg-emerald-900/30';
  }

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="flex items-center gap-2">
      {hasCapacity && (
        <div className={`flex-1 overflow-hidden rounded-full ${bgColorClass} ${heightClasses[size]}`}>
          <div
            className={`h-full rounded-full transition-all ${colorClass}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {showCount && (
        <Typography variant="bodyXs" colorRole="muted" className="whitespace-nowrap">
          {currentCases}
          {hasCapacity && `/${maxCapacity}`}
          {' cs'}
        </Typography>
      )}
      {showPercent && hasCapacity && (
        <Typography variant="bodyXs" colorRole="muted" className="whitespace-nowrap">
          {Math.round(percent)}%
        </Typography>
      )}
    </div>
  );
};

export default CapacityBar;
