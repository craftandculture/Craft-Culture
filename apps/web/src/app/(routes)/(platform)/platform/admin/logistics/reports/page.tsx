'use client';

import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconChevronRight,
  IconClockExclamation,
  IconCurrencyDollar,
  IconFileCheck,
  IconLoader2,
  IconPackage,
  IconPackageExport,
  IconPackageImport,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

type ShipmentType = 'inbound' | 'outbound' | 're_export' | 'mainland_transfer';

const TYPES: { key: ShipmentType; label: string; bar: string; dot: string }[] = [
  { key: 'inbound', label: 'Import', bar: 'bg-slate-800 dark:bg-slate-200', dot: 'bg-slate-800 dark:bg-slate-200' },
  { key: 'outbound', label: 'Export', bar: 'bg-indigo-400', dot: 'bg-indigo-400' },
  { key: 'mainland_transfer', label: 'Mainland Transfer', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  { key: 're_export', label: 'Re-Export', bar: 'bg-rose-300', dot: 'bg-rose-300' },
];

const number = new Intl.NumberFormat('en-GB');
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

/**
 * Short and long labels for a YYYY-MM month key
 *
 * @param key - The month key
 * @returns Labels such as 'Oct' and 'October 2026'
 */
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1));
  return {
    short: d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }),
    long: d.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
};

/**
 * Change against the previous month, as a percentage (or points for a rate)
 *
 * @param current - This month's value
 * @param previous - Last month's value
 * @param asPoints - Report a difference in points rather than a percentage
 * @returns The change, or null when there is nothing to compare
 */
const changeOf = (current: number | null | undefined, previous: number | null | undefined, asPoints = false) => {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (asPoints) return current - previous;
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
};

interface KpiTileProps {
  label: string;
  value: string;
  sub: string;
  change: number | null;
  unit: '%' | ' pts';
  /** Whether a rise is good news (green) or bad news (red) */
  higherIsBetter: boolean;
  icon: typeof IconPackage;
  tone: string;
  iconTone: string;
}

/**
 * One KPI tile in the Stock Explorer / Team Tasks style, with its month-on-month change
 */
const KpiTile = ({ label, value, sub, change, unit, higherIsBetter, icon: TileIcon, tone, iconTone }: KpiTileProps) => {
  const good = change !== null && (higherIsBetter ? change > 0 : change < 0);
  const bad = change !== null && (higherIsBetter ? change < 0 : change > 0);
  return (
    <div className={`rounded-xl border bg-gradient-to-b to-transparent px-4 py-3 shadow-sm ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{label}</span>
        <span className={`flex size-6 items-center justify-center rounded-md ${iconTone}`}>
          <TileIcon size={13} />
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold leading-tight tabular-nums text-text-primary">{value}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
        {change === null ? (
          <span className="text-text-muted">No comparison</span>
        ) : (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums ${
              good
                ? 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                : bad
                  ? 'bg-red-100/70 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                  : 'bg-surface-muted text-text-muted'
            }`}
          >
            {change > 0 ? <IconArrowUpRight size={11} /> : change < 0 ? <IconArrowDownRight size={11} /> : null}
            {change > 0 ? '+' : ''}
            {change}
            {unit}
          </span>
        )}
        <span className="truncate text-text-muted">{sub}</span>
      </div>
    </div>
  );
};

/**
 * Logistics Reports
 *
 * Month-by-month view of what moved, what freight cost per bottle, and how
 * reliably imports arrived on time. Pick a month for its KPIs and late
 * arrivals; the charts show the twelve months to date.
 */
