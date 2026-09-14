'use client';

import { useQuery } from '@tanstack/react-query';

import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import formatBottles from '../utils/formatBottles';

export interface MonthlyTabProps {
  programmeId: string | null;
}

/** Money as the invoice states it, with no currency symbol assumed */
const formatValue = (value: number, currencies: string[]) => {
  const amount = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  if (currencies.length === 0) return amount;
  if (currencies.length === 1) return `${currencies[0]} ${amount}`;

  // Two currencies added together make a number that looks like money
  return `${amount} (${currencies.join(' + ')})`;
};

/**
 * What sold each month, by owner, in bottles and in money
 *
 * The reconciliation answers where the wine is across all time. Settling with
 * an owner is the other question — what went this month and what it was worth —
 * and it was done by hand against invoices the tool had already read, because
 * the unit price on every line never reached a screen.
 *
 * Owners are shown side by side rather than one client at a time. A mixed
 * invoice belongs to several of them, and the month it falls in is the thing
 * being agreed, so splitting the view by client would hide exactly the rows a
 * settlement has to reconcile.
 */
const MonthlyTab = ({ programmeId }: MonthlyTabProps) => {
  const api = useTRPC();
  const monthly = useQuery(
    api.triangulation.admin.getMonthlySales.queryOptions({ programmeId }),
  );

  const rows = monthly.data ?? [];
  const months = [...new Set(rows.map((row) => row.month))];

  if (monthly.isLoading) {
    return (
      <Typography variant="bodySm" colorRole="muted" asChild>
        <p>Reading the months…</p>
      </Typography>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border-border-primary rounded-xl border p-6 text-center">
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p>
            Nothing committed yet for this client, so there is no month to
            settle. Commit an import on the Imports tab and it will appear here.
          </p>
        </Typography>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p className="max-w-2xl">
          What left us and what the outlet sold on, by month and by owner. Value
          is the invoice&rsquo;s own — rate times quantity, in the currency it
          was billed in. Unattributed rows are lines no invoice named an owner
          for and whose wine has none set.
        </p>
      </Typography>

      {months.map((month) => {
        const forMonth = rows.filter((row) => row.month === month);
        const bottles = forMonth.reduce(
          (sum, row) => sum + row.soldToOutletBottles,
          0,
        );

        return (
          <div
            key={month}
            className="border-border-primary overflow-hidden rounded-xl border"
          >
            <div className="bg-fill-muted/20 flex items-baseline justify-between px-4 py-2">
              <Typography variant="labelSm">{month}</Typography>
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <span>{formatBottles(bottles)} bottles out</span>
              </Typography>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="text-text-muted">
                  <tr className="border-border-primary border-b text-xs">
                    <th className="py-2 pl-4 pr-3 text-left font-medium">
                      Owner
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Bottles out
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Invoiced
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Bottles sold on
                    </th>
                    <th className="py-2 pr-4 text-right font-medium">
                      Sold for
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {forMonth.map((row) => (
                    <tr
                      key={`${month}-${row.ownerName}`}
                      className="border-border-primary border-b last:border-0"
                    >
                      <td className="py-2 pl-4 pr-3">
                        {row.ownerName === 'Unattributed' ? (
                          <span className="text-text-warning">
                            Unattributed
                          </span>
                        ) : (
                          row.ownerName
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatBottles(row.soldToOutletBottles)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {row.soldToOutletValue > 0
                          ? formatValue(row.soldToOutletValue, row.currencies)
                          : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatBottles(row.outletSoldBottles)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {row.outletSoldValue > 0
                          ? formatValue(row.outletSoldValue, row.currencies)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MonthlyTab;
