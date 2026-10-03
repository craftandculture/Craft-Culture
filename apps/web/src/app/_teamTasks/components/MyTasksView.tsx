'use client';

import JobCard from './JobCard';
import Section from './Section';
import type { Board, BoardTask } from '../types/Board';
import type { CardActions } from '../types/CardActions';
import partState, { type PartState } from '../utils/partState';

const GROUPS: { key: PartState | 'ready' | 'waiting'; title: string; tone?: 'danger' | 'success' }[] = [
  { key: 'ready', title: 'Ready to close', tone: 'success' },
  { key: 'overdue', title: 'Overdue', tone: 'danger' },
  { key: 'today', title: 'Due today' },
  { key: 'week', title: 'This week' },
  { key: 'later', title: 'Later' },
  { key: 'undated', title: 'No date' },
  { key: 'blocked', title: 'Waiting for someone else first' },
  { key: 'waiting', title: 'On hold: waiting on someone' },
];

const rank: Record<PartState, number> = { overdue: 0, today: 1, week: 2, later: 3, undated: 4, blocked: 5, done: 6 };

/**
 * My tasks: the viewer's own open parts, most pressing first
 *
 * Each job sits in the group of the viewer's most pressing part. Jobs the
 * viewer has a part in and that are fully ticked appear under Ready to close.
 */
const MyTasksView = ({ board, tasks, actions }: { board: Board; tasks: BoardTask[]; actions: CardActions }) => {
  const grouped = new Map<string, { task: BoardTask; partIds: string[] }[]>();
  const sortKey = new Map<string, string>();

  for (const task of tasks) {
    if (task.status !== 'open') continue;
    const mine = task.parts.filter((p) => p.ownerId === board.viewerId);
    if (!mine.length) continue;

    let key: string;
    if (task.parts.every((p) => p.done)) key = 'ready';
    else if (task.waitingOn) key = 'waiting';
    else {
      const open = mine.filter((p) => !p.done);
      if (!open.length) continue;
      key = open.map((p) => partState(p, task, actions.today)).sort((a, b) => rank[a] - rank[b])[0]!;
      sortKey.set(task.id, open.map((p) => p.due ?? '9999').sort()[0]!);
    }

    grouped.set(key, [...(grouped.get(key) ?? []), { task, partIds: mine.map((p) => p.id) }]);
  }

  const total = [...grouped.values()].reduce((n, g) => n + g.length, 0);

  if (!total) {
    return <p className="py-12 text-center text-sm text-text-muted">Nothing on your list. Add a job, or check the team board.</p>;
  }

  return (
    <div className="space-y-6">
      {GROUPS.map((g) => {
        const items = (grouped.get(g.key) ?? []).sort((a, b) =>
          (sortKey.get(a.task.id) ?? '').localeCompare(sortKey.get(b.task.id) ?? ''),
        );
        return (
          <Section key={g.key} title={g.title} count={items.length} tone={g.tone}>
            {items.map(({ task, partIds }) => (
              <JobCard key={task.id} task={task} board={board} partIds={g.key === 'ready' ? undefined : partIds} {...actions} />
            ))}
          </Section>
        );
      })}
    </div>
  );
};

export default MyTasksView;
