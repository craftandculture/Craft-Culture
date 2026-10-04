'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import useTRPC from '@/lib/trpc/browser';

import dubaiToday from '../utils/dubaiToday';
import partState from '../utils/partState';

/**
 * Team Tasks on the Index home page: your work due today, anything overdue,
 * and jobs ready to close
 *
 * Shown only to C&C staff; partner logins are refused by the server, so the
 * card simply does not appear for them.
 */
const HomeTasksCard = () => {
  const api = useTRPC();
  const { data: board } = useQuery({ ...api.teamTasks.getBoard.queryOptions(), retry: false });

  if (!board) return null;

  const today = dubaiToday();
  const open = board.tasks.filter((t) => t.status === 'open');
  const mine = open
    .filter((t) => !t.waitingOn)
    .flatMap((t) => t.parts.filter((p) => p.ownerId === board.viewerId && !p.done).map((p) => ({ t, p, s: partState(p, t, today) })));
  const overdue = mine.filter((r) => r.s === 'overdue');
  const dueToday = mine.filter((r) => r.s === 'today');
  const teamOverdue = open.filter((t) => !t.waitingOn && t.parts.some((p) => !p.done && p.due && p.due < today)).length;
  const ready = open.filter((t) => t.parts.length > 0 && t.parts.every((p) => p.done)).length;
  const list = [...overdue, ...dueToday].slice(0, 5);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <p className="text-[15px] font-bold">Your tasks</p>
          <Link href="/platform/admin/tasks" className="text-[12px] font-medium text-text-brand transition-opacity hover:opacity-80">
            All tasks &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-3 border-t border-border-muted text-center">
          <div className="px-3 py-3">
            <p className={`text-xl font-bold tabular-nums ${overdue.length ? 'text-text-danger' : ''}`}>{overdue.length}</p>
            <p className="text-[11px] text-text-muted">Overdue</p>
          </div>
          <div className="border-x border-border-muted px-3 py-3">
            <p className="text-xl font-bold tabular-nums">{dueToday.length}</p>
            <p className="text-[11px] text-text-muted">Due today</p>
          </div>
          <div className="px-3 py-3">
            <p className="text-xl font-bold tabular-nums">{mine.length}</p>
            <p className="text-[11px] text-text-muted">Open</p>
          </div>
        </div>
        {list.length > 0 && (
          <div className="flex flex-col">
            {list.map(({ t, p, s }) => (
              <Link
                key={p.id}
                href={`/platform/admin/tasks?job=${t.id}`}
                className="flex items-center gap-3 border-t border-border-muted px-6 py-3 transition-colors hover:bg-surface-secondary/50"
              >
                <span className={`size-2 shrink-0 rounded-full ${s === 'overdue' ? 'bg-fill-danger' : 'bg-fill-warning'}`} />
                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t.title}</p>
                <span className="shrink-0 text-[11px] text-text-muted">{s === 'overdue' ? 'Overdue' : 'Today'}</span>
              </Link>
            ))}
          </div>
        )}
        {(teamOverdue > 0 || ready > 0) && (
          <p className="border-t border-border-muted px-6 py-3 text-[12px] text-text-muted">
            Team: {teamOverdue} job{teamOverdue === 1 ? '' : 's'} overdue · {ready} ready to close
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default HomeTasksCard;
