import type { PartState } from '../utils/partState';
import shortDate from '../utils/shortDate';

const styles: Record<PartState, string> = {
  overdue: 'bg-fill-danger/15 text-text-danger',
  today: 'bg-fill-warning/20 text-text-warning',
  week: 'bg-fill-brand/10 text-text-brand',
  later: 'bg-fill-muted text-text-muted',
  undated: 'bg-fill-muted text-text-muted',
  blocked: 'bg-fill-muted text-text-muted',
  done: 'bg-fill-success/15 text-text-success',
};

/** A part's due date, coloured by how close it is */
const DueChip = ({ due, state }: { due: string | null; state: PartState }) => {
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
              : shortDate(due);

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[state]}`}>
      {text}
    </span>
  );
};

export default DueChip;
