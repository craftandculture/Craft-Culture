'use client';

import { IconDownload, IconPrinter } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { format, startOfMonth, subMonths } from 'date-fns';
import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';

import CellarPageHeader from '@/app/_cellar/components/CellarPageHeader';
import CellarState from '@/app/_cellar/components/CellarState';
import StatementGroups from '@/app/_cellar/components/StatementGroups';
import type { StatementGroup } from '@/app/_cellar/components/StatementGroups';
import StatementSection from '@/app/_cellar/components/StatementSection';
import bottleName from '@/app/_cellar/utils/bottleName';
import csvCell from '@/app/_cellar/utils/csvCell';
import useTRPC from '@/lib/trpc/browser';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const bottles = (count: number) => `${count} ${count === 1 ? 'bottle' : 'bottles'}`;

/** How wine came in; the CSV needs a word for each, the page only where it adds something */
const KIND_LABEL = {
  arrived: 'Arrived',
  bought: 'Bought',
  added: 'Added',
} as const;

const KIND_NOTE = {
  arrived: 'Arrived at the warehouse',
  bought: 'Bought from Craft & Culture',
  added: 'Transferred to your cellar',
} as const;

/**
 * The months a statement can be read for, newest first
 *
 * From the month before the cellar first held wine up to this month. Months
 * before the account was open only ever showed empty statements.
 */
const monthOptions = (activeSince: Date | string | null | undefined) => {
  const now = startOfMonth(new Date());
  const first = activeSince
    ? subMonths(startOfMonth(new Date(activeSince)), 1)
    : subMonths(now, 1);
  const options: { value: string; label: string }[] = [];
  for (let date = now; date >= first; date = subMonths(date, 1)) {
    options.push({ value: format(date, 'yyyy-MM'), label: format(date, 'MMMM yyyy') });
    if (options.length > 60) break;
  }
  // Never empty, even for a cellar opened this month
  if (options.length === 0) {
    options.push({ value: format(now, 'yyyy-MM'), label: format(now, 'MMMM yyyy') });
  }
  return options;
};

/** Holdings shown before "Show all" */
const HOLDINGS_SHOWN = 12;

interface LeftRow {
  id: string;
  at: Date | string;
  name: string;
  detail: string;
  bottles: number;
  groupKey: string;
  groupLabel: string;
  status: string | null;
  outcome: string;
  amountUsd: number | null;
}

/** Rows that left the cellar, one group per order or reason, oldest first */
const hasMoney = (outcome: string) => outcome === 'sale' || outcome === 'reimbursed';

const groupsOf = (rows: LeftRow[]): StatementGroup[] => {
  const groups = new Map<string, StatementGroup>();
  const totals = new Map<string, { sum: number; open: boolean; money: boolean }>();
  for (const row of rows) {
    const group = groups.get(row.groupKey) ?? {
      key: row.groupKey,
      label: row.groupLabel,
      status: row.status,
      date: row.at,
      wines: [],
    };
    group.wines.push({
      key: row.id,
      name: row.name,
      detail: row.detail,
      bottles: row.bottles,
      // Money only where it means something: sales, samples, reimbursements
      amount: hasMoney(row.outcome)
        ? row.amountUsd != null
          ? money(row.amountUsd)
          : 'Price being agreed'
        : null,
    });
    groups.set(row.groupKey, group);
    totals.set(row.groupKey, {
      sum: (totals.get(row.groupKey)?.sum ?? 0) + (row.amountUsd ?? 0),
      open: (totals.get(row.groupKey)?.open ?? false) || (hasMoney(row.outcome) && row.amountUsd == null),
      money: hasMoney(row.outcome),
    });
  }

  return [...groups.values()].map((group) => {
    const total = totals.get(group.key);
    return {
      ...group,
      amount: total?.money
        ? total.open
          ? total.sum > 0
            ? `${money(total.sum)} so far`
            : 'Price being agreed'
          : money(total.sum)
        : null,
    };
  });
};

/** A CSV cell, quoted when it needs to be and never read as a formula */
const cell = (value: string | number) => csvCell(value);

/**
 * A member's monthly statement
 *
 * What came into the cellar, what left it, what sold and what was paid, with
 * the wine held. Printable on a single A4 column and downloadable as CSV, so a
 * collector can keep it with their own records.
 *
 * Opens on this month, and offers only the months the cellar has been open
 * (and the one before). No fees or charges appear: those are for the
 * invoice, not the cellar.
 */
