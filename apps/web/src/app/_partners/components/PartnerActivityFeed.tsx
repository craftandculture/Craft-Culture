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
export interface PartnerActivityFeedProps {
  /** A Private Cellar member's feed: their stock only, buyers named */
  source?: 'partner' | 'cellar';
}

const PartnerActivityFeed = ({ source = 'partner' }: PartnerActivityFeedProps) => {
  const api = useTRPC();
  const isCellar = source === 'cellar';
  const [streams, setStreams] = useState<Stream[]>([]);
  // Folded rows the user has opened: a day's housekeeping, or an order's picks
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const partnerQuery = useQuery({
    ...api.partners.getActivity.queryOptions({
      streams: streams.length > 0 ? streams : undefined,
      limit: 150,
    }),
    enabled: !isCellar,
  });
  const cellarQuery = useQuery({
    ...api.cellar.member.getActivity.queryOptions({ limit: 200 }),
    enabled: isCellar,
  });
  const data = isCellar ? cellarQuery.data : partnerQuery.data;
  const isLoading = isCellar ? cellarQuery.isLoading : partnerQuery.isLoading;

  const entries = data?.entries ?? [];
  type Entry = PartnerActivityEntry;

  // Day headings in the order the entries arrive, which is already newest-first.
  const days = entries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const key = dayLabel(entry.at);
    acc[key] = [...(acc[key] ?? []), entry];
    return acc;
  }, {});

  const isHousekeeping = (e: Entry) => e.kind === 'internal' || e.kind === 'correction';

  /*
    Picks for one order become one row. An order of twenty wines was twenty
    rows a minute apart; what the partner wants to know is that an order took
    their stock, which one, and how much. The wines are a click away.
  */
  type Item =
    | { type: 'entry'; entry: Entry }
    | { type: 'order'; ref: string; entries: Entry[] };

  const groupByOrder = (list: Entry[]) => {
    const items: Item[] = [];
    const byRef = new Map<string, Entry[]>();
    for (const entry of list) {
      if (entry.kind === 'out' && entry.orderRef) {
        const group = byRef.get(entry.orderRef);
        if (group) {
          group.push(entry);
          continue;
        }
        const fresh = [entry];
        byRef.set(entry.orderRef, fresh);
        items.push({ type: 'order', ref: entry.orderRef, entries: fresh });
      } else {
        items.push({ type: 'entry', entry });
      }
    }
    // A one-wine order reads better as the plain row
    return items.map((item) =>
      item.type === 'order' && item.entries.length === 1
        ? { type: 'entry' as const, entry: item.entries[0]! }
        : item,
    );
  };

  const summarise = (dayEntries: Entry[]) => {
    const count = (k: Entry['kind']) => dayEntries.filter((e) => e.kind === k).length;
    return [
      count('in') && `${count('in')} received`,
      count('out') && `${plural(count('out'), 'wine')} out`,
      count('update') && plural(count('update'), 'order update'),
      count('correction') && plural(count('correction'), 'count correction'),
      count('internal') && plural(count('internal'), 'bay move'),
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const summary = !isCellar ? partnerQuery.data?.summary : undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,48rem)_17rem]">
    <div className="space-y-5">
      <div className={`flex flex-wrap items-center gap-1.5 ${isCellar ? 'hidden' : ''}`}>
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
            const open = opened.has(`${day}|housekeeping`);

            return (
              <section key={day}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-[13px] font-semibold text-text-primary">{day}</h2>
                  <p className="text-[12px] text-text-muted">{summarise(dayEntries)}</p>
                </div>

                <div className="divide-y divide-border-muted overflow-hidden rounded-xl border border-border-muted bg-fill-primary">
                  {groupByOrder(main).map((item) => {
                    if (item.type === 'entry') {
                      return <Row key={item.entry.id} entry={item.entry} />;
                    }
                    const key = `${day}|order|${item.ref}`;
                    const isOpen = opened.has(key);
                    const bottles = item.entries.reduce((sum, e) => sum + e.bottles, 0);
                    const times = item.entries.map((e) => timeLabel(e.at)).sort();
                    const span =
                      times[0] === times[times.length - 1]
                        ? times[0]
                        : `${times[0]}–${times[times.length - 1]}`;
                    return (
                      <div key={key}>
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-fill-muted/30"
                        >
                          <span
                            className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full ${KIND_STYLE.out.disc}`}
                            aria-hidden
                          >
                            <Icon icon={KIND_STYLE.out.icon} size="sm" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-medium text-text-muted">
                              Picked for an order
                            </span>
                            <span className="block text-[14px] font-medium text-text-primary">
                              {item.ref} · {plural(item.entries.length, 'wine')}
                            </span>
                          </span>
                          <span className="flex flex-none flex-col items-end gap-1">
                            <span className="rounded-full bg-fill-muted px-2.5 py-0.5 text-[12px] font-medium tabular-nums text-text-primary">
                              {plural(bottles, 'bottle')}
                            </span>
                            <span className="flex items-center gap-1 text-[11.5px] tabular-nums text-text-muted">
                              {span}
                              <Icon
                                icon={IconChevronDown}
                                size="xs"
                                className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              />
                            </span>
                          </span>
                        </button>
                        {isOpen && (
                          <div className="divide-y divide-border-muted border-t border-border-muted bg-fill-muted/20">
                            {item.entries.map((entry) => (
                              <Row key={entry.id} entry={entry} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {housekeeping.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => toggle(`${day}|housekeeping`)}
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

    {/* The week at a glance */}
    {summary && (
      <aside className="order-first lg:order-none">
        <div className="space-y-3 rounded-xl border border-border-muted bg-fill-primary p-4 lg:sticky lg:top-24">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Last 7 days
          </p>
          {[
            { label: 'Received', value: plural(summary.receivedBottles, 'bottle'), tint: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Picked out', value: plural(summary.outBottles, 'bottle'), tint: 'bg-amber-50 dark:bg-amber-900/20' },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-lg px-3 py-2 ${stat.tint}`}>
              <p className="text-[12px] text-text-muted">{stat.label}</p>
              <p className="text-[16px] font-semibold tabular-nums text-text-primary">{stat.value}</p>
            </div>
          ))}
          <div className="border-t border-border-muted pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Now
            </p>
            <p className="mt-2 text-[13px] text-text-primary">
              <span className="font-semibold tabular-nums">{plural(summary.onHandBottles, 'bottle')}</span>
              <span className="text-text-muted"> in the warehouse · {plural(summary.onHandWines, 'wine')}</span>
            </p>
            <p className="mt-1 text-[13px] text-text-primary">
              <span className="font-semibold tabular-nums">{summary.ordersInProgress}</span>
              <span className="text-text-muted"> private-client {summary.ordersInProgress === 1 ? 'order' : 'orders'} in progress</span>
            </p>
          </div>
        </div>
      </aside>
    )}
    </div>
  );
};

export default PartnerActivityFeed;
