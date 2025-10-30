'use client';

import { IconUserCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Button from '@/app/_ui/components/Button/Button';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import useTRPC from '@/lib/trpc/browser';

interface PendingCountData {
  count: number;
}

/**
 * Pending users notification bell for admin users
 *
 * Shows count of users awaiting approval with pulsing indicator
 * Links to admin users page filtered by pending status
 */
const PendingUsersBell = () => {
  const api = useTRPC();

  // Get pending users count
  const { data } = useQuery({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(api.users as any).getPendingCount.queryOptions(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const pendingData = data as PendingCountData | undefined;
  const pendingCount = pendingData?.count ?? 0;
  const hasPending = pendingCount > 0;

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/platform/admin/users?filter=pending">
            <Button
              variant="ghost"
              shape="circle"
              size="md"
              className="relative"
              aria-label="View pending user approvals"
            >
              <IconUserCheck className="h-5 w-5" />
              {hasPending && (
                <>
                  {/* Badge with count */}
                  <span className="bg-brand-primary text-text-on-brand absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                  {/* Pulsing indicator */}
                  <span className="absolute -right-1 -top-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500"></span>
                  </span>
                </>
              )}
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              {hasPending
                ? `${pendingCount} user${pendingCount === 1 ? '' : 's'} awaiting approval`
                : 'No pending approvals'}
            </p>
            {hasPending && (
              <p className="text-text-muted text-xs">Click to review and approve</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default PendingUsersBell;
