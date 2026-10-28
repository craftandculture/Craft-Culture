'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import useTRPC from '@/lib/trpc/browser';

const SHIPMENTS = '/platform/admin/logistics/shipments';

/**
 * The logistics board at a glance
 *
 * How well the board is kept, what has gone quiet, what lands this week, and
 * who is holding which next actions. Each figure opens the shipments behind
 * it. Read from the same rules as the morning #logistics post.
 */
const TeamBoardStrip = () => {
  const api = useTRPC();
  const { data } = useQuery(api.logistics.admin.getTeamBoard.queryOptions());

  const health = data?.health;
  const healthy = health && health.active > 0 ? health.updated / health.active : null;

  const cell = 'flex min-w-0 flex-col gap-1 px-4 py-3 transition-colors hover:bg-surface-primary';
  const label = 'text-[11px] font-semibold uppercase tracking-wider text-text-muted';

  return (
    <section
      aria-label="Board at a glance"
      className="grid grid-cols-2 overflow-hidden rounded-xl border border-border-muted bg-surface-quiet lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.6fr)]"
    >
      <Link href={`${SHIPMENTS}?news=none`} className={`${cell} border-b border-r border-border-muted lg:border-b-0`}>
        <span className={label}>Board health</span>
        <span
          className={`text-2xl font-semibold tabular-nums ${
            healthy == null
              ? 'text-text-muted'
              : healthy >= 0.8
                ? 'text-emerald-700 dark:text-emerald-400'
                : healthy >= 0.5
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-red-700 dark:text-red-400'
          }`}
        >
          {health ? `${health.updated} of ${health.active}` : '–'}
        </span>
        <span className="text-xs text-text-muted">have news from the last 24 hours</span>
      </Link>

      <Link href={`${SHIPMENTS}?news=none`} className={`${cell} border-b border-border-muted lg:border-b-0 lg:border-r`}>
        <span className={label}>No news 48h</span>
        <span
          className={`text-2xl font-semibold tabular-nums ${
            data?.noNews ? 'text-red-700 dark:text-red-400' : 'text-text-primary'
          }`}
        >
          {data ? data.noNews : '–'}
        </span>
        <span className="text-xs text-text-muted">on their way and gone quiet</span>
      </Link>

      <Link href={`${SHIPMENTS}?sort=eta`} className={`${cell} border-r border-border-muted`}>
        <span className={label}>Next 7 days</span>
        <span className="text-2xl font-semibold tabular-nums text-text-primary">
          {data ? `${data.arriving.count} arriving` : '–'}
        </span>
        <span className="text-xs text-text-muted">
          {data ? `${data.arriving.confirmed} ETA${data.arriving.confirmed === 1 ? '' : 's'} confirmed` : ' '}
        </span>
      </Link>

      <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
        <span className={label}>Waiting on</span>
        {data && data.waiting.length === 0 ? (
          <span className="text-sm text-text-muted">No next actions set yet. Use Update on a shipment.</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(data?.waiting ?? []).map((w) => (
              <Link
                key={w.ownerId}
                href={`${SHIPMENTS}?owner=${w.ownerId === data?.viewerId ? 'me' : w.ownerId}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-muted bg-surface-primary px-3 text-sm text-text-primary transition-colors hover:bg-fill-primary-hover"
              >
                {w.ownerId === data?.viewerId ? 'You' : w.name}
                <span className="font-semibold tabular-nums">{w.count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TeamBoardStrip;
