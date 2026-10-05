'use client';

import { IconAlertTriangle, IconArrowRight, IconCoin } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import useTRPC from '@/lib/trpc/browser';

import { money } from './exportUi';

/**
 * C&C money held as movement bonds, for the logistics dashboard
 *
 * Shows only while a bond is outstanding, and turns red when a claim is close
 * to its deadline or past it. Says nothing when the export jobs cannot be
 * read, so the dashboard never breaks for it.
 */
const BondsOutstandingCard = () => {
  const api = useTRPC();
  const { data } = useQuery({ ...api.logistics.admin.exports.getMany.queryOptions(), retry: false });

  const bonds = (data?.jobs ?? []).filter((j) => j.bond?.outstanding);
  if (!bonds.length) return null;

  const totals = Object.entries(
    bonds.reduce<Record<string, number>>((acc, j) => {
      acc[j.bond!.currency] = (acc[j.bond!.currency] ?? 0) + (j.bond!.amount ?? 0);
      return acc;
    }, {}),
  );
  const overdue = bonds.filter((j) => j.bond!.overdue).length;
  const urgent = bonds.filter((j) => j.bond!.dueSoon && (j.bond!.daysLeft ?? 99) <= 7).length;
  const dueSoon = bonds.filter((j) => j.bond!.dueSoon).length;
  const alarm = overdue > 0 || urgent > 0;

  return (
    <Link
      href="/platform/admin/logistics/exports"
      className={`flex flex-col gap-3 rounded-xl border bg-gradient-to-b to-transparent p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${
        alarm
          ? 'border-red-100 from-red-50/50 dark:border-red-900/50 dark:from-red-500/10'
          : 'border-violet-100 from-violet-50/50 dark:border-violet-900/50 dark:from-violet-500/10'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 items-center justify-center rounded-lg ${
            alarm ? 'bg-red-100/70 text-red-500 dark:bg-red-500/20' : 'bg-violet-100/70 text-violet-500 dark:bg-violet-500/20'
          }`}
        >
          {alarm ? <IconAlertTriangle size={20} /> : <IconCoin size={20} />}
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Bonds outstanding</p>
          <p className={`text-lg font-bold tabular-nums ${alarm ? 'text-red-600' : 'text-violet-600'}`}>
            {totals.map(([c, v]) => money(v, c)).join(' · ')}
          </p>
          <p className="text-xs text-text-muted">
            C&C cash held on {bonds.length} bonded transfer{bonds.length === 1 ? '' : 's'}
            {dueSoon ? ` · ${dueSoon} claim${dueSoon === 1 ? '' : 's'} due within 30 days` : ''}
            {overdue ? ` · ${overdue} past the claim deadline` : ''}
          </p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-text-primary">
        Export jobs <IconArrowRight size={16} />
      </span>
    </Link>
  );
};

export default BondsOutstandingCard;
