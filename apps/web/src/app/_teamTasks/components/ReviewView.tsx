'use client';

import DueMenu from './DueMenu';
import type { Board, BoardTask } from '../types/Board';
import partLabel from '../utils/partLabel';
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
  const undatedParts = open
    .filter((t) => t.urgent && !t.waitingOn)
    .flatMap((t) => t.parts.filter((p) => !p.done && !p.due && partState(p, t, today) !== 'blocked').map((p) => ({ t, p })));

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Closed this week', value: closed.length, tone: 'text-text-success' },
            { label: 'Overdue now', value: overdue.length, tone: overdue.length ? 'text-text-danger' : '' },
            { label: 'Urgent, no date', value: undatedParts.length, tone: undatedParts.length ? 'text-text-warning' : '' },
            { label: 'Open jobs', value: open.length, tone: '' },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-border-muted bg-surface-primary shadow-sm px-4 py-3">
              <p className={`text-2xl font-bold tabular-nums ${k.tone}`}>{k.value}</p>
              <p className="text-xs text-text-muted">{k.label}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="tt-controls h-8 rounded-lg border border-border-primary bg-fill-primary px-3 text-sm font-medium text-text-primary"
        >
          Print
        </button>
      </div>

      <section>
        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Each person</h2>
        <div className="overflow-x-auto rounded-xl border border-border-muted bg-surface-primary shadow-sm">
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
        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-danger">Overdue now · {overdue.length}</h2>
        {overdue.length ? (
          <div className="divide-y divide-border-muted rounded-xl border border-border-muted bg-surface-primary shadow-sm">
            {overdue.map(({ t, p }) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-28 shrink-0 text-text-danger">{shortDate(p.due!)}</span>
                <span className="min-w-0 flex-1 text-text-primary">
                  {t.title}
                  {partLabel(t.title, p.what) && <span className="text-text-muted"> · {partLabel(t.title, p.what)}</span>}
                </span>
                <span className="shrink-0 text-text-muted">{name(p.ownerId)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Nothing overdue.</p>
        )}
      </section>

      {undatedParts.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-warning">
            Urgent with no date · {undatedParts.length}
          </h2>
          <p className="mb-1.5 text-xs text-text-muted">These cannot go overdue or be chased until they have a date. Set one here.</p>
          <div className="divide-y divide-border-muted rounded-xl border border-border-muted bg-surface-primary shadow-sm">
            {undatedParts.map(({ t, p }) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 text-text-primary">
                  {t.title}
                  {partLabel(t.title, p.what) && <span className="text-text-muted"> · {partLabel(t.title, p.what)}</span>}
                </span>
                <span className="w-32 shrink-0 text-right text-text-muted">{name(p.ownerId)}</span>
                <span className="tt-controls">
                  <DueMenu partId={p.id} due={p.due} state="undated" today={today} urgent />
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-success">Closed this week · {closed.length}</h2>
        {closed.length ? (
          <div className="divide-y divide-border-muted rounded-xl border border-border-muted bg-surface-primary shadow-sm">
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
