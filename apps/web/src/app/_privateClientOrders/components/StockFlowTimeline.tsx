'use client';

import {
  IconArrowRight,
  IconBox,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconPackage,
  IconPlane,
  IconTruck,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientOrderActivityLog } from '@/database/schema';

interface ActivityWithUser extends PrivateClientOrderActivityLog {
  user?: { id: string; name: string; email: string } | null;
  partner?: { id: string; businessName: string } | null;
}

export interface StockFlowTimelineProps {
  activities: ActivityWithUser[];
  className?: string;
  /** Number of entries to show when collapsed. Default: 3 */
  collapsedCount?: number;
}

const stockStatusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  at_cc_bonded: 'At C&C',
  at_cc_ready_for_dispatch: 'Packed',
  in_transit_to_cc: 'In Transit',
  in_transit_to_distributor: 'To Distributor',
  at_distributor: 'At Distributor',
  delivered: 'Delivered',
};

const stockStatusIcons: Record<string, typeof IconCheck> = {
  pending: IconClock,
  confirmed: IconCheck,
  at_cc_bonded: IconBox,
  at_cc_ready_for_dispatch: IconPackage,
  in_transit_to_cc: IconPlane,
  in_transit_to_distributor: IconTruck,
  at_distributor: IconPackage,
  delivered: IconTruck,
};

const stockStatusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  confirmed: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
  at_cc_bonded: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
  at_cc_ready_for_dispatch: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300',
  in_transit_to_cc: 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300',
  in_transit_to_distributor: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-300',
  at_distributor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300',
  delivered: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
};

interface StockStatusMetadata {
  itemId?: string;
  productName?: string;
  previousStockStatus?: string;
  newStockStatus?: string;
  stockExpectedAt?: string;
  itemIds?: string[];
  itemCount?: number;
  itemNames?: string;
}

/**
 * Stock Flow Timeline Component
 *
 * Displays a dedicated timeline for stock movement activities.
 * Collapsed by default showing only recent entries, expandable to see full history.
 */
const StockFlowTimeline = ({
  activities,
  className,
  collapsedCount = 3,
}: StockFlowTimelineProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter only stock-related activities
  const stockActivities = activities.filter(
    (a) => a.action === 'stock_status_updated' || a.action === 'stock_status_bulk_updated',
  );

  if (stockActivities.length === 0) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 rounded-lg border border-border-secondary bg-fill-secondary/50 p-3">
          <Icon icon={IconClock} size="sm" colorRole="muted" />
          <Typography variant="bodySm" colorRole="muted">
            No stock movement history yet
          </Typography>
        </div>
      </div>
    );
  }

  // Sort by date descending (most recent first)
  const sortedActivities = [...stockActivities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const hasMoreToShow = sortedActivities.length > collapsedCount;
  const visibleActivities = isExpanded
    ? sortedActivities
    : sortedActivities.slice(0, collapsedCount);
  const hiddenCount = sortedActivities.length - collapsedCount;

  const getActorName = (activity: ActivityWithUser) => {
    if (activity.user?.name) return activity.user.name;
    if (activity.partner?.businessName) return activity.partner.businessName;
    return 'System';
  };

  const formatActivityDate = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const renderCompactStatusBadge = (status: string) => {
    const StatusIcon = stockStatusIcons[status] || IconClock;
    const colorClass = stockStatusColors[status] || stockStatusColors.pending;

    return (
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}
      >
        <StatusIcon size={10} />
        {stockStatusLabels[status] || status}
      </span>
    );
  };

  return (
    <div className={className}>
      {/* Header with count */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon={IconBox} size="sm" colorRole="muted" />
          <Typography variant="headingSm">Stock Movement History</Typography>
          <span className="rounded-full bg-fill-muted px-2 py-0.5 text-[10px] font-medium text-text-muted">
            {stockActivities.length}
          </span>
        </div>
      </div>

      {/* Compact Timeline */}
      <div className="space-y-1.5">
        {visibleActivities.map((activity, index) => {
          const metadata = activity.metadata as StockStatusMetadata | null;
          const isFirst = index === 0;
          const isBulk = activity.action === 'stock_status_bulk_updated';
          const newStatus = metadata?.newStockStatus || 'pending';
          const NewStatusIcon = stockStatusIcons[newStatus] || IconClock;

          return (
            <div
              key={activity.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                isFirst
                  ? 'border-fill-brand/30 bg-fill-brand/5'
                  : 'border-border-secondary bg-surface-secondary/30'
              }`}
            >
              {/* Icon */}
              <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                  isFirst ? 'bg-fill-brand text-white' : 'bg-fill-muted text-text-muted'
                }`}
              >
                <NewStatusIcon size={12} />
              </div>

              {/* Content - single line */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {/* Item name or bulk count */}
                <span className="truncate text-xs font-medium text-text-primary">
                  {isBulk ? `${metadata?.itemCount || 'Multiple'} items` : metadata?.productName || 'Item'}
                </span>

                {/* Status transition */}
                <div className="flex flex-shrink-0 items-center gap-1">
                  {metadata?.previousStockStatus && (
                    <>
                      {renderCompactStatusBadge(metadata.previousStockStatus)}
                      <IconArrowRight size={10} className="text-text-muted" />
                    </>
                  )}
                  {renderCompactStatusBadge(newStatus)}
                </div>
              </div>

              {/* Time and actor */}
              <div className="flex flex-shrink-0 items-center gap-2 text-[10px] text-text-muted">
                <span className="hidden sm:inline">{getActorName(activity)}</span>
                <span>{formatActivityDate(activity.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expand/Collapse button */}
      {hasMoreToShow && (
        <div className="mt-2 flex justify-center">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            {isExpanded ? (
              <>
                <IconChevronUp size={14} />
                Show less
              </>
            ) : (
              <>
                <IconChevronDown size={14} />
                Show {hiddenCount} more
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default StockFlowTimeline;
