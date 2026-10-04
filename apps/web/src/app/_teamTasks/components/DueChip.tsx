import dubaiToday from '../utils/dubaiToday';
import type { PartState } from '../utils/partState';
import shortDate from '../utils/shortDate';

const styles: Record<PartState, string> = {
  overdue: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30',
  today: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  week: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
  later: 'bg-surface-muted text-text-secondary ring-border-muted',
  undated: 'bg-surface-muted text-text-muted ring-border-muted',
  blocked: 'bg-surface-muted text-text-muted ring-border-muted',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
};

/** A part's due date, coloured by how close it is; undated parts show nothing unless asked */
const DueChip = ({ due, state, showUndated = false }: { due: string | null; state: PartState; showUndated?: boolean }) => {
  if ((state === 'undated' || state === 'done') && !showUndated) return null;

  const tomorrow = new Date(`${dubaiToday()}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const isTomorrow = due === tomorrow.toISOString().slice(0, 10);

  const text =
    state === 'blocked'
      ? 'Waiting'
      : state === 'done'
        ? 'Done'
        : !due
          ? 'No date'
          : state === 'overdue'
            ? `Overdue · ${shortDate(due)}`
            : state === 'today'
              ? 'Today'
              : isTomorrow
                ? 'Tomorrow'
                : shortDate(due);

  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${styles[state]}`}>
      {text}
    </span>
  );
};

export default DueChip;
