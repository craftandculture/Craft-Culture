'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';

import displayWineName from '@/app/_wms/utils/displayWineName';
import { useTRPCClient } from '@/lib/trpc/browser';

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
  { key: 'receive', label: 'Received', dir: 'in' },
  { key: 'putaway', label: 'Put away', dir: 'move' },
  { key: 'pick', label: 'Picked', dir: 'out' },
  { key: 'transfer', label: 'Moved', dir: 'move' },
  /*
    Repacks read as wine appearing and vanishing unless they are named for what
    they are. A case is opened and the bottles move from the case's code to the
    singles code — same wine, same warehouse, nothing gained or lost. "Repacked
    in / out" describes our records; these describe the shelf.
  */
  { key: 'repack_in', label: 'From an opened case', dir: 'in' },
  { key: 'repack_out', label: 'Made into other packs', dir: 'out' },
  { key: 'count', label: 'Counted', dir: 'unknown' },
  { key: 'adjust', label: 'Adjusted', dir: 'unknown' },
  { key: 'dispatch', label: 'Dispatched', dir: 'out' },
] as const;

type TypeKey = (typeof TYPES)[number]['key'];

const meta = (key: string) => TYPES.find((t) => t.key === key);

/** Colour carries direction only: in is emerald, out is amber, the rest neutral. */
const dotFor = (dir: string | undefined) =>
  dir === 'in' ? 'bg-emerald-500' : dir === 'out' ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-500';

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
  const trpcClient = useTRPCClient();
  const [selected, setSelected] = useState<TypeKey[]>([]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['wms.partner.getMovements', { lwin18, selected, limit }],
    queryFn: ({ pageParam }) =>
      trpcClient.wms.partner.getMovements.query({
        lwin18,
        movementTypes: selected.length > 0 ? selected : undefined,
        limit,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length * limit : undefined,
  });

  const movements = data?.pages.flatMap((page) => page.movements) ?? [];
  const sharedWineCount = data?.pages[0]?.sharedWineCount ?? 0;
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

  /** "+3 cases · +18 bottles", or bottles alone on a singles code */
  const describeQty = (row: (typeof movements)[number]) => {
    const dir = meta(row.movementType)?.dir;
    const sign = dir === 'in' ? '+' : dir === 'out' ? '−' : '';
    // On a singles code a case IS a bottle, so cases and bottles would say one thing twice
    if (packOf(row.lwin18) === 1) {
      return {
        main: `${sign}${row.quantityCases} ${row.quantityCases === 1 ? 'bottle' : 'bottles'}`,
        sub: null,
      };
    }
    return {
      main: `${sign}${row.quantityCases} ${row.quantityCases === 1 ? 'case' : 'cases'}`,
      sub: row.quantityBottles
        ? `${sign}${row.quantityBottles} ${row.quantityBottles === 1 ? 'bottle' : 'bottles'}`
        : null,
    };
  };

  const qtyToneFor = (dir: string | undefined) =>
    dir === 'in'
      ? 'text-emerald-700 dark:text-emerald-300'
      : dir === 'out'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-text-muted';

  const typePill = (movementType: string) => {
    const m = meta(movementType);
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-primary ring-1 ring-inset ring-border-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${dotFor(m?.dir)}`} />
        {m?.label ?? movementType}
      </span>
    );
  };

  const filters = !compact && (
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
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              on
                ? 'bg-text-primary text-surface-primary'
                : 'bg-surface-muted text-text-secondary hover:text-text-primary'
            }`}
          >
            {(type.dir === 'in' || type.dir === 'out') && (
              <span className={`h-1.5 w-1.5 rounded-full ${dotFor(type.dir)}`} />
            )}
            {type.label}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => setSelected([])}
          className="px-2 text-xs text-text-muted underline-offset-2 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className={compact ? '' : 'space-y-4'}>
        {filters}
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: compact ? 3 : 6 }).map((_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-surface-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={compact ? '' : 'space-y-4'}>
        {filters}
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border-muted bg-surface-primary px-4 py-8 text-center">
          <p className="text-[13px] text-text-primary">Movements could not be loaded.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="rounded-lg bg-text-primary px-3 py-1.5 text-xs font-medium text-surface-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isRefetching ? 'Loading…' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'space-y-4'}>
      {filters}

      {movements.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-text-muted">
          {lwin18
            ? 'No movements recorded for this wine yet.'
            : 'No movements recorded yet.'}
        </p>
      ) : (
        <>
          {/* Phones: one card per movement */}
          <div className="divide-y divide-border-muted overflow-hidden rounded-xl border border-border-muted bg-surface-primary md:hidden">
            {movements.map((row) => {
              const dir = meta(row.movementType)?.dir;
              const qty = describeQty(row);
              return (
                <div key={row.id} className="space-y-1 px-3 py-2.5 text-[13px]">
                  <div className="flex items-start justify-between gap-2">
                    {typePill(row.movementType)}
                    <div className={`text-right tabular-nums font-medium ${qtyToneFor(dir)}`}>
                      {qty.main}
                      {qty.sub && (
                        <div className="text-[11px] font-normal opacity-70">{qty.sub}</div>
                      )}
                    </div>
                  </div>
                  {!lwin18 && (
                    <div className="font-medium text-text-primary">
                      {displayWineName(row.productName ?? '', { keepVintage: true })}
                    </div>
                  )}
                  {row.detail && <div className="text-[12px]">{row.detail}</div>}
                  <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-text-muted">
                    <span className="font-mono">{describeMove(row)}</span>
                    <span>·</span>
                    <span>{when(row.performedAt)}</span>
                    {balances && (
                      <>
                        <span>·</span>
                        <span>{balances.get(row.id)} cases after</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wider screens: the ledger as a table */}
          <div className="hidden overflow-x-auto rounded-xl border border-border-muted bg-surface-primary md:block">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-muted text-left text-[11px] uppercase tracking-wider text-text-muted">
                  <th className="px-3 py-2 font-medium">What happened</th>
                  {!lwin18 && <th className="px-3 py-2 font-medium">Wine</th>}
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
                  const dir = meta(row.movementType)?.dir;
                  const qty = describeQty(row);

                  return (
                    <tr key={row.id} className="transition-colors hover:bg-surface-secondary/50">
                      <td className="px-3 py-2">
                        {typePill(row.movementType)}
                        {row.detail && <div className="mt-0.5 text-[11px]">{row.detail}</div>}
                      </td>
                      {!lwin18 && (
                        <td className="px-3 py-2">
                          {displayWineName(row.productName ?? '', { keepVintage: true })}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11.5px]">
                        {describeMove(row)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums ${qtyToneFor(dir)}`}
                      >
                        {qty.main}
                        {qty.sub && (
                          <span className="ml-1.5 font-normal opacity-70">{qty.sub}</span>
                        )}
                      </td>
                      {balances && (
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-text-muted">
                          {balances.get(row.id)} cases
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2 text-text-muted">
                        {when(row.performedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasNextPage && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-lg border border-border-muted bg-surface-primary px-3 py-1.5 text-xs font-medium text-text-primary shadow-sm transition-colors hover:bg-surface-secondary/50 disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Only when a repack is on screen — a legend nobody reads is worse. */}
      {movements.some((row) => row.movementType.startsWith('repack')) && (
        <p className="mt-2 text-[11.5px] text-text-muted">
          A case was opened into another pack size. Nothing gained or lost — the
          matching line sits under that pack.
        </p>
      )}

      {!compact && sharedWineCount > 0 && (
        <p className="text-[11.5px] text-text-muted">
          Some movements could not be matched to your account and are not shown.
        </p>
      )}
    </div>
  );
};

export default PartnerMovementsPanel;
