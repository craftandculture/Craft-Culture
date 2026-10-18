'use client';

import {
  IconAlertTriangle,
  IconArrowRight,
  IconCircleCheck,
  IconClockHour4,
  IconHandFinger,
  IconRefresh,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import Link from 'next/link';

import useTRPC from '@/lib/trpc/browser';

const TONES = {
  urgent: {
    label: 'Do today',
    pill: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-900',
    tile: 'border-red-100 from-red-50/50 dark:border-red-900/50 dark:from-red-500/10',
    icon: 'bg-red-100/70 text-red-500 dark:bg-red-500/20',
  },
  action: {
    label: 'To decide',
    pill: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900',
    tile: 'border-amber-100 from-amber-50/50 dark:border-amber-900/50 dark:from-amber-500/10',
    icon: 'bg-amber-100/70 text-amber-600 dark:bg-amber-500/20',
  },
  chase: {
    label: 'To chase',
    pill: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-900',
    tile: 'border-blue-100 from-blue-50/50 dark:border-blue-900/50 dark:from-blue-500/10',
    icon: 'bg-blue-100/70 text-blue-600 dark:bg-blue-500/20',
  },
} as const;

const QUIET = {
  tile: 'border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10',
  icon: 'bg-slate-100 text-slate-500 dark:bg-slate-500/20',
};

const ICONS = {
  urgent: IconAlertTriangle,
  action: IconHandFinger,
  chase: IconClockHour4,
};

/**
 * Everything in Private Cellar waiting on the team, on one screen
 *
 * Exception-first: a heading appears only when something is under it, and an
 * empty queue says so in one line. Each heading shows the oldest few and links
 * to the screen where the work is done; nothing is actioned from here.
 */
const AttentionQueue = () => {
  const api = useTRPC();
  const { data, isLoading, refetch, isRefetching } = useQuery(
    api.cellar.admin.getAttention.queryOptions(),
  );

  const groups = data?.groups ?? [];
  const byTone = (tone: keyof typeof TONES) =>
    groups.filter((item) => item.tone === tone).reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-muted text-sm">
          What is waiting on us across purchases, deliveries, offers, sign-ups and transfers
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="border-border-muted text-text-primary inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50"
        >
          <IconRefresh size={15} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {(Object.keys(TONES) as (keyof typeof TONES)[]).map((tone) => {
          const count = byTone(tone);
          const Icon = ICONS[tone];
          const style = count > 0 ? TONES[tone] : QUIET;

          return (
            <div
              key={tone}
              className={`rounded-xl border bg-gradient-to-b to-transparent px-3 py-2.5 text-center shadow-sm ${style.tile}`}
            >
              <span className={`mx-auto mb-1 flex size-6 items-center justify-center rounded-md ${style.icon}`}>
                <Icon size={14} />
              </span>
              <span className="text-text-primary block text-lg font-bold leading-tight tabular-nums">
                {isLoading ? '–' : count}
              </span>
              <span className="text-text-muted block text-[11px]">{TONES[tone].label}</span>
            </div>
          );
        })}
      </div>

      {isLoading && <p className="text-text-muted py-6 text-sm">Loading…</p>}

      {!isLoading && groups.length === 0 && (
        <div className="border-border-muted flex items-center justify-center gap-2 rounded-xl border px-4 py-10 text-sm">
          <IconCircleCheck size={18} className="text-emerald-600" />
          <span className="text-text-primary font-semibold">Nothing is waiting on us.</span>
        </div>
      )}

      <ul className="space-y-2.5">
        {groups.map((group) => (
          <li
            key={group.key}
            className="border-border-muted bg-surface-primary overflow-hidden rounded-xl border shadow-sm"
          >
            <div className="border-border-muted flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset ${TONES[group.tone].pill}`}
                >
                  {group.count}
                </span>
                <p className="text-text-primary text-sm font-semibold">{group.label}</p>
                <p className="text-text-muted hidden text-xs sm:block">· {group.action}</p>
              </div>
              <Link
                href={group.href}
                className="bg-text-primary text-surface-primary inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold"
              >
                Open <IconArrowRight size={13} />
              </Link>
            </div>
            <ul className="divide-border-muted divide-y">
              {group.rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="text-text-primary font-medium">{row.title}</span>
                    <span className="text-text-muted"> · {row.detail}</span>
                  </span>
                  {row.since && (
                    <span className="text-text-muted text-xs tabular-nums">
                      {formatDistanceToNowStrict(new Date(row.since), { addSuffix: true })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {group.count > group.rows.length && (
              <Link
                href={group.href}
                className="text-text-muted hover:text-text-primary border-border-muted block border-t px-4 py-2 text-xs font-semibold"
              >
                and {group.count - group.rows.length} more
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AttentionQueue;
