'use client';

import {
  IconAlertCircle,
  IconChevronRight,
  IconFileInvoice,
  IconGitCompare,
  IconHourglass,
  IconInbox,
  IconPlus,
  IconSearch,
  IconSnowflake,
  IconThermometer,
  IconUsers,
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
  pillClass,
  primaryButton,
  secondaryButton,
  sectionHeading,
} from '@/app/_logistics/components/exports/exportUi';
import type { QuoteRequestNextStep } from '@/app/_logistics/utils/quoteRequestNextStep';
import type {
  logisticsQuoteRequestStatus,
  logisticsQuoteStatus,
} from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type RequestStatus = (typeof logisticsQuoteRequestStatus.enumValues)[number];
type QuoteStatus = (typeof logisticsQuoteStatus.enumValues)[number];
type Focus = '' | 'action' | 'awaiting' | 'decide' | 'completed' | 'standalone';

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

/** What each request is waiting on, as the list says it */
const nextStepLabel: Record<
  QuoteRequestNextStep,
  { text: string; tone: Tone } | null
> = {
  add_cargo: { text: 'Add the cargo size', tone: 'amber' },
  choose_forwarders: { text: 'Choose forwarders', tone: 'amber' },
  send: { text: 'Send to forwarders', tone: 'amber' },
  chase: { text: 'Chase due', tone: 'red' },
  fix_quotes: { text: 'Quotes expired', tone: 'red' },
  awaiting: { text: 'Awaiting replies', tone: 'blue' },
  price: { text: 'Price the client', tone: 'violet' },
  send_price: { text: 'Send the client price', tone: 'violet' },
  accept: { text: 'Awaiting the client', tone: 'blue' },
  done: null,
};

const ACTION_STEPS: QuoteRequestNextStep[] = [
  'add_cargo',
  'choose_forwarders',
  'send',
  'chase',
  'fix_quotes',
  'price',
  'send_price',
];
const DECIDE_STEPS: QuoteRequestNextStep[] = ['price', 'send_price', 'accept'];

