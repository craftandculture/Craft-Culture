'use client';

import {
  IconAdjustmentsHorizontal,
  IconArrowsExchange,
  IconChevronDown,
  IconFileText,
  IconPackageExport,
  IconPackageImport,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import useTRPC from '@/lib/trpc/browser';

import type { PartnerActivityEntry } from '../controllers/partnerGetActivity';

type Stream = 'stock' | 'order' | 'rfq';

const STREAMS: { key: Stream; label: string }[] = [
  { key: 'stock', label: 'Stock' },
  { key: 'order', label: 'Orders' },
  { key: 'rfq', label: 'RFQs' },
];

/** The look of each kind of event: an icon on a tinted disc */
const KIND_STYLE = {
  in: { icon: IconPackageImport, disc: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  out: { icon: IconPackageExport, disc: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  dispatch: { icon: IconTruckDelivery, disc: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  internal: { icon: IconArrowsExchange, disc: 'bg-fill-muted text-text-muted' },
  correction: { icon: IconAdjustmentsHorizontal, disc: 'bg-fill-muted text-text-muted' },
  update: { icon: IconFileText, disc: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
} as const;

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
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
};

const timeLabel = (value: Date | string) =>
  new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One event: icon, what happened and to what, quantity and time */
const Row = ({ entry }: { entry: PartnerActivityEntry }) => {
  const style =
    entry.title === 'Dispatched' ? KIND_STYLE.dispatch : KIND_STYLE[entry.kind];
  const quantity =
    entry.kind === 'correction' && entry.quantity && !entry.quantity.startsWith('−')
      ? `+${entry.quantity}`
      : entry.quantity;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full ${style.disc}`}
        aria-hidden
      >
        <Icon icon={style.icon} size="sm" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-text-muted">{entry.title}</p>
        <p className="truncate text-[14px] font-medium text-text-primary">{entry.subject}</p>
        {entry.detail && (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-text-muted">{entry.detail}</p>
        )}
      </div>
      <div className="flex flex-none flex-col items-end gap-1">
        {quantity && (
          <span className="rounded-full bg-fill-muted px-2.5 py-0.5 text-[12px] font-medium tabular-nums text-text-primary">
            {quantity}
          </span>
        )}
        <span className="text-[11.5px] tabular-nums text-text-muted" title={entry.reference ?? undefined}>
          {timeLabel(entry.at)}
        </span>
      </div>
    </div>
  );
};


/**
 * One feed for everything that has happened to a partner.
 *
 * Read the way a partner reads it: what arrived, what left, what happened to
 * their orders. Those are listed in full. Warehouse housekeeping — bay moves,
 * put-away, repacks and stock-count corrections — is real and stays visible,
 * but folded into one line per day, because a day of cycle counting used to
 * bury the one pick that mattered.
 *
 * Each day opens with a one-line summary, so a week can be scanned without
 * reading every row.
 */
const PartnerActivityFeed = () => {
  const api = useTRPC();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery(
    api.partners.getActivity.queryOptions({
      streams: streams.length > 0 ? streams : undefined,
      limit: 150,
    }),
  );

  const entries = data?.entries ?? [];
  type Entry = PartnerActivityEntry;

  // Day headings in the order the entries arrive, which is already newest-first.
  const days = entries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const key = dayLabel(entry.at);
    acc[key] = [...(acc[key] ?? []), entry];
    return acc;
  }, {});

  const isHousekeeping = (e: Entry) => e.kind === 'internal' || e.kind === 'correction';

  const summarise = (dayEntries: Entry[]) => {
    const count = (k: Entry['kind']) => dayEntries.filter((e) => e.kind === k).length;
    return [
      count('in') && `${count('in')} received`,
      count('out') && `${count('out')} out`,
      count('update') && plural(count('update'), 'order update'),
      count('correction') && plural(count('correction'), 'count correction'),
      count('internal') && plural(count('internal'), 'bay move'),
    ]
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
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
              className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${
                on
                  ? 'bg-text-primary text-background-primary'
                  : 'bg-fill-muted/60 text-text-muted hover:bg-fill-muted hover:text-text-primary'
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
        <p className="py-8 text-center text-sm text-text-muted">Nothing recorded yet.</p>
      ) : (
        <div className="space-y-7">
          {Object.entries(days).map(([day, dayEntries]) => {
            const main = dayEntries.filter((e) => !isHousekeeping(e));
            const housekeeping = dayEntries.filter(isHousekeeping);
            const open = openDays.has(day);

            return (
              <section key={day}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-[13px] font-semibold text-text-primary">{day}</h2>
                  <p className="text-[12px] text-text-muted">{summarise(dayEntries)}</p>
                </div>

                <div className="divide-y divide-border-muted overflow-hidden rounded-xl border border-border-muted bg-fill-primary">
                  {main.map((entry) => (
                    <Row key={entry.id} entry={entry} />
                  ))}

                  {housekeeping.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenDays((prev) => {
                            const next = new Set(prev);
                            if (next.has(day)) next.delete(day);
                            else next.add(day);
                            return next;
                          })
                        }
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-fill-muted/30"
                      >
                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-fill-muted text-text-muted">
                          <Icon icon={IconAdjustmentsHorizontal} size="sm" />
                        </span>
                        <span className="flex-1 text-[13px] text-text-muted">
                          Warehouse housekeeping ·{' '}
                          {[
                            housekeeping.filter((e) => e.kind === 'correction').length &&
                              plural(
                                housekeeping.filter((e) => e.kind === 'correction').length,
                                'count correction',
                              ),
                            housekeeping.filter((e) => e.kind === 'internal').length &&
                              plural(
                                housekeeping.filter((e) => e.kind === 'internal').length,
                                'bay move',
                              ),
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                        <Icon
                          icon={IconChevronDown}
                          size="sm"
                          className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {open && (
                        <div className="divide-y divide-border-muted bg-fill-muted/20">
                          {housekeeping.map((entry) => (
                            <Row key={entry.id} entry={entry} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PartnerActivityFeed;
