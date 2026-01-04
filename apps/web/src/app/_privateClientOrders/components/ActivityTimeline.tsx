'use client';

import {
  IconArrowRight,
  IconBox,
  IconCheck,
  IconCirclePlus,
  IconClock,
  IconCreditCard,
  IconEdit,
  IconFileText,
  IconMessage,
  IconPackage,
  IconPlane,
  IconRefresh,
  IconSend,
  IconTruck,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientOrderActivityLog } from '@/database/schema';

interface ActivityWithUser extends PrivateClientOrderActivityLog {
  user?: { id: string; name: string; email: string } | null;
  partner?: { id: string; businessName: string } | null;
}

interface ActivityTimelineProps {
  activities: ActivityWithUser[];
  maxItems?: number;
}

type IconType = typeof IconCheck;

/** Stock status labels for display */
const stockStatusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  at_cc_bonded: 'At C&C',
  in_transit_to_cc: 'In Transit',
  at_distributor: 'At Distributor',
  delivered: 'Delivered',
};

/** Stock status colors for badges */
const stockStatusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  confirmed: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
  at_cc_bonded: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300',
  in_transit_to_cc: 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300',
  at_distributor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300',
  delivered: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
};

/** Stock status icons */
const stockStatusIcons: Record<string, typeof IconCheck> = {
  pending: IconClock,
  confirmed: IconCheck,
  at_cc_bonded: IconBox,
  in_transit_to_cc: IconPlane,
  at_distributor: IconPackage,
  delivered: IconTruck,
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
 * Check if activity is stock-related
 */
const isStockActivity = (action: string) => {
  return action === 'stock_status_updated' || action === 'stock_status_bulk_updated';
};

/**
 * Get icon and color for an activity based on its action text
 */
const getActivityStyle = (action: string, metadata?: unknown): { icon: IconType; colorRole: 'muted' | 'brand' | 'success' | 'warning' | 'danger' } => {
  const actionLower = action.toLowerCase();

  // Handle stock status updates with specific icons
  if (isStockActivity(action) && metadata) {
    const stockMeta = metadata as StockStatusMetadata;
    const newStatus = stockMeta.newStockStatus;
    if (newStatus && stockStatusIcons[newStatus]) {
      // Color based on new status
      if (newStatus === 'delivered' || newStatus === 'at_distributor') {
        return { icon: stockStatusIcons[newStatus], colorRole: 'success' };
      }
      if (newStatus === 'in_transit_to_cc' || newStatus === 'at_cc_bonded') {
        return { icon: stockStatusIcons[newStatus], colorRole: 'warning' };
      }
      return { icon: stockStatusIcons[newStatus], colorRole: 'brand' };
    }
    return { icon: IconPackage, colorRole: 'brand' };
  }

  if (actionLower.includes('created') || actionLower.includes('added')) {
    return { icon: IconCirclePlus, colorRole: 'brand' };
  }
  if (actionLower.includes('submitted') || actionLower.includes('sent')) {
    return { icon: IconSend, colorRole: 'brand' };
  }
  if (actionLower.includes('approved') || actionLower.includes('confirmed')) {
    return { icon: IconCheck, colorRole: 'success' };
  }
  if (actionLower.includes('rejected') || actionLower.includes('cancelled')) {
    return { icon: IconX, colorRole: 'danger' };
  }
  if (actionLower.includes('revision') || actionLower.includes('updated') || actionLower.includes('changed')) {
    return { icon: IconEdit, colorRole: 'warning' };
  }
  if (actionLower.includes('payment') || actionLower.includes('paid')) {
    return { icon: IconCreditCard, colorRole: 'success' };
  }
  if (actionLower.includes('assigned') || actionLower.includes('distributor')) {
    return { icon: IconUser, colorRole: 'brand' };
  }
  if (actionLower.includes('transit') || actionLower.includes('delivery') || actionLower.includes('delivered')) {
    return { icon: IconTruck, colorRole: 'success' };
  }
  if (actionLower.includes('document') || actionLower.includes('upload')) {
    return { icon: IconFileText, colorRole: 'muted' };
  }
  if (actionLower.includes('note') || actionLower.includes('comment')) {
    return { icon: IconMessage, colorRole: 'muted' };
  }
  if (actionLower.includes('status')) {
    return { icon: IconRefresh, colorRole: 'brand' };
  }

  return { icon: IconClock, colorRole: 'muted' };
};

/**
 * Format action text to be more readable
 */
const formatAction = (action: string, metadata?: unknown): string => {
  // Stock status updates get special formatting
  if (isStockActivity(action) && metadata) {
    const stockMeta = metadata as StockStatusMetadata;
    const isBulk = action === 'stock_status_bulk_updated';

    if (isBulk) {
      return `Stock Updated (${stockMeta.itemCount || 'Multiple'} items)`;
    }
    return 'Stock Updated';
  }

  // Capitalize first letter and format status transitions
  const formatted = action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return formatted;
};

/**
 * Render compact stock status badge
 */
const renderStockBadge = (status: string) => {
  const colorClass = stockStatusColors[status] || stockStatusColors.pending;
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}>
      {stockStatusLabels[status] || status}
    </span>
  );
};

