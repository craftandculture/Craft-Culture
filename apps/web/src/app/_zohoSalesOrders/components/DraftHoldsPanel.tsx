'use client';

import { IconHandStop, IconLoader2, IconRefresh, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

const card = 'rounded-xl border border-border-muted bg-surface-primary shadow-sm';

const STATUS: Record<string, string> = {
  active: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-900',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900',
  released: 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-700',
};

const ago = (at: Date | string | null) => {
  if (!at) return 'never';
  const mins = Math.round((Date.now() - new Date(at).getTime()) / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
};

/**
 * Hold the wine on a draft sales order while the client finishes it
 *
 * Enter the draft's SO number and its lines are held, so the stock comes off
 * "available" and shows against the client everywhere holds are shown. The
 * hold follows the draft: it is brought up to date whenever orders are synced
 * (or by Refresh), released if the draft is voided or deleted, and handed to
 * the order when it is confirmed — without holding anything twice.
 */
const DraftHoldsPanel = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [number, setNumber] = useState('');

  const { data: holds } = useQuery(api.zohoSalesOrders.draftHolds.queryOptions());
  const refresh = () => void queryClient.invalidateQueries();

  const hold = useMutation({
    ...api.zohoSalesOrders.holdDraft.mutationOptions(),
    onSuccess: (r) => {
      setNumber('');
      refresh();
      if (r.short.length) {
        toast.warning(`${r.number}: held ${r.casesHeld} cases. Not enough free stock for ${r.short.map((s) => s.name).join(', ')}`);
      } else {
        toast.success(`${r.number}: ${r.casesHeld} case${r.casesHeld === 1 ? '' : 's'} held`);
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const refreshOne = useMutation({
    ...api.zohoSalesOrders.refreshDraftHold.mutationOptions(),
    onSuccess: (r) => {
      refresh();
      const said = {
        held: 'Hold brought up to date',
        released: 'The draft was voided or deleted in Zoho, so its stock has been released',
        confirmed: 'The order was confirmed; its holds have moved to the synced order',
        awaiting_sync: 'Confirmed in Zoho — the holds move across when orders next sync',
        inactive: 'This hold is no longer active',
        unreachable: 'Zoho could not be reached',
      } as const;
      toast.success(said[r.outcome]);
    },
    onError: (e) => toast.error(e.message),
  });
  const release = useMutation({
    ...api.zohoSalesOrders.releaseDraftHold.mutationOptions(),
    onSuccess: () => {
      refresh();
      toast.success('Released');
    },
    onError: (e) => toast.error(e.message),
  });
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
  const [showFinished, setShowFinished] = useState(false);

  const active = (holds ?? []).filter((h) => h.status === 'active');
  const recent = (holds ?? []).filter((h) => h.status !== 'active');

  return (
    <section className={`${card} p-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <IconHandStop size={16} /> Hold stock for a draft order
            {active.length ? (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">{active.length} held</span>
            ) : null}
          </p>
          <p className="text-xs text-text-muted">
            For a client still adding to their order. The hold follows the draft and moves to the order when it is confirmed.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (number.trim()) hold.mutate({ number: number.trim() });
          }}
          className="flex gap-2"
        >
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Draft SO number, e.g. SO-00151"
            className="h-9 w-56 rounded-lg border border-border-muted bg-surface-primary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={hold.isPending || !number.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-text-primary px-3 text-sm font-medium text-surface-primary disabled:opacity-50"
          >
            {hold.isPending ? <IconLoader2 size={15} className="animate-spin" /> : null} Hold stock
          </button>
        </form>
      </div>

      {/*
        Finished holds are history. Listed in full they pushed the orders this
        screen is for below the fold — fifteen "confirmed" rows above the list
        on a normal day — so only live holds show until asked.
      */}
      {active.length > 0 || (showFinished && recent.length > 0) ? (
        <ul className="mt-3 divide-y divide-border-muted rounded-lg border border-border-muted">
          {[...active, ...(showFinished ? recent : [])].map((h) => {
            const casesHeld = h.lines.reduce((s, l) => s + l.casesHeld, 0);
            return (
              <li key={h.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono font-semibold text-text-primary">{h.number}</span>
                    <span className="text-text-primary">{h.customerName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS[h.status]}`}>
                      {h.status === 'active' ? `${casesHeld} case${casesHeld === 1 ? '' : 's'} held` : h.status}
                    </span>
                    <span className="text-xs text-text-muted">
                      {h.status === 'active' ? `checked ${ago(h.lastRefreshedAt)}` : h.statusReason}
                    </span>
                  </p>
                  {h.status === 'active' ? (
                    <span className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => refreshOne.mutate({ holdId: h.id })}
                        disabled={refreshOne.isPending}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-border-muted px-2 text-xs font-medium text-text-primary hover:bg-surface-secondary"
                      >
                        <IconRefresh size={13} /> Refresh
                      </button>
                      {confirmRelease === h.id ? (
                        <button
                          type="button"
                          onClick={() => release.mutate({ holdId: h.id }, { onSettled: () => setConfirmRelease(null) })}
                          disabled={release.isPending}
                          className="h-7 rounded-lg bg-red-50 px-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-900"
                        >
                          Release all?
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRelease(h.id)}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border-muted px-2 text-xs font-medium text-text-muted hover:text-red-600"
                        >
                          <IconX size={13} /> Release
                        </button>
                      )}
                    </span>
                  ) : null}
                </div>
                {h.status === 'active' && h.lines.length ? (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-text-muted">
                    {h.lines.map((l) => (
                      <li key={l.id} className="flex justify-between gap-3">
                        <span className="truncate">
                          {l.name} · {l.quantity} {(l.unit ?? 'cases').toLowerCase()}
                        </span>
                        <span className={l.casesHeld ? 'shrink-0 text-text-primary' : 'shrink-0 font-medium text-red-600'}>
                          {l.casesHeld ? `${l.bottlesHeld} btl held` : 'not held — no free stock'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {recent.length > 0 && (
        <button
          type="button"
          onClick={() => setShowFinished((v) => !v)}
          className="mt-2 text-xs font-medium text-text-muted hover:text-text-primary"
        >
          {showFinished ? 'Hide finished holds' : `Show ${recent.length} finished hold${recent.length === 1 ? '' : 's'}`}
        </button>
      )}
    </section>
  );
};

export default DraftHoldsPanel;
