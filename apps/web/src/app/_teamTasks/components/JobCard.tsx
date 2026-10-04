'use client';

import PartRow from './PartRow';
import TwoStepButton from './TwoStepButton';
import type { Board, BoardTask } from '../types/Board';

interface JobCardProps {
  task: BoardTask;
  board: Board;
  today: string;
  onOpen: (taskId: string) => void;
  onTick: (partId: string, done: boolean) => void;
  onClose: (taskId: string) => void;
  /** Show only these parts (My tasks, By person); defaults to all */
  partIds?: string[];
  busy?: boolean;
  /** Leave out the area label (the board already groups by area) */
  hideArea?: boolean;
}

/**
 * A job as a card: title, tags, progress and its parts
 *
 * Clicking the card opens the job panel. When every part is ticked, the card
 * offers the two-step close; ticking alone never closes it.
 */
const JobCard = ({ task, board, today, onOpen, onTick, onClose, partIds, busy, hideArea }: JobCardProps) => {
  const area = board.areas.find((a) => a.id === task.areaId);
  const done = task.parts.filter((p) => p.done).length;
  const total = task.parts.length;
  const ready = task.status === 'open' && total > 0 && done === total;
  const shown = partIds ? task.parts.filter((p) => partIds.includes(p.id)) : task.parts;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(task.id)}
      className={`cursor-pointer rounded-xl border bg-surface-primary p-3.5 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md ${
        ready ? 'border-border-success' : 'border-border-muted'
      } ${task.urgent && task.status === 'open' && !ready ? 'border-l-[3px] border-l-red-500' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {area && !hideArea && <span className="font-medium uppercase tracking-wide text-text-muted">{area.name}</span>}
        {task.urgent && task.status === 'open' && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30">Urgent</span>
        )}
        {task.forTag && (
          <span className="rounded-full bg-fill-muted px-2 py-0.5 text-text-muted">
            {task.forTag === 'client' ? 'Client' : 'Distributor'}
          </span>
        )}
        {task.repeat && (
          <span className="rounded-full bg-fill-muted px-2 py-0.5 text-text-muted">
            Repeats {task.repeat}
          </span>
        )}
        {task.noteCount > 0 && (
          <span className="text-text-muted">
            · {task.noteCount} note{task.noteCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <p className="mt-1 text-[15px] font-semibold leading-snug tracking-tight text-text-primary">{task.title}</p>

      {task.waitingOn && task.status === 'open' && (
        <p className="mt-1 rounded-md bg-fill-warning/15 px-2 py-1 text-xs text-text-warning">
          Waiting on: {task.waitingOn}
        </p>
      )}

      {total > 1 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill-muted">
            <div className="h-full rounded-full bg-text-primary" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="text-[11px] text-text-muted">
            {done}/{total}
          </span>
        </div>
      )}

      <div className="mt-1 divide-y divide-border-muted">
        {shown.map((p) => (
          <PartRow key={p.id} part={p} task={task} board={board} today={today} onTick={onTick} busy={busy} />
        ))}
      </div>

      {ready && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-fill-success/10 px-2 py-1.5">
          <span className="text-xs font-medium text-text-success">All parts done</span>
          <TwoStepButton label="Close job" confirmLabel="Yes, close it" onConfirm={() => onClose(task.id)} size="xs" />
        </div>
      )}
    </div>
  );
};

export default JobCard;
