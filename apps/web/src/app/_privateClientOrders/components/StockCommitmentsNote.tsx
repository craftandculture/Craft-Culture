'use client';

import { IconAlertTriangle, IconPackage } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

/** An LWIN18, dashed or compact; anything shorter cannot name one wine */
const isFullLwin = (code: string) => /^\d{7}-?\d{4}-?\d{2}-?\d{5}$/.test(code.trim());

/**
 * What this wine has free, and who the rest is promised to
 *
 * Sits under an order line while it is entered. Counted in bottles across
 * every pack of the wine, so a line for 3-packs is checked against 6-packs on
 * the shelf. Turns red when the line asks for more than is free, and names
 * the orders holding the rest — so a second order does not quietly take wine
 * a first one already has.
 */
const StockCommitmentsNote = ({
  lwin,
  bottlesWanted,
  excludePcoId,
}: {
  lwin: string;
  bottlesWanted: number;
  excludePcoId?: string;
}) => {
  const api = useTRPC();
  const [open, setOpen] = useState(false);
  const enabled = isFullLwin(lwin);

  const { data } = useQuery({
    ...api.wms.admin.ownership.getCommitments.queryOptions({ lwin18: lwin.trim(), excludePcoId }),
    enabled,
    staleTime: 30_000,
  });

  if (!enabled || !data?.recognised) return null;

  const short = bottlesWanted > data.freeBottles;
  const claims = [
    ...data.holds.map((h) => ({ ref: h.orderNumber, who: h.clientName, bottles: h.bottles, how: 'held' })),
    ...data.promised.map((p) => ({ ref: p.orderNumber, who: p.clientName, bottles: p.bottles, how: 'promised' })),
  ];

  return (
    <div
      className={`mt-2 rounded-lg px-3 py-2 text-xs ring-1 ring-inset ${
        short
          ? 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-900'
          : 'bg-surface-secondary text-text-secondary ring-border-muted'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {short ? <IconAlertTriangle size={14} className="shrink-0" /> : <IconPackage size={14} className="shrink-0 text-text-muted" />}
        <span className="font-medium">
          {data.freeBottles} btl free
        </span>
        <span className="text-text-muted">
          · {data.onHandBottles} on hand
          {data.heldBottles ? ` · ${data.heldBottles} held` : ''}
          {data.promisedBottles ? ` · ${data.promisedBottles} promised on PCOs` : ''}
        </span>
        {short ? (
          <span className="font-medium">
            · this line needs {bottlesWanted} btl, {bottlesWanted - data.freeBottles} more than is free
          </span>
        ) : null}
        {claims.length ? (
          <button type="button" onClick={() => setOpen((o) => !o)} className="ml-auto font-medium underline-offset-2 hover:underline">
            {open ? 'Hide' : `Who has it (${claims.length})`}
          </button>
        ) : null}
      </div>
      {open && claims.length ? (
        <ul className="mt-1.5 space-y-0.5 pl-5">
          {claims.map((c) => (
            <li key={`${c.how}-${c.ref}`}>
              <span className="font-mono">{c.ref}</span>
              {c.who ? ` · ${c.who}` : ''} · {c.bottles} btl {c.how}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default StockCommitmentsNote;
