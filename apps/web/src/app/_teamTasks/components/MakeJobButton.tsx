'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import useTRPC from '@/lib/trpc/browser';

interface MakeJobButtonProps {
  /** This page's path, which the job links back to */
  linkUrl: string;
  /** How the link reads on the job, e.g. PCO-2026-00060 */
  linkLabel: string;
  /** Suggested job title */
  title: string;
}

/**
 * "Make a job" for any Index page, e.g. an order: opens Team Tasks with a new
 * job already linked here, and lists jobs already made from this page
 *
 * Renders nothing for partner logins, who cannot use Team Tasks.
 */
const MakeJobButton = ({ linkUrl, linkLabel, title }: MakeJobButtonProps) => {
  const api = useTRPC();
  const { data: jobs, isError } = useQuery({ ...api.teamTasks.jobsForLink.queryOptions({ linkUrl }), retry: false });

  if (isError) return null;

  const openJobs = (jobs ?? []).filter((j) => j.status === 'open');
  const href = `/platform/admin/tasks?new=1&title=${encodeURIComponent(title)}&link=${encodeURIComponent(linkUrl)}&linkLabel=${encodeURIComponent(linkLabel)}`;

  return (
    <span className="inline-flex items-center gap-1.5">
      <Link
        href={href}
        className="inline-flex h-8 items-center rounded-lg border border-border-primary bg-fill-primary px-3 text-sm font-medium text-text-primary hover:bg-fill-primary-hover"
      >
        Make a job
      </Link>
      {openJobs.length > 0 && (
        <Link
          href={`/platform/admin/tasks?job=${openJobs[0]!.id}`}
          title={openJobs.map((j) => `${j.title} (${j.done}/${j.total})`).join('\n')}
          className="inline-flex h-8 items-center rounded-lg bg-surface-muted px-2.5 text-xs font-medium text-text-primary"
        >
          {openJobs.length} open job{openJobs.length === 1 ? '' : 's'}
        </Link>
      )}
    </span>
  );
};

export default MakeJobButton;
