'use client';

import DueChip from './DueChip';
import PersonBadge from './PersonBadge';
import TwoStepButton from './TwoStepButton';
import type { Board, BoardTask } from '../types/Board';
import type { CardActions } from '../types/CardActions';
import partState from '../utils/partState';

/**
 * By person: one column per person with their open parts
 *
 * Each row ticks one part. A job whose parts are all ticked shows as ready
 * with the two-step close, never a one-press close.
 */
const ByPersonView = ({ board, tasks, actions }: { board: Board; tasks: BoardTask[]; actions: CardActions }) => {
  const open = tasks.filter((t) => t.status === 'open');

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {board.team.map((person) => {
        const rows = open
          .flatMap((task) => task.parts.filter((p) => p.ownerId === person.id && !p.done).map((part) => ({ task, part })))
          .sort((a, b) => (a.part.due ?? '9999').localeCompare(b.part.due ?? '9999'));
        const ready = open.filter(
          (t) => t.parts.length > 0 && t.parts.every((p) => p.done) && t.parts.some((p) => p.ownerId === person.id),
        );

        if (!rows.length && !ready.length) return null;

        return (
          <div key={person.id} className="rounded-xl border border-border-muted bg-surface-primary p-3">
            <div className="mb-2 flex items-center gap-2">
              <PersonBadge name={person.name} isViewer={person.id === board.viewerId} />
              <span className="text-sm font-semibold text-text-primary">{person.name}</span>
              <span className="ml-auto text-xs text-text-muted">{rows.length} open</span>
            </div>
            <div className="divide-y divide-border-muted">
              {rows.map(({ task, part }) => {
                const state = partState(part, task, actions.today);
                return (
                  <div key={part.id} className="flex items-start gap-2 py-2">
                    <input
                      type="checkbox"
                      aria-label="Mark part done"
                      checked={false}
                      disabled={state === 'blocked' || actions.busy}
                      onChange={() => actions.onTick(part.id, true)}
                      className="mt-1 size-4 shrink-0 cursor-pointer accent-teal-600 disabled:cursor-not-allowed"
                    />
                    <button type="button" onClick={() => actions.onOpen(task.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
                      <p className="text-xs text-text-muted">{part.what}</p>
                    </button>
                    <DueChip due={part.due} state={state} />
                  </div>
                );
              })}
              {ready.map((task) => (
                <div key={task.id} className="flex items-center gap-2 py-2">
                  <button type="button" onClick={() => actions.onOpen(task.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
                    <p className="text-xs text-text-success">All parts done, ready to close</p>
                  </button>
                  <TwoStepButton label="Close" confirmLabel="Yes, close" size="xs" onConfirm={() => actions.onClose(task.id)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ByPersonView;
