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
}

const TYPES = [
  { key: 'receive', label: 'Received', tone: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { key: 'putaway', label: 'Put away', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  { key: 'pick', label: 'Picked', tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  { key: 'transfer', label: 'Transfer', tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
  { key: 'repack_in', label: 'Repack in', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { key: 'repack_out', label: 'Repack out', tone: 'bg-rose-50 text-rose-700 ring-rose-200' },
  { key: 'count', label: 'Count', tone: 'bg-cyan-50 text-cyan-700 ring-cyan-200' },
  { key: 'adjust', label: 'Adjusted', tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
  { key: 'dispatch', label: 'Dispatched', tone: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
] as const;

type TypeKey = (typeof TYPES)[number]['key'];

const meta = (key: string) => TYPES.find((t) => t.key === key);

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
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Ref</th>
                {!lwin18 && <th className="px-3 py-2 font-medium">Product</th>}
                <th className="px-3 py-2 font-medium">Move</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {movements.map((row) => {
                const m = meta(row.movementType);
                return (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${m?.tone ?? 'bg-slate-100 text-slate-700 ring-slate-200'}`}
                      >
                        {m?.label ?? row.movementType}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11.5px] text-text-muted">
                      {row.movementNumber}
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
                      {row.fromLocation && row.toLocation ? (
                        <>
                          {row.fromLocation} <span className="text-text-muted">→</span>{' '}
                          {row.toLocation}
                        </>
                      ) : row.fromLocation ? (
                        <>
                          {row.fromLocation}{' '}
                          <span className="text-text-muted">out</span>
                        </>
                      ) : row.toLocation ? (
                        <>
                          {row.toLocation} <span className="text-text-muted">in</span>
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {row.quantityCases > 0 && (
                        <span className="font-medium">{row.quantityCases} cs</span>
                      )}
                      {row.quantityBottles ? (
                        <span className="ml-1.5 text-text-muted">
                          {row.quantityBottles} btl
                        </span>
                      ) : null}
                    </td>
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

      {!compact && (data?.sharedWineCount ?? 0) > 0 && (
        <p className="text-[11.5px] leading-snug text-text-muted">
          {data?.sharedWineCount} of your wines are also held in the warehouse for
          another owner. Movements on those are only shown where the record says
          which owner they belonged to, so none of someone else&apos;s stock
          appears as yours.
        </p>
      )}
    </div>
  );
};

export default PartnerMovementsPanel;
