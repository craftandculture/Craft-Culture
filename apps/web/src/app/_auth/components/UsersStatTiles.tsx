'use client';

import {
  IconBuildingStore,
  IconClockHour4,
  IconLinkOff,
  IconShieldCheck,
  IconTruckDelivery,
  IconUserQuestion,
} from '@tabler/icons-react';

export type UsersFocus =
  | ''
  | 'pending'
  | 'team'
  | 'partners'
  | 'distributors'
  | 'unlinked'
  | 'never';

export interface UsersCounts {
  all: number;
  pending: number;
  team: number;
  partnerAccounts: number;
  distributors: number;
  unlinked: number;
  never: number;
}

const TILES: {
  key: Exclude<UsersFocus, ''>;
  count: keyof UsersCounts;
  label: string;
  sub: string;
  icon: typeof IconShieldCheck;
  tone: string;
  iconTone: string;
  valueTone?: string;
}[] = [
  { key: 'pending', count: 'pending', label: 'Awaiting approval', sub: 'Signed up, waiting on us', icon: IconClockHour4, tone: 'border-amber-100 from-amber-50/50 dark:border-amber-900/50 dark:from-amber-500/10', iconTone: 'bg-amber-100/70 text-amber-600 dark:bg-amber-500/20', valueTone: 'text-amber-600' },
  { key: 'unlinked', count: 'unlinked', label: 'Not linked', sub: 'Account with no organisation', icon: IconLinkOff, tone: 'border-red-100 from-red-50/50 dark:border-red-900/50 dark:from-red-500/10', iconTone: 'bg-red-100/70 text-red-500 dark:bg-red-500/20', valueTone: 'text-red-600' },
  { key: 'team', count: 'team', label: 'C&C team', sub: 'Admins and warehouse', icon: IconShieldCheck, tone: 'border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10', iconTone: 'bg-slate-100 text-slate-500 dark:bg-slate-500/20' },
  { key: 'partners', count: 'partnerAccounts', label: 'Partner accounts', sub: 'Wine partners and collectors', icon: IconBuildingStore, tone: 'border-emerald-100 from-emerald-50/50 dark:border-emerald-900/50 dark:from-emerald-500/10', iconTone: 'bg-emerald-100/70 text-emerald-600 dark:bg-emerald-500/20' },
  { key: 'distributors', count: 'distributors', label: 'Distributors', sub: 'Distributor staff', icon: IconTruckDelivery, tone: 'border-sky-100 from-sky-50/50 dark:border-sky-900/50 dark:from-sky-500/10', iconTone: 'bg-sky-100/70 text-sky-600 dark:bg-sky-500/20' },
  { key: 'never', count: 'never', label: 'Never signed in', sub: 'Invited, not yet used', icon: IconUserQuestion, tone: 'border-violet-100 from-violet-50/50 dark:border-violet-900/50 dark:from-violet-500/10', iconTone: 'bg-violet-100/70 text-violet-500 dark:bg-violet-500/20' },
];

/**
 * The user base at a glance, in the Stock Explorer / Team Tasks tile style
 *
 * Each tile is also a filter: press it to show only those users, press it
 * again to clear. The two that need someone to act — awaiting approval and
 * not linked — come first and are tinted only when there is something there.
 */
const UsersStatTiles = ({
  counts,
  focus,
  onFocus,
}: {
  counts: UsersCounts | undefined;
  focus: UsersFocus;
  onFocus: (focus: UsersFocus) => void;
}) => (
  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
    {TILES.map((tile) => {
      const value = counts?.[tile.count];
      const active = focus === tile.key;
      const Icon = tile.icon;
      return (
        <button
          key={tile.key}
          type="button"
          aria-pressed={active}
          onClick={() => onFocus(active ? '' : tile.key)}
          className={`rounded-xl border bg-gradient-to-b to-transparent px-3 py-2.5 text-center shadow-sm transition hover:-translate-y-px hover:shadow-md ${tile.tone} ${
            active ? 'ring-2 ring-text-primary ring-offset-1 ring-offset-surface-primary' : ''
          }`}
        >
          <span className={`mx-auto mb-1 flex size-6 items-center justify-center rounded-md ${tile.iconTone}`}>
            <Icon size={13} />
          </span>
          <span
            className={`block text-lg font-bold leading-tight tabular-nums ${
              value ? (tile.valueTone ?? '') : 'text-text-muted'
            }`}
          >
            {value ?? '–'}
          </span>
          <span className="block text-[11px] text-text-muted">{tile.label}</span>
          <span className="block truncate text-[10px] text-text-muted/80">{tile.sub}</span>
        </button>
      );
    })}
  </div>
);

export default UsersStatTiles;
