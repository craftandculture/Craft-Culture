'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface MonthSummaryPanelProps {
  outletId: string | null;
  month: string;
}

const money = (value: number) =>
  `$${new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

/**
 * The month across every partner, and the figure the distributor is invoiced
 *
 * The per-owner statement says what we pay Crurated. This says what pays the
 * bills: City Drinks owe us the sum of every partner's billed column, and we
 * owe each partner out of it. Both come from the same statement the per-owner
 * screen shows, so the two cannot disagree.
 *
 * A partner whose wines have no landed cost is marked rather than averaged
 * away. Their margin is unknown, not large, and a total that quietly treats an
 * unknown cost as nil reports profit we have not made.
 */
const MonthSummaryPanel = ({ outletId, month }: MonthSummaryPanelProps) => {
  const api = useTRPC();

  const summary = useQuery({
    ...api.distribution.admin.getMonthSummary.queryOptions({
      outletId: outletId ?? '',
      month,
    }),
    enabled: Boolean(outletId),
  });

  const exportAll = useMutation(
    api.distribution.admin.exportStatement.mutationOptions({
      onSuccess: (result) => {
        /*
          Built as a data URL rather than a blob: the page is rendered inside
          the platform shell and a revoked object URL has raced the click
          before.
        */
        const link = document.createElement('a');

        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.base64}`;
        link.download = result.filename;
        link.click();
        toast.success(`Exported ${result.filename}`);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const data = summary.data;

  if (!outletId) return null;

  if (summary.isError) {
    return (
      <div className="border-border-danger bg-fill-danger/5 rounded-xl border p-4">
        <Typography variant="bodySm" colorRole="danger" asChild>
          <p className="font-medium">The month could not be totalled.</p>
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1">{summary.error.message}</p>
        </Typography>
      </div>
    );
  }

  return (
    <div className="border-border-primary space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography variant="labelSm" asChild>
            <h2>The month, every partner</h2>
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1 max-w-2xl">
              What City Drinks owe us for {month}, and what we owe each partner
              out of it.
            </p>
          </Typography>
        </div>
        <button
          type="button"
          disabled={exportAll.isPending || !data?.rows.length}
          onClick={() =>
            exportAll.mutate({ outletId, ownerId: null, month })
          }
          className="bg-text-primary text-text-on-brand hover:bg-text-primary/90 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {exportAll.isPending ? 'Building…' : 'Export all partners'}
        </button>
      </div>

      {summary.isLoading ? (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>Totalling the month…</p>
        </Typography>
      ) : !data || data.rows.length === 0 ? (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>
            Nothing sold in {month}. Upload the distributor&rsquo;s sheet for
            the month above.
          </p>
        </Typography>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-text-muted border-border-primary border-b">
              <tr>
                <th className="py-2 pr-3 text-left font-medium">Partner</th>
                <th className="py-2 pr-3 text-right font-medium">Bottles</th>
                <th className="py-2 pr-3 text-right font-medium">We owe them</th>
                <th className="py-2 pr-3 text-right font-medium">
                  City Drinks owe us
                </th>
                <th className="py-2 pr-3 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.ownerId} className="border-border-muted border-b">
                  <td className="py-2 pr-3">
                    {row.ownerName}
                    {row.withoutCost > 0 ? (
                      <Badge size="xs" colorRole="warning" className="ml-2">
                        {row.withoutCost} with no landed cost
                      </Badge>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {row.bottles}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {money(row.dueToOwner)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {money(row.billedToOutlet)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {money(row.margin)}
                  </td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {data.totals.bottles}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {money(data.totals.dueToOwner)}
                </td>
                <td className="text-text-primary py-2 pr-3 text-right tabular-nums">
                  {money(data.invoiceToOutlet)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {money(data.totals.margin)}
                </td>
              </tr>
            </tbody>
          </table>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-2">
              {money(data.invoiceToOutlet)} is the figure to invoice City
              Drinks for {month}.
              {data.totals.withoutCost > 0
                ? ` ${data.totals.withoutCost} wines have no landed cost, so what we owe is understated by whatever they cost.`
                : ''}
              {data.totals.shortBottles > 0
                ? ` ${data.totals.shortBottles} bottles sold with no invoice left to bill them against.`
                : ''}
            </p>
          </Typography>
        </div>
      )}
    </div>
  );
};

export default MonthSummaryPanel;
