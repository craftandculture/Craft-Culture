'use client';

import { IconCheck, IconClock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { useTRPCClient } from '@/lib/trpc/client';

interface LeadTimeBadgeProps {
  source: 'cultx' | 'local_inventory';
}

/**
 * Display lead time badge based on product source
 *
 * @example
 *   <LeadTimeBadge source="local_inventory" /> // Shows "In stock - immediate dispatch"
 *   <LeadTimeBadge source="cultx" /> // Shows "14-21 days lead time"
 */
const LeadTimeBadge = ({ source }: LeadTimeBadgeProps) => {
  const api = useTRPCClient();

  const { data: leadTimeMin } = useQuery(
    api.admin.settings.get.queryOptions({ key: 'leadTimeMin' }),
  );
  const { data: leadTimeMax } = useQuery(
    api.admin.settings.get.queryOptions({ key: 'leadTimeMax' }),
  );

  if (source === 'local_inventory') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <IconCheck size={14} stroke={2} />
        <span>In stock - immediate dispatch</span>
      </div>
    );
  }

  const minDays = leadTimeMin ?? '14';
  const maxDays = leadTimeMax ?? '21';

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-fill-secondary px-2.5 py-1 text-xs text-text-muted">
      <IconClock size={14} />
      <span>
        {minDays}-{maxDays} days lead time
      </span>
    </div>
  );
};

export default LeadTimeBadge;
