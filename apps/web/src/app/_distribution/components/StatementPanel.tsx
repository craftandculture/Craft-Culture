'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import formatBottles from '@/app/_triangulation/utils/formatBottles';
import Badge from '@/app/_ui/components/Badge/Badge';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import ownerColour from '../utils/ownerColour';


export interface StatementPanelProps {
  outletId: string | null;
  /** Lifted, so the summary, the unmatched list and this read one month */
  month: string;
  onMonthChange: (month: string) => void;
  owners: { id: string; name: string }[];
  /** The months a sale can be asked about, newest first */
  soldMonths: { month: string; bottles: number; source: string }[];
}

const money = (value: number, currency: string | null) => {
  const amount = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return currency ? `${currency} ${amount}` : amount;
};


/**
 * What to tell an owner sold, and what we owe them for it
 *
 * This is the document that starts a settlement. City Drinks never send one —
 * we bill them; the owners are the other way round, and invoice us against
 * what we report here.
 *
 * Both prices are shown. What we owe is the import price; what the outlet was
 * billed is drawn FIFO from the invoices that put those bottles there. A
 * settlement nobody can check is a settlement nobody trusts, so the margin
 * between them is on the page rather than implied.
 */
const StatementPanel = ({
  outletId,
  owners,
  soldMonths,
  month,
  onMonthChange,
}: StatementPanelProps) => {
  const api = useTRPC();
  const [ownerId, setOwnerId] = useState('');
  /* The same colour the owner carries on the table, so the two screens agree */
  const colour = ownerColour(owners.findIndex((row) => row.id === ownerId));

  const statement = useQuery({
    ...api.distribution.admin.getStatement.queryOptions({
      ownerId,
      outletId: outletId ?? '',
      month,
    }),
    enabled: Boolean(ownerId && outletId),
  });

  /* What actually goes to Crurated and to Cru, in the columns they argue in */
  const exportOne = useMutation(
    api.distribution.admin.exportStatement.mutationOptions({
      onSuccess: (result) => {
        const link = document.createElement('a');

        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.base64}`;
        link.download = result.filename;
        link.click();
        toast.success(`Exported ${result.filename}`);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  /* Per owner, because one wine can cost two owners two different amounts */
  const setLanded = useMutation(
    api.distribution.admin.setWineLanded.mutationOptions({
      onSuccess: async (result) => {
        toast.success(
          result.landedPerBottle === null
            ? 'Back to the Pricing Manager price'
            : 'Landed cost recorded for this owner',
        );
        await statement.refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const lines = statement.data?.lines ?? [];
  const summary = statement.data?.summary;

  return (
    <div className="border-border-primary space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Typography variant="labelSm" asChild>
            <span className="flex items-center gap-2">
              {ownerId ? (
                <span className={`size-2 rounded-full ${colour.dot}`} />
              ) : null}
              Owner statement
            </span>
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1 max-w-xl">
              What sold, and what we owe for it at the landed cost on their own
              shipment. Send this and they invoice against it.
            </p>
          </Typography>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            disabled={exportOne.isPending || !ownerId || lines.length === 0}
            onClick={() =>
              exportOne.mutate({ outletId: outletId ?? '', ownerId, month })
            }
            className="border-border-primary hover:bg-fill-muted/30 min-h-9 rounded-md border px-3 text-xs font-medium disabled:opacity-50"
          >
            {exportOne.isPending ? 'Building…' : 'Export'}
          </button>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-xs">Owner</span>
            <select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              className="border-border-primary bg-fill-primary text-text-primary min-h-9 rounded-md border px-2 text-sm"
            >
              <option value="">— choose —</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-xs">Month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => onMonthChange(event.target.value)}
              className="border-border-primary bg-fill-primary text-text-primary min-h-9 rounded-md border px-2 text-sm"
            />
          </label>
        </div>
      </div>

      {!ownerId ? (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>Choose an owner to see what they are owed.</p>
        </Typography>
      ) : statement.isLoading ? (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>Working it out…</p>
        </Typography>
      ) : lines.length === 0 ? (
        /*
          Say which of the two it is. "Nothing sold, or nothing uploaded" left
          a month reading as settled when in truth it had never been asked,
          and the difference is an owner who is owed and does not know it.
        */
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="max-w-xl">
            {soldMonths.length === 0 ? (
              <>
                No month has any sales recorded yet at this distributor. Their
                feed is a live position and carries no history, so a month
                exists only once their sheet is uploaded above, or two
                snapshots either side of it are differenced. The Sold column on
                the table below is all-time, which is why it has figures and
                this does not.
              </>
            ) : soldMonths.some((row) => row.month === month) ? (
              <>Nothing of theirs sold in {month}.</>
            ) : (
              <>
                {month} has no sales recorded. Months with figures:{' '}
                {soldMonths.map((row) => row.month).join(', ')}.
              </>
            )}
          </p>
        </Typography>
      ) : (
        <>
          <div className="border-border-primary overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="text-text-muted border-border-primary border-b">
                <tr>
                  <th className="py-2 pl-3 pr-3 font-medium">Wine</th>
                  <th className="py-2 pr-3 text-right font-medium">Sold</th>
                  <th className="py-2 pr-3 text-right font-medium">Cost/btl</th>
                  <th className="py-2 pr-3 text-right font-medium">Due to them</th>
                  <th className="border-border-primary border-l py-2 pr-3 text-right font-medium">
                    Billed to them
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr
                    key={`${line.lwin18 ?? line.productName}`}
                    className="border-border-primary border-b last:border-0"
                  >
                    <td className="py-2 pl-3 pr-3">
                      {line.productName}
                      {/*
                        More sold than we ever invoiced out. A missing invoice,
                        a wrong pack, or wine they got another way — none of
                        which should be valued at a price we invented.
                      */}
                      {line.shortBottles > 0 ? (
                        <Badge size="xs" colorRole="danger" className="ml-2">
                          {line.shortBottles} unaccounted
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatBottles(line.bottlesSold)}
                    </td>
                    {/*
                      Editable per owner. One wine held by two owners has one
                      price in the Pricing Manager and two real costs, and
                      paying both from one figure overpays one out of the
                      other's margin.
                    */}
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={line.costPerBottle ?? ''}
                        placeholder="no cost"
                        disabled={setLanded.isPending || !line.lwin18}
                        onBlur={(event) => {
                          const typed = event.target.value.trim();
                          const next = typed === '' ? null : Number(typed);

                          if (next !== null && !Number.isFinite(next)) return;
                          if (next === (line.costPerBottle ?? null)) return;

                          setLanded.mutate({
                            ownerId,
                            lwin18: line.lwin18 ?? '',
                            productName: line.productName,
                            landedPerBottle: next,
                          });
                        }}
                        className={`border-border-primary w-24 rounded border bg-transparent px-1 py-0.5 text-right tabular-nums ${
                          line.costPerBottle === null
                            ? 'border-border-warning placeholder:text-text-warning'
                            : 'border-transparent hover:border-border-primary'
                        }`}
                        title={
                          line.costFrom
                            ? `From ${line.costFrom}. Type to set this owner's own cost.`
                            : "No landed cost. Type this owner's own."
                        }
                      />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {line.dueToOwner === null
                        ? '—'
                        : money(line.dueToOwner, line.currency)}
                    </td>
                    <td className="border-border-primary border-l py-2 pr-3 text-right tabular-nums">
                      {money(line.billedToOutlet, line.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary ? (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              {[
                ['Bottles sold', formatBottles(summary.bottles)],
                ['Due to them', money(summary.dueToOwner, lines[0]?.currency ?? null)],
                ['Billed to them', money(summary.billedToOutlet, lines[0]?.currency ?? null)],
                ['C&C margin', money(summary.margin, lines[0]?.currency ?? null)],
              ].map(([label, value]) => (
                <div key={label}>
                  <Typography variant="bodyXs" colorRole="muted" asChild>
                    <p>{label}</p>
                  </Typography>
                  <Typography variant="labelMd" asChild>
                    <p className="tabular-nums">{value}</p>
                  </Typography>
                </div>
              ))}
              {summary.withoutCost > 0 ? (
                <Typography variant="bodyXs" colorRole="warning" asChild>
                  <p className="max-w-xs">
                    {summary.withoutCost} wines have no import price recorded, so
                    nothing can be owed for them yet.
                  </p>
                </Typography>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default StatementPanel;
