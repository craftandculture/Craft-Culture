'use client';

import { IconBell } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import markActivitiesAsViewed from '@/app/_admin/actions/markActivitiesAsViewed';
import Button from '@/app/_ui/components/Button/Button';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import useTRPC from '@/lib/trpc/browser';

/**
 * Activity bell notification component for admin users
 *
 * Shows count of unread user activities with pulsing indicator
 * Links to full activity feed page
 */
const ActivityBell = () => {
  const api = useTRPC();

  // Get unread activity count
  const { data: activityData } = useQuery({
    ...api.admin.userActivityLogs.getMany.queryOptions({
      limit: 100,
      unreadOnly: true,
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const unreadCount = activityData?.logs.length ?? 0;
  const hasUnread = unreadCount > 0;

  const handleClick = () => {
    void markActivitiesAsViewed();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href="/platform/admin/activity" onClick={handleClick}>
          <Button
            variant="ghost"
            shape="circle"
            size="md"
            className="relative"
            aria-label="View activity feed"
          >
            <IconBell className="h-5 w-5" />
            {hasUnread && (
              <>
                {/* Badge with count */}
                <span className="bg-brand-primary text-text-on-brand absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
                {/* Pulsing green indicator */}
                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                </span>
              </>
            )}
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>{hasUnread ? `${unreadCount} new activities` : 'No new activities'}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default ActivityBell;
