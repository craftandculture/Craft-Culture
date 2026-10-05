'use client';

import {
  IconAlertTriangle,
  IconCalendarDue,
  IconChevronRight,
  IconCoin,
  IconPackageExport,
  IconPlus,
  IconSearch,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

import {
  bondTone,
  card,
  dayLabel,
  money,
  pill,
  pillClass,
  primaryButton,
  sectionHeading,
  stageTone,
} from './exportUi';
import { BOND_STEP_LABEL } from '../../utils/bondStatus';
import { EXPORT_STAGES, modeLabel, stageLabel } from '../../utils/exportStages';

type Focus = '' | 'open' | 'shipped' | 'bonds' | 'dueSoon' | 'overdue';

/**
 * Export jobs: every job the logistics team is moving out of the UAE
 *
 * The tiles show what needs doing — jobs still open, jobs shipped but waiting
 * for their documents, and the movement bonds C&C has money tied up in — and
 * each one filters the list.
 */
const ExportJobsClient = () => {
  const api = useTRPC();
  const { data, isLoading, error } = useQuery(api.logistics.admin.exports.getMany.queryOptions());
  const [focus, setFocus] = useState<Focus>('');
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');

  const jobs = data?.jobs ?? [];
  const open = jobs.filter((j) => j.stage !== 'docs_sent');
  const shipped = jobs.filter((j) => j.stage === 'shipped');
  const bonds = jobs.filter((j) => j.bond?.outstanding);
  const dueSoon = bonds.filter((j) => j.bond?.dueSoon);
  const overdue = bonds.filter((j) => j.bond?.overdue);

  // Bonds are normally all AED; any other currency is listed beside it
  const held = Object.entries(
    bonds.reduce<Record<string, number>>((acc, j) => {
      const c = j.bond!.currency;
      acc[c] = (acc[c] ?? 0) + (j.bond!.amount ?? 0);
      return acc;
    }, {}),
  );

  const tiles: { key: Focus; label: string; sub: string; value: string; icon: typeof IconPlus; tone: string; iconTone: string; valueTone?: string }[] = [
    { key: 'open', label: 'Open jobs', sub: 'Not yet docs sent', value: String(open.length), icon: IconPackageExport, tone: 'border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10', iconTone: 'bg-slate-100 text-slate-500 dark:bg-slate-500/20' },
    { key: 'shipped', label: 'Shipped', sub: 'Documents to send', value: String(shipped.length), icon: IconTruckDelivery, tone: 'border-blue-100 from-blue-50/50 dark:border-blue-900/50 dark:from-blue-500/10', iconTone: 'bg-blue-100/70 text-blue-500 dark:bg-blue-500/20', valueTone: 'text-blue-600' },
    { key: 'bonds', label: 'Bonds held', sub: `${bonds.length} job${bonds.length === 1 ? '' : 's'} · C&C cash`, value: held.length ? held.map(([c, v]) => money(v, c)).join(' · ') : '—', icon: IconCoin, tone: 'border-violet-100 from-violet-50/50 dark:border-violet-900/50 dark:from-violet-500/10', iconTone: 'bg-violet-100/70 text-violet-500 dark:bg-violet-500/20', valueTone: 'text-violet-600' },
    { key: 'dueSoon', label: 'Claim due', sub: 'Within 30 days', value: String(dueSoon.length), icon: IconCalendarDue, tone: 'border-amber-100 from-amber-50/50 dark:border-amber-900/50 dark:from-amber-500/10', iconTone: 'bg-amber-100/70 text-amber-600 dark:bg-amber-500/20', valueTone: 'text-amber-600' },
    { key: 'overdue', label: 'Claim missed', sub: 'Past 3 months', value: String(overdue.length), icon: IconAlertTriangle, tone: 'border-red-100 from-red-50/50 dark:border-red-900/50 dark:from-red-500/10', iconTone: 'bg-red-100/70 text-red-500 dark:bg-red-500/20', valueTone: 'text-red-600' },
  ];

  const q = search.trim().toLowerCase();
  const shown = jobs.filter((j) => {
    if (focus === 'open' && j.stage === 'docs_sent') return false;
    if (focus === 'shipped' && j.stage !== 'shipped') return false;
    if (focus === 'bonds' && !j.bond?.outstanding) return false;
    if (focus === 'dueSoon' && !j.bond?.dueSoon) return false;
    if (focus === 'overdue' && !j.bond?.overdue) return false;
    if (stage && j.stage !== stage) return false;
    return (
      !q ||
      [j.jobNumber, j.shipmentNumber, j.clientName, j.destination, j.invoiceNumber, j.reference]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href="/platform/admin/logistics" className="transition-colors hover:text-text-primary">
              Logistics
            </Link>
            <IconChevronRight className="size-4" />
            <span className="text-text-primary">Exports</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Export jobs</h1>
          <p className="mt-0.5 text-sm text-text-muted">Everything leaving the UAE, and the bonds on bonded transfers</p>
        </div>
        <Link href="/platform/admin/logistics/exports/new" className={primaryButton}>
          <IconPlus size={16} /> New export job
        </Link>
      </div>

      {error ? (
        <p className={`${card} p-6 text-sm text-text-muted`}>
          Export jobs could not be loaded: {error.message}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => {
          const active = focus === tile.key;
          const Icon = tile.icon;
          const empty = tile.value === '0' || tile.value === '—';
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
                <Icon size={13} />
              </span>
              <span className={`block truncate text-lg font-bold leading-tight tabular-nums ${empty ? 'text-text-muted' : (tile.valueTone ?? '')}`}>
                {tile.value}
              </span>
              <span className="block text-[11px] text-text-muted">{tile.label}</span>
              <span className="block text-[10px] text-text-muted/80">{tile.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search job number, client, destination, invoice or AWB"
          className="h-11 w-full rounded-xl border border-border-muted bg-surface-primary pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:border-text-primary focus:outline-none"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" className={pill(stage === '')} onClick={() => setStage('')}>
          All stages
        </button>
        {EXPORT_STAGES.map((s) => (
          <button key={s.key} type="button" className={pill(stage === s.key)} onClick={() => setStage(stage === s.key ? '' : s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className={card}>
        <div className="flex items-center gap-2 border-b border-border-muted px-4 py-3">
          <span className={sectionHeading}>Jobs</span>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">{shown.length}</span>
        </div>

        {isLoading ? (
          <p className="py-12 text-center text-sm text-text-muted">Loading export jobs…</p>
        ) : shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-muted">
            {jobs.length ? 'No jobs match.' : 'No export jobs yet. Open the first with New export job.'}
          </p>
        ) : (
          <ul className="divide-y divide-border-muted">
            {shown.map((j) => (
              <li key={j.shipmentId}>
                <Link
                  href={`/platform/admin/logistics/exports/${j.shipmentId}`}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface-secondary/50 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-text-primary">{j.jobNumber}</span>
                      <span className={pillClass(stageTone(j.stage))}>{stageLabel(j.stage)}</span>
                      <span className={pillClass('slate')}>{modeLabel(j.mode)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-text-primary">{j.clientName}</p>
                    <p className="truncate text-xs text-text-muted">
                      {j.origin || '—'} → {j.destination || '—'}
                      {j.invoiceNumber ? ` · Invoice ${j.invoiceNumber}` : ''}
                      {j.reference ? ` · ${j.reference}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    {j.bond && j.bond.step !== 'not_paid' ? (
                      <span className={pillClass(bondTone(j.bond))}>
                        Bond {money(j.bond.amount, j.bond.currency)} · {BOND_STEP_LABEL[j.bond.step]}
                        {j.bond.outstanding && j.bond.step !== 'claimed' && j.bond.daysLeft !== null
                          ? j.bond.daysLeft < 0
                            ? ' · claim missed'
                            : ` · ${j.bond.daysLeft}d to claim`
                          : ''}
                      </span>
                    ) : j.bond ? (
                      <span className={pillClass('amber')}>Bond not recorded</span>
                    ) : null}
                    <span className="text-xs text-text-muted">{dayLabel(new Date(j.createdAt).toISOString())}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ExportJobsClient;
