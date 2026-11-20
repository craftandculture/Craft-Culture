'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface SettlementPanelProps {
  outletId: string | null;
  month: string;
  owners: { id: string; name: string }[];
}

const money = (value: number | null | undefined) =>
  value == null
    ? '—'
    : `$${new Intl.NumberFormat('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)}`;

const download = (result: { base64: string; filename: string }) => {
  const link = document.createElement('a');

  link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.base64}`;
  link.download = result.filename;
  link.click();
};

const EXCEPTION_LABELS: Record<string, string> = {
  unmatched: 'Unmatched code',
  oversold: 'Oversold',
  'no-cost': 'No cost',
  count: 'Bottle check',
};

/**
 * The month's settlement with City Drinks, in the order Sophie works it
 *
 * The bottle check and anything blocking the month come first, because
 * nothing else can be trusted until they are clear. Then the three figures
 * (what City Drinks owe, what each owner is owed, what C&C keeps), the
 * adjustments log, the bottles already billed, and the export. Approving the
 * month raises the Zoho drafts and locks it.
 */
const SettlementPanel = ({ outletId, month, owners }: SettlementPanelProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [showLines, setShowLines] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [ownerAmount, setOwnerAmount] = useState('');

  const settlement = useQuery({
    ...api.distribution.admin.getSettlement.queryOptions({
      outletId: outletId ?? '',
      month,
    }),
    enabled: Boolean(outletId),
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: api.distribution.admin.getSettlement.queryKey(),
    });

  const exportMonth = useMutation(
    api.distribution.admin.exportSettlement.mutationOptions({
      onSuccess: (result) => {
        download(result);
        toast.success(`Exported ${result.filename}`);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const addAdjustment = useMutation(
    api.distribution.admin.addAdjustment.mutationOptions({
      onSuccess: () => {
        setDescription('');
        setAmount('');
        setOwnerId('');
        setOwnerAmount('');
        toast.success('Adjustment added');
        void refresh();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const removeAdjustment = useMutation(
    api.distribution.admin.removeAdjustment.mutationOptions({
      onSuccess: () => {
        toast.success('Adjustment removed');
        void refresh();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const approve = useMutation(
    api.distribution.admin.approveMonth.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${month} approved. Zoho drafts: ${result.invoiceNumber ?? 'invoice'} to City Drinks and ${result.bills} owner bills.`,
        );
        void refresh();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (!outletId) return null;

  if (settlement.isError) {
    return (
      <div className="border-border-danger bg-fill-danger/5 rounded-xl border p-4">
        <Typography variant="bodySm" colorRole="danger" asChild>
          <p className="font-medium">The month could not be settled.</p>
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1">{settlement.error.message}</p>
        </Typography>
      </div>
    );
  }

  const data = settlement.data;
  const locked = Boolean(data?.closed);
  const blocked = (data?.blockers.length ?? 0) > 0;

  return (
    <div className="border-border-primary space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography variant="labelSm" asChild>
            <h2>
              Settlement for {month}
              {locked ? (
                <Badge size="xs" colorRole="muted" className="ml-2">
                  Approved {data?.closed?.approvedAt.slice(0, 10)}
                  {data?.closed?.approvedBy ? ` by ${data.closed.approvedBy}` : ''}
                </Badge>
              ) : null}
            </h2>
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1 max-w-2xl">
              What City Drinks owe us, what we owe each owner, and the margin,
              from their report for the month.
            </p>
          </Typography>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exportMonth.isPending || !data}
            onClick={() =>
              exportMonth.mutate({ outletId, month, draft: blocked })
            }
            className="border-border-primary hover:bg-fill-muted rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {exportMonth.isPending
              ? 'Building…'
              : blocked
                ? 'Export draft'
                : 'Export month'}
          </button>
          {!locked ? (
            <button
              type="button"
              disabled={approve.isPending || !data || blocked}
              title={
                blocked
                  ? `Clear first: ${data?.blockers.join('; ')}`
                  : 'Raise the Zoho drafts and lock the month'
              }
              onClick={() => {
                if (
                  window.confirm(
                    `Approve ${month}? This raises a draft Zoho invoice to City Drinks for ${money(data?.totals.totalDue)} and a draft bill to each owner, then locks the month.`,
                  )
                ) {
                  approve.mutate({ outletId, month });
                }
              }}
              className="bg-text-primary text-text-on-brand hover:bg-text-primary/90 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {approve.isPending ? 'Approving…' : 'Approve and lock'}
            </button>
          ) : null}
        </div>
      </div>

      {settlement.isLoading || !data ? (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>Settling the month…</p>
        </Typography>
      ) : (
        <>
          <div
            className={`rounded-lg border p-3 text-sm ${
              data.check.addsUp
                ? 'border-border-primary bg-fill-muted/40'
                : 'border-border-danger bg-fill-danger/5'
            }`}
          >
            <p className="font-medium">
              {data.check.addsUp ? 'Every bottle accounted for' : 'Bottles do not add up'}
            </p>
            <p className="text-text-muted mt-1 text-xs tabular-nums">
              {data.check.onReport} on the report = {data.check.billedBottles}{' '}
              billed + {data.check.alreadyBilledBottles} already billed +{' '}
              {data.check.shortBottles} oversold +{' '}
              {data.check.unmatchedBottles} unmatched
              {data.check.addsUp ? '' : ` (${data.check.accountedFor} accounted for)`}
            </p>
            {data.blockers.length > 0 ? (
              <ul className="text-text-danger mt-2 list-disc pl-5 text-xs">
                {data.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ['Sales due', data.totals.salesDue],
              ['Adjustments', data.totals.adjustments],
              ['Total due from City Drinks', data.totals.totalDue],
              ['Owed to owners', data.totals.dueToOwners],
              ['C&C margin', data.totals.margin],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="border-border-primary rounded-lg border p-2"
              >
                <p className="text-text-muted text-[11px]">{label}</p>
                <p className="text-sm font-medium tabular-nums">
                  {money(value as number)}
                </p>
              </div>
            ))}
          </div>

          {data.exceptions.length > 0 ? (
            <div>
              <Typography variant="labelXs" asChild>
                <h3 className="mb-1">Exceptions ({data.exceptions.length})</h3>
              </Typography>
              <table className="w-full text-xs">
                <tbody>
                  {data.exceptions.map((row, index) => (
                    <tr
                      key={`${row.kind}-${row.outletCode}-${index}`}
                      className="border-border-muted border-b"
                    >
                      <td className="py-1 pr-2">
                        <Badge
                          size="xs"
                          colorRole={row.kind === 'oversold' ? 'warning' : 'danger'}
                        >
                          {EXCEPTION_LABELS[row.kind] ?? row.kind}
                        </Badge>
                      </td>
                      <td className="py-1 pr-2 font-mono">{row.outletCode}</td>
                      <td className="py-1 pr-2">{row.productName}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{row.bottles}</td>
                      <td className="text-text-muted py-1">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div>
            <Typography variant="labelXs" asChild>
              <h3 className="mb-1">Owners</h3>
            </Typography>
            <table className="w-full text-sm">
              <thead className="text-text-muted border-border-primary border-b text-xs">
                <tr>
                  <th className="py-1 pr-3 text-left font-medium">Owner</th>
                  <th className="py-1 pr-3 text-right font-medium">Bottles</th>
                  <th className="py-1 pr-3 text-right font-medium">We owe them</th>
                  <th className="py-1 pr-3 text-right font-medium">City Drinks pay</th>
                  <th className="py-1 pr-3 text-right font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((row) => (
                  <tr key={row.ownerId} className="border-border-muted border-b">
                    <td className="py-1.5 pr-3">
                      {row.ownerName}
                      {row.withoutCost > 0 ? (
                        <Badge size="xs" colorRole="warning" className="ml-2">
                          {row.withoutCost} with no cost
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{row.bottles}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{money(row.dueToOwner)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{money(row.billedToOutlet)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{money(row.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <Typography variant="labelXs" asChild>
              <h3 className="mb-1">Adjustments</h3>
            </Typography>
            {data.adjustments.length === 0 ? (
              <p className="text-text-muted text-xs">None this month.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {data.adjustments.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3">
                    <span>{row.description}</span>
                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      {money(row.amount)}
                      {!locked ? (
                        <button
                          type="button"
                          className="text-text-muted hover:text-text-danger"
                          onClick={() => removeAdjustment.mutate({ id: row.id })}
                        >
                          Remove
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!locked ? (
              <form
                className="mt-2 flex flex-wrap items-end gap-2 text-xs"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = Number(amount);

                  if (!description.trim() || !Number.isFinite(value) || amount === '') {
                    toast.error('Give the adjustment a description and an amount.');
                    return;
                  }

                  addAdjustment.mutate({
                    outletId,
                    month,
                    description: description.trim(),
                    amount: value,
                    ownerId: ownerId || null,
                    ownerAmount: ownerAmount === '' ? null : Number(ownerAmount),
                  });
                }}
              >
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Description, as City Drinks will read it"
                  className="border-border-primary min-w-64 flex-1 rounded-md border px-2 py-1"
                />
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Amount $ (− reduces)"
                  inputMode="decimal"
                  className="border-border-primary w-36 rounded-md border px-2 py-1"
                />
                <select
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                  className="border-border-primary rounded-md border px-2 py-1"
                >
                  <option value="">No owner</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
                {ownerId ? (
                  <input
                    value={ownerAmount}
                    onChange={(event) => setOwnerAmount(event.target.value)}
                    placeholder="Owner paid $"
                    inputMode="decimal"
                    className="border-border-primary w-28 rounded-md border px-2 py-1"
                  />
                ) : null}
                <button
                  type="submit"
                  disabled={addAdjustment.isPending}
                  className="bg-text-primary text-text-on-brand rounded-md px-2.5 py-1 font-medium disabled:opacity-50"
                >
                  Add
                </button>
              </form>
            ) : null}
          </div>

          {data.alreadyBilled.length > 0 ? (
            <div>
              <Typography variant="labelXs" asChild>
                <h3 className="mb-1">
                  Already billed, not charged ({data.check.alreadyBilledBottles} btl,{' '}
                  {money(data.totals.alreadyBilledValue)})
                </h3>
              </Typography>
              <table className="w-full text-xs">
                <tbody>
                  {data.alreadyBilled.map((row, index) => (
                    <tr key={`${row.outletCode}-${row.docRef}-${index}`} className="border-border-muted border-b">
                      <td className="py-1 pr-2 font-mono">{row.outletCode}</td>
                      <td className="py-1 pr-2">{row.productName}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{row.bottles}</td>
                      <td className="py-1 pr-2">{row.docRef}</td>
                      <td className="py-1 text-right tabular-nums">{money(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div>
            <button
              type="button"
              className="text-text-muted text-xs underline"
              onClick={() => setShowLines((value) => !value)}
            >
              {showLines ? 'Hide' : 'Show'} the {data.cdLines.length} billed lines
            </button>
            {showLines ? (
              <table className="mt-2 w-full text-xs">
                <thead className="text-text-muted">
                  <tr>
                    <th className="py-1 pr-2 text-left font-medium">CD code</th>
                    <th className="py-1 pr-2 text-left font-medium">Wine</th>
                    <th className="py-1 pr-2 text-left font-medium">Owner</th>
                    <th className="py-1 pr-2 text-right font-medium">Btl</th>
                    <th className="py-1 pr-2 text-left font-medium">Invoice</th>
                    <th className="py-1 pr-2 text-right font-medium">$/btl</th>
                    <th className="py-1 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cdLines.map((row, index) => (
                    <tr key={`${row.outletCode}-${row.docRef}-${index}`} className="border-border-muted border-b">
                      <td className="py-1 pr-2 font-mono">{row.outletCode}</td>
                      <td className="py-1 pr-2">{row.productName}</td>
                      <td className="py-1 pr-2">{row.ownerName}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{row.bottles}</td>
                      <td className="py-1 pr-2">{row.docRef}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">
                        {money(row.pricePerBottle)}
                        {row.priceCutPct ? ` (−${row.priceCutPct}%)` : ''}
                      </td>
                      <td className="py-1 text-right tabular-nums">{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

export default SettlementPanel;
