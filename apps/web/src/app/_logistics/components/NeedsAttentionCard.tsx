'use client';

import { IconAlertTriangle, IconCheck, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

import ShipmentTypeBadge from './ShipmentTypeBadge';

/**
 * The logistics dashboard's first card: what needs someone to act
 *
 * One row per reason with a count; opening a row lists the shipments behind it,
 * each linking to its export job or shipment. Reasons with nothing in them are
 * hidden, and when there is nothing at all the card says so in one line.
 */
const NeedsAttentionCard = () => {
  const api = useTRPC();
  const { data: groups, isLoading } = useQuery(api.logistics.admin.getAttention.queryOptions());
  const [open, setOpen] = useState<string | null>(null);

  if (isLoading || !groups) return null;

  const active = groups.filter((g) => g.shipments.length > 0);
  const total = active.reduce((n, g) => n + g.shipments.length, 0);

  if (active.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border-muted bg-surface-primary px-4 py-3 text-sm text-text-muted">
        <IconCheck size={16} className="text-emerald-600" /> Nothing needs attention on the board.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border-muted bg-surface-primary">
      <div className="flex items-center gap-2 px-4 py-3">
        <IconAlertTriangle size={18} className="text-amber-600" />
        <p className="text-sm font-semibold text-text-primary">Needs attention</p>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
          {total}
        </span>
      </div>
      <ul className="divide-y divide-border-muted border-t border-border-muted">
        {active.map((g) => {
          const isOpen = open === g.key;
          return (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : g.key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-text-primary transition-colors hover:bg-surface-secondary"
              >
                <span>{g.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{g.shipments.length}</span>
                  {isOpen ? <IconChevronDown size={16} className="text-text-muted" /> : <IconChevronRight size={16} className="text-text-muted" />}
                </span>
              </button>
              {isOpen ? (
                <ul className="bg-surface-secondary/50 pb-1">
                  {g.shipments.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={
                          s.jobNumber
                            ? `/platform/admin/logistics/exports/${s.id}`
                            : `/platform/admin/logistics/shipments/${s.id}`
                        }
                        className="flex items-center gap-3 px-6 py-2 text-sm transition-colors hover:bg-surface-secondary"
                      >
                        <span className="w-32 shrink-0 font-mono text-xs text-text-muted">{s.jobNumber ?? s.shipmentNumber}</span>
                        <span className="min-w-0 flex-1 truncate text-text-primary">
                          {s.name ?? `${s.originCity ?? 'Origin'} → ${s.destinationCity ?? 'Destination'}`}
                        </span>
                        <ShipmentTypeBadge type={s.type} />
                        {g.key === 'overdue' && s.eta ? (
                          <span className="shrink-0 text-xs text-text-muted">
                            ETA {new Date(s.eta).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default NeedsAttentionCard;
