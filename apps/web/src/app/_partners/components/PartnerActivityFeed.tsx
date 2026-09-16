'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

type Stream = 'stock' | 'order' | 'rfq';

const STREAMS: { key: Stream; label: string; tone: string; dot: string }[] = [
  { key: 'stock', label: 'Stock', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  { key: 'order', label: 'Orders', tone: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  { key: 'rfq', label: 'RFQs', tone: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
];

/** Today, Yesterday, then the date — how people actually place things. */
const dayLabel = (value: Date | string) => {
  const date = new Date(value);
  const today = new Date();
  const asDay = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (asDay(date) === asDay(today)) return 'Today';
  if (asDay(date) === asDay(yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
};

const timeLabel = (value: Date | string) =>
  new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * One feed for everything that has happened to a partner.
 *
 * Stock, their private-client orders and the RFQs they were invited to answer
 * the same question — what has been going on — and they were three screens
 * whose timestamps had to be reconciled by hand.
 *
 * Grouped by day rather than paginated by count, because "what happened
 * yesterday" is the question people actually arrive with.
 */
const PartnerActivityFeed = () => {
  const api = useTRPC();
  const [streams, setStreams] = useState<Stream[]>([]);

  const { data, isLoading } = useQuery(
    api.partners.getActivity.queryOptions({
      streams: streams.length > 0 ? streams : undefined,
      limit: 120,
    }),
  );

  const entries = data?.entries ?? [];

  // Day headings in the order the entries arrive, which is already newest-first.
  const days = entries.reduce<Record<string, typeof entries>>((acc, entry) => {
    const key = dayLabel(entry.at);
    acc[key] = [...(acc[key] ?? []), entry];
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {STREAMS.map((stream) => {
          const on = streams.includes(stream.key);
          return (
            <button
              key={stream.key}
              type="button"
              onClick={() =>
                setStreams((prev) =>
                  on ? prev.filter((s) => s !== stream.key) : [...prev, stream.key],
                )
              }
              className={`rounded-full px-3 py-1 text-[12.5px] font-medium ring-1 ring-inset transition-colors ${
                on
                  ? stream.tone
                  : 'text-text-muted ring-border-muted hover:bg-fill-secondary'
              }`}
            >
              {stream.label}
            </button>
          );
        })}
        {streams.length > 0 && (
          <button
            type="button"
            onClick={() => setStreams([])}
            className="px-2 text-[12px] text-text-muted underline-offset-2 hover:underline"
          >
            Show all
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          Nothing recorded yet.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(days).map(([day, dayEntries]) => (
            <div key={day}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {day}
              </h2>
              <div className="overflow-hidden rounded-xl border border-border-muted">
                {dayEntries.map((entry, index) => {
                  const stream = STREAMS.find((s) => s.key === entry.stream);
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-start gap-3 px-4 py-2.5 ${
                        index > 0 ? 'border-t border-border-muted' : ''
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${stream?.dot ?? 'bg-slate-400'}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px]">
                          <span className="font-medium">{entry.title}</span>
                          <span className="text-text-muted"> · </span>
                          <span>{entry.subject}</span>
                        </p>
                        {entry.detail && (
                          <p className="mt-0.5 text-[12px] text-text-muted">
                            {entry.detail}
                          </p>
                        )}
                      </div>
                      <div className="flex-none text-right">
                        <p className="text-[12px] tabular-nums text-text-muted">
                          {timeLabel(entry.at)}
                        </p>
                        {entry.reference && (
                          <p className="font-mono text-[10px] text-text-muted/70">
                            {entry.reference}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PartnerActivityFeed;
