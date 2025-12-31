'use client';

import { format } from 'date-fns';

import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientOrderActivityLog } from '@/database/schema';

interface ActivityWithUser extends PrivateClientOrderActivityLog {
  user?: { id: string; name: string; email: string } | null;
  partner?: { id: string; businessName: string } | null;
}

interface ActivityTimelineProps {
  activities: ActivityWithUser[];
}

/**
 * Timeline component displaying order activity history
 */
const ActivityTimeline = ({ activities }: ActivityTimelineProps) => {
  if (!activities || activities.length === 0) {
    return (
      <Typography variant="bodySm" colorRole="muted">
        No activity yet
      </Typography>
    );
  }

  // Sort activities by date descending (most recent first)
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const getActorName = (activity: ActivityWithUser) => {
    if (activity.user?.name) return activity.user.name;
    if (activity.partner?.businessName) return activity.partner.businessName;
    return 'System';
  };

  const formatActivityDate = (date: Date) => {
    return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute bottom-0 left-2 top-0 w-0.5 bg-border-muted" />

      <div className="space-y-4">
        {sortedActivities.map((activity, index) => (
          <div key={activity.id} className="relative flex gap-4 pl-6">
            {/* Timeline dot */}
            <div
              className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 ${
                index === 0
                  ? 'border-fill-brand bg-fill-brand'
                  : 'border-border-muted bg-background-primary'
              }`}
            />

            <div className="flex-1">
              <div className="flex flex-col gap-1">
                <Typography variant="bodySm" className="font-medium">
                  {activity.action}
                </Typography>
                <div className="flex flex-wrap gap-2">
                  <Typography variant="bodyXs" colorRole="muted">
                    by {getActorName(activity)}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    {formatActivityDate(activity.createdAt)}
                  </Typography>
                </div>
                {activity.notes && (
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="mt-1 rounded bg-surface-secondary p-2"
                  >
                    {activity.notes}
                  </Typography>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityTimeline;
