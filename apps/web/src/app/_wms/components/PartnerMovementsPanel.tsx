'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

export interface PartnerMovementsPanelProps {
  /** Narrow to one wine, for the history under a stock row. */
  lwin18?: string;
  /** Compact drops the filters and the summary, for inline use. */
  variant?: 'full' | 'compact';
  limit?: number;
  /**
   * Cases held now, which anchors the running balance.
   *
   * Counting forward from the oldest row would be wrong whenever the history
   * is longer than the page; counting back from what is actually on the shelf
   * is right however much of it is shown.
   */
  currentCases?: number;
}

/**
 * Whether a movement adds stock, removes it, or only moves it.
 *
 * A transfer and a putaway change the bay, not the holding. A count or an
 * adjustment can go either way and the row does not say which, so neither is
 * given a direction — and their presence suppresses the running balance rather
 * than quietly reporting one that does not add up.
 */
const TYPES = [
  { key: 'receive', label: 'Received', dir: 'in', tone: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { key: 'putaway', label: 'Put away', dir: 'move', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  { key: 'pick', label: 'Picked', dir: 'out', tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  { key: 'transfer', label: 'Moved', dir: 'move', tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
  /*
    Repacks read as wine appearing and vanishing unless they are named for what
    they are. A case is opened and the bottles move from the case's code to the
    singles code — same wine, same warehouse, nothing gained or lost. "Repacked
    in / out" describes our records; these describe the shelf.
  */
  { key: 'repack_in', label: 'From an opened case', dir: 'in', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { key: 'repack_out', label: 'Made into other packs', dir: 'out', tone: 'bg-rose-50 text-rose-700 ring-rose-200' },
  { key: 'count', label: 'Counted', dir: 'unknown', tone: 'bg-cyan-50 text-cyan-700 ring-cyan-200' },
  { key: 'adjust', label: 'Adjusted', dir: 'unknown', tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
  { key: 'dispatch', label: 'Dispatched', dir: 'out', tone: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
] as const;

type TypeKey = (typeof TYPES)[number]['key'];

const meta = (key: string) => TYPES.find((t) => t.key === key);

/**
 * Bottles per case, read off the code.
 *
 * LWIN18 is wine-vintage-pack-size, so the pack is the third segment. Pack is
 * always taken from the code and never from a description — the house rule,
 * because a description goes stale when a pack changes and the code does not.
 */
const packOf = (lwin18: string) => {
  const parts = String(lwin18 ?? '').split('-');
  const pack = parts.length === 4 ? Number(parts[2]) : NaN;
  return Number.isFinite(pack) && pack > 0 ? pack : null;
};

/** "Picked from C-01-00", "Moved C-01-00 → B-02-01" — said, not abbreviated. */
const describeMove = (row: {
  movementType: string;
  fromLocation: string | null;
  toLocation: string | null;
}) => {
  const { fromLocation: from, toLocation: to } = row;
  if (from && to) return `${from} → ${to}`;
  if (from) return `from ${from}`;
  if (to) return `into ${to}`;
  return '—';
};

/** "16 Sept, 15:20" — the warehouse reads dates that way. */
const when = (value: Date | string) =>
  new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * A partner's stock ledger: what arrived, moved bay, was picked or went.
 *
 * Quantities are shown in cases **and** bottles because a split-case pick moves
 * bottles without moving a whole case — recorded in cases alone it reads as
 * zero, which is true and useless when you are trying to account for stock.
 *
 * Where a movement happened matters as much as that it happened, so both bays
 * are shown and a transfer reads as one to the other.
 */
const PartnerMovementsPanel = ({
  lwin18,
  variant = 'full',
  limit = 50,
  currentCases,
}: PartnerMovementsPanelProps) => {
  const api = useTRPC();
  const [selected, setSelected] = useState<TypeKey[]>([]);

  const { data, isLoading } = useQuery(
    api.wms.partner.getMovements.queryOptions({
      lwin18,
      movementTypes: selected.length > 0 ? selected : undefined,
      limit,
      offset: 0,
    }),
  );

  const movements = data?.movements ?? [];
  const compact = variant === 'compact';

  /*
    The running balance, worked back from what is on the shelf now.

    It is only shown for a single wine, and only when every row on screen has a
    known direction — a count or an adjustment does not say whether it added or
    removed, so a balance drawn through one would be arithmetic nobody could
    check. Better no column than a column that does not add up.
  */
  const balances = (() => {
    if (!lwin18 || currentCases === undefined) return null;
    if (movements.some((row) => meta(row.movementType)?.dir === 'unknown')) {
      return null;
    }

    const result = new Map<string, number>();
    let running = currentCases;

    // Newest first, so each step undoes the movement above it.
    for (const row of movements) {
      result.set(row.id, running);
      const dir = meta(row.movementType)?.dir;
      if (dir === 'in') running -= row.quantityCases;
      else if (dir === 'out') running += row.quantityCases;
    }

    return result;
  })();

  if (isLoading) {
    return (
      <p className="py-4 text-center text-[13px] text-text-muted">
        Loading movements…
      </p>
    );
  }

  return (
    <div className={compact ? '' : 'space-y-4'}>
      {!compact && (
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((type) => {
            const on = selected.includes(type.key);
            return (
              <button
                key={type.key}
                type="button"
                onClick={() =>
                  setSelected((prev) =>
                    on ? prev.filter((k) => k !== type.key) : [...prev, type.key],
                  )
                }
                className={`rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset transition-colors ${
                  on
                    ? type.tone
                    : 'bg-transparent text-text-muted ring-border-muted hover:bg-fill-secondary'
                }`}
              >
                {type.label}
              </button>
            );
          })}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="px-2 text-[12px] text-text-muted underline-offset-2 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {movements.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-text-muted">
          {lwin18
            ? 'No movements recorded for this wine yet.'
            : 'No movements recorded yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-muted">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border-muted text-left text-[10.5px] uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 font-medium">What happened</th>
                {!lwin18 && <th className="px-3 py-2 font-medium">Product</th>}
                <th className="px-3 py-2 font-medium">Where</th>
                <th className="px-3 py-2 text-right font-medium">Change</th>
                {balances && (
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                )}
                <th className="px-3 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {movements.map((row) => {
                const m = meta(row.movementType);
                const dir = m?.dir;
                const sign = dir === 'in' ? '+' : dir === 'out' ? '−' : '';
                const qtyTone =
                  dir === 'in'
                    ? 'text-emerald-600'
                    : dir === 'out'
                      ? 'text-amber-700'
                      : 'text-text-muted';

                return (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${m?.tone ?? 'bg-slate-100 text-slate-700 ring-slate-200'}`}
                      >
                        {m?.label ?? row.movementType}
                      </span>
                      <div className="mt-0.5 font-mono text-[10px] text-text-muted">
                        {row.movementNumber}
                      </div>
                    </td>
                    {!lwin18 && (
                      <td className="px-3 py-2">
                        <div>{row.productName}</div>
                        <div className="font-mono text-[10.5px] text-text-muted">
                          {row.lwin18}
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-[11.5px]">
                      {describeMove(row)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right whitespace-nowrap tabular-nums font-medium ${qtyTone}`}
                    >
                      {/*
                        On a singles code a case IS a bottle, so "5 cs 5 btl"
                        says one thing twice and reads as ten.
                      */}
                      {packOf(row.lwin18) === 1 ? (
                        <>
                          {sign}
                          {row.quantityCases} btl
                        </>
                      ) : (
                        <>
                          {sign}
                          {row.quantityCases} cs
                          {row.quantityBottles ? (
                            <span className="ml-1.5 font-normal opacity-70">
                              {sign}
                              {row.quantityBottles} btl
                            </span>
                          ) : null}
                        </>
                      )}
                    </td>
                    {balances && (
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-text-muted">
                        {balances.get(row.id)} cs
                      </td>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap text-text-muted">
                      {when(row.performedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Only when a repack is on screen — a legend nobody reads is worse. */}
      {movements.some((row) => row.movementType.startsWith('repack')) && (
        <p className="mt-2 text-[11.5px] text-text-muted">
          A case was opened into another pack size. Nothing gained or lost — the
          matching line sits under that pack.
        </p>
      )}

      {!compact && (data?.sharedWineCount ?? 0) > 0 && (
        <p className="text-[11.5px] text-text-muted">
          {data?.sharedWineCount} of your wines are also stored for another
          owner. Only movements we can attribute to you are shown.
        </p>
      )}
    </div>
  );
};

export default PartnerMovementsPanel;
