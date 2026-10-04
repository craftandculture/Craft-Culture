'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import useTRPC from '@/lib/trpc/browser';

/**
 * "Tasks" in a partner's menu, shown only once C&C has shared a job with them
 *
 * Carries a count of the signed-in person's own open parts.
 */
const PartnerTasksNavLink = () => {
  const api = useTRPC();
  const { data } = useQuery({ ...api.teamTasks.partnerCount.queryOptions(), retry: false, refetchInterval: 120_000 });

  if (!data?.jobs) return null;

  return (
    <Link
      href="/platform/tasks"
      className="flex items-center gap-1.5 rounded-lg border border-border-muted/50 px-2.5 py-1.5 text-sm font-medium text-text-primary transition-all duration-200 hover:bg-fill-muted"
    >
      Tasks
      {data.mine > 0 && (
        <span className="min-w-[18px] rounded-full bg-text-primary/15 px-1.5 text-center text-[11px] font-semibold leading-[18px] text-text-primary">
          {data.mine}
        </span>
      )}
    </Link>
  );
};

export default PartnerTasksNavLink;
