'use client';

import { IconCloudUpload } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import ConfirmAction from '@/app/_cellar/components/ConfirmAction';
import useTRPC from '@/lib/trpc/browser';

const aed = (value: number) => `AED ${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

const statusLabel: Record<string, string> = {
  not_activated: 'Not activated',
  pending_payment: 'Awaiting card',
  active: 'Active',
  past_due: 'Paused',
  cancelled: 'Cancelled',
};

/**
 * This month's storage per member, and the push to Zoho Billing
 *
 * Push near the end of the month, before renewals: each active member's
 * extra cases become the add-on quantity on their next invoice.
 */
const StorageList = () => {
  const api = useTRPC();
  const { data, refetch } = useQuery(api.onboarding.admin.getStorage.queryOptions());
  const push = useMutation(
    api.onboarding.admin.pushExtraCases.mutationOptions({
      onSuccess: (result) => {
        const parts = [
          `${result.pushed.length} pushed`,
          result.skipped.length && `${result.skipped.length} already pushed this month`,
          result.failed.length && `${result.failed.length} failed: ${result.failed.join(', ')}`,
        ].filter(Boolean);
        (result.failed.length ? toast.error : toast.success)(parts.join(' · '));
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const setStatus = useMutation(
    api.onboarding.admin.setMembershipStatus.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          result.status === 'active'
            ? 'Membership resumed'
            : result.status === 'cancelled'
              ? 'Membership closed'
              : 'Membership paused',
        );
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const rows = data?.rows ?? [];
  const extraTotal = rows.filter((row) => row.status === 'active').reduce((sum, row) => sum + row.extraAed, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-muted text-sm">
          {data?.month} · extra cases across active members:{' '}
          <span className="text-text-primary font-semibold">{aed(extraTotal)}</span>
        </p>
        <button
          type="button"
          onClick={() => push.mutate()}
          disabled={push.isPending}
          className="bg-text-primary text-surface-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
        >
          <IconCloudUpload size={16} /> {push.isPending ? 'Pushing…' : "Push this month's extra cases"}
        </button>
      </div>

      <div className="border-border-muted bg-surface-primary overflow-x-auto rounded-xl border shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-text-muted border-border-muted border-b text-[11px] uppercase tracking-wider">
              <th className="px-4 py-2 text-left">Member</th>
              <th className="px-3 py-2 text-left">Membership</th>
              <th className="px-3 py-2 text-right">Cases held</th>
              <th className="px-3 py-2 text-right">Extra</th>
              <th className="px-3 py-2 text-right">This month</th>
              <th className="px-3 py-2 text-left">Billing</th>
              <th className="px-4 py-2 text-right">Pushed</th>
              <th className="px-4 py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-text-muted px-4 py-10 text-center">
                  No billed members yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.membershipId} className="border-border-muted hover:bg-surface-secondary/50 border-b last:border-b-0">
                <td className="text-text-primary px-4 py-2.5 font-semibold">{row.name}</td>
                <td className="text-text-muted px-3 py-2.5 text-xs">{statusLabel[row.status] ?? row.status}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.cases}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.extraCases || '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {row.status === 'active' ? aed(row.totalAed) : '—'}
                </td>
                <td className="text-text-muted px-3 py-2.5 text-xs">
                  {row.zohoSubscriptionId ? 'Card' : 'Invoice'}
                </td>
                <td className="text-text-muted px-4 py-2.5 text-right text-xs">
                  {row.zohoSubscriptionId ? (row.isPushed ? 'Yes' : '—') : 'Add to invoice'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {!row.zohoSubscriptionId && (row.status === 'active' || row.status === 'past_due') && (
                    <ConfirmAction
                      title={row.status === 'active' ? 'Pause this membership?' : 'Resume this membership?'}
                      description={
                        <p>
                          {row.status === 'active'
                            ? 'The member can still see their cellar, but buying, deliveries and sales stop until you resume. They are notified.'
                            : 'Buying, deliveries and sales open again straight away. The member is notified.'}
                        </p>
                      }
                      confirmLabel={row.status === 'active' ? 'Pause membership' : 'Resume membership'}
                      tone={row.status === 'active' ? 'danger' : 'default'}
                      onConfirm={() =>
                        setStatus.mutate({
                          membershipId: row.membershipId,
                          status: row.status === 'active' ? 'past_due' : 'active',
                        })
                      }
                    >
                      <button
                        type="button"
                        disabled={setStatus.isPending}
                        className="text-text-brand text-xs hover:underline disabled:opacity-50"
                      >
                        {row.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                    </ConfirmAction>
                  )}
                  {/*
                    Closing ends the membership for good: the member keeps seeing
                    their cellar but can no longer buy, sell or ask for
                    deliveries, and it drops out of billing. Wine still held is
                    dealt with under the terms, not by this button.
                  */}
                  {row.status !== 'cancelled' && (
                    <ConfirmAction
                      title="Close this membership?"
                      description={
                        <p>
                          The membership ends and drops out of billing. Any wine still held stays where it is until it
                          is delivered, sold or moved out.
                        </p>
                      }
                      confirmLabel="Close membership"
                      tone="danger"
                      onConfirm={() =>
                        setStatus.mutate({ membershipId: row.membershipId, status: 'cancelled' })
                      }
                    >
                      <button
                        type="button"
                        disabled={setStatus.isPending}
                        className="text-text-muted ml-3 text-xs hover:text-red-700 disabled:opacity-50"
                      >
                        Close
                      </button>
                    </ConfirmAction>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-text-muted text-xs leading-5">
        Cases are counted as held now, in standard 75cl bottles (magnum = 2, Imperial = 8): a case of up to 6
        bottles is half, 7–12 bottles one, loose bottles in sixes at half each — so push close to month end. Zoho is
        sent 6-bottle units (two per 12-bottle case): price the CELLAR-EXTRA-CASE add-on at half the Release Rates
        extra-case price.
      </p>
    </div>
  );
};

export default StorageList;
