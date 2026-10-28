'use client';

import { IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import UpdateCard from './UpdateCard';
import type { ProductUpdateType } from '../types';

export interface WhatsNewTimelineProps {
  updates: {
    id: string;
    type: ProductUpdateType;
    title: string;
    body: string;
    linkPath: string | null;
    date: Date;
    publishedAt: Date | null;
  }[];
  /** When the member last opened the page; later updates are marked New */
  seenAt: Date | null;
  preview?: boolean;
}

const FILTERS: { key: 'all' | ProductUpdateType; label: string }[] = [
  { key: 'all', label: 'All updates' },
  { key: 'feature', label: 'New features' },
  { key: 'improvement', label: 'Improvements' },
  { key: 'fix', label: 'Fixes' },
];

/** The rail marker beside each update, coloured as its tag is */
const MARKER: Record<ProductUpdateType, string> = {
  feature: 'border-emerald-500',
  improvement: 'border-amber-500',
  fix: 'border-slate-400',
};

const dayLabel = (date: Date) =>
  date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/**
 * The What's New timeline: search, filters with counts, and updates by day
 *
 * The chosen filter is underlined rather than filled, and filters with no
 * updates are hidden, so the page stays quiet.
 *
 * Shared by the member page and the staff preview, so what staff check is
 * exactly what members see. Updates are dated by when they shipped; "New"
 * follows when they were published, so an update published today about last
 * week's release is still new to someone who visited yesterday.
 */
const WhatsNewTimeline = ({ updates, seenAt, preview }: WhatsNewTimelineProps) => {
  const [filter, setFilter] = useState<'all' | ProductUpdateType>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const result: Record<'all' | ProductUpdateType, number> = { all: updates.length, feature: 0, improvement: 0, fix: 0 };
    for (const update of updates) result[update.type] += 1;
    return result;
  }, [updates]);

  const days = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = updates.filter(
      (u) =>
        (filter === 'all' || u.type === filter) && (!q || `${u.title} ${u.body}`.toLowerCase().includes(q)),
    );

    const grouped: { label: string; items: typeof shown }[] = [];
    for (const update of shown) {
      const label = dayLabel(new Date(update.date));
      const last = grouped[grouped.length - 1];
      if (last?.label === label) last.items.push(update);
      else grouped.push({ label, items: [update] });
    }
    return grouped;
  }, [updates, filter, query]);

  const isNew = (publishedAt: Date | null) =>
    !!seenAt && !!publishedAt && new Date(publishedAt) > new Date(seenAt);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="border-border-primary bg-background-primary flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full border px-4 shadow-sm">
          <IconSearch size={16} className="text-text-muted shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search updates"
            aria-label="Search updates"
            className="text-text-primary placeholder:text-text-muted w-full min-w-0 bg-transparent text-sm outline-none"
          />
        </label>
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {/* A filter with nothing under it is only noise, so it is not offered */}
          {FILTERS.filter((f) => f.key === 'all' || counts[f.key] > 0).map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.key)}
                className={`flex min-h-10 shrink-0 items-center gap-2 px-2 text-sm whitespace-nowrap underline-offset-[6px] transition-colors ${
                  active
                    ? 'text-text-primary font-semibold underline decoration-2'
                    : 'text-text-muted hover:text-text-primary font-medium'
                }`}
              >
                {f.label}
                <span className="text-text-muted text-xs tabular-nums">
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {days.length === 0 ? (
        <p className="text-text-muted py-8 text-sm">
          {updates.length === 0 ? 'Updates to your private cellar will appear here.' : 'No updates match your search.'}
        </p>
      ) : (
        <div className="rounded-2xl bg-black/[0.025] p-3 sm:p-5 dark:bg-white/[0.02]">
        <div className="relative ml-1.5 border-l-2 border-black/[0.08] pl-5 sm:pl-7 dark:border-white/10">
          {days.map((day) => (
            <section key={day.label} className="mb-7 last:mb-0">
              <h2 className="text-text-secondary relative mb-3 text-xs font-semibold tracking-wider uppercase">
                <span className="absolute top-1 -left-[25px] size-2 rounded-[2px] bg-neutral-400 sm:-left-[33px] dark:bg-neutral-500" />
                {day.label}
              </h2>
              <div className="flex flex-col gap-3">
                {day.items.map((update) => (
                  <div key={update.id} className="relative">
                    <span
                      aria-hidden
                      className={`absolute top-6 -left-[27px] size-3 rounded-full border-2 bg-surface-primary sm:-left-[35px] dark:bg-neutral-950 ${MARKER[update.type]}`}
                    />
                  <UpdateCard
                    type={update.type}
                    title={update.title}
                    body={update.body}
                    linkPath={update.linkPath}
                    isNew={isNew(update.publishedAt)}
                    highlight={query}
                    preview={preview}
                  />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        </div>
      )}
    </div>
  );
};

export default WhatsNewTimeline;
