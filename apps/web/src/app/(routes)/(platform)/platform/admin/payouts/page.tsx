'use client';

import { IconCheck, IconRefresh } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const STATE_STYLES: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800',
  approved: 'bg-teal-100 text-teal-800',
  paid: 'bg-fill-secondary text-text-muted',
};

/**
 * Paying members for wine that has sold
 *
 * The last link in the consignment chain. A sale writes a settlement, a
 * settlement waits until the buyer's money is in, and a run turns everything
 * waiting into bills in Zoho for the accounts team to pay.
 *
 * Approving is where a member is actually paid, so it is deliberately a second
 * action: a run is opened as a draft, read, and only then approved.
 */
const PayoutsPage = () => {
  const api = useTRPC();
  const [periodEnd, setPeriodEnd] = useState(
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...api.consignment.admin.getPayoutRuns.queryOptions(),
  });

  const { mutate: createRun, isPending: isCreating } = useMutation(
    api.consignment.admin.createPayoutRun.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.runNumber} opened — ${result.settlements} settlements, ${money(result.total)} to ${result.members} ${result.members === 1 ? 'member' : 'members'}.`,
        );
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: approveRun, isPending: isApproving } = useMutation(
    api.consignment.admin.approvePayoutRun.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.runNumber} approved — ${result.billed} bills raised in Zoho.`,
        );
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const runs = data?.runs ?? [];
  const waiting = data?.waiting;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Typography variant="headingLg">Member payouts</Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1 block">
            What we owe members for wine that has sold and been paid for
          </Typography>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          isDisabled={isRefetching}
        >
          <ButtonContent iconLeft={IconRefresh}>Refresh</ButtonContent>
        </Button>
      </div>

      {/*
        Money held on members' behalf and not yet paid over. It is the figure
        that matters day to day, so it is stated before any run is opened.
      */}
      {waiting && (
        <div className="border-border-muted mb-5 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Typography
              variant="bodyXs"
              colorRole="muted"
              className="uppercase tracking-[0.08em]"
            >
              Waiting to be paid
            </Typography>
            <Typography
              variant="headingMd"
              className="text-text-brand mt-0.5 block tabular-nums"
            >
              {money(waiting.owedUsd)}
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" className="block">
              {waiting.settlements}{' '}
              {waiting.settlements === 1 ? 'sale' : 'sales'} &middot;{' '}
              {waiting.members} {waiting.members === 1 ? 'member' : 'members'}
            </Typography>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="text-text-muted mb-1 block text-[11px] uppercase tracking-wider">
                Include sales paid up to
              </span>
              <Input
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                className="max-w-[170px]"
              />
            </label>
            <Button
              size="sm"
              colorRole="brand"
              isDisabled={isCreating || waiting.settlements === 0}
              onClick={() => createRun({ periodEnd })}
            >
              <ButtonContent>Open a run</ButtonContent>
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted">
          Loading&hellip;
        </Typography>
      )}

      {!isLoading && runs.length === 0 && (
        <div className="border-border-muted rounded-xl border px-6 py-12 text-center">
          <Typography variant="bodyMd" colorRole="muted" className="block">
            No runs yet.
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" className="mt-1 block">
            A run gathers everything a buyer has paid for and turns it into
            bills.
          </Typography>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {runs.map((run) => {
          const isOpen = openId === run.id;

          return (
            <div
              key={run.id}
              className="border-border-muted overflow-hidden rounded-xl border"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : run.id)}
                className="hover:bg-fill-muted/40 flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Typography variant="bodySm" className="font-semibold">
                    <span className="font-mono text-xs">{run.runNumber}</span>
                    <span className="text-text-brand ml-2 tabular-nums">
                      {money(run.totalUsd)}
                    </span>
                  </Typography>
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="mt-0.5 block"
                  >
                    {run.memberCount}{' '}
                    {run.memberCount === 1 ? 'member' : 'members'} &middot;{' '}
                    {run.settlements.length} sales &middot; to{' '}
                    {format(new Date(run.periodEnd), 'd MMM yyyy')}
                    {run.status !== 'draft' &&
                      ` · ${run.billed}/${run.settlements.length} billed`}
                  </Typography>
                </div>
                <span
                  className={`flex-shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                    STATE_STYLES[run.status] ??
                    'bg-fill-secondary text-text-muted'
                  }`}
                >
                  {run.status}
                </span>
              </button>

              {isOpen && (
                <div className="border-border-muted bg-fill-muted/30 border-t px-4 py-4">
                  <div className="border-border-muted bg-background-primary mb-4 overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[460px] text-sm">
                      <thead>
                        <tr className="text-text-muted border-border-muted border-b text-[10px] uppercase tracking-wider">
                          <th className="px-3 py-1.5 text-left">Member</th>
                          <th className="px-3 py-1.5 text-left">Settlement</th>
                          <th className="px-3 py-1.5 text-right">Owed</th>
                          <th className="px-3 py-1.5 text-left">Bill</th>
                        </tr>
                      </thead>
                      <tbody className="divide-border-muted/60 divide-y">
                        {run.settlements.map((line) => (
                          <tr key={line.settlementNumber}>
                            <td className="px-3 py-2">{line.ownerName}</td>
                            <td className="text-text-muted px-3 py-2 font-mono text-xs">
                              {line.settlementNumber}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {money(line.owedToOwner)}
                            </td>
                            <td className="text-text-muted px-3 py-2 text-xs">
                              {line.zohoBillId ? 'Raised' : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {run.status === 'draft' ? (
                    <>
                      <Typography
                        variant="bodyXs"
                        colorRole="muted"
                        className="mb-3 block max-w-[68ch]"
                      >
                        Approving raises a bill in Zoho against each member as a
                        vendor, which is what the accounts team then pays. The
                        sales move to settled and cannot be swept into another
                        run.
                      </Typography>
                      <Button
                        size="sm"
                        colorRole="brand"
                        isDisabled={isApproving}
                        onClick={() => approveRun({ runId: run.id })}
                      >
                        <ButtonContent iconLeft={IconCheck}>
                          Approve &amp; raise bills
                        </ButtonContent>
                      </Button>
                    </>
                  ) : (
                    <Typography variant="bodyXs" colorRole="muted">
                      Approved
                      {run.approvedAt
                        ? ` ${format(new Date(run.approvedAt), 'd MMM yyyy')}`
                        : ''}
                      . {run.billed} of {run.settlements.length} bills raised in
                      Zoho.
                    </Typography>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PayoutsPage;
