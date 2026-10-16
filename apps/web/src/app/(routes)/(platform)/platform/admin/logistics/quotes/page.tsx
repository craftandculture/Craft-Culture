'use client';

import {
  IconChevronRight,
  IconFileInvoice,
  IconGitCompare,
  IconHourglass,
  IconInbox,
  IconPlus,
  IconSearch,
  IconSnowflake,
  IconThermometer,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import type { Tone } from '@/app/_logistics/components/exports/exportUi';
import {
  card,
  money,
  pill,
  pillClass,
  primaryButton,
  secondaryButton,
  sectionHeading,
} from '@/app/_logistics/components/exports/exportUi';
import type {
  logisticsQuoteRequestStatus,
  logisticsQuoteStatus,
} from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type RequestStatus = (typeof logisticsQuoteRequestStatus.enumValues)[number];
type QuoteStatus = (typeof logisticsQuoteStatus.enumValues)[number];
type Focus = '' | 'awaiting' | 'decide' | 'completed' | 'standalone';

const requestStatusLabel: Record<RequestStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  quoted: 'Quoted',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const requestStatusTone: Record<RequestStatus, Tone> = {
  pending: 'amber',
  in_progress: 'blue',
  quoted: 'violet',
  completed: 'emerald',
  cancelled: 'slate',
};

const quoteStatusTone: Record<QuoteStatus, Tone> = {
  draft: 'slate',
  pending: 'amber',
  accepted: 'emerald',
  rejected: 'red',
  expired: 'slate',
};

const modeLabel: Record<string, string> = {
  sea_fcl: 'Sea FCL',
  sea_lcl: 'Sea LCL',
  air: 'Air',
  road: 'Road',
};

/** The most quotes the comparison screen sets side by side */
const MAX_COMPARE = 5;

/**
 * Whether a quote is still in the running
 *
 * @param status - Quote status
 * @returns False for rejected and expired quotes
 */
const isLive = (status: QuoteStatus) => status !== 'rejected' && status !== 'expired';

/**
 * Capitalise the first letter of a status
 *
 * @param text - Status as stored
 * @returns The status as it reads on screen
 */
const titleCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Freight quotes: one home for quote requests and the quotes they receive
 *
 * Each request is listed with the forwarder quotes received against it, the
 * best price and a comparison of them. Quotes entered without a request are
 * listed underneath. The tiles count what needs doing — requests no forwarder
 * has quoted yet, and requests with quotes waiting for a decision.
 */
const FreightQuotesPage = () => {
  const api = useTRPC();
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get('shipmentId') || undefined;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [focus, setFocus] = useState<Focus>('');
  const [selected, setSelected] = useState<string[]>([]);

  const {
    data: requestData,
    isLoading: requestsLoading,
    error: requestsError,
  } = useQuery({
    ...api.logistics.admin.requests.getMany.queryOptions({
      limit: 100,
      search: search || undefined,
    }),
    enabled: !shipmentId,
  });

  const {
    data: quoteData,
    isLoading: quotesLoading,
    error: quotesError,
  } = useQuery(
    api.logistics.admin.quotes.getMany.queryOptions({
      limit: 100,
      search: search || undefined,
      ...(shipmentId ? { shipmentId } : { withoutRequest: true }),
    }),
  );

  const requests = requestData?.requests ?? [];
  const standalone = quoteData?.quotes ?? [];

  const isOpen = (s: RequestStatus) => s !== 'completed' && s !== 'cancelled';
  const awaiting = requests.filter((r) => isOpen(r.status) && !r.quotes.some((q) => isLive(q.status)));
  const toDecide = requests.filter((r) => isOpen(r.status) && r.quotes.some((q) => q.status === 'pending'));
  const completed = requests.filter((r) => r.status === 'completed');

  const tiles: {
    key: Focus;
    label: string;
    sub: string;
    value: number;
    icon: typeof IconInbox;
    tone: string;
    iconTone: string;
    valueTone?: string;
  }[] = [
    {
      key: 'awaiting',
      label: 'Awaiting quotes',
      sub: 'Open, no live quote yet',
      value: awaiting.length,
      icon: IconHourglass,
      tone: 'border-amber-100 from-amber-50/50 dark:border-amber-900/50 dark:from-amber-500/10',
      iconTone: 'bg-amber-100/70 text-amber-600 dark:bg-amber-500/20',
      valueTone: 'text-amber-600',
    },
    {
      key: 'decide',
      label: 'To decide',
      sub: 'Quotes waiting to be accepted',
      value: toDecide.length,
      icon: IconGitCompare,
      tone: 'border-violet-100 from-violet-50/50 dark:border-violet-900/50 dark:from-violet-500/10',
      iconTone: 'bg-violet-100/70 text-violet-500 dark:bg-violet-500/20',
      valueTone: 'text-violet-600',
    },
    {
      key: 'completed',
      label: 'Completed',
      sub: 'A quote was accepted',
      value: completed.length,
      icon: IconInbox,
      tone: 'border-emerald-100 from-emerald-50/50 dark:border-emerald-900/50 dark:from-emerald-500/10',
      iconTone: 'bg-emerald-100/70 text-emerald-600 dark:bg-emerald-500/20',
      valueTone: 'text-emerald-600',
    },
    {
      key: 'standalone',
      label: 'Without a request',
      sub: 'Quotes entered directly',
      value: standalone.length,
      icon: IconFileInvoice,
      tone: 'border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10',
      iconTone: 'bg-slate-100 text-slate-500 dark:bg-slate-500/20',
    },
  ];

  const shownRequests = requests.filter((r) => {
    if (focus === 'standalone') return false;
    if (focus === 'awaiting' && !awaiting.includes(r)) return false;
    if (focus === 'decide' && !toDecide.includes(r)) return false;
    if (focus === 'completed' && r.status !== 'completed') return false;
    if (status && r.status !== status) return false;
    return true;
  });
  const showStandalone = !!shipmentId || focus === '' || focus === 'standalone';

  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const canCompareSelected = selected.length >= 2 && selected.length <= MAX_COMPARE;

  return (
    <div className="container mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href="/platform/admin/logistics" className="transition-colors hover:text-text-primary">
              Logistics
            </Link>
            <IconChevronRight className="size-4" />
            <span className="text-text-primary">Freight quotes</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Freight quotes</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Requests for freight and the forwarder quotes received against each one
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/platform/admin/logistics/quotes/new" className={secondaryButton}>
            <IconPlus size={16} /> Quote without a request
          </Link>
          <Link href="/platform/admin/logistics/requests/new" className={primaryButton}>
            <IconPlus size={16} /> New request
          </Link>
        </div>
      </div>

      {(requestsError || quotesError) && (
        <p className={`${card} p-6 text-sm text-text-muted`}>
          Freight quotes could not be loaded: {(requestsError ?? quotesError)?.message}
        </p>
      )}

      {shipmentId ? (
        <p className={`${card} flex items-center justify-between gap-3 p-4 text-sm text-text-muted`}>
          Showing the quotes linked to one shipment.
          <Link href="/platform/admin/logistics/quotes" className={secondaryButton}>
            Show all freight quotes
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {tiles.map((tile) => {
            const active = focus === tile.key;
            const TileIcon = tile.icon;
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => setFocus(active ? '' : tile.key)}
                className={`rounded-xl border bg-gradient-to-b to-transparent px-3 py-2.5 text-center shadow-sm transition hover:-translate-y-px hover:shadow-md ${tile.tone} ${
                  active ? 'ring-2 ring-text-primary ring-offset-1 ring-offset-surface-primary' : ''
                }`}
              >
                <span className={`mx-auto mb-1 flex size-6 items-center justify-center rounded-md ${tile.iconTone}`}>
                  <TileIcon size={13} />
                </span>
                <span
                  className={`block text-lg font-bold leading-tight tabular-nums ${
                    tile.value === 0 ? 'text-text-muted' : (tile.valueTone ?? '')
                  }`}
                >
                  {tile.value}
                </span>
                <span className="block text-[11px] text-text-muted">{tile.label}</span>
                <span className="block text-[10px] text-text-muted/80">{tile.sub}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search requests by number, route or cargo, and quotes by number or forwarder"
          className="h-11 w-full rounded-xl border border-border-muted bg-surface-primary pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:border-text-primary focus:outline-none"
        />
      </div>

      {!shipmentId && focus !== 'standalone' && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" className={pill(status === '')} onClick={() => setStatus('')}>
            All requests
            <span className="ml-1.5 tabular-nums opacity-60">{requests.length}</span>
          </button>
          {(Object.keys(requestStatusLabel) as RequestStatus[]).map((s) => (
            <button key={s} type="button" className={pill(status === s)} onClick={() => setStatus(status === s ? '' : s)}>
              {requestStatusLabel[s]}
              <span className="ml-1.5 tabular-nums opacity-60">{requests.filter((r) => r.status === s).length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Requests, each with its quotes beneath it */}
      {!shipmentId && focus !== 'standalone' && (
        <div className={card}>
          <div className="flex items-center gap-2 border-b border-border-muted px-4 py-3">
            <span className={sectionHeading}>Requests</span>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
              {shownRequests.length}
            </span>
          </div>

          {requestsLoading ? (
            <p className="py-12 text-center text-sm text-text-muted">Loading requests…</p>
          ) : shownRequests.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-muted">
              {requests.length ? 'No requests match.' : 'No quote requests yet. Open the first with New request.'}
            </p>
          ) : (
            <ul className="divide-y divide-border-muted">
              {shownRequests.map((r) => {
                const live = r.quotes.filter((q) => isLive(q.status));
                const best = live[0];
                const pendingCount = r.quotes.filter((q) => q.status === 'pending').length;
                const compareIds = (live.length >= 2 ? live : r.quotes).slice(0, MAX_COMPARE).map((q) => q.id);
                const href = `/platform/admin/logistics/requests/${r.id}`;
                const cargo = [
                  titleCase(r.productType),
                  r.totalCases ? `${r.totalCases} cases` : null,
                  r.totalPallets ? `${r.totalPallets} pallets` : null,
                  r.totalWeightKg ? `${r.totalWeightKg.toFixed(0)} kg` : null,
                  r.transportMode ? modeLabel[r.transportMode] : null,
                ].filter(Boolean);

                return (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                      <Link href={href} className="group min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-text-primary group-hover:underline">
                            {r.requestNumber}
                          </span>
                          <span className={pillClass(requestStatusTone[r.status])}>{requestStatusLabel[r.status]}</span>
                          {(r.priority === 'high' || r.priority === 'urgent') && (
                            <span className={pillClass(r.priority === 'urgent' ? 'red' : 'amber')}>
                              {titleCase(r.priority)}
                            </span>
                          )}
                          {r.requiresThermalLiner && (
                            <span className={pillClass('slate')}>
                              <IconSnowflake size={11} /> Liner
                            </span>
                          )}
                          {r.requiresTracker && (
                            <span className={pillClass('slate')}>
                              <IconThermometer size={11} /> Tracker
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-text-primary">
                          {r.originCity || r.originCountry} → {r.destinationCity || r.destinationCountry}
                        </p>
                        <p className="truncate text-xs text-text-muted">
                          {cargo.join(' · ')}
                          {r.requester ? ` · ${r.requester.name || r.requester.email}` : ''}
                          {' · '}
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </p>
                      </Link>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                        <span className="text-xs text-text-muted">
                          {r.quotes.length === 0
                            ? 'No quotes yet'
                            : `${r.quotes.length} quote${r.quotes.length === 1 ? '' : 's'}`}
                          {best && r.quotes.length > 0 ? ` · best ${money(best.totalPrice, best.currency)}` : ''}
                          {pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
                        </span>
                        {compareIds.length >= 2 && (
                          <Link
                            href={`/platform/admin/logistics/quotes/compare?ids=${compareIds.join(',')}`}
                            className={secondaryButton}
                          >
                            <IconGitCompare size={15} /> Compare
                          </Link>
                        )}
                        {isOpen(r.status) && (
                          <Link
                            href={`/platform/admin/logistics/quotes/new?requestId=${r.id}`}
                            className={secondaryButton}
                          >
                            <IconPlus size={15} /> Add quote
                          </Link>
                        )}
                      </div>
                    </div>

                    {r.quotes.length > 0 && (
                      <ul className="mt-2 space-y-1 border-l-2 border-border-muted pl-3">
                        {r.quotes.map((q) => (
                          <li key={q.id}>
                            <Link
                              href={`/platform/admin/logistics/quotes/${q.id}`}
                              className="flex items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors hover:bg-surface-secondary/50"
                            >
                              <span className="font-mono text-xs text-text-muted">{q.quoteNumber}</span>
                              <span className="min-w-0 flex-1 truncate text-text-primary">{q.forwarderName}</span>
                              {q.transitDays ? (
                                <span className="hidden text-xs text-text-muted sm:inline">{q.transitDays} days</span>
                              ) : null}
                              <span className="tabular-nums text-text-primary">{money(q.totalPrice, q.currency)}</span>
                              {best && q.id === best.id && live.length > 1 && (
                                <span className={pillClass('emerald')}>Best price</span>
                              )}
                              <span className={pillClass(quoteStatusTone[q.status])}>{titleCase(q.status)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Quotes entered without a request */}
      {showStandalone && (
        <div className={card}>
          <div className="flex items-center gap-2 border-b border-border-muted px-4 py-3">
            <span className={sectionHeading}>{shipmentId ? 'Quotes for this shipment' : 'Quotes without a request'}</span>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
              {standalone.length}
            </span>
            {selected.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-text-muted">
                  {canCompareSelected ? `${selected.length} selected` : `Select 2 to ${MAX_COMPARE} quotes to compare`}
                </span>
                {canCompareSelected && (
                  <Link
                    href={`/platform/admin/logistics/quotes/compare?ids=${selected.join(',')}`}
                    className={primaryButton}
                  >
                    <IconGitCompare size={15} /> Compare
                  </Link>
                )}
              </div>
            )}
          </div>

          {quotesLoading ? (
            <p className="py-12 text-center text-sm text-text-muted">Loading quotes…</p>
          ) : standalone.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              {shipmentId ? 'No quotes are linked to this shipment.' : 'Every quote answers a request.'}
            </p>
          ) : (
            <ul className="divide-y divide-border-muted">
              {standalone.map((q) => (
                <li key={q.id} className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${q.quoteNumber} to compare`}
                    checked={selected.includes(q.id)}
                    onChange={() => toggleSelected(q.id)}
                  />
                  <Link
                    href={`/platform/admin/logistics/quotes/${q.id}`}
                    className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-text-primary">{q.quoteNumber}</span>
                        <span className={pillClass(quoteStatusTone[q.status])}>{titleCase(q.status)}</span>
                        {q.shipment && <span className={pillClass('blue')}>{q.shipment.shipmentNumber}</span>}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-text-primary">{q.forwarderName}</p>
                      <p className="truncate text-xs text-text-muted">
                        {q.originCity || q.originCountry || '—'} → {q.destinationCity || q.destinationCountry || '—'}
                        {q.transportMode ? ` · ${modeLabel[q.transportMode]}` : ''}
                        {q.transitDays ? ` · ${q.transitDays} days` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-text-primary">
                      {money(q.totalPrice, q.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default FreightQuotesPage;