const LogisticsReportsPage = () => {
  const api = useTRPC();
  const [month, setMonth] = useState<string | undefined>(undefined);

  const { data, isLoading, isFetching } = useQuery({
    ...api.logistics.admin.getReportMetrics.queryOptions({ month }),
    placeholderData: (prev) => prev,
  });

  const { data: compliance } = useQuery({
    ...api.logistics.admin.getDocumentCompliance.queryOptions({ filter: 'all' }),
  });

  const pill = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-text-primary text-surface-primary'
        : 'bg-surface-muted text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
    }`;

  if (isLoading || !data) {
    return (
      <div className="container mx-auto flex max-w-7xl justify-center px-4 py-16">
        <IconLoader2 className="size-6 animate-spin text-text-muted" />
      </div>
    );
  }

  const { selected, previous, series, lateShipments, selectedMonth, months } = data;
  const selectedLabel = monthLabel(selectedMonth).long;
  const criticalCompliance = compliance?.summary.criticalCount ?? 0;

  const maxBottles = Math.max(
    1,
    ...series.map((m) => TYPES.reduce((s, t) => s + m.volume[t.key].bottles, 0)),
  );
  const maxFreightPerBottle = Math.max(1, ...series.map((m) => m.freightPerBottleUsd ?? 0));

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href="/platform/admin/logistics" className="transition-colors hover:text-text-primary">
              Logistics
            </Link>
            <IconChevronRight className="size-4" />
            <span className="text-text-primary">Reports</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Logistics Reports</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Volume, freight cost and on-time arrivals, month by month
          </p>
        </div>

        {/* Month selector */}
        <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
          {[...months].reverse().map((m) => (
            <button key={m} type="button" onClick={() => setMonth(m)} className={pill(m === selectedMonth)}>
              {monthLabel(m).short} {m.slice(2, 4)}
            </button>
          ))}
          {isFetching && <IconLoader2 className="size-4 shrink-0 animate-spin text-text-muted" />}
        </div>

        {criticalCompliance > 0 && (
          <Link
            href="/platform/admin/logistics/reports/compliance"
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
          >
            <IconAlertTriangle className="size-4 shrink-0" />
            {criticalCompliance} shipment{criticalCompliance === 1 ? ' has' : 's have'} missing or expired
            documents.
            <span className="ml-auto font-medium">Review</span>
          </Link>
        )}

        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <KpiTile
            label="Bottles in"
            value={number.format(selected?.bottlesIn ?? 0)}
            sub={`${selected?.volume.inbound.shipments ?? 0} imports`}
            change={changeOf(selected?.bottlesIn, previous?.bottlesIn)}
            unit="%"
            higherIsBetter
            icon={IconPackageImport}
            tone="border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10"
            iconTone="bg-slate-100 text-slate-500 dark:bg-slate-500/20"
          />
          <KpiTile
            label="Bottles out"
            value={number.format(selected?.bottlesOut ?? 0)}
            sub="Exports, transfers, re-exports"
            change={changeOf(selected?.bottlesOut, previous?.bottlesOut)}
            unit="%"
            higherIsBetter
            icon={IconPackageExport}
            tone="border-indigo-100 from-indigo-50/50 dark:border-indigo-900/50 dark:from-indigo-500/10"
            iconTone="bg-indigo-100/70 text-indigo-500 dark:bg-indigo-500/20"
          />
          <KpiTile
            label="Freight per bottle"
            value={selected?.freightPerBottleUsd != null ? usd2.format(selected.freightPerBottleUsd) : '—'}
            sub={
              selected?.importsWithoutFreight
                ? `${selected.importsWithoutFreight} import${selected.importsWithoutFreight === 1 ? '' : 's'} not costed`
                : `${usd0.format(selected?.freightUsd ?? 0)} total`
            }
            change={changeOf(selected?.freightPerBottleUsd, previous?.freightPerBottleUsd)}
            unit="%"
            higherIsBetter={false}
            icon={IconCurrencyDollar}
            tone="border-amber-100 from-amber-50/50 dark:border-amber-900/50 dark:from-amber-500/10"
            iconTone="bg-amber-100/70 text-amber-600 dark:bg-amber-500/20"
          />
          <KpiTile
            label="Imports on time"
            value={selected?.onTime.rate != null ? `${selected.onTime.rate}%` : '—'}
            sub={
              selected?.onTime.rated
                ? `${selected.onTime.onTime} of ${selected.onTime.rated} arrivals`
                : 'No rated arrivals'
            }
            change={changeOf(selected?.onTime.rate, previous?.onTime.rate, true)}
            unit=" pts"
            higherIsBetter
            icon={IconClockExclamation}
            tone="border-emerald-100 from-emerald-50/50 dark:border-emerald-900/50 dark:from-emerald-500/10"
            iconTone="bg-emerald-100/70 text-emerald-500 dark:bg-emerald-500/20"
          />
        </div>

        {/* Late arrivals for the selected month */}
        <section className="rounded-xl border border-border-muted bg-surface-primary p-4 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Late arrivals — {selectedLabel}</h2>
            <span className="text-xs text-text-muted">
              Late means arrived more than {data.onTimeGraceDays} days after ETA
            </span>
          </div>
          {lateShipments.length === 0 ? (
            <p className="text-sm text-text-muted">
              {selected?.onTime.rated
                ? 'Every rated import arrived on time.'
                : 'No imports with an ETA arrived this month.'}
              {selected?.onTime.noEta
                ? ` ${selected.onTime.noEta} arrival${selected.onTime.noEta === 1 ? '' : 's'} had no ETA and could not be rated.`
                : ''}
            </p>
          ) : (
            <div className="divide-y divide-border-muted">
              {lateShipments.map((s) => (
                <Link
                  key={s.id}
                  href={`/platform/admin/logistics/shipments/${s.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-surface-muted/50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text-primary">
                      {s.shipmentNumber}
                      {s.name ? <span className="font-normal text-text-muted"> · {s.name}</span> : null}
                    </div>
                    <div className="truncate text-xs text-text-muted">
                      ETA {new Date(s.eta).toLocaleDateString('en-GB')} · arrived{' '}
                      {new Date(s.arrivedAt).toLocaleDateString('en-GB')}
                      {s.carrierName ? ` · ${s.carrierName}` : ''}
                      {s.originCountry ? ` · from ${s.originCountry}` : ''}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-100/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-red-700 dark:bg-red-500/20 dark:text-red-300">
                    {s.daysLate} day{s.daysLate === 1 ? '' : 's'} late
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Volume by month */}
        <section className="rounded-xl border border-border-muted bg-surface-primary p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Bottles moved, last 12 months</h2>
            <div className="flex flex-wrap gap-3 text-xs text-text-muted">
              {TYPES.map((t) => (
                <span key={t.key} className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${t.dot}`} />
                  {t.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex h-44 items-end gap-1.5">
            {series.map((m) => {
              const total = TYPES.reduce((s, t) => s + m.volume[t.key].bottles, 0);
              const cases = TYPES.reduce((s, t) => s + m.volume[t.key].cases, 0);
              const breakdown = TYPES.map(
                (t) => `${t.label}: ${number.format(m.volume[t.key].bottles)} btl`,
              ).join('\n');
              return (
                <button
                  key={m.month}
                  type="button"
                  onClick={() => setMonth(m.month)}
                  title={`${monthLabel(m.month).long}\n${number.format(total)} bottles, ${number.format(cases)} cases\n${breakdown}`}
                  className={`flex h-full min-w-0 flex-1 flex-col justify-end rounded-md px-0.5 transition ${
                    m.month === selectedMonth ? 'bg-surface-muted' : 'hover:bg-surface-muted/60'
                  }`}
                >
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-sm" style={{ height: `${(total / maxBottles) * 100}%` }}>
                    {TYPES.map((t) =>
                      m.volume[t.key].bottles > 0 ? (
                        <div
                          key={t.key}
                          className={t.bar}
                          style={{ height: `${(m.volume[t.key].bottles / total) * 100}%` }}
                        />
                      ) : null,
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex gap-1.5">
            {series.map((m) => (
              <span
                key={m.month}
                className={`flex-1 text-center text-[10px] ${m.month === selectedMonth ? 'font-semibold text-text-primary' : 'text-text-muted'}`}
              >
                {monthLabel(m.month).short}
              </span>
            ))}
          </div>

          {/* Selected month breakdown */}
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-muted pt-3 sm:grid-cols-4">
            {TYPES.map((t) => (
              <div key={t.key} className="text-sm">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <span className={`size-2 rounded-full ${t.dot}`} />
                  {t.label}
                </div>
                <div className="font-semibold tabular-nums text-text-primary">
                  {number.format(selected?.volume[t.key].bottles ?? 0)} btl
                </div>
                <div className="text-xs tabular-nums text-text-muted">
                  {number.format(selected?.volume[t.key].cases ?? 0)} cases ·{' '}
                  {selected?.volume[t.key].shipments ?? 0} shipments
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Freight by month */}
          <section className="rounded-xl border border-border-muted bg-surface-primary p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-text-primary">Import freight per bottle</h2>
            <p className="mb-3 text-xs text-text-muted">
              Only imports with a freight cost are counted; months with imports still to cost are flagged.
            </p>
            <div className="space-y-1.5">
              {[...series].reverse().map((m) => (
                <button
                  key={m.month}
                  type="button"
                  onClick={() => setMonth(m.month)}
                  className={`grid w-full grid-cols-[2.5rem_1fr_4.5rem_5rem] items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs ${
                    m.month === selectedMonth ? 'bg-surface-muted' : 'hover:bg-surface-muted/60'
                  }`}
                >
                  <span className={m.month === selectedMonth ? 'font-semibold text-text-primary' : 'text-text-muted'}>
                    {monthLabel(m.month).short}
                  </span>
                  <span className="h-2 rounded-full bg-surface-muted">
                    <span
                      className="block h-2 rounded-full bg-amber-400"
                      style={{ width: `${((m.freightPerBottleUsd ?? 0) / maxFreightPerBottle) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-medium tabular-nums text-text-primary">
                    {m.freightPerBottleUsd != null ? usd2.format(m.freightPerBottleUsd) : '—'}
                  </span>
                  <span className="flex items-center justify-end gap-1 tabular-nums text-text-muted">
                    {m.importsWithoutFreight > 0 && (
                      <IconAlertTriangle
                        size={11}
                        className="text-amber-500"
                        aria-label={`${m.importsWithoutFreight} imports not costed`}
                      />
                    )}
                    {usd0.format(m.freightUsd)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* On-time by month */}
          <section className="rounded-xl border border-border-muted bg-surface-primary p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-text-primary">Imports on time</h2>
            <p className="mb-3 text-xs text-text-muted">
              Arrived no later than {data.onTimeGraceDays} days after ETA, in the month they arrived.
            </p>
            <div className="space-y-1.5">
              {[...series].reverse().map((m) => {
                const rate = m.onTime.rate;
                return (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => setMonth(m.month)}
                    className={`grid w-full grid-cols-[2.5rem_1fr_3rem_4.5rem] items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs ${
                      m.month === selectedMonth ? 'bg-surface-muted' : 'hover:bg-surface-muted/60'
                    }`}
                  >
                    <span className={m.month === selectedMonth ? 'font-semibold text-text-primary' : 'text-text-muted'}>
                      {monthLabel(m.month).short}
                    </span>
                    <span className="h-2 rounded-full bg-surface-muted">
                      <span
                        className={`block h-2 rounded-full ${
                          rate === null ? '' : rate >= 90 ? 'bg-emerald-500' : rate >= 70 ? 'bg-amber-400' : 'bg-red-500'
                        }`}
                        style={{ width: `${rate ?? 0}%` }}
                      />
                    </span>
                    <span className="text-right font-medium tabular-nums text-text-primary">
                      {rate !== null ? `${rate}%` : '—'}
                    </span>
                    <span className="text-right tabular-nums text-text-muted">
                      {m.onTime.late > 0 ? `${m.onTime.late} late` : m.onTime.rated > 0 ? 'none late' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sub-reports */}
        <div className="grid gap-2.5 sm:grid-cols-3">
          {[
            {
              href: '/platform/admin/logistics/reports/landed-cost',
              title: 'Landed Cost Report',
              sub: 'Cost breakdown by shipment',
              icon: IconCurrencyDollar,
            },
            {
              href: '/platform/admin/logistics/reports/compliance',
              title: 'Compliance Report',
              sub: 'Document status by shipment',
              icon: IconFileCheck,
            },
            {
              href: '/platform/admin/logistics/shipments',
              title: 'All Shipments',
              sub: 'View and manage shipments',
              icon: IconPackage,
            },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-xl border border-border-muted bg-surface-primary px-4 py-3 shadow-sm transition hover:-translate-y-px hover:shadow-md"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-surface-muted text-text-secondary">
                <link.icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text-primary">{link.title}</span>
                <span className="block text-xs text-text-muted">{link.sub}</span>
              </span>
              <IconChevronRight className="ml-auto size-4 text-text-muted" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LogisticsReportsPage;