const StatementPage = () => {
  const api = useTRPC();
  // This month: what a member opening the statement wants to see is now
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showAllHoldings, setShowAllHoldings] = useState(false);

  const { data, isLoading, isError } = useQuery({
    ...api.cellar.member.getStatement.queryOptions({ month }),
    // Keep the page (and the month list) while the next month loads
    placeholderData: keepPreviousData,
  });

  const options = useMemo(() => monthOptions(data?.activeSince), [data?.activeSince]);

  const monthLabel =
    options.find((option) => option.value === month)?.label ?? month;

  const totals = data
    ? {
        added: data.added.reduce((sum, row) => sum + row.bottles, 0),
        delivered: data.deliveries.reduce((sum, row) => sum + row.bottles, 0),
        onItsWay: data.left
          .filter((row) => row.outcome === 'delivery')
          .reduce((sum, row) => sum + row.bottles, 0),
        sold:
          data.sold.reduce((sum, row) => sum + row.bottles, 0) +
          data.left
            .filter((row) => row.outcome === 'sale')
            .reduce((sum, row) => sum + row.bottles, 0),
        uae: data.holdings.reduce((sum, row) => sum + row.bottles, 0),
        uk: data.ukHoldings.reduce((sum, row) => sum + row.totalBottles, 0),
        value: data.holdings.reduce((sum, row) => sum + (row.valueUsd ?? 0), 0),
      }
    : null;

  const downloadCsv = () => {
    if (!data) return;

    const rows: (string | number)[][] = [
      ['Section', 'Date', 'Wine', 'Bottles', 'Amount (USD)'],
      ...data.added.map((row) => [
        `${KIND_LABEL[row.kind]}${row.where === 'uk' ? ' (UK)' : ''}`,
        row.at ? format(new Date(row.at), 'yyyy-MM-dd') : '',
        [row.name, row.detail].filter(Boolean).join(' '),
        row.bottles,
        '',
      ]),
      ...data.deliveries.flatMap((delivery) =>
        delivery.wines.map((wine) => [
          'Delivered',
          delivery.deliveredAt
            ? format(new Date(delivery.deliveredAt), 'yyyy-MM-dd')
            : '',
          [wine.name, wine.detail].filter(Boolean).join(' '),
          wine.bottles,
          '',
        ]),
      ),
      ...data.left.map((row) => [
        row.groupLabel,
        format(new Date(row.at), 'yyyy-MM-dd'),
        [row.name, row.detail].filter(Boolean).join(' '),
        row.bottles,
        row.amountUsd != null ? row.amountUsd.toFixed(2) : '',
      ]),
      ...data.sold.map((row) => [
        'Sold',
        format(new Date(row.at), 'yyyy-MM-dd'),
        row.productName,
        row.bottles,
        row.amountUsd.toFixed(2),
      ]),
      ['Paid to you', '', '', '', data.paidUsd.toFixed(2)],
      ...data.holdings.map((row) => [
        'Held in the UAE',
        format(new Date(data.generatedAt), 'yyyy-MM-dd'),
        row.vintage ? `${row.productName} ${row.vintage}` : row.productName,
        row.bottles,
        '',
      ]),
      ...data.ukHoldings.map((row) => [
        'Held in the UK',
        data.ukReportedAt ? format(new Date(data.ukReportedAt), 'yyyy-MM-dd') : '',
        row.vintage ? `${row.name} ${row.vintage}` : row.name,
        row.totalBottles,
        '',
      ]),
    ];

    const blob = new Blob([rows.map((row) => row.map(cell).join(',')).join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `private-cellar-statement-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="statement w-full pb-8">
      {/*
        Printing drops the app around the statement, footer included: its
        warehouse feed and links filled a third page on their own. Chrome's own
        margins override @page, so the content is kept inside a 180mm column
        rather than relying on the page size. Rows, not whole sections, are
        kept from splitting, so a long month runs on instead of leaving half a
        page blank.
      */}
      <style>
        {`@media print {
          header:not(.statement-header), nav, footer, .statement-controls { display: none !important; }
          body { background: #fff !important; }
          .statement { max-width: 180mm; margin: 0 auto; font-size: 11px; padding: 0; }
          .statement tr, .statement dl { break-inside: avoid; }
          .statement h2 { break-after: avoid; }
          .statement .shadow-sm { box-shadow: none !important; }
          .statement-letterhead { display: flex !important; }
        }`}
      </style>

      <div className="statement-letterhead border-text-primary mb-5 hidden items-end justify-between border-b pb-3">
        <div>
          <p className="text-text-primary text-base font-semibold tracking-wide">Craft &amp; Culture</p>
          <p className="text-text-muted text-[10px] uppercase tracking-[0.18em]">Private Cellar</p>
        </div>
        <p className="text-text-muted text-right text-[10px] leading-4">
          craftculture.xyz
        </p>
      </div>

      <CellarPageHeader
        className="statement-header mb-5"
        title={data?.memberName ?? 'Your statements'}
        description={`${monthLabel}${
          data ? ` · issued ${format(new Date(data.generatedAt), 'd MMMM yyyy')}` : ''
        }`}
        actions={
        <div className="statement-controls grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <select
            id="statement-month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            aria-label="Statement month"
            className="border-border-muted bg-surface-primary text-text-primary col-span-2 h-10 rounded-lg border px-3 text-sm sm:col-span-1"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              // Every order and every wine on paper, not only what was opened on screen
              flushSync(() => setShowAllHoldings(true));
              document
                .querySelectorAll<HTMLDetailsElement>('.statement-group')
                .forEach((group) => {
                  group.open = true;
                });
              window.print();
            }}
            disabled={!data}
            className="border-border-muted bg-surface-primary text-text-primary inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold shadow-sm disabled:opacity-50"
          >
            <IconPrinter size={16} />
            Print
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!data}
            className="bg-text-primary text-background-primary inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50"
          >
            <IconDownload size={16} />
            CSV
          </button>
        </div>
        }
      />

      {isLoading && <CellarState kind="loading" rows={4} />}

      {isError && !data && <CellarState kind="error" />}

      {data && totals && (
        <>
          {/*
            One strip, read left to right like a statement: what came in, what
            went out, what sold and what is owed. Only the balance owed carries
            colour; a month with nothing in a column says so quietly.
          */}
          <dl className="border-border-muted bg-surface-primary divide-border-muted mb-7 grid grid-cols-2 divide-x overflow-hidden rounded-xl border sm:grid-cols-4 [&>div:nth-child(n+3)]:border-t sm:[&>div:nth-child(n+3)]:border-t-0">
            {[
              {
                label: 'Added',
                value: bottles(totals.added),
                detail: 'to your cellar',
                quiet: totals.added === 0,
              },
              {
                label: 'Deliveries',
                value: bottles(totals.delivered + totals.onItsWay),
                detail: totals.onItsWay
                  ? totals.delivered
                    ? `${totals.delivered} delivered · ${totals.onItsWay} on the way`
                    : 'on the way to you'
                  : 'delivered to you',
                quiet: totals.delivered + totals.onItsWay === 0,
              },
              {
                label: 'Sold',
                value: money(data.soldUsd + data.soldLeftUsd),
                detail: `${bottles(totals.sold)}${data.unpricedBottles ? ` · ${data.unpricedBottles} awaiting a price` : ''}`,
                quiet: totals.sold === 0,
              },
              {
                label: 'Owed to you',
                value: money(Math.max(0, data.owedUsd)),
                detail: data.paidUsd > 0 ? `${money(data.paidUsd)} paid this month` : 'Paid monthly',
                accent: data.owedUsd > 0,
              },
            ].map((item) => (
              <div key={item.label} className="min-w-0 px-4 py-3">
                <dt className="text-text-muted text-[11px] font-medium uppercase tracking-wider">
                  {item.label}
                </dt>
                <dd
                  className={`mt-1 text-xl font-semibold leading-tight tabular-nums ${
                    item.accent
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : item.quiet
                        ? 'text-text-muted'
                        : 'text-text-primary'
                  }`}
                >
                  {item.value}
                </dd>
                <dd className="text-text-muted mt-0.5 truncate text-xs">{item.detail}</dd>
              </div>
            ))}
          </dl>

          <StatementGroups
            title="Deliveries"
            empty="No deliveries this month."
            total={totals.delivered + totals.onItsWay ? bottles(totals.delivered + totals.onItsWay) : undefined}
            groups={[
              ...groupsOf(data.left.filter((row) => row.outcome === 'delivery')),
              ...data.deliveries.map((delivery) => ({
                key: delivery.id,
                label: 'Delivered to you',
                status: 'Delivered',
                date: delivery.deliveredAt,
                wines: delivery.wines.map((wine, index) => ({
                  key: `${delivery.id}-${index}`,
                  name: wine.name,
                  detail: wine.detail,
                  bottles: wine.bottles,
                })),
              })),
            ]}
          />

          <StatementGroups
            title="Sold"
            empty="Nothing sold this month."
            total={totals.sold ? money(data.soldUsd + data.soldLeftUsd) : undefined}
            groups={[
              ...groupsOf(data.left.filter((row) => row.outcome === 'sale')),
              ...(data.sold.length
                ? [
                    {
                      key: 'pool',
                      label: 'Sold through Craft & Culture',
                      date: data.sold[0]?.at ?? null,
                      amount: money(data.soldUsd),
                      wines: data.sold.map((row) => ({
                        key: row.id,
                        name: row.productName,
                        bottles: row.bottles,
                        amount: money(row.amountUsd),
                      })),
                    },
                  ]
                : []),
            ]}
            footer={
              data.paidUsd > 0
                ? `Paid to you this month: ${money(data.paidUsd)}`
                : undefined
            }
          />

          {data.left.some((row) => !['delivery', 'sale'].includes(row.outcome)) && (
            <StatementGroups
              title="Other changes"
              empty=""
              groups={groupsOf(
                data.left.filter((row) => !['delivery', 'sale'].includes(row.outcome)),
              )}
            />
          )}

          <StatementSection
            title="Added to your cellar"
            empty="Nothing was added this month."
            rows={data.added.map((row) => ({
              key: row.id,
              date: row.at,
              name: row.name,
              detail: row.detail,
              note:
                row.where === 'uk'
                  ? 'Arrived in the UK'
                  : row.kind === 'added'
                    ? undefined
                    : KIND_NOTE[row.kind],
              value: String(row.bottles),
            }))}
          />

          <section className="mb-7">
            <h2 className="text-text-muted mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider">
              Your cellar today · {bottles(totals.uae + totals.uk)}
              {totals.value > 0 ? ` · ${money(totals.value)}` : ''}
            </h2>
            <p className="text-text-muted mb-2 px-1 text-xs">
              As held on {format(new Date(data.generatedAt), 'd MMMM yyyy')}
              {totals.uk > 0 && data.ukReportedAt
                ? `; wine in the UK as last reported by London City Bond on ${format(new Date(data.ukReportedAt), 'd MMMM yyyy')}`
                : ''}
              .
            </p>
            <div className="border-border-muted bg-surface-primary overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-fill-muted/60 border-border-muted border-b">
                  <tr className="text-text-muted text-[10px] uppercase tracking-[0.08em]">
                    <th className="px-3 py-2 text-left">Wine</th>
                    <th className="hidden px-3 py-2 text-left sm:table-cell">Location</th>
                    <th className="px-3 py-2 text-right">Bottles</th>
                    <th className="px-3 py-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-border-muted divide-y">
                  {data.holdings.slice(0, showAllHoldings ? undefined : HOLDINGS_SHOWN).map((row) => (
                    <tr key={`${row.lwin18}-${row.caseConfig}`}>
                      <td className="px-3 py-2">
                        <span className="text-text-primary block font-medium">
                          {row.productName}
                        </span>
                        <span className="text-text-muted block text-xs">
                          {[row.producer, row.vintage ?? 'NV', bottleName(row.bottleSize)]
                            .filter(Boolean)
                            .join(' · ')}
                          <span className="sm:hidden"> · UAE</span>
                        </span>
                      </td>
                      <td className="text-text-muted hidden px-3 py-2 text-xs sm:table-cell">UAE</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.bottles}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.valueUsd != null ? money(row.valueUsd) : '—'}
                        {row.valueBasis === 'your price' && (
                          <span className="text-text-muted block text-[10px]">your price</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(showAllHoldings || data.holdings.length < HOLDINGS_SHOWN ? data.ukHoldings : []).map((row, index) => (
                    <tr key={`uk-${index}`}>
                      <td className="px-3 py-2">
                        <span className="text-text-primary block font-medium">
                          {row.name}
                        </span>
                        <span className="text-text-muted block text-xs">
                          {row.vintage ?? 'NV'}
                          <span className="sm:hidden"> · United Kingdom</span>
                        </span>
                      </td>
                      <td className="text-text-muted hidden px-3 py-2 text-xs sm:table-cell">United Kingdom</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.totalBottles}</td>
                      <td className="text-text-muted px-3 py-2 text-right">—</td>
                    </tr>
                  ))}
                  {data.holdings.length === 0 && data.ukHoldings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-text-muted px-3 py-4 text-center text-sm">
                        No wine held today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!showAllHoldings &&
              data.holdings.length + data.ukHoldings.length > HOLDINGS_SHOWN && (
                <button
                  type="button"
                  onClick={() => setShowAllHoldings(true)}
                  className="text-text-primary mt-2 text-sm font-semibold underline underline-offset-2"
                >
                  Show all {data.holdings.length + data.ukHoldings.length} wines
                </button>
              )}
          </section>

          <p className="text-text-muted border-border-muted max-w-3xl border-t px-1 pt-4 text-xs leading-5">
            Wine in the UAE is held in bond, duty suspended, under Craft &amp;
            Culture&rsquo;s licence on your behalf. Sales are valued at your price
            for each wine. Bottles taken as samples, or damaged in our care, are
            valued at their original cost to you, including shipping. Wine you hold is valued at your
            price where you have set one, and otherwise at its cost. Payments are
            made monthly for sales the buyer has paid for. If anything here
            differs from your own records, please contact the cellar team.
          </p>
        </>
      )}
    </div>
  );
};

export default StatementPage;
