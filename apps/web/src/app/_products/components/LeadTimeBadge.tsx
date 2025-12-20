'use client';

import { IconCheck, IconClock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import useTRPCClient from '@/lib/trpc/browser';

export interface LeadTimeBadgeProps {
  source: 'cultx' | 'local_inventory';
}

/**
 * Display lead time badge based on product source
 *
 * - CultX: Shows configurable lead time (e.g., "14-21 days")
 * - Local Inventory: Shows "In stock - immediate dispatch"
 *
 * @param props - Component props
 * @returns Lead time badge component
 */
const LeadTimeBadge = ({ source }: LeadTimeBadgeProps) => {
  const api = useTRPCClient();

  // Fetch lead time settings for CultX
  const { data: leadTimeMin } = useQuery(
    api.admin.settings.get.queryOptions({ key: 'leadTimeMin' }),
  );
  const { data: leadTimeMax } = useQuery(
    api.admin.settings.get.queryOptions({ key: 'leadTimeMax' }),
  );

  if (source === 'local_inventory') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
        <IconCheck size={14} stroke={2} />
        <span>In stock - immediate dispatch</span>
      </div>
    );
  }

  // CultX source
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