const usd = (n: number | null | undefined) =>
  n == null
    ? '—'
    : `USD ${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const modeLabel: Record<string, string> = {
  sea_fcl: 'Sea FCL',
  sea_lcl: 'Sea LCL',
  air: 'Air',
  road: 'Road',
};

/**
 * The forwarder a quote is from, as the list shows it
 *
 * @param name - Forwarder name as stored
 * @returns The name, or a prompt when the quote was entered without one
 */
const forwarderLabel = (name: string | null) =>
  !name || name === 'Unknown' ? 'Forwarder not set' : name;

/** The most quotes the comparison screen sets side by side */
const MAX_COMPARE = 5;

/**
 * Whether a quote is still in the running
 *
 * @param status - Quote status
 * @returns False for rejected and expired quotes
 */
const isLive = (status: QuoteStatus) =>
  status !== 'rejected' && status !== 'expired';

/**
 * Capitalise the first letter of a status
 *
 * @param text - Status as stored
 * @returns The status as it reads on screen
 */
const titleCase = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

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
  /*
    Always opens on everything. It used to open on Needs action whenever
    something did, while the All requests pill still read as selected, so the
    same page showed two lists depending on when it was loaded. The tiles
    count what needs doing; clicking one narrows the list.
  */
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

  const needsAction = requests.filter((r) => ACTION_STEPS.includes(r.nextStep));
  const awaiting = requests.filter((r) => r.nextStep === 'awaiting');
  const toDecide = requests.filter((r) => DECIDE_STEPS.includes(r.nextStep));
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
      key: 'action',
      label: 'Needs action',
      sub: 'Send, chase or price',
      value: needsAction.length,
      icon: IconAlertCircle,
      tone: 'border-red-100 from-red-50/50 dark:border-red-900/50 dark:from-red-500/10',
      iconTone: 'bg-red-100/70 text-red-600 dark:bg-red-500/20',
      valueTone: 'text-red-600',
    },
    {
      key: 'awaiting',
      label: 'Awaiting replies',
      sub: 'Sent, not yet due a chase',
      value: awaiting.length,
      icon: IconHourglass,
      tone: 'border-amber-100 from-amber-50/50 dark:border-amber-900/50 dark:from-amber-500/10',
      iconTone: 'bg-amber-100/70 text-amber-600 dark:bg-amber-500/20',
      valueTone: 'text-amber-600',
    },
    {
      key: 'decide',
      label: 'Quotes in',
      sub: 'To price, send or accept',
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
      label: 'Without a job',
      sub: 'Older quotes entered directly',
      value: standalone.length,
      icon: IconFileInvoice,
      tone: 'border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10',
      iconTone: 'bg-slate-100 text-slate-500 dark:bg-slate-500/20',
    },
  ];

  const shownRequests = requests.filter((r) => {
    if (focus === 'standalone') return false;
    if (focus === 'action' && !needsAction.includes(r)) return false;
    if (focus === 'awaiting' && !awaiting.includes(r)) return false;
    if (focus === 'decide' && !toDecide.includes(r)) return false;
    if (focus === 'completed' && r.status !== 'completed') return false;
    return true;
  });
  const showStandalone = !!shipmentId || focus === '' || focus === 'standalone';

  const toggleSelected = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const canCompareSelected =
    selected.length >= 2 && selected.length <= MAX_COMPARE;

  return (
    <div className="container mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-text-muted mb-1 flex items-center gap-1.5 text-sm">
            <Link
              href="/platform/admin/logistics"
              className="hover:text-text-primary transition-colors"
            >
              Logistics
            </Link>
            <IconChevronRight className="size-4" />
            <span className="text-text-primary">Freight quotes</span>
          </div>
          <h1 className="text-text-primary text-2xl font-semibold tracking-tight">
            Freight quotes
          </h1>
          <p className="text-text-muted mt-0.5 text-sm">
            Freight requests and the forwarder quotes against them
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/platform/admin/logistics/forwarders"
            className={secondaryButton}
          >
            <IconUsers size={16} /> Forwarders
          </Link>
          <Link
            href="/platform/admin/logistics/requests/new"
            className={primaryButton}
          >
            <IconPlus size={16} /> New request
          </Link>
        </div>
      </div>

      {(requestsError || quotesError) && (
        <p className={`${card} text-text-muted p-6 text-sm`}>
          Freight quotes could not be loaded:{' '}
          {(requestsError ?? quotesError)?.message}
        </p>
      )}

      {shipmentId ? (
        <p
          className={`${card} text-text-muted flex items-center justify-between gap-3 p-4 text-sm`}
        >
          Showing the quotes linked to one shipment.
          <Link
            href="/platform/admin/logistics/quotes"
            className={secondaryButton}
          >
            Show all freight quotes
          </Link>
        </p>
      ) : (
        <div
          className={`grid grid-cols-2 gap-2.5 ${standalone.length ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}
        >
          {/* Quotes now always belong to a job; the older ones show only while there are any */}
          {tiles
            .filter((t) => t.key !== 'standalone' || t.value > 0)
            .map((tile) => {
              const active = focus === tile.key;
              const TileIcon = tile.icon;
              return (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => {
                    setFocus(active ? '' : tile.key);
                  }}
                  className={`rounded-xl border bg-gradient-to-b to-transparent px-3 py-2.5 text-center shadow-sm transition hover:-translate-y-px hover:shadow-md ${tile.tone} ${
                    active
                      ? 'ring-text-primary ring-offset-surface-primary ring-2 ring-offset-1'
                      : ''
                  }`}
                >
                  <span
                    className={`mx-auto mb-1 flex size-6 items-center justify-center rounded-md ${tile.iconTone}`}
                  >
                    <TileIcon size={13} />
                  </span>
                  <span
                    className={`block text-lg font-bold tabular-nums leading-tight ${
                      tile.value === 0
                        ? 'text-text-muted'
                        : (tile.valueTone ?? '')
                    }`}
                  >
                    {tile.value}
                  </span>
                  <span className="text-text-muted block text-[11px]">
                    {tile.label}
                  </span>
                  <span className="text-text-muted/80 block text-[10px]">
                    {tile.sub}
                  </span>
                </button>
              );
            })}
        </div>
      )}

      <div className="relative">
        <IconSearch className="text-text-muted pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client, route, request or quote number"
          className="border-border-muted bg-surface-primary text-text-primary placeholder:text-text-muted focus:border-text-primary h-11 w-full rounded-xl border pl-10 pr-3 text-sm shadow-sm focus:outline-none"
        />
      </div>

      {/* Requests: one line each — who and where, what it waits on, the best price */}
      {!shipmentId && focus !== 'standalone' && (
        <div className={card}>
          <div className="border-border-muted flex items-center gap-2 border-b px-4 py-3">
            <span className={sectionHeading}>
              {focus ? tiles.find((t) => t.key === focus)?.label : 'All requests'}
            </span>
            <span className="bg-surface-muted text-text-muted rounded-full px-2 py-0.5 text-[11px] font-medium">
              {shownRequests.length}
            </span>
            {focus && (
              <button
                type="button"
                onClick={() => setFocus('')}
                className="text-text-muted hover:text-text-primary ml-auto text-xs"
              >
                Show all
              </button>
            )}
          </div>

          {requestsLoading ? (
            <p className="text-text-muted py-12 text-center text-sm">
              Loading requests…
            </p>
          ) : shownRequests.length === 0 ? (
            <p className="text-text-muted py-12 text-center text-sm">
              {focus === 'action' && requests.length
                ? 'Nothing needs action. Every request is with forwarders or the client.'
                : requests.length
                  ? 'No requests match.'
                  : 'No quote requests yet. Open the first with New request.'}
            </p>
          ) : (
            <ul className="divide-border-muted divide-y">
              {shownRequests.map((r) => {
                const live = r.quotes.filter((q) => isLive(q.status));
                const best = live[0];
                const step = nextStepLabel[r.nextStep];
                const quoted = r.recipients.filter((x) => x.outcome === 'quoted').length;
                const meta = [
                  r.job?.shipmentNumber,
                  r.bottles ? `${r.bottles.toLocaleString('en-GB')} btl` : r.totalCases ? `${r.totalCases} cs` : null,
                  r.transportMode ? modeLabel[r.transportMode] : null,
                  r.recipients.length
                    ? `${quoted} of ${r.recipients.length} forwarder${r.recipients.length === 1 ? '' : 's'} quoted`
                    : null,
                  formatDistanceToNow(new Date(r.createdAt), { addSuffix: true }),
                ].filter(Boolean);

                return (
                  <li key={r.id}>
                    <Link
                      href={`/platform/admin/logistics/requests/${r.id}`}
                      className="hover:bg-surface-secondary/50 flex items-center gap-4 px-4 py-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-text-primary truncate text-sm font-semibold">
                            {r.clientName || 'No client'}
                          </span>
                          <span className="text-text-muted truncate text-sm">
                            {r.originCity || r.originCountry} → {r.destinationCity || r.destinationCountry}
                          </span>
                          {r.priority === 'urgent' && (
                            <span className={pillClass('red')}>Urgent</span>
                          )}
                        </div>
                        <p className="text-text-muted mt-0.5 flex items-center gap-1.5 truncate text-xs">
                          <span className="font-mono">{r.requestNumber}</span>
                          {meta.map((m) => (
                            <span key={m} className="truncate">· {m}</span>
                          ))}
                          {r.requiresThermalLiner && <IconSnowflake size={12} aria-label="Thermal liner" />}
                          {r.requiresTracker && <IconThermometer size={12} aria-label="Temperature tracker" />}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        {best ? (
                          <>
                            <span className="text-text-primary block text-sm font-semibold tabular-nums">
                              {best.perBottleUsd != null
                                ? `${usd(best.perBottleUsd)} / btl`
                                : money(best.totalPrice, best.currency)}
                            </span>
                            <span className="text-text-muted block text-[11px]">
                              {live.length > 1 ? `best of ${live.length}` : forwarderLabel(best.forwarderName)}
                            </span>
                          </>
                        ) : (
                          <span className="text-text-muted text-xs">No quotes yet</span>
                        )}
                      </div>

                      <span className="hidden w-44 shrink-0 justify-end sm:flex">
                        {step ? (
                          <span className={pillClass(step.tone)}>{step.text}</span>
                        ) : (
                          <span className={pillClass(requestStatusTone[r.status])}>
                            {requestStatusLabel[r.status]}
                          </span>
                        )}
                      </span>
                      <IconChevronRight size={16} className="text-text-muted shrink-0" />
                    </Link>
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
          <div className="border-border-muted flex items-center gap-2 border-b px-4 py-3">
            <span className={sectionHeading}>
              {shipmentId
                ? 'Quotes for this shipment'
                : 'Quotes without a request'}
            </span>
            <span className="bg-surface-muted text-text-muted rounded-full px-2 py-0.5 text-[11px] font-medium">
              {standalone.length}
            </span>
            {selected.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-text-muted text-xs">
                  {canCompareSelected
                    ? `${selected.length} selected`
                    : `Select 2 to ${MAX_COMPARE} quotes to compare`}
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
            <p className="text-text-muted py-12 text-center text-sm">
              Loading quotes…
            </p>
          ) : standalone.length === 0 ? (
            <p className="text-text-muted py-8 text-center text-sm">
              {shipmentId
                ? 'No quotes are linked to this shipment.'
                : 'Every quote answers a request.'}
            </p>
          ) : (
            <ul className="divide-border-muted divide-y">
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
                        <span className="text-text-primary font-mono text-sm font-semibold">
                          {q.quoteNumber}
                        </span>
                        <span className={pillClass(quoteStatusTone[q.status])}>
                          {titleCase(q.status)}
                        </span>
                        {q.shipment && (
                          <span className={pillClass('blue')}>
                            {q.shipment.shipmentNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-text-primary mt-0.5 truncate text-sm">
                        {q.forwarderName}
                      </p>
                      <p className="text-text-muted truncate text-xs">
                        {q.originCity || q.originCountry || '—'} →{' '}
                        {q.destinationCity || q.destinationCountry || '—'}
                        {q.transportMode
                          ? ` · ${modeLabel[q.transportMode]}`
                          : ''}
                        {q.transitDays ? ` · ${q.transitDays} days` : ''}
                      </p>
                    </div>
                    <span className="text-text-primary shrink-0 text-sm font-semibold tabular-nums">
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
