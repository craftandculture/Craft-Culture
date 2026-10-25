'use client';

import { IconDownload, IconPrinter } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { useMemo, useState } from 'react';

import StatementGroups from '@/app/_cellar/components/StatementGroups';
import type { StatementGroup } from '@/app/_cellar/components/StatementGroups';
import StatementSection from '@/app/_cellar/components/StatementSection';
import bottleName from '@/app/_cellar/utils/bottleName';
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

/** The last twelve months, most recent complete month first */
const monthOptions = () =>
  Array.from({ length: 12 }, (_, index) => {
    const date = subMonths(new Date(), index);

    return { value: format(date, 'yyyy-MM'), label: format(date, 'MMMM yyyy') };
  });

interface LeftRow {
  id: string;
  at: Date | string;
  name: string;
  detail: string;
  bottles: number;
  groupKey: string;
  groupLabel: string;
  status: string | null;
}

/** Rows that left the cellar, one group per order or reason, oldest first */
const groupsOf = (rows: LeftRow[]): StatementGroup[] => {
  const groups = new Map<string, StatementGroup>();
  for (const row of rows) {
    const group = groups.get(row.groupKey) ?? {
      key: row.groupKey,
      label: row.groupLabel,
      status: row.status,
      date: row.at,
      wines: [],
    };
    group.wines.push({ key: row.id, name: row.name, detail: row.detail, bottles: row.bottles });
    groups.set(row.groupKey, group);
  }

  return [...groups.values()];
};

/** A CSV cell, quoted when it needs to be */
const cell = (value: string | number) => {
  const text = String(value);

  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * A member's monthly statement
 *
 * What came into the cellar, what left it, what sold and what was paid, with
 * the wine held. Printable on a single A4 column and downloadable as CSV, so a
 * collector can keep it with their own records.
 *
 * Defaults to the last complete month, because that is the one with a
 * finished story. No fees or charges appear: those are for the invoice, not
 * the cellar.
 */
const StatementPage = () => {
  const api = useTRPC();
  const options = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(
    options[1]?.value ?? format(new Date(), 'yyyy-MM'),
  );

  const { data, isLoading } = useQuery({
    ...api.cellar.member.getStatement.queryOptions({ month }),
  });

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
        '',
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
          header, nav, footer, .statement-controls { display: none !important; }
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

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.18em]">
            C&amp;C Private Cellar · Statement
          </p>
          <h1 className="text-text-primary mt-1 text-xl font-semibold">
            {monthLabel}
          </h1>
          {data && (
            <p className="text-text-muted mt-0.5 text-sm">
              {data.memberName} · issued{' '}
              {format(new Date(data.generatedAt), 'd MMMM yyyy')}
            </p>
          )}
        </div>
        <div className="statement-controls flex flex-wrap items-center gap-2">
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            aria-label="Statement month"
            className="border-border-muted bg-surface-primary text-text-primary h-10 rounded-lg border px-3 text-sm"
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
              // Every order opens on paper, not only the ones tapped on screen
              document
                .querySelectorAll<HTMLDetailsElement>('.statement-group')
                .forEach((group) => {
                  group.open = true;
                });
              window.print();
            }}
            disabled={!data}
            className="border-border-muted text-text-primary inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50"
          >
            <IconPrinter size={16} />
            Print
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!data}
            className="bg-text-primary text-surface-primary inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50"
          >
            <IconDownload size={16} />
            Download CSV
          </button>
        </div>
      </div>

      {isLoading && <p className="text-text-muted py-6 text-sm">Loading&hellip;</p>}

      {data && totals && (
        <>
          <dl className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              { label: 'Added', value: bottles(totals.added), sub: null },
              {
                label: 'Delivered to you',
                value: bottles(totals.delivered),
                sub: totals.onItsWay ? `${totals.onItsWay} on the way` : null,
              },
              {
                label: 'Sold',
                value: bottles(totals.sold),
                sub: data.soldUsd > 0 ? money(data.soldUsd) : null,
              },
              {
                label: 'Paid to you',
                value: money(data.paidUsd),
                sub: null,
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/60 to-transparent px-3 py-2.5 shadow-sm sm:px-4 sm:py-3 dark:border-slate-700 dark:from-slate-500/10"
              >
                <dt className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.08em]">
                  {tile.label}
                </dt>
                <dd className="text-text-primary m-0 mt-1 text-lg font-semibold tabular-nums">
                  {tile.value}
                </dd>
                {tile.sub && (
                  <dd className="text-text-muted m-0 text-xs tabular-nums">{tile.sub}</dd>
                )}
              </div>
            ))}
          </dl>

          <StatementGroups
            title="Deliveries"
            empty="No deliveries this month."
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

          <section className="mb-6">
            <h2 className="text-text-muted mb-2 text-[11px] font-semibold uppercase tracking-wider">
              Your cellar today · {bottles(totals.uae + totals.uk)}
            </h2>
            <p className="text-text-muted mb-2 text-xs">
              As held on {format(new Date(data.generatedAt), 'd MMMM yyyy')}
              {totals.uk > 0 && data.ukReportedAt
                ? `; wine in the UK as last reported by London City Bond on ${format(new Date(data.ukReportedAt), 'd MMMM yyyy')}`
                : ''}
              .
            </p>
            <div className="border-border-muted overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-fill-muted/60 border-border-muted border-b">
                  <tr className="text-text-muted text-[10px] uppercase tracking-[0.08em]">
                    <th className="px-3 py-2 text-left">Wine</th>
                    <th className="px-3 py-2 text-left">Where</th>
                    <th className="px-3 py-2 text-right">Bottles</th>
                  </tr>
                </thead>
                <tbody className="divide-border-muted divide-y">
                  {data.holdings.map((row) => (
                    <tr key={`${row.lwin18}-${row.caseConfig}`}>
                      <td className="px-3 py-2">
                        <span className="text-text-primary block font-medium">
                          {row.productName}
                        </span>
                        <span className="text-text-muted block text-xs">
                          {[row.producer, row.vintage ?? 'NV', bottleName(row.bottleSize)]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </td>
                      <td className="text-text-muted px-3 py-2 text-xs">UAE</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.bottles}</td>
                    </tr>
                  ))}
                  {data.ukHoldings.map((row, index) => (
                    <tr key={`uk-${index}`}>
                      <td className="px-3 py-2">
                        <span className="text-text-primary block font-medium">
                          {row.name}
                        </span>
                        <span className="text-text-muted block text-xs">
                          {row.vintage ?? 'NV'}
                        </span>
                      </td>
                      <td className="text-text-muted px-3 py-2 text-xs">United Kingdom</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.totalBottles}</td>
                    </tr>
                  ))}
                  {data.holdings.length === 0 && data.ukHoldings.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-text-muted px-3 py-4 text-center text-sm">
                        No wine held today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-text-muted text-xs leading-5">
            Wine in the UAE is held in bond, duty suspended, under Craft &amp;
            Culture&rsquo;s licence on your behalf. Sale amounts are your asking
            price for the bottles sold. If anything here differs from your own
            records, please contact the cellar team.
          </p>
        </>
      )}
    </div>
  );
};

export default StatementPage;
