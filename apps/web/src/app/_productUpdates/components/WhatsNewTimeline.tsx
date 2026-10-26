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

const dayLabel = (date: Date) =>
  date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/**
 * The What's New timeline: search, filters with counts, and updates by day
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
        <label className="border-border-muted bg-background-primary flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full border px-4">
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
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.key)}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-text-primary text-surface-primary border-text-primary'
                    : 'border-border-muted bg-background-primary text-text-primary hover:bg-fill-muted'
                }`}
              >
                {f.label}
                <span className={`text-xs tabular-nums ${active ? 'opacity-70' : 'text-text-muted'}`}>
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
        <div className="border-border-muted relative ml-1.5 border-l pl-5 sm:pl-7">
          {days.map((day) => (
            <section key={day.label} className="mb-7 last:mb-0">
              <h2 className="text-text-muted relative mb-3 text-xs font-semibold tracking-wider uppercase">
                <span className="bg-border-primary absolute top-1 -left-[25px] size-2 rounded-[2px] sm:-left-[33px]" />
                {day.label}
              </h2>
              <div className="flex flex-col gap-3">
                {day.items.map((update) => (
                  <UpdateCard
                    key={update.id}
                    type={update.type}
                    title={update.title}
                    body={update.body}
                    linkPath={update.linkPath}
                    isNew={isNew(update.publishedAt)}
                    highlight={query}
                    preview={preview}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default WhatsNewTimeline;
