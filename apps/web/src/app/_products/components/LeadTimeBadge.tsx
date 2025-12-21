'use client';

import { IconCheck, IconClock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import useTRPC from '@/lib/trpc/browser';

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
  const api = useTRPC();

  const { data: leadTimeMin } = useQuery({
    ...api.admin.settings.get.queryOptions({ key: 'leadTimeMin' }),
  });
  const { data: leadTimeMax } = useQuery({
    ...api.admin.settings.get.queryOptions({ key: 'leadTimeMax' }),
  });

  if (source === 'local_inventory') {
    return (
      <div className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
        <IconCheck size={12} stroke={2.5} />
        <span className="hidden sm:inline">In Stock</span>
        <span className="sm:hidden">Stock</span>
      </div>
    );
  }

  const minDays = leadTimeMin ?? '14';
  const maxDays = leadTimeMax ?? '21';

  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-fill-secondary px-2 py-0.5 text-[10px] text-text-muted">
      <IconClock size={12} stroke={2} />
      <span className="hidden sm:inline">
        {minDays}-{maxDays} days
      </span>
      <span className="sm:hidden">{minDays}d</span>
    </div>
  );
};

export default LeadTimeBadge;
