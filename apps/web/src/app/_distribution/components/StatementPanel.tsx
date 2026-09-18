'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import formatBottles from '@/app/_triangulation/utils/formatBottles';
import Badge from '@/app/_ui/components/Badge/Badge';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';


export interface StatementPanelProps {
  outletId: string | null;
  owners: { id: string; name: string }[];
}

const money = (value: number, currency: string | null) => {
  const amount = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return currency ? `${currency} ${amount}` : amount;
};

/** The month before this one, which is what a settlement is usually about */
const lastMonth = () => {
  const now = new Date();
  const when = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  return `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, '0')}`;
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
const StatementPanel = ({ outletId, owners }: StatementPanelProps) => {
  const api = useTRPC();
  const [ownerId, setOwnerId] = useState('');
  const [month, setMonth] = useState(lastMonth());

  const statement = useQuery({
    ...api.distribution.admin.getStatement.queryOptions({
      ownerId,
      outletId: outletId ?? '',
      month,
    }),
    enabled: Boolean(ownerId && outletId),
  });

  const lines = statement.data?.lines ?? [];
  const summary = statement.data?.summary;

  return (
    <div className="border-border-primary space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Typography variant="labelSm">Owner statement</Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1 max-w-xl">
              What sold, and what we owe for it at the import price. Send this
              and they invoice against it.
            </p>
          </Typography>
        </div>
        <div className="flex items-end gap-2">
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
              onChange={(event) => setMonth(event.target.value)}
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
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>
            Nothing of theirs sold in {month}, or the month&rsquo;s sales have
            not been uploaded yet.
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
                    Billed to outlet
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
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {line.costPerBottle === null ? (
                        <span className="text-text-warning">no price</span>
                      ) : (
                        line.costPerBottle.toFixed(2)
                      )}
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
                ['Billed to outlet', money(summary.billedToOutlet, lines[0]?.currency ?? null)],
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
