'use client';

import { useQuery } from '@tanstack/react-query';

import useTRPC from '@/lib/trpc/browser';

const gbp = (value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const aed = (value: number) => `AED ${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

/**
 * UK storage this month, per member with wine at LCB
 *
 * Beside the UAE membership above it: wine is charged where it is held. Taken
 * from LCB's latest report and the UK rates in force; nothing is charged for
 * receiving or handling here, as those are billed when they happen.
 */
const UkStorageList = () => {
  const api = useTRPC();
  const { data } = useQuery(api.cellar.admin.getUkStorage.queryOptions());

  if (!data || data.rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-text-primary text-sm font-semibold">UK storage · London City Bond</h3>
        <p className="text-text-muted text-xs">
          {data.rates
            ? `At ${gbp(data.rates.storagePerUnitMonthMemberGbp)} per case unit per month (LCB ${gbp(data.rates.storagePerUnitMonthGbp)} + recharge), no allowance. Receiving and handling out are billed when they happen.`
            : 'No UK prices yet. Enter LCB’s prices on Cellar rates to see the charge.'}
        </p>
      </div>
      <div className="border-border-muted bg-surface-primary overflow-x-auto rounded-xl border shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-text-muted border-border-muted border-b text-[11px] uppercase tracking-wider">
              <th className="px-4 py-2 text-left">Member</th>
              <th className="px-3 py-2 text-right">Cases</th>
              <th className="px-3 py-2 text-right">Bottles</th>
              <th className="px-3 py-2 text-right">Units</th>
              <th className="px-3 py-2 text-right">LCB cost</th>
              <th className="px-4 py-2 text-right">This month</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.partnerId} className="border-border-muted border-b last:border-b-0">
                <td className="text-text-primary px-4 py-2.5 font-semibold">{row.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.cases}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.bottles}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.units}</td>
                <td className="text-text-muted px-3 py-2.5 text-right tabular-nums">
                  {row.costGbp !== null ? gbp(row.costGbp) : ''}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.chargedGbp !== null ? (
                    <>
                      <span className="text-text-primary font-semibold">{gbp(row.chargedGbp)}</span>
                      {row.chargedAed !== null && (
                        <span className="text-text-muted block text-[11px]">about {aed(row.chargedAed)}</span>
                      )}
                    </>
                  ) : (
                    ''
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default UkStorageList;
