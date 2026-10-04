'use client';

import DueChip from './DueChip';
import PersonBadge from './PersonBadge';
import TwoStepButton from './TwoStepButton';
import type { Board, BoardPart, BoardTask } from '../types/Board';
import type { CardActions } from '../types/CardActions';
import partLabel from '../utils/partLabel';
import partState, { type PartState } from '../utils/partState';
import personName from '../utils/personName';

type Row = { task: BoardTask; part: BoardPart; state: PartState; onHold: boolean };

/** Most pressing first: overdue, today, this week, then urgent, then the rest */
const rank = (r: Row) => {
  if (r.onHold) return 9;
  const byState: Record<PartState, number> = { overdue: 0, today: 1, week: 2, later: 5, undated: 6, blocked: 8, done: 10 };
  const base = byState[r.state];
  // Urgent jobs without a near date sit above ordinary undated work
  return r.task.urgent && base >= 5 && base < 8 ? 3 : base;
};

/**
 * By person: one column per person with their open parts
 *
 * Rows run most pressing first, with urgent jobs flagged and jobs on hold
 * (waiting on a client or someone outside) dimmed at the bottom. Each row
 * ticks one part; a job whose parts are all ticked offers the two-step close,
 * never a one-press close.
 */
const ByPersonView = ({ board, tasks, actions }: { board: Board; tasks: BoardTask[]; actions: CardActions }) => {
  const open = tasks.filter((t) => t.status === 'open');

  return (
    <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
      {board.team.map((person) => {
        const rows: Row[] = open
          .flatMap((task) =>
            task.parts
              .filter((p) => p.ownerId === person.id && !p.done)
              .map((part) => ({ task, part, state: partState(part, task, actions.today), onHold: Boolean(task.waitingOn) })),
          )
          .sort((a, b) => rank(a) - rank(b) || (a.part.due ?? '9999').localeCompare(b.part.due ?? '9999'));
        const ready = open.filter(
          (t) => t.parts.length > 0 && t.parts.every((p) => p.done) && t.parts.some((p) => p.ownerId === person.id),
        );

        if (!rows.length && !ready.length) return null;

        const overdue = rows.filter((r) => r.state === 'overdue' && !r.onHold).length;
        const active = rows.filter((r) => !r.onHold).length;

        return (
          <div key={person.id} className="rounded-xl border border-border-muted bg-surface-primary">
            <div className="flex items-center gap-2 border-b border-border-muted px-3 py-2.5">
              <PersonBadge name={person.name} isViewer={person.id === board.viewerId} />
              <span className="text-sm font-semibold text-text-primary">{personName(person.name)}</span>
              <span className="ml-auto flex items-center gap-1.5 text-xs">
                {overdue > 0 && (
                  <span className="rounded-full bg-fill-danger/15 px-1.5 py-0.5 font-semibold text-text-danger">
                    {overdue} overdue
                  </span>
                )}
                <span className="text-text-muted">{active} open</span>
              </span>
            </div>

            <div className="divide-y divide-border-muted">
              {ready.map((task) => (
                <div key={task.id} className="flex items-center gap-2 bg-fill-success/5 px-3 py-2.5">
                  <button type="button" onClick={() => actions.onOpen(task.id)} className="min-w-0 flex-1 text-left">
                    <p className="line-clamp-2 text-sm font-medium text-text-primary">{task.title}</p>
                    <p className="text-xs text-text-success">All parts done, ready to close</p>
                  </button>
                  <TwoStepButton label="Close" confirmLabel="Yes, close" size="xs" onConfirm={() => actions.onClose(task.id)} />
                </div>
              ))}

              {rows.map(({ task, part, state, onHold }, i) => {
                const label = partLabel(task.title, part.what);
                const firstOnHold = onHold && (i === 0 || !rows[i - 1]!.onHold);
                return (
                  <div key={part.id}>
                    {firstOnHold && (
                      <p className="bg-fill-secondary px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                        On hold until the go-ahead
                      </p>
                    )}
                    <div className={`flex items-start gap-2.5 px-3 py-2.5 ${onHold ? 'opacity-60' : ''}`}>
                      <input
                        type="checkbox"
                        aria-label="Mark part done"
                        checked={false}
                        disabled={state === 'blocked' || onHold || actions.busy}
                        onChange={() => actions.onTick(part.id, true)}
                        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-teal-600 disabled:cursor-not-allowed disabled:opacity-40"
                      />
                      <button type="button" onClick={() => actions.onOpen(task.id)} className="min-w-0 flex-1 text-left">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary">
                          {task.urgent && (
                            <span
                              className="mr-1.5 inline-block size-2 -translate-y-px rounded-full bg-fill-danger align-middle"
                              title="Urgent"
                            />
                          )}
                          {task.title}
                        </p>
                        {label && <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{label}</p>}
                        {state === 'blocked' && <p className="mt-0.5 text-xs text-text-muted">Waiting for an earlier part</p>}
                        {onHold && <p className="mt-0.5 text-xs text-text-muted">Waiting on: {task.waitingOn}</p>}
                      </button>
                      {state !== 'blocked' && !onHold && state !== 'undated' && <DueChip due={part.due} state={state} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ByPersonView;
