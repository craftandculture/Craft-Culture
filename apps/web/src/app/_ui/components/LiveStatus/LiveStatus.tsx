'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

import useTRPC from '@/lib/trpc/browser';

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
    refetchInterval: 60000, // Refetch every minute
  });

  return (
    <div className="flex items-center gap-2">
      {/* Pulsing green dot */}
      <div className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
      </div>

      {/* Status text */}
      <div className="flex items-center gap-1.5">
        <Typography variant="bodyXs" colorRole="muted" className="font-medium">
          Live
        </Typography>
        {lastUpdate && (
          <>
            <span className="text-text-muted">•</span>
            <Typography variant="bodyXs" colorRole="muted">
              Updated {formatDistanceToNow(new Date(lastUpdate), { addSuffix: true })}
            </Typography>
          </>
        )}
      </div>
    </div>
  );
};

export default LiveStatus;
