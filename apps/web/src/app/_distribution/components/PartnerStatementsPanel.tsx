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
  const [payee, setPayee] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');

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

  const refreshStatements = () =>
    queryClient.invalidateQueries({
      queryKey: api.distribution.admin.getPartnerStatements.queryKey(),
    });

  const addAdjustment = useMutation(
    api.distribution.admin.addPartnerAdjustment.mutationOptions({
      onSuccess: () => {
        setAdjustmentNote('');
        setAdjustmentAmount('');
        toast.success('Statement line added');
        void refreshStatements();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const removeAdjustment = useMutation(
    api.distribution.admin.removePartnerAdjustment.mutationOptions({
      onSuccess: () => {
        toast.success('Statement line removed');
        void refreshStatements();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (!outletId) return null;

  const data = statements.data;
  const flagged = data?.outright.filter((line) => line.needsConfirm) ?? [];
  const shown = showAll ? (data?.outright ?? []) : flagged;
  const hasAdjustments = (data?.adjustments.length ?? 0) > 0;
  const chosenRow = data?.rows.find((row) => row.name === payee);

  return (
    <div className="border-border-primary space-y-4 rounded-xl border p-4">
      <div>
        <Typography variant="labelSm" asChild>
          <h2>Partner statements for {month}</h2>
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1 max-w-2xl">
            Every bottle from each partner&rsquo;s lot sold this month, to any
            customer: consignment at City Drinks (on the CD sale, or on dispatch
            where the owner is paid that way), outright sales and private client
            orders, each at the partner&rsquo;s agreed price.
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
                {hasAdjustments ? (
                  <th className="py-1 pr-3 text-right font-medium">Adjustments</th>
                ) : null}
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
                  {hasAdjustments ? (
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {row.adjustments ? money(row.adjustments) : ''}
                    </td>
                  ) : null}
                  <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                    {money(row.totalOwed)}
                  </td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-1.5 pr-3">Total</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{money(data.totals.consignmentOwed)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{money(data.totals.outrightOwed)}</td>
                {hasAdjustments ? (
                  <td className="py-1.5 pr-3 text-right tabular-nums">{money(data.totals.adjustments)}</td>
                ) : null}
                <td className="py-1.5 pr-3 text-right tabular-nums">{money(data.totals.totalOwed)}</td>
              </tr>
            </tbody>
          </table>

          <div className="space-y-2">
            <Typography variant="labelXs" asChild>
              <h3>One-off lines</h3>
            </Typography>
            {data.adjustments.map((adjustment) => (
              <div key={adjustment.id} className="flex items-center gap-3 text-xs">
                <span className="font-medium">{adjustment.payee}</span>
                <span className="text-text-muted flex-1">{adjustment.description}</span>
                <span className="tabular-nums">{money(adjustment.amount)}</span>
                <button
                  type="button"
                  disabled={removeAdjustment.isPending}
                  onClick={() => removeAdjustment.mutate({ id: adjustment.id })}
                  className="text-text-muted underline"
                >
                  Remove
                </button>
              </div>
            ))}
            <form
              className="flex flex-wrap items-center gap-2 text-xs"
              onSubmit={(event) => {
                event.preventDefault();
                const amount = Number(adjustmentAmount);

                if (!payee.trim() || !adjustmentNote.trim() || !Number.isFinite(amount) || amount === 0) {
                  toast.error('Name the partner, say what the line is for, and give an amount');
                  return;
                }

                addAdjustment.mutate({
                  month,
                  payee: payee.trim(),
                  partnerId: chosenRow?.partnerId ?? null,
                  description: adjustmentNote.trim(),
                  amount,
                });
              }}
            >
              <input
                list="statement-payees"
                value={payee}
                onChange={(event) => setPayee(event.target.value)}
                placeholder="Partner or brand"
                className="border-border-primary rounded-lg border px-2 py-1"
              />
              <datalist id="statement-payees">
                {data.rows.map((row) => (
                  <option key={row.partnerId ?? row.name} value={row.name} />
                ))}
              </datalist>
              <input
                value={adjustmentNote}
                onChange={(event) => setAdjustmentNote(event.target.value)}
                placeholder="What it is for, e.g. 10% on the Super Cellar order"
                className="border-border-primary min-w-64 flex-1 rounded-lg border px-2 py-1"
              />
              <input
                value={adjustmentAmount}
                onChange={(event) => setAdjustmentAmount(event.target.value)}
                inputMode="decimal"
                placeholder="Amount $ (− to take off)"
                className="border-border-primary w-40 rounded-lg border px-2 py-1"
              />
              <button
                type="submit"
                disabled={addAdjustment.isPending}
                className="rounded-lg bg-neutral-900 px-3 py-1 font-medium text-white disabled:opacity-50"
              >
                Add line
              </button>
            </form>
          </div>

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
                        <span className="text-text-muted block">
                          {line.customerName}
                          {line.basis === 'dispatch'
                            ? ' · consignment, paid on dispatch'
                            : line.basis === 'pco'
                              ? ' · private client order'
                              : ''}
                        </span>
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
                      <td className="py-1 pr-2 text-right tabular-nums">
                        {line.paidThroughPco ? (
                          <span className="text-text-muted" title="The order's partner payment already covers these bottles">
                            Paid in {line.paidThroughPco}
                          </span>
                        ) : (
                          money(line.owed)
                        )}
                      </td>
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
