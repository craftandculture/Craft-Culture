'use client';

import {
  IconAlertTriangle,
  IconCalendarDue,
  IconCalendarQuestion,
  IconCircleCheck,
  IconListCheck,
  IconPlayerPause,
} from '@tabler/icons-react';

import type { BoardTask } from '../types/Board';
import type { Focus } from '../types/Focus';
import matchesFocus from '../utils/matchesFocus';

const TILES: {
  key: Focus;
  label: string;
  sub: string;
  icon: typeof IconListCheck;
  tone: string;
  icon_tone: string;
  value_tone?: string;
}[] = [
  { key: '', label: 'Open jobs', sub: 'Across the team', icon: IconListCheck, tone: 'border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10', icon_tone: 'bg-slate-100 text-slate-500 dark:bg-slate-500/20' },
  { key: 'overdue', label: 'Overdue', sub: 'Past their date', icon: IconAlertTriangle, tone: 'border-red-100 from-red-50/50 dark:border-red-900/50 dark:from-red-500/10', icon_tone: 'bg-red-100/70 text-red-500 dark:bg-red-500/20', value_tone: 'text-red-600' },
  { key: 'week', label: 'Due this week', sub: 'Today to next 6 days', icon: IconCalendarDue, tone: 'border-amber-100 from-amber-50/50 dark:border-amber-900/50 dark:from-amber-500/10', icon_tone: 'bg-amber-100/70 text-amber-600 dark:bg-amber-500/20', value_tone: 'text-amber-600' },
  { key: 'nodate', label: 'Needs a date', sub: 'Urgent, undated', icon: IconCalendarQuestion, tone: 'border-orange-100 from-orange-50/50 dark:border-orange-900/50 dark:from-orange-500/10', icon_tone: 'bg-orange-100/70 text-orange-500 dark:bg-orange-500/20', value_tone: 'text-orange-600' },
  { key: 'ready', label: 'Ready to close', sub: 'Every part ticked', icon: IconCircleCheck, tone: 'border-emerald-100 from-emerald-50/50 dark:border-emerald-900/50 dark:from-emerald-500/10', icon_tone: 'bg-emerald-100/70 text-emerald-500 dark:bg-emerald-500/20', value_tone: 'text-emerald-600' },
  { key: 'hold', label: 'On hold', sub: 'Waiting on someone', icon: IconPlayerPause, tone: 'border-violet-100 from-violet-50/50 dark:border-violet-900/50 dark:from-violet-500/10', icon_tone: 'bg-violet-100/70 text-violet-500 dark:bg-violet-500/20' },
];

/**
 * The team at a glance, in the same tile style as Stock Explorer
 *
 * Each tile is also a filter: press it to show only those jobs, press again
 * to clear.
 */
const StatTiles = ({
  tasks,
  today,
  focus,
  onFocus,
}: {
  tasks: BoardTask[];
  today: string;
  focus: Focus;
  onFocus: (f: Focus) => void;
}) => {
  const open = tasks.filter((t) => t.status === 'open');

  return (
    <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-6">
      {TILES.map((tile) => {
        const count = tile.key ? open.filter((t) => matchesFocus(t, tile.key, today)).length : open.length;
        const active = focus === tile.key && tile.key !== '';
        const Icon = tile.icon;
        return (
          <button
            key={tile.label}
            type="button"
            onClick={() => onFocus(active || !tile.key ? '' : tile.key)}
            className={`rounded-xl border bg-gradient-to-b to-transparent px-3 py-2.5 text-center shadow-sm transition hover:-translate-y-px hover:shadow-md ${tile.tone} ${
              active ? 'ring-2 ring-text-primary ring-offset-1 ring-offset-surface-primary' : ''
            }`}
          >
            <span className={`mx-auto mb-1 flex size-6 items-center justify-center rounded-md ${tile.icon_tone}`}>
              <Icon size={13} />
            </span>
            <span className={`block text-lg font-bold leading-tight tabular-nums ${count ? (tile.value_tone ?? '') : 'text-text-muted'}`}>
              {count}
            </span>
            <span className="block text-[11px] text-text-muted">{tile.label}</span>
            <span className="block text-[10px] text-text-muted/80">{tile.sub}</span>
          </button>
        );
      })}
    </div>
  );
};

export default StatTiles;
