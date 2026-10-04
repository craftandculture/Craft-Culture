'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import dubaiToday from '../utils/dubaiToday';
import shortDate from '../utils/shortDate';

/**
 * Shared jobs, as a partner sees them
 *
 * Every job Craft & Culture has shared with the partner: all parts (who is
 * doing what, and by when), notes in both directions, and a tick box on the
 * signed-in person's own parts. C&C's parts are shown but cannot be ticked.
 */
const PartnerTasksClient = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ ...api.teamTasks.partnerGetJobs.queryOptions(), retry: false });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const refresh = () => void queryClient.invalidateQueries();
  const onError = (e: { message: string }) => toast.error(e.message);

  const tick = useMutation({ ...api.teamTasks.partnerTickPart.mutationOptions(), onSuccess: refresh, onError });
  const note = useMutation({ ...api.teamTasks.partnerAddNote.mutationOptions(), onSuccess: refresh, onError });

  if (isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (isError || !data) return <p className="text-sm text-text-muted">There are no jobs shared with your account.</p>;

  const today = dubaiToday();
  const open = data.jobs.filter((j) => j.status === 'open');
  const closed = data.jobs.filter((j) => j.status !== 'open');

  if (!data.jobs.length) {
    return <p className="py-12 text-center text-sm text-text-muted">Craft &amp; Culture has not shared any jobs with {data.partnerName} yet.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Open · {open.length}</h2>
        {open.map((job) => (
          <div key={job.id} className="rounded-xl border border-border-muted bg-surface-primary">
            <div className="border-b border-border-muted px-4 py-3">
              <p className="text-[15px] font-semibold text-text-primary">
                {job.urgent && <span className="mr-1.5 inline-block size-2 -translate-y-px rounded-full bg-fill-danger align-middle" title="Urgent" />}
                {job.title}
              </p>
              {job.waitingOn && <p className="mt-0.5 text-xs text-text-warning">On hold: waiting on {job.waitingOn}</p>}
            </div>
            <div className="divide-y divide-border-muted">
              {job.parts.map((p) => {
                const mine = p.ownerId === data.viewerId;
                const overdue = !p.done && p.due && p.due < today;
                return (
                  <div key={p.id} className="flex items-start gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={p.done}
                      disabled={!mine || tick.isPending || Boolean(job.waitingOn)}
                      onChange={(e) => tick.mutate({ partId: p.id, done: e.target.checked })}
                      aria-label={`Mark "${p.what}" done`}
                      className="mt-0.5 size-4 shrink-0 accent-teal-600 disabled:opacity-40"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${p.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>{p.what}</p>
                      <p className="text-xs text-text-muted">{mine ? 'You' : p.ownerName}</p>
                    </div>
                    {p.due && !p.done && (
                      <span className={`shrink-0 text-[11px] ${overdue ? 'font-semibold text-text-danger' : 'text-text-muted'}`}>
                        {overdue ? `Overdue · ${shortDate(p.due)}` : shortDate(p.due)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-2 border-t border-border-muted px-4 py-3">
              {job.notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-fill-secondary px-3 py-2">
                  <p className="text-[11px] text-text-muted">
                    {n.name ?? 'Craft & Culture'} ·{' '}
                    {new Date(n.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-text-primary">{n.body}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={drafts[job.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [job.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    const body = (drafts[job.id] ?? '').trim();
                    if (e.key === 'Enter' && body) {
                      note.mutate({ taskId: job.id, body }, { onSuccess: () => setDrafts((d) => ({ ...d, [job.id]: '' })) });
                    }
                  }}
                  placeholder="Write a note to Craft & Culture and press Enter"
                  className="h-9 flex-1 rounded-lg border border-border-primary bg-surface-primary px-2.5 text-sm text-text-primary"
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      {closed.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Closed in the last 30 days</h2>
          <div className="divide-y divide-border-muted rounded-xl border border-border-muted bg-surface-primary">
            {closed.map((j) => (
              <p key={j.id} className="px-4 py-2 text-sm text-text-muted">
                {j.title}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default PartnerTasksClient;
