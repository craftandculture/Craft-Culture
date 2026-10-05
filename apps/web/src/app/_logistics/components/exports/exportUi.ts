import type { BondStep } from '../../utils/bondStatus';

/** Shared looks for the export job screens, in the Stock Explorer / Team Tasks house style */

export const card = 'rounded-xl border border-border-muted bg-surface-primary shadow-sm';

export const sectionHeading = 'text-[11px] font-semibold uppercase tracking-wider text-text-muted';

export const input =
  'h-10 w-full rounded-lg border border-border-muted bg-surface-primary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none';

export const label = 'mb-1 block text-xs font-medium text-text-muted';

export const primaryButton =
  'inline-flex items-center gap-1.5 rounded-lg bg-text-primary px-3.5 py-2 text-sm font-medium text-surface-primary transition hover:opacity-90 disabled:opacity-50';

export const secondaryButton =
  'inline-flex items-center gap-1.5 rounded-lg border border-border-muted bg-surface-primary px-3 py-2 text-sm font-medium text-text-primary shadow-sm transition hover:bg-surface-secondary disabled:opacity-50';

export const pill = (active: boolean) =>
  `shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-text-primary text-surface-primary'
      : 'bg-surface-muted text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
  }`;

/** A coloured status pill; tone carries meaning, as on Team Tasks */
export const tonePill = {
  slate: 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-700',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-900',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900',
  red: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-900',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-900',
} as const;

export type Tone = keyof typeof tonePill;

export const pillClass = (tone: Tone) =>
  `inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tonePill[tone]}`;

export const stageTone = (stage: string): Tone =>
  stage === 'docs_sent' ? 'emerald' : stage === 'shipped' ? 'blue' : stage === 'customs' ? 'violet' : 'slate';

/**
 * How a bond reads in a list: what step it is at, coloured by how close the
 * claim deadline is
 */
export const bondTone = (bond: { step: BondStep; overdue: boolean; dueSoon: boolean; daysLeft: number | null }): Tone => {
  if (bond.step === 'refunded') return 'emerald';
  if (bond.overdue) return 'red';
  if (bond.step === 'claimed') return 'blue';
  if (bond.dueSoon && bond.daysLeft !== null && bond.daysLeft <= 7) return 'red';
  if (bond.dueSoon) return 'amber';
  return 'slate';
};

export const money = (amount: number | null | undefined, currency: string) =>
  amount == null
    ? '—'
    : `${currency} ${amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

export const dayLabel = (iso: string | null | undefined) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '—';
