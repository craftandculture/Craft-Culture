'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import useTRPC from '@/lib/trpc/browser';

type Mode = 'off' | 'shadow' | 'live';

const MODES: { mode: Mode; label: string; detail: string }[] = [
  {
    mode: 'off',
    label: 'Off',
    detail: 'The new emails are not sent; partners and distributors keep receiving the older emails.',
  },
  {
    mode: 'shadow',
    label: 'Shadow',
    detail: 'Each new email goes to Kevin instead, marked with who it was for. The older emails still go out.',
  },
  {
    mode: 'live',
    label: 'Live',
    detail: 'The new emails go to partners and distributors, and replace the older ones.',
  },
];

const STATUS: Record<string, { label: string; tint: string }> = {
  pending: { label: 'Waiting', tint: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
  shadowed: { label: 'Sent to team', tint: 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300' },
  sent: { label: 'Sent', tint: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' },
  merged: { label: 'Combined or no longer needed', tint: 'bg-fill-muted text-text-muted' },
  suppressed: { label: 'Not sent (off)', tint: 'bg-fill-muted text-text-muted' },
  failed: { label: 'Failed', tint: 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300' },
};

const smallButton = 'border-border-muted hover:bg-fill-muted rounded-lg border px-3 py-1.5 text-xs font-semibold';
const primaryButton = 'bg-text-primary text-surface-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40';

const when = (value: Date | string | null) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        timeZone: 'Asia/Dubai',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

/**
 * Order Emails: the switch for the order emails to partners and distributors,
 * and everything queued
 *
 * Every order event that concerns a partner or a distributor queues an email
 * here. Off by default; shadow sends each one to Kevin so real emails from real
 * orders can be read first; live replaces the older per-event emails.
 */
const OrderEmailsAdmin = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<Mode | null>(null);

  const { data } = useQuery(api.privateClientOrders.adminGetOrderEmails.queryOptions());

  const setMode = useMutation({
    ...api.privateClientOrders.adminSetOrderEmailMode.mutationOptions(),
    onSuccess: (result) => {
      toast.success(
        result.mode === 'live'
          ? 'Order emails are now live'
          : result.mode === 'shadow'
            ? 'Order emails now go to Kevin'
            : 'Order emails are off',
      );
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: api.privateClientOrders.adminGetOrderEmails.queryKey() });
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = data?.rows ?? [];
  const count = (status: string) => rows.filter((row) => row.status === status).length;

  return (
    <div className="pb-10">
      <header className="mb-5">
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Order Emails</h1>
        <p className="text-text-muted mt-0.5 max-w-2xl text-sm">
          Emails to wine partners and distributors about their orders. Each order event queues an email here; events on
          the same order a few minutes apart go as one.
        </p>
      </header>

      <div className="border-border-muted bg-surface-muted mb-5 rounded-xl border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-text-primary text-sm">
            <span className="font-semibold">
              {data?.mode === 'live'
                ? 'Live: emails go to partners and distributors.'
                : data?.mode === 'shadow'
                  ? `Shadow: every new email goes to ${data.shadowInbox}.`
                  : 'Off: nothing is sent.'}
            </span>{' '}
            {MODES.find((m) => m.mode === data?.mode)?.detail}
          </p>
          <div className="flex gap-2">
            {MODES.map((option) => (
              <button
                key={option.mode}
                type="button"
                disabled={!data || data.mode === option.mode || setMode.isPending}
                aria-pressed={data?.mode === option.mode}
                className={data?.mode === option.mode ? primaryButton : smallButton}
                onClick={() => setConfirm(option.mode)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Waiting', value: count('pending'), tint: 'bg-amber-50 dark:bg-amber-500/10' },
          { label: 'Sent to team', value: count('shadowed'), tint: 'bg-sky-50 dark:bg-sky-500/10' },
          { label: 'Sent', value: count('sent'), tint: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { label: 'Sent in 30 days (Loops limit 4,000)', value: data?.sentLast30Days ?? 0, tint: 'bg-fill-muted' },
        ].map((tile) => (
          <div key={tile.label} className={`rounded-xl px-4 py-3 ${tile.tint}`}>
            <span className="text-text-primary block text-2xl font-semibold tabular-nums">{tile.value}</span>
            <span className="text-text-muted text-xs font-semibold">{tile.label}</span>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-text-muted border-border-muted rounded-xl border border-dashed px-4 py-10 text-center text-sm">
          No order emails yet. They appear here as orders are approved, paid, dispatched and delivered.
        </p>
      ) : (
        <ul className="border-border-muted divide-border-muted divide-y rounded-xl border">
          {rows.map((row) => {
            const status = STATUS[row.status] ?? STATUS.pending!;
            return (
              <li key={row.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate text-sm font-semibold">
                    {row.isAction ? 'Action · ' : ''}
                    {row.subject ?? row.event}
                  </p>
                  <p className="text-text-muted truncate text-xs">
                    For {row.recipientName || row.recipientEmail} ({row.recipientEmail})
                    {` · ${row.audience === 'partner' ? 'Wine partner' : 'Distributor'}`}
                    {row.error ? ` · ${row.error}` : ''}
                  </p>
                </div>
                <span className="text-text-muted text-xs tabular-nums sm:w-28 sm:text-right">
                  {when(row.sentAt ?? row.sendAt)}
                </span>
                <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${status.tint}`}>
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === 'live'
                ? 'Send order emails to partners and distributors?'
                : confirm === 'shadow'
                  ? 'Send order emails to Kevin first?'
                  : 'Turn order emails off?'}
            </DialogTitle>
            <DialogDescription>{MODES.find((m) => m.mode === confirm)?.detail}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-text-muted text-sm">
              {confirm === 'live'
                ? 'Within five minutes partners and distributors receive the new emails, and the older emails stop.'
                : confirm === 'shadow'
                  ? `Nothing new reaches a partner. Each email goes to ${data?.shadowInbox ?? 'Kevin'} with the recipient in the subject.`
                  : 'Emails that fall due while off are set aside and are not sent later.'}
            </p>
          </DialogBody>
          <DialogFooter>
            <button type="button" className={smallButton} onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={setMode.isPending}
              onClick={() => confirm && setMode.mutate({ mode: confirm })}
            >
              {confirm === 'live' ? 'Go live' : confirm === 'shadow' ? 'Turn on shadow' : 'Turn off'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderEmailsAdmin;
