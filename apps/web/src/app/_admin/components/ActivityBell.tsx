'use client';

import { IconBell } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Button from '@/app/_ui/components/Button/Button';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import useTRPC from '@/lib/trpc/browser';

/**
 * Activity bell notification component for admin users
 *
 * Shows count of recent user activities (last 24 hours)
 * Links to full activity feed page
 */
const ActivityBell = () => {
  const api = useTRPC();

  // Get recent activity count (last 24 hours)
  const { data: activityData } = useQuery({
    ...api.admin.userActivityLogs.getMany.queryOptions({
      limit: 100,
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const recentActivityCount = activityData?.logs.length ?? 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href="/platform/admin/activity">
          <Button
            variant="ghost"
            shape="circle"
            size="md"
            className="relative"
            aria-label="View activity feed"
          >
            <IconBell className="h-5 w-5" />
            {recentActivityCount > 0 && (
              <span className="bg-brand-primary text-text-on-brand absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
                {recentActivityCount > 99 ? '99+' : recentActivityCount}
              </span>
            )}
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>View user activity</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default ActivityBell;
