'use client';

import {
  IconAlertTriangle,
  IconChevronRight,
  IconCircleCheck,
  IconInfoCircle,
  IconListCheck,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import Link from 'next/link';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

type Checked = inferRouterOutputs<AppRouter>['orderChecks']['check'];
type Counts = Checked['counts'];
type Level = 'error' | 'warning' | 'info';

const card = 'rounded-xl border border-border-muted bg-surface-primary shadow-sm';

const tone: Record<Level, string> = {
  error: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-900',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900',
  info: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-900',
};

const KIND: Record<string, string> = { sales_order: 'Sales order', invoice: 'Invoice', pco: 'PCO' };

const money = (n: number | null | undefined, currency?: string) =>
  n == null ? '—' : `${currency ? `${currency} ` : '$'}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const IssueChip = ({ level, message }: { level: Level; message: string }) => {
  const Icon = level === 'error' ? IconX : level === 'warning' ? IconAlertTriangle : IconInfoCircle;
  return (
    <span className={`inline-flex items-start gap-1 rounded-md px-2 py-1 text-xs ring-1 ring-inset ${tone[level]}`}>
      <Icon size={13} className="mt-px shrink-0" />
      {message}
    </span>
  );
};

const Summary = ({ counts }: { counts: Counts }) =>
  counts.error + counts.warning + counts.info === 0 ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900">
      <IconCircleCheck size={13} /> No issues
    </span>
  ) : (
    <span className="flex flex-wrap gap-1.5 text-xs font-medium">
      {counts.error ? <span className={`rounded-full px-2.5 py-0.5 ring-1 ring-inset ${tone.error}`}>{counts.error} to fix</span> : null}
      {counts.warning ? <span className={`rounded-full px-2.5 py-0.5 ring-1 ring-inset ${tone.warning}`}>{counts.warning} to check</span> : null}
      {counts.info ? <span className={`rounded-full px-2.5 py-0.5 ring-1 ring-inset ${tone.info}`}>{counts.info} to note</span> : null}
    </span>
  );

/**
 * One checked document: its header, issues for the whole document, and its
 * lines — flagged lines only until "Show all lines" is pressed
 */
const CheckedDocument = ({ result }: { result: Checked }) => {
  const [showAll, setShowAll] = useState(false);
  const doc = result.document;
  const flagged = result.lines.filter((l) => l.issues.length > 0);
  const shown = showAll ? result.lines : flagged;

  return (
    <section className={card}>
      <div className="flex flex-col gap-2 border-b border-border-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-text-primary">{doc.number}</span>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-text-muted">
              {KIND[doc.kind] ?? doc.kind} · {doc.status}
            </span>
          </p>
          <p className="truncate text-sm text-text-muted">
            {doc.customerName} · {doc.currency}
            {doc.total != null ? ` · ${money(doc.total, doc.currency)}` : ''} · {result.lines.length} line
            {result.lines.length === 1 ? '' : 's'}
          </p>
        </div>
        <Summary counts={result.counts} />
      </div>

      {doc.kind === 'pco' ? (
        <p className="border-b border-border-muted px-4 py-2 text-xs text-text-muted">
          PCO lines hold C&C&apos;s cost, so prices are checked for gaps but not against the price list.
        </p>
      ) : null}

      {result.documentIssues.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-border-muted px-4 py-3">
          {result.documentIssues.map((i) => (
            <IssueChip key={i.code} level={i.level} message={i.message} />
          ))}
        </div>
      ) : null}

      {shown.length > 0 ? (
        <ul className="divide-y divide-border-muted">
          {shown.map((line) => (
            <li key={line.index} className="px-4 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">
                    <span className="mr-1.5 text-xs text-text-muted">{line.index + 1}.</span>
                    {line.name}
                  </p>
                  <p className="font-mono text-[11px] text-text-muted">{line.sku ?? 'no code'}</p>
                </div>
                <p className="shrink-0 text-xs tabular-nums text-text-muted sm:text-right">
                  {line.quantity} × {money(line.rate, doc.currency)}
                  {line.perBottleUsd != null ? (
                    <span className="block">
                      {money(line.perBottleUsd)}/btl
                      {line.listPerBottleUsd != null ? ` · list ${money(line.listPerBottleUsd)}` : ''}
                    </span>
                  ) : null}
                </p>
              </div>
              {line.issues.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {line.issues.map((i) => (
                    <IssueChip key={i.code} level={i.level} message={i.message} />
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-text-muted">
          {result.lines.length ? 'Every line passed.' : 'This document has no lines.'}
        </p>
      )}

      {result.lines.length > flagged.length ? (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="w-full border-t border-border-muted px-4 py-2 text-xs font-medium text-text-muted hover:bg-surface-secondary/50 hover:text-text-primary"
        >
          {showAll ? 'Show flagged lines only' : `Show all ${result.lines.length} lines`}
        </button>
      ) : null}
    </section>
  );
};

/**
 * Order & invoice check
 *
 * Type a sales order, invoice or PCO number to check it line by line, or
 * check every draft waiting in Zoho at once. Read-only: it reports, it never
 * changes the document.
 */
const OrderCheckClient = () => {
  const api = useTRPC();
  const [input, setInput] = useState('');
  const [number, setNumber] = useState('');
  const [sweep, setSweep] = useState(false);

  const single = useQuery({
    ...api.orderChecks.check.queryOptions({ number }),
    enabled: number.length >= 2,
    retry: false,
  });
  const drafts = useQuery({ ...api.orderChecks.drafts.queryOptions(), enabled: sweep, retry: false });

  const draftResults = drafts.data?.results ?? [];
  const checked = draftResults.filter((r): r is Checked & { failed: null } => !r.failed && 'lines' in r);
  const withErrors = checked.filter((r) => r.counts.error > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href="/platform/admin" className="transition-colors hover:text-text-primary">
              Orders
            </Link>
            <IconChevronRight className="size-4" />
            <span className="text-text-primary">Order Check</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Order &amp; invoice check</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Codes, packs, vintages, prices and currency — checked before a document goes to the client
          </p>
        </div>
        <button
          type="button"
          onClick={() => (sweep ? void drafts.refetch() : setSweep(true))}
          disabled={drafts.isFetching}
          className="inline-flex items-center gap-1.5 rounded-lg bg-text-primary px-3.5 py-2 text-sm font-medium text-surface-primary transition hover:opacity-90 disabled:opacity-50"
        >
          <IconListCheck size={16} /> {drafts.isFetching ? 'Checking drafts…' : 'Check all Zoho drafts'}
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNumber(input.trim());
        }}
        className="relative"
      >
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Sales order, invoice or PCO number — e.g. SO-00140, INV-000512, PCO-2026-00079"
          className="h-11 w-full rounded-xl border border-border-muted bg-surface-primary pl-10 pr-24 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:border-text-primary focus:outline-none"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-text-primary px-3 text-sm font-medium text-surface-primary"
        >
          Check
        </button>
      </form>

      {number ? (
        single.isFetching ? (
          <p className={`${card} px-4 py-8 text-center text-sm text-text-muted`}>Reading {number} from Zoho…</p>
        ) : single.error ? (
          <p className={`${card} px-4 py-6 text-sm text-red-600`}>{single.error.message}</p>
        ) : single.data ? (
          <CheckedDocument result={single.data} />
        ) : null
      ) : null}

      {sweep ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Zoho drafts</span>
            {drafts.data ? (
              <span className="text-xs text-text-muted">
                {checked.length} checked · {withErrors} with something to fix
              </span>
            ) : null}
          </div>
          {drafts.isFetching && !drafts.data ? (
            <p className={`${card} px-4 py-8 text-center text-sm text-text-muted`}>
              Reading every draft from Zoho — this takes a moment…
            </p>
          ) : drafts.error ? (
            <p className={`${card} px-4 py-6 text-sm text-red-600`}>{drafts.error.message}</p>
          ) : draftResults.length === 0 ? (
            <p className={`${card} px-4 py-6 text-sm text-text-muted`}>No drafts waiting in Zoho.</p>
          ) : (
            [...checked]
              .sort((a, b) => b.counts.error - a.counts.error || b.counts.warning - a.counts.warning)
              .map((r) => <CheckedDocument key={r.document.number} result={r} />)
          )}
          {draftResults
            .filter((r) => r.failed)
            .map((r) => (
              <p key={r.document.number} className={`${card} px-4 py-3 text-sm text-text-muted`}>
                {r.document.number}: could not be read ({r.failed})
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
};

export default OrderCheckClient;
