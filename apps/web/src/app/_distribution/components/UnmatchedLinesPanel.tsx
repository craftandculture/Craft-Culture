'use client';

import { useQuery } from '@tanstack/react-query';

import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface UnmatchedLinesPanelProps {
  outletId: string | null;
  month: string;
}

/**
 * Bottles the distributor sold that reach no wine of ours
 *
 * Money nobody will be billed for. These were counted in a toast when the
 * sheet was uploaded and then gone, which is the same as dropping them — the
 * sheet says the bottles left their shelf, and if we cannot name the wine we
 * cannot bill City Drinks for it or pay the owner of it.
 *
 * Shown until somebody answers them, and silent when there are none.
 */
const UnmatchedLinesPanel = ({ outletId, month }: UnmatchedLinesPanelProps) => {
  const api = useTRPC();

  const unmatched = useQuery({
    ...api.distribution.admin.getUnmatchedLines.queryOptions({
      outletId: outletId ?? '',
      month,
    }),
    enabled: Boolean(outletId),
  });

  const data = unmatched.data;

  if (!data || data.lines.length === 0) return null;

  return (
    <div className="border-border-warning bg-fill-warning/5 space-y-2 rounded-xl border p-4">
      <Typography variant="labelSm" colorRole="warning" asChild>
        <h2>
          {data.bottles} bottles sold in {month} that reach no wine of ours
        </h2>
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p className="max-w-3xl">
          City Drinks sold these and we cannot say whose they were, so nobody is
          billed for them and no owner is paid. Claim the line on the table
          below, or have City Drinks put our code against it.
        </p>
      </Typography>
      <div className="divide-border-muted divide-y">
        {data.lines.map((line) => (
          <div
            key={`${line.outletCode}-${line.productName}`}
            className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5"
          >
            <Typography variant="bodyXs" asChild>
              <span>{line.productName ?? '(no name)'}</span>
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" asChild>
              <span className="tabular-nums">
                {line.outletCode} · {line.bottles} btl · {line.reason}
              </span>
            </Typography>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UnmatchedLinesPanel;
