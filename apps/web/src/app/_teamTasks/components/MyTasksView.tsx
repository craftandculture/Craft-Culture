'use client';

import QuickAdd from './QuickAdd';
import TaskRow from './TaskRow';
import TwoStepButton from './TwoStepButton';
import type { Board, BoardTask } from '../types/Board';
import type { CardActions } from '../types/CardActions';
import partState, { type PartState } from '../utils/partState';
import rankPart from '../utils/rankPart';

type Group = 'overdue' | 'today' | 'week' | 'next' | 'blocked' | 'hold';

const GROUPS: { key: Group; title: string; tone?: string }[] = [
  { key: 'overdue', title: 'Overdue', tone: 'text-text-danger' },
  { key: 'today', title: 'Today' },
  { key: 'week', title: 'This week' },
  { key: 'next', title: 'Later and undated' },
  { key: 'blocked', title: 'Waiting for someone else first' },
  { key: 'hold', title: 'On hold until the go-ahead' },
];

const groupOf = (task: BoardTask, state: PartState): Group => {
  if (task.waitingOn) return 'hold';
  if (state === 'overdue' || state === 'today' || state === 'week' || state === 'blocked') return state;
  return 'next';
};

/**
 * My tasks: the viewer's own to-do list, one row per part, most pressing first
 *
 * Jobs the viewer is on whose parts are all ticked sit at the top, ready for
 * the two-step close. Jobs on hold are listed last, dimmed.
 */
const MyTasksView = ({ board, tasks, actions }: { board: Board; tasks: BoardTask[]; actions: CardActions }) => {
  const open = tasks.filter((t) => t.status === 'open');
  const ready = open.filter(
    (t) => t.parts.length > 0 && t.parts.every((p) => p.done) && t.parts.some((p) => p.ownerId === board.viewerId),
  );
  const rows = open
    .flatMap((task) =>
      task.parts
        .filter((p) => p.ownerId === board.viewerId && !p.done)
        .map((part) => ({ task, part, state: partState(part, task, actions.today) })),
    )
    .sort((a, b) => rankPart(a.task, a.state) - rankPart(b.task, b.state) || (a.part.due ?? '9999').localeCompare(b.part.due ?? '9999'));

  return (
    <div className="space-y-5">
      <QuickAdd board={board} />
      {!rows.length && !ready.length && (
        <p className="py-12 text-center text-sm text-text-muted">Nothing on your list. Add a job above, or check the team board.</p>
      )}
      {ready.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-success">
            Ready to close <span className="font-normal">· {ready.length}</span>
          </h2>
          <div className="divide-y divide-border-muted overflow-hidden rounded-xl border border-border-success/50 bg-surface-primary">
            {ready.map((task) => (
              <div key={task.id} className="flex items-center gap-3 px-3 py-2.5">
                <button type="button" onClick={() => actions.onOpen(task.id)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-text-primary">{task.title}</p>
                  <p className="text-xs text-text-success">Every part is done</p>
                </button>
                <TwoStepButton label="Close job" confirmLabel="Yes, close it" size="xs" onConfirm={() => actions.onClose(task.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {GROUPS.map((g) => {
        const items = rows.filter((r) => groupOf(r.task, r.state) === g.key);
        if (!items.length) return null;
        return (
          <section key={g.key}>
            <h2 className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${g.tone ?? 'text-text-muted'}`}>
              {g.title} <span className="font-normal">· {items.length}</span>
            </h2>
            <div className="divide-y divide-border-muted overflow-hidden rounded-xl border border-border-muted bg-surface-primary">
              {items.map(({ task, part, state }) => (
                <TaskRow key={part.id} task={task} part={part} state={state} board={board} actions={actions} showMeta />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default MyTasksView;
