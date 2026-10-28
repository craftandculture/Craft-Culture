'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const thisMonth = () => format(new Date(), 'yyyy-MM');

type Group = {
  label: string;
  bottles: number;
  amountUsd: number;
  rows: {
    id: string;
    at: Date | string;
    name: string;
    detail: string;
    lwin18: string;
    bottles: number;
    unitUsd: number | null;
    amountUsd: number | null;
    basis: string;
  }[];
};

const GroupRows = ({ group }: { group: Group }) => (
  <>
    <tr className="bg-fill-muted/40 border-border-muted border-t font-semibold">
      <td colSpan={3} className="px-3 py-2">
        {group.label}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{group.bottles}</td>
      <td />
      <td className="px-3 py-2 text-right tabular-nums">{money(group.amountUsd)}</td>
      <td />
    </tr>
    {group.rows.map((row) => (
      <tr key={row.id} className="border-border-muted border-t">
        <td className="text-text-muted whitespace-nowrap px-3 py-1.5">{format(new Date(row.at), 'd MMM')}</td>
        <td className="px-3 py-1.5">
          {row.name}
          {row.detail && <span className="text-text-muted"> · {row.detail}</span>}
        </td>
        <td className="text-text-muted whitespace-nowrap px-3 py-1.5 font-mono text-xs">{row.lwin18}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{row.bottles}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{row.unitUsd != null ? money(row.unitUsd) : '—'}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{row.amountUsd != null ? money(row.amountUsd) : '—'}</td>
        <td className={`px-3 py-1.5 text-xs ${row.basis === 'No price set' ? 'text-amber-700' : 'text-text-muted'}`}>
          {row.basis}
        </td>
      </tr>
    ))}
  </>
);

/**
 * A member's statement as staff check it
 *
 * The member sees one line per order; this lists every wine behind those
 * lines with its bottles, price per bottle and how it was valued, so the
 * Sold and Owed figures can be added up by hand. "Owed" reaches back past
 * the month: every bottle valued since the cellar started, plus sales and
 * settlements, less payments.
 */
const CellarStatementsPage = () => {
  const api = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const memberId = params.get('member') ?? '';
  const month = params.get('month') ?? thisMonth();
  const [scope, setScope] = useState<'month' | 'all'>('month');

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const { data: membersData } = useQuery(api.cellar.admin.getMembers.queryOptions());
  const members = useMemo(
    () => [...(membersData?.members ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [membersData],
  );

  const { data, isLoading, error } = useQuery({
    ...api.cellar.admin.getMemberStatement.queryOptions({ partnerId: memberId, month }),
    enabled: !!memberId,
  });

  const breakdown = data?.owedBreakdown;
  const lines = (breakdown?.lines ?? []).filter((line) => scope === 'all' || line.inMonth);

  // One block per order or outcome, as the member's statement groups them
  const groups = useMemo(() => {
    const byGroup = new Map<string, typeof lines>();
    for (const line of lines) {
      const key = scope === 'all' ? `${format(new Date(line.at), 'MMM yyyy')} · ${line.group}` : line.group;
      byGroup.set(key, [...(byGroup.get(key) ?? []), line]);
    }
    return [...byGroup.entries()].map(([label, rows]) => ({
      label,
      rows,
      bottles: rows.reduce((sum, row) => sum + row.bottles, 0),
      amountUsd: rows.reduce((sum, row) => sum + (row.amountUsd ?? 0), 0),
    }));
  }, [lines, scope]);

  const totalBottles = lines.reduce((sum, row) => sum + row.bottles, 0);
  const totalUsd = lines.reduce((sum, row) => sum + (row.amountUsd ?? 0), 0);

  return (
    <div className="container mx-auto max-w-6xl space-y-5 px-4 py-6">
      <div>
        <Typography variant="headingLg">Member statements</Typography>
        <Typography variant="bodySm" colorRole="muted">
          Every line behind a member&apos;s statement, to check Sold and Owed by hand
        </Typography>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={memberId}
          onChange={(e) => setParam('member', e.target.value)}
          className="border-border-muted bg-fill-primary h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm sm:max-w-xs"
        >
          <option value="">Choose a member</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <input
          type="month"
          value={month}
          onChange={(e) => setParam('month', e.target.value)}
          className="border-border-muted bg-fill-primary h-10 rounded-lg border px-3 text-sm"
        />
        <div className="bg-fill-secondary flex rounded-lg p-1">
          {(
            [
              ['month', 'This month'],
              ['all', 'Everything behind Owed'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScope(id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                scope === id ? 'bg-fill-primary text-text-primary shadow-sm' : 'text-text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!memberId && (
        <Typography variant="bodySm" colorRole="muted">
          Choose a member to see their statement.
        </Typography>
      )}
      {memberId && isLoading && (
        <Typography variant="bodySm" colorRole="muted">
          Loading…
        </Typography>
      )}
      {error && (
        <Typography variant="bodySm" className="text-red-600">
          {error.message}
        </Typography>
      )}

      {data && breakdown && (
        <>
          {/* The member's figures, then how Owed is reached */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: 'Sold this month', value: money(data.soldUsd + data.soldLeftUsd), tint: 'bg-sky-50 dark:bg-sky-950/30' },
              { label: 'Bottles valued to date', value: money(breakdown.picksUsd), tint: 'bg-fill-secondary' },
              { label: 'Sales and settlements', value: money(breakdown.salesAndSettlementsUsd), tint: 'bg-fill-secondary' },
              { label: 'Paid to date', value: `− ${money(breakdown.paidUsd)}`, tint: 'bg-fill-secondary' },
              { label: 'Owed to member', value: money(Math.max(0, data.owedUsd)), tint: 'bg-emerald-50 dark:bg-emerald-950/30' },
            ].map((tile) => (
              <div key={tile.label} className={`rounded-xl p-4 ${tile.tint}`}>
                <Typography variant="bodyXs" colorRole="muted">
                  {tile.label}
                </Typography>
                <Typography variant="headingMd" className="tabular-nums">
                  {tile.value}
                </Typography>
              </div>
            ))}
          </div>

          {data.unpricedBottles > 0 && (
            <Typography variant="bodySm" className="text-amber-700">
              {data.unpricedBottles} bottles sold this month have no price yet and count as $0 here.
            </Typography>
          )}

          <div className="border-border-muted overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-fill-secondary text-text-muted text-left text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Wine</th>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 text-right font-medium">Bottles</th>
                  <th className="px-3 py-2 text-right font-medium">Per bottle</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Valued at</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-text-muted px-3 py-6 text-center">
                      Nothing left this cellar in this period.
                    </td>
                  </tr>
                )}
                {groups.map((group) => (
                  <GroupRows key={group.label} group={group} />
                ))}
              </tbody>
              {groups.length > 0 && (
                <tfoot>
                  <tr className="border-border-muted border-t-2 font-semibold">
                    <td colSpan={3} className="px-3 py-2">
                      Total
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{totalBottles}</td>
                    <td />
                    <td className="px-3 py-2 text-right tabular-nums">{money(totalUsd)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CellarStatementsPage;
