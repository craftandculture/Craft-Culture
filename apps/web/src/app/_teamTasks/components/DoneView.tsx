'use client';

import type { Board, BoardTask } from '../types/Board';
import type { CardActions } from '../types/CardActions';

/** Done: jobs closed or cancelled in the last 60 days, newest first */
const DoneView = ({ board, tasks, actions }: { board: Board; tasks: BoardTask[]; actions: CardActions }) => {
  const done = tasks
    .filter((t) => t.status !== 'open')
    .sort((a, b) => new Date(b.closedAt ?? 0).getTime() - new Date(a.closedAt ?? 0).getTime());

  if (!done.length) return <p className="py-12 text-center text-sm text-text-muted">Nothing closed in the last 60 days.</p>;

  return (
    <div className="divide-y divide-border-muted rounded-xl border border-border-muted bg-surface-primary">
      {done.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => actions.onOpen(t.id)}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-fill-secondary"
        >
          <span className={`text-sm ${t.status === 'cancelled' ? 'text-text-muted line-through' : 'text-text-primary'}`}>
            {t.title}
          </span>
          <span className="text-xs text-text-muted">{board.areas.find((a) => a.id === t.areaId)?.name}</span>
          <span className="ml-auto shrink-0 text-xs text-text-muted">
            {t.status === 'cancelled' ? 'Cancelled' : 'Closed'}{' '}
            {t.closedAt &&
              new Date(t.closedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })}
          </span>
        </button>
      ))}
    </div>
  );
};

export default DoneView;
