'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface SameWinePanelProps {
  outletId: string | null;
}

/**
 * One wine on several consignment lines, and the tool to fold them together
 *
 * Sales land on one code and the invoice on another, which is where bottles
 * with "no invoice left to bill them against" and negative sold come from.
 * Likely pairs are proposed; any two codes can also be merged by hand, for a
 * misspelling the names do not give away. A merge moves the invoices and
 * sales across and holds for every later sync and import.
 *
 * @example
 *   <SameWinePanel outletId={outletId} />
 */
const SameWinePanel = ({ outletId }: SameWinePanelProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [fromCode, setFromCode] = useState('');
  const [toCode, setToCode] = useState('');

  const duplicates = useQuery({
    ...api.distribution.admin.getLineDuplicates.queryOptions({
      outletId: outletId ?? '',
    }),
    enabled: Boolean(outletId),
  });

  const merge = useMutation({
    ...api.distribution.admin.mergeWine.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(`Merged: ${result.moved} lines moved onto ${result.toLwin18}`);
      setFromCode('');
      setToCode('');
      await Promise.all(
        [
          api.distribution.admin.getLineDuplicates.queryKey(),
          api.distribution.admin.getBalances.queryKey(),
          api.distribution.admin.getStatement.queryKey(),
          api.distribution.admin.getMonthSummary.queryKey(),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const data = duplicates.data;

  if (!outletId || !data) return null;

  const target = data.lines.find((line) => line.code === toCode);

  return (
    <div className="border-border-primary space-y-3 rounded-xl border p-4">
      <div>
        <Typography variant="labelSm" asChild>
          <h2>One wine, several codes</h2>
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            A wine held under two codes splits its sales from its invoices.
            Merging moves the invoices and sales onto the line kept and holds
            for every later sync.{' '}
            {data.notLwin.length > 0
              ? `${data.notLwin.length} codes are not a LWIN18 (W codes or internal codes).`
              : ''}
          </p>
        </Typography>
      </div>

      {data.groups.length > 0 ? (
        <div className="divide-border-muted divide-y">
          {data.groups.map((group) => (
            <div key={group.main.key} className="space-y-1.5 py-2">
              <Typography variant="bodySm" asChild>
                <p>
                  {group.main.name}{' '}
                  <span className="text-text-muted tabular-nums">
                    · {group.main.code} · {group.main.outBottles} out
                  </span>
                </p>
              </Typography>
              {group.duplicates.map((duplicate) => (
                <div
                  key={duplicate.key}
                  className="flex flex-wrap items-center justify-between gap-2 pl-3"
                >
                  <Typography variant="bodyXs" colorRole="muted" asChild>
                    <span className="tabular-nums">
                      also {duplicate.code} · {duplicate.name} ·{' '}
                      {duplicate.outBottles} out · {duplicate.soldBottles} sold
                    </span>
                  </Typography>
                  <Button
                    size="xs"
                    variant="outline"
                    isDisabled={merge.isPending}
                    onClick={() =>
                      merge.mutate({
                        outletId,
                        fromCode: duplicate.code,
                        toLwin18: group.main.code,
                        toName: group.main.name,
                      })
                    }
                  >
                    Merge into the line above
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>No likely duplicates found by name.</p>
        </Typography>
      )}

      <div className="border-border-primary flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-text-muted text-xs">Fold this code</span>
          <select
            value={fromCode}
            onChange={(event) => setFromCode(event.target.value)}
            className="border-border-primary bg-fill-primary text-text-primary min-h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="">Choose…</option>
            {data.lines.map((line) => (
              <option key={line.key} value={line.code}>
                {line.name} · {line.code}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-text-muted text-xs">into this wine</span>
          <select
            value={toCode}
            onChange={(event) => setToCode(event.target.value)}
            className="border-border-primary bg-fill-primary text-text-primary min-h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="">Choose…</option>
            {data.lines
              .filter((line) => line.code !== fromCode)
              .map((line) => (
                <option key={line.key} value={line.code}>
                  {line.name} · {line.code}
                </option>
              ))}
          </select>
        </label>
        <Button
          size="sm"
          colorRole="bold"
          isDisabled={!fromCode || !toCode || merge.isPending}
          onClick={() =>
            merge.mutate({
              outletId,
              fromCode,
              toLwin18: toCode,
              toName: target?.name,
            })
          }
        >
          Merge
        </Button>
      </div>
    </div>
  );
};

export default SameWinePanel;