/**
 * Timeline component displaying order activity history
 */
const ActivityTimeline = ({ activities, maxItems }: ActivityTimelineProps) => {
  if (!activities || activities.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-text-muted">
        <Icon icon={IconClock} size="sm" colorRole="muted" />
        <Typography variant="bodySm" colorRole="muted">
          No activity yet
        </Typography>
      </div>
    );
  }

  // Sort activities by date descending (most recent first)
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const displayActivities = maxItems ? sortedActivities.slice(0, maxItems) : sortedActivities;
  const hasMore = maxItems && sortedActivities.length > maxItems;

  const getActorName = (activity: ActivityWithUser) => {
    if (activity.user?.name) return activity.user.name;
    if (activity.partner?.businessName) return activity.partner.businessName;
    return 'System';
  };

  const formatActivityDate = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute bottom-0 left-[7px] top-0 w-px bg-border-muted" />

      <div className="space-y-3">
        {displayActivities.map((activity, index) => {
          const { icon, colorRole } = getActivityStyle(activity.action, activity.metadata);
          const isFirst = index === 0;
          const isStock = isStockActivity(activity.action);
          const stockMeta = isStock ? (activity.metadata as StockStatusMetadata | null) : null;

          return (
            <div key={activity.id} className="relative flex gap-3 pl-6">
              {/* Timeline dot with icon */}
              <div
                className={`absolute left-0 top-0 flex h-4 w-4 items-center justify-center rounded-full ${
                  isFirst
                    ? 'bg-fill-brand'
                    : colorRole === 'success'
                      ? 'bg-fill-success'
                      : colorRole === 'warning'
                        ? 'bg-fill-warning'
                        : colorRole === 'danger'
                          ? 'bg-fill-danger'
                          : 'bg-fill-muted'
                }`}
              >
                <Icon
                  icon={icon}
                  size="xs"
                  className={isFirst || colorRole !== 'muted' ? 'text-white' : 'text-text-muted'}
                />
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Typography variant="bodySm" className="font-medium">
                    {formatAction(activity.action, activity.metadata)}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    {formatActivityDate(activity.createdAt)}
                  </Typography>
                </div>

                {/* Stock-specific details: product name + status transition */}
                {isStock && stockMeta && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {/* Product name */}
                    {stockMeta.productName && (
                      <span className="text-xs text-text-primary">{stockMeta.productName}</span>
                    )}
                    {/* Status transition */}
                    {(stockMeta.previousStockStatus || stockMeta.newStockStatus) && (
                      <div className="flex items-center gap-1">
                        {stockMeta.previousStockStatus && (
                          <>
                            {renderStockBadge(stockMeta.previousStockStatus)}
                            <IconArrowRight size={10} className="text-text-muted" />
                          </>
                        )}
                        {stockMeta.newStockStatus && renderStockBadge(stockMeta.newStockStatus)}
                      </div>
                    )}
                    {/* Bulk item names */}
                    {!stockMeta.productName && stockMeta.itemNames && (
                      <span className="text-xs text-text-muted">{stockMeta.itemNames}</span>
                    )}
                  </div>
                )}

                <Typography variant="bodyXs" colorRole="muted">
                  by {getActorName(activity)}
                </Typography>
                {activity.notes && (
                  <div className="mt-1 rounded bg-surface-secondary/50 px-2 py-1.5">
                    <Typography variant="bodyXs" colorRole="muted">
                      {activity.notes}
                    </Typography>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {hasMore && (
          <div className="pl-6">
            <Typography variant="bodyXs" colorRole="muted">
              +{sortedActivities.length - maxItems} more activities
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityTimeline;
