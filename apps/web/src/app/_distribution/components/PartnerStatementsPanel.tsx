'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface PartnerStatementsPanelProps {
  outletId: string | null;
  month: string;
}

const money = (value: number | null | undefined) =>
  value == null
    ? '—'
    : `$${new Intl.NumberFormat('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)}`;

/**
 * What each partner is owed for the month, consignment and outright together
 *
 * Outright sales are partner wine invoiced to a customer: owned by the lot the
 * warehouse picked, at the partner's Pricing Manager price. Lines for a wine
 * two or more partners hold are listed first with a button per holder, since
 * a wrong guess there pays the wrong partner.
 */
const PartnerStatementsPanel = ({ outletId, month }: PartnerStatementsPanelProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const statements = useQuery({
    ...api.distribution.admin.getPartnerStatements.queryOptions({
      outletId: outletId ?? '',
      month,
    }),
    enabled: Boolean(outletId),
  });

  const confirm = useMutation(
    api.distribution.admin.confirmOutrightOwner.mutationOptions({
      onSuccess: () => {
        toast.success('Owner confirmed');
        void queryClient.invalidateQueries({
          queryKey: api.distribution.admin.getPartnerStatements.queryKey(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (!outletId) return null;

  const data = statements.data;
  const flagged = data?.outright.filter((line) => line.needsConfirm) ?? [];
  const shown = showAll ? (data?.outright ?? []) : flagged;

  return (
    <div className="border-border-primary space-y-4 rounded-xl border p-4">
      <div>
        <Typography variant="labelSm" asChild>
          <h2>Partner statements for {month}</h2>
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1 max-w-2xl">
            Consignment sales at City Drinks and outright sales to customers,
            each at the partner&rsquo;s agreed price.
          </p>
        </Typography>
      </div>

      {statements.isError ? (
        <p className="text-text-danger text-xs">{statements.error.message}</p>
      ) : statements.isLoading || !data ? (
        <p className="text-text-muted text-xs">Building the statements…</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="text-text-muted border-border-primary border-b text-xs">
              <tr>
                <th className="py-1 pr-3 text-left font-medium">Partner</th>
                <th className="py-1 pr-3 text-right font-medium">Consignment</th>
                <th className="py-1 pr-3 text-right font-medium">Outright</th>
                <th className="py-1 pr-3 text-right font-medium">Total owed</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.partnerId ?? row.name} className="border-border-muted border-b">
                  <td className="py-1.5 pr-3">
                    {row.name}
                    {row.toConfirm > 0 ? (
                      <Badge size="xs" colorRole="warning" className="ml-2">
                        {row.toConfirm} to confirm
                      </Badge>
                    ) : null}
                    {row.withoutCost > 0 ? (
                      <Badge size="xs" colorRole="danger" className="ml-2">
                        {row.withoutCost} with no cost
                      </Badge>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {money(row.consignmentOwed)}
                    <span className="text-text-muted ml-1 text-xs">{row.consignmentBottles} btl</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {money(row.outrightOwed)}
                    <span className="text-text-muted ml-1 text-xs">{row.outrightBottles} btl</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                    {money(row.totalOwed)}
                  </td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-1.5 pr-3">Total</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{money(data.totals.consignmentOwed)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{money(data.totals.outrightOwed)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{money(data.totals.totalOwed)}</td>
              </tr>
            </tbody>
          </table>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Typography variant="labelXs" asChild>
                <h3>
                  {showAll
                    ? `Outright sales (${data.outright.length} lines)`
                    : `Outright lines to confirm (${flagged.length})`}
                </h3>
              </Typography>
              <button
                type="button"
                className="text-text-muted text-xs underline"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll ? 'Show only those to confirm' : `Show all ${data.outright.length}`}
              </button>
            </div>
            {shown.length === 0 ? (
              <p className="text-text-muted text-xs">
                {showAll ? 'No outright sales this month.' : 'Nothing to confirm.'}
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-text-muted">
                  <tr>
                    <th className="py-1 pr-2 text-left font-medium">Invoice</th>
                    <th className="py-1 pr-2 text-left font-medium">Wine</th>
                    <th className="py-1 pr-2 text-right font-medium">Btl</th>
                    <th className="py-1 pr-2 text-left font-medium">Owner</th>
                    <th className="py-1 pr-2 text-right font-medium">Owed</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((line) => (
                    <tr key={`${line.lineId}-${line.ownerPartnerId}`} className="border-border-muted border-b align-top">
                      <td className="py-1 pr-2">
                        {line.invoiceNumber}
                        <span className="text-text-muted block">{line.customerName}</span>
                      </td>
                      <td className="py-1 pr-2">{line.productName}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{line.bottles}</td>
                      <td className="py-1 pr-2">
                        {line.ownerName ?? 'Unknown'}
                        <span className="text-text-muted ml-1">({line.ownerSource})</span>
                        {line.needsConfirm ? (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {line.holders.map((holder) => (
                              <button
                                key={holder.partnerId}
                                type="button"
                                disabled={confirm.isPending}
                                onClick={() =>
                                  confirm.mutate({
                                    invoiceLineId: line.lineId,
                                    ownerPartnerId: holder.partnerId,
                                  })
                                }
                                className="border-border-primary hover:bg-fill-muted rounded border px-1.5 py-0.5"
                              >
                                {holder.name}
                              </button>
                            ))}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1 pr-2 text-right tabular-nums">{money(line.owed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PartnerStatementsPanel;
