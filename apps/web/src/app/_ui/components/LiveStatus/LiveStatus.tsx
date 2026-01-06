'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

import useTRPC from '@/lib/trpc/browser';

import Tooltip from '../Tooltip/Tooltip';
import TooltipContent from '../Tooltip/TooltipContent';
import TooltipProvider from '../Tooltip/TooltipProvider';
import TooltipTrigger from '../Tooltip/TooltipTrigger';
import Typography from '../Typography/Typography';

/**
 * LiveStatus component displays a live indicator with database sync status
 *
 * @example
 *   <LiveStatus />
 */
const LiveStatus = () => {
  const api = useTRPC();
  const { data: lastUpdate } = useQuery({
    ...api.products.getLastUpdate.queryOptions(),
    refetchInterval: 5000, // Refetch every minute
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-help items-center gap-2">
            {/* Pulsing green dot */}
            <div className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/30" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-600/60" />
            </div>

            {/* Status text */}
            {lastUpdate && (
              <Typography variant="bodyXs" colorRole="muted">
                Updated {formatDistanceToNow(new Date(lastUpdate), { addSuffix: true })}
              </Typography>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <Typography variant="bodyXs">Database Update</Typography>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default LiveStatus;
