'use client';

import {
  IconCheck,
  IconFileUpload,
  IconPackage,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

interface ActivityLogEntry {
  id: string;
  type: string;
  description: string;
  createdAt: Date;
  createdBy?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ActivityLogProps {
  activities: ActivityLogEntry[];
  maxItems?: number;
}

const activityIcons: Record<string, typeof IconCheck> = {
  status_change: IconCheck,
  document_uploaded: IconFileUpload,
  item_added: IconPlus,
  item_removed: IconTrash,
  shipment_created: IconPackage,
  shipment_updated: IconPencil,
};

const activityColors: Record<string, string> = {
  status_change: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  document_uploaded: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  item_added: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  item_removed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  shipment_created: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  shipment_updated: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
};

/**
 * Activity log showing recent changes to a shipment
 */
const ActivityLog = ({ activities, maxItems = 10 }: ActivityLogProps) => {
  const displayedActivities = activities.slice(0, maxItems);

  if (displayedActivities.length === 0) {
    return (
      <div className="py-8 text-center">
        <Typography variant="bodySm" colorRole="muted">
          No activity yet
        </Typography>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {displayedActivities.map((activity, index) => {
          const ActivityIcon = activityIcons[activity.type] ?? IconPencil;
          const colorClass = activityColors[activity.type] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
          const isLast = index === displayedActivities.length - 1;

          return (
            <li key={activity.id}>
              <div className="relative pb-8">
                {/* Connecting line */}
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-border-muted"
                    aria-hidden="true"
                  />
                )}

                <div className="relative flex space-x-3">
                  {/* Icon */}
                  <div>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}>
                      <Icon icon={ActivityIcon} size="sm" />
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1">
                    <div>
                      <Typography variant="bodySm">{activity.description}</Typography>
                      {activity.createdBy && (
                        <Typography variant="bodyXs" colorRole="muted">
                          by {activity.createdBy}
                        </Typography>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right">
                      <Typography variant="bodyXs" colorRole="muted">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </Typography>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ActivityLog;
