'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import LinkWinePicker from './LinkWinePicker';

export interface UnmatchedLinesPanelProps {
  outletId: string | null;
  month: string;
}

/**
 * Sales the month could not tie to an owner, kept until each is answered
 *
 * Every line carries the likeliest answer where there is one — the owner the
 * Codes tab names, or a wine whose name matches — and is confirmed with one
 * click. Nothing here is applied without a person: a guess applied silently
 * is how a partner gets paid for somebody else's wine. "Not ours" files the
 * code as City Drinks' own stock, billed and paid to nobody.
 *
 * Each answer is kept against the code, so it holds in every later month, and
 * the month is re-matched at once.
 *
 * @example
 *   <UnmatchedLinesPanel outletId={outletId} month="2026-10" />
 */
const UnmatchedLinesPanel = ({ outletId, month }: UnmatchedLinesPanelProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState<string | null>(null);

  const unmatched = useQuery({
    ...api.distribution.admin.getUnmatchedLines.queryOptions({
      outletId: outletId ?? '',
      month,
    }),
    enabled: Boolean(outletId),
  });

  const refresh = async () => {
    await Promise.all(
      [
        api.distribution.admin.getUnmatchedLines.queryKey(),
        api.distribution.admin.getMonthSummary.queryKey(),
        api.distribution.admin.getStatement.queryKey(),
        api.distribution.admin.getBalances.queryKey(),
        api.distribution.admin.getSetup.queryKey(),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  };

  const confirm = useMutation({
    ...api.distribution.admin.confirmSale.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        result
          ? `Matched. ${result.unattributedBottles} bottles still waiting.`
          : 'Matched.',
      );
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const rematch = useMutation({
    ...api.distribution.admin.reattributeMonth.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        `${month} matched again: ${result.bottles} bottles attributed, ${result.unattributedBottles} waiting.`,
      );
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const data = unmatched.data;

  if (!outletId || !data || data.lines.length === 0) return null;

  return (
    <div className="border-border-warning bg-fill-warning/5 space-y-3 rounded-xl border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Typography variant="labelSm" colorRole="warning" asChild>
            <h2>
              {data.bottles} bottles sold in {month} not yet tied to an owner
            </h2>
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1 max-w-3xl">
              Nobody is billed for these and no owner is paid until each is
              answered. Confirm the suggestion, choose the wine, or mark it as
              City Drinks&rsquo; own stock.
            </p>
          </Typography>
        </div>
        <Button
          size="sm"
          variant="outline"
          isDisabled={rematch.isPending}
          onClick={() => rematch.mutate({ outletId, month })}
        >
          {rematch.isPending ? 'Matching…' : 'Match the month again'}
        </Button>
      </div>

      <div className="divide-border-muted divide-y">
        {data.lines.map((line) => {
          const key = `${line.outletCode}-${line.productName}`;
          const code = line.outletCode ?? '';

          return (
            <div key={key} className="space-y-2 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Typography variant="bodySm" asChild>
                  <span>
                    {line.productName ?? '(no name)'}{' '}
                    <span className="text-text-muted tabular-nums">
                      · {line.bottles} btl
                    </span>
                  </span>
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <span className="tabular-nums">{line.outletCode}</span>
                </Typography>
              </div>

              <Typography variant="bodyXs" colorRole="muted" asChild>
                <p>{line.reason}</p>
              </Typography>

              {line.suggestedOwnerName || line.suggestedName ? (
                <Typography variant="bodyXs" asChild>
                  <p>
                    <span className="text-text-muted">Suggested: </span>
                    {[line.suggestedOwnerName, line.suggestedName]
                      .filter(Boolean)
                      .join(' · ')}
                    {line.suggestedWhy ? (
                      <span className="text-text-muted">
                        {' '}
                        ({line.suggestedWhy})
                      </span>
                    ) : null}
                  </p>
                </Typography>
              ) : null}

              {code ? (
                <div className="flex flex-wrap gap-2">
                  {(line.candidateOwners ?? []).map((owner) => (
                    <Button
                      key={owner.id}
                      size="sm"
                      colorRole="bold"
                      isDisabled={confirm.isPending || !line.suggestedLwin18}
                      onClick={() =>
                        confirm.mutate({
                          outletId,
                          month,
                          outletCode: code,
                          lwin18: line.suggestedLwin18!,
                          ownerId: owner.id,
                          outletProductName: line.productName ?? undefined,
                          ourProductName: line.suggestedName ?? undefined,
                        })
                      }
                    >
                      {owner.name}&rsquo;s
                    </Button>
                  ))}
                  {line.suggestedLwin18 && !line.candidateOwners?.length ? (
                    <Button
                      size="sm"
                      colorRole="bold"
                      isDisabled={confirm.isPending}
                      onClick={() =>
                        confirm.mutate({
                          outletId,
                          month,
                          outletCode: code,
                          lwin18: line.suggestedLwin18!,
                          outletProductName: line.productName ?? undefined,
                          ourProductName: line.suggestedName ?? undefined,
                        })
                      }
                    >
                      Confirm
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPicking(picking === key ? null : key)}
                  >
                    Choose the wine
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={confirm.isPending}
                    onClick={() =>
                      confirm.mutate({
                        outletId,
                        month,
                        outletCode: code,
                        notOurs: true,
                        outletProductName: line.productName ?? undefined,
                      })
                    }
                  >
                    City Drinks&rsquo; own stock
                  </Button>
                </div>
              ) : null}

              {picking === key && code ? (
                <LinkWinePicker
                  outletId={outletId}
                  outletCode={code}
                  productName={line.productName ?? ''}
                  onCancel={() => setPicking(null)}
                  onLinked={() => {
                    setPicking(null);
                    rematch.mutate({ outletId, month });
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UnmatchedLinesPanel;
