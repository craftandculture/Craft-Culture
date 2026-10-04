'use client';

import type { Board, BoardTask } from '../types/Board';
import partState from '../utils/partState';
import shortDate from '../utils/shortDate';

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted';
const td = 'px-3 py-2 text-sm text-text-primary';

/**
 * Weekly review: the Monday meeting on one page, and printable
 *
 * What closed in the last seven days, what is overdue now, each person's load,
 * and urgent work with no date. Replaces the weekly PDF.
 */
const ReviewView = ({ board, tasks, today }: { board: Board; tasks: BoardTask[]; today: string }) => {
  const weekAgo = Date.now() - 7 * 864e5;
  const name = (id: string | null) => board.team.find((m) => m.id === id)?.name ?? '';
  const open = tasks.filter((t) => t.status === 'open');
  const closed = tasks
    .filter((t) => t.status === 'closed' && new Date(t.closedAt ?? 0).getTime() >= weekAgo)
    .sort((a, b) => new Date(b.closedAt ?? 0).getTime() - new Date(a.closedAt ?? 0).getTime());
  const overdue = open
    .filter((t) => !t.waitingOn)
    .flatMap((t) => t.parts.filter((p) => partState(p, t, today) === 'overdue').map((p) => ({ t, p })))
    .sort((a, b) => (a.p.due ?? '').localeCompare(b.p.due ?? ''));
  const undatedUrgent = open.filter((t) => t.urgent && !t.waitingOn && t.parts.some((p) => !p.done && !p.due));

  const load = board.team
    .map((m) => {
      const rows = open.flatMap((t) => t.parts.filter((p) => p.ownerId === m.id && !p.done).map((p) => ({ t, s: partState(p, t, today) })));
      const active = rows.filter((r) => !r.t.waitingOn);
      return {
        m,
        open: active.length,
        overdue: active.filter((r) => r.s === 'overdue').length,
        week: active.filter((r) => r.s === 'today' || r.s === 'week').length,
        urgent: active.filter((r) => r.t.urgent).length,
        hold: rows.length - active.length,
        closed: closed.filter((t) => t.parts.some((p) => p.ownerId === m.id)).length,
      };
    })
    .filter((r) => r.open || r.hold || r.closed);

  return (
    <div className="space-y-6">
      <style>{'@media print { header, nav, .tt-controls { display: none !important; } }'}</style>
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          Week to {shortDate(today)} · {closed.length} closed · {overdue.length} overdue · {open.length} open
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="tt-controls h-8 rounded-lg border border-border-primary bg-fill-primary px-3 text-sm font-medium text-text-primary"
        >
          Print
        </button>
      </div>

      <section>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Each person</h2>
        <div className="overflow-x-auto rounded-xl border border-border-muted bg-surface-primary">
          <table className="w-full">
            <thead className="border-b border-border-muted">
              <tr>
                <th className={th}>Person</th>
                <th className={`${th} text-right`}>Closed this week</th>
                <th className={`${th} text-right`}>Open</th>
                <th className={`${th} text-right`}>Overdue</th>
                <th className={`${th} text-right`}>Due this week</th>
                <th className={`${th} text-right`}>Urgent</th>
                <th className={`${th} text-right`}>On hold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {load.map((r) => (
                <tr key={r.m.id}>
                  <td className={`${td} font-medium`}>{r.m.name}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.closed}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.open}</td>
                  <td className={`${td} text-right tabular-nums ${r.overdue ? 'font-semibold text-text-danger' : ''}`}>{r.overdue}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.week}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.urgent}</td>
                  <td className={`${td} text-right tabular-nums text-text-muted`}>{r.hold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-danger">Overdue now · {overdue.length}</h2>
        {overdue.length ? (
          <div className="divide-y divide-border-muted rounded-xl border border-border-muted bg-surface-primary">
            {overdue.map(({ t, p }) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-28 shrink-0 text-text-danger">{shortDate(p.due!)}</span>
                <span className="min-w-0 flex-1 text-text-primary">
                  {t.title} <span className="text-text-muted">· {p.what}</span>
                </span>
                <span className="shrink-0 text-text-muted">{name(p.ownerId)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Nothing overdue.</p>
        )}
      </section>

      {undatedUrgent.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-warning">
            Urgent with no date · {undatedUrgent.length}
          </h2>
          <p className="mb-1.5 text-xs text-text-muted">These cannot go overdue or be chased until they have a date.</p>
          <div className="divide-y divide-border-muted rounded-xl border border-border-muted bg-surface-primary">
            {undatedUrgent.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 text-text-primary">{t.title}</span>
                <span className="shrink-0 text-text-muted">
                  {[...new Set(t.parts.filter((p) => !p.done && !p.due).map((p) => name(p.ownerId)))].join(', ')}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-success">Closed this week · {closed.length}</h2>
        {closed.length ? (
          <div className="divide-y divide-border-muted rounded-xl border border-border-muted bg-surface-primary">
            {closed.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-28 shrink-0 text-text-muted">
                  {new Date(t.closedAt!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })}
                </span>
                <span className="min-w-0 flex-1 text-text-primary">{t.title}</span>
                <span className="shrink-0 text-text-muted">{name(t.closedBy)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Nothing closed in the last seven days.</p>
        )}
      </section>
    </div>
  );
};

export default ReviewView;
