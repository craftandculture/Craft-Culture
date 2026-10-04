'use client';

import PersonBadge from './PersonBadge';
import TaskRow from './TaskRow';
import TwoStepButton from './TwoStepButton';
import type { Board, BoardTask } from '../types/Board';
import type { CardActions } from '../types/CardActions';
import partState from '../utils/partState';
import rankPart from '../utils/rankPart';

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
        const rows = open
          .flatMap((task) =>
            task.parts
              .filter((p) => p.ownerId === person.id && !p.done)
              .map((part) => ({ task, part, state: partState(part, task, actions.today) })),
          )
          .sort((a, b) => rankPart(a.task, a.state) - rankPart(b.task, b.state) || (a.part.due ?? '9999').localeCompare(b.part.due ?? '9999'));
        const ready = open.filter(
          (t) => t.parts.length > 0 && t.parts.every((p) => p.done) && t.parts.some((p) => p.ownerId === person.id),
        );

        if (!rows.length && !ready.length) return null;

        const overdue = rows.filter((r) => r.state === 'overdue' && !r.task.waitingOn).length;
        const active = rows.filter((r) => !r.task.waitingOn).length;
        const week = rows.filter((r) => !r.task.waitingOn && (r.state === 'today' || r.state === 'week')).length;

        return (
          <div key={person.id} className="rounded-xl border border-border-muted bg-surface-primary shadow-sm">
            <div className="border-b border-border-muted px-3 pb-2.5 pt-3">
              <div className="flex items-center gap-2.5">
                <PersonBadge name={person.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-text-primary">
                    {person.name}
                    {person.partnerId && (
                      <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                        {board.partners.find((p) => p.id === person.partnerId)?.name ?? 'Partner'}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-text-muted">
                    {active} open{week > 0 && ` · ${week} this week`}
                    {overdue > 0 && <span className="font-semibold text-red-600"> · {overdue} overdue</span>}
                  </p>
                </div>
              </div>
              {active > 0 && (
                <div className="mt-2.5 flex h-1 overflow-hidden rounded-full bg-surface-muted" title="Overdue · this week · later">
                  <span className="bg-red-500" style={{ width: `${(overdue / active) * 100}%` }} />
                  <span className="bg-amber-400" style={{ width: `${(week / active) * 100}%` }} />
                  <span className="bg-text-muted/40" style={{ width: `${((active - overdue - week) / active) * 100}%` }} />
                </div>
              )}
            </div>

            <div className="divide-y divide-border-muted">
              {ready.map((task) => (
                <div key={task.id} className="flex items-center gap-2 bg-fill-success/5 px-3 py-2.5">
                  <button type="button" onClick={() => actions.onOpen(task.id)} className="min-w-0 flex-1 text-left">
                    <p className="line-clamp-2 text-sm font-medium text-text-primary">{task.title}</p>
                    <p className="text-xs text-text-success">Every part is done</p>
                  </button>
                  <TwoStepButton label="Close" confirmLabel="Yes, close" size="xs" onConfirm={() => actions.onClose(task.id)} />
                </div>
              ))}
              {rows.map(({ task, part, state }, i) => (
                <div key={part.id}>
                  {task.waitingOn && (i === 0 || !rows[i - 1]!.task.waitingOn) && (
                    <p className="bg-fill-secondary px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                      On hold until the go-ahead
                    </p>
                  )}
                  <TaskRow task={task} part={part} state={state} board={board} actions={actions} />
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
