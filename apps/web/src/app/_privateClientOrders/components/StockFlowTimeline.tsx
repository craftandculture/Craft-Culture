'use client';

import {
  IconArrowRight,
  IconBox,
  IconCheck,
  IconClock,
  IconPackage,
  IconPlane,
  IconTruck,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

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
}

const stockStatusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  at_cc_bonded: 'At C&C Bonded',
  in_transit_to_cc: 'In Transit',
  at_distributor: 'At Distributor',
  delivered: 'Delivered',
};

const stockStatusIcons: Record<string, typeof IconCheck> = {
  pending: IconClock,
  confirmed: IconCheck,
  at_cc_bonded: IconBox,
  in_transit_to_cc: IconPlane,
  at_distributor: IconPackage,
  delivered: IconTruck,
};

const stockStatusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  confirmed: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
  at_cc_bonded: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
  in_transit_to_cc: 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300',
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
 * Displays a dedicated timeline for stock movement activities,
 * separate from the main order workflow timeline.
 * Shows transitions between stock statuses with visual indicators.
 */
const StockFlowTimeline = ({ activities, className }: StockFlowTimelineProps) => {
  // Filter only stock-related activities
  const stockActivities = activities.filter(
    (a) => a.action === 'stock_status_updated' || a.action === 'stock_status_bulk_updated',
  );

  if (stockActivities.length === 0) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-border-secondary bg-fill-secondary/50 p-4">
          <div className="flex items-center gap-2 text-text-muted">
            <Icon icon={IconClock} size="sm" colorRole="muted" />
            <Typography variant="bodySm" colorRole="muted">
              No stock movement history yet
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  // Sort by date descending (most recent first)
  const sortedActivities = [...stockActivities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const getActorName = (activity: ActivityWithUser) => {
    if (activity.user?.name) return activity.user.name;
    if (activity.partner?.businessName) return activity.partner.businessName;
    return 'System';
  };

  const formatActivityDate = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const renderStatusBadge = (status: string) => {
    const StatusIcon = stockStatusIcons[status] || IconClock;
    const colorClass = stockStatusColors[status] || stockStatusColors.pending;

    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
        <StatusIcon size={12} />
        {stockStatusLabels[status] || status}
      </span>
    );
  };

  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2">
        <Icon icon={IconBox} size="sm" colorRole="muted" />
        <Typography variant="headingSm">Stock Movement History</Typography>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute bottom-0 left-3 top-0 w-px bg-border-muted" />

        <div className="space-y-3">
          {sortedActivities.map((activity, index) => {
            const metadata = activity.metadata as StockStatusMetadata | null;
            const isFirst = index === 0;
            const isBulk = activity.action === 'stock_status_bulk_updated';
            const newStatus = metadata?.newStockStatus || 'pending';
            const NewStatusIcon = stockStatusIcons[newStatus] || IconClock;

            return (
              <div key={activity.id} className="relative flex gap-3 pl-8">
                {/* Timeline dot */}
                <div
                  className={`absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    isFirst
                      ? 'border-fill-brand bg-fill-brand'
                      : 'border-border-muted bg-background-primary'
                  }`}
                >
                  <NewStatusIcon
                    size={14}
                    className={isFirst ? 'text-white' : 'text-text-muted'}
                  />
                </div>

                <div className="min-w-0 flex-1 rounded-lg border border-border-secondary bg-surface-secondary/30 p-3">
                  {/* Header */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {isBulk ? (
                      <Typography variant="bodySm" className="font-medium">
                        {metadata?.itemCount || 'Multiple'} items updated
                      </Typography>
                    ) : (
                      <Typography variant="bodySm" className="font-medium">
                        {metadata?.productName || 'Item'}
                      </Typography>
                    )}
                    <Typography variant="bodyXs" colorRole="muted">
                      {formatActivityDate(activity.createdAt)}
                    </Typography>
                  </div>

                  {/* Status Transition */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {metadata?.previousStockStatus && (
                      <>
                        {renderStatusBadge(metadata.previousStockStatus)}
                        <Icon icon={IconArrowRight} size="xs" colorRole="muted" />
                      </>
                    )}
                    {renderStatusBadge(newStatus)}
                  </div>

                  {/* Additional Info */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                    <span>by {getActorName(activity)}</span>
                    {metadata?.stockExpectedAt && (
                      <span>
                        ETA: {new Date(metadata.stockExpectedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Notes or bulk items list */}
                  {activity.notes && (
                    <div className="mt-2 rounded bg-fill-secondary/50 px-2 py-1.5">
                      <Typography variant="bodyXs" colorRole="muted">
                        {activity.notes}
                      </Typography>
                    </div>
                  )}

                  {/* For bulk updates, show affected items */}
                  {isBulk && metadata?.itemNames && (
                    <div className="mt-2 rounded bg-fill-secondary/50 px-2 py-1.5">
                      <Typography variant="bodyXs" colorRole="muted">
                        Items: {metadata.itemNames}
                      </Typography>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StockFlowTimeline;
