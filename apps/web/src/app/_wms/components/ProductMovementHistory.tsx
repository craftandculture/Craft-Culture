'use client';

import { IconArrowRight, IconHistory, IconLoader2 } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import MovementTypeBadge from './MovementTypeBadge';
import type { MovementTypeBadgeProps } from './MovementTypeBadge';

export interface ProductMovementHistoryProps {
  /** Product LWIN18 to load movement history for */
  lwin18: string;
  /** Max number of movements to show */
  limit?: number;
}

/**
 * ProductMovementHistory - inline audit trail of stock movements for a single
 * product, loaded on demand from the expanded Stock Explorer row.
 *
 * @example
 *   <ProductMovementHistory lwin18="1022223-2003-01-00750" />
 */
const ProductMovementHistory = ({ lwin18, limit = 50 }: ProductMovementHistoryProps) => {
  const api = useTRPC();
  const { data, isLoading } = useQuery({
    ...api.wms.admin.stock.getMovements.queryOptions({ lwin18, limit }),
  });

  const movements = data?.movements ?? [];

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-text-muted">
        <IconLoader2 className="h-4 w-4 animate-spin" />
        <Typography variant="bodyXs">Loading history…</Typography>
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-6 text-center text-text-muted">
        <IconHistory className="h-5 w-5" />
        <Typography variant="bodyXs">No movements recorded for this product</Typography>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border-muted bg-background-primary">
      <div className="flex items-center gap-2 border-b border-border-muted px-4 py-2.5">
        <IconHistory className="h-4 w-4 text-text-brand" />
        <Typography variant="bodyXs" className="font-semibold uppercase tracking-wider text-text-muted">
          Movement History — {data?.pagination.total ?? movements.length} record
          {(data?.pagination.total ?? movements.length) !== 1 ? 's' : ''}
        </Typography>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-1.5 text-left">When</th>
              <th className="px-3 py-1.5 text-left">Type</th>
              <th className="px-3 py-1.5 text-right">Qty</th>
              <th className="px-3 py-1.5 text-left">Movement</th>
              <th className="hidden px-3 py-1.5 text-left sm:table-cell">By</th>
              <th className="hidden px-3 py-1.5 text-left md:table-cell">Notes</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-t border-border-muted">
                <td className="whitespace-nowrap px-3 py-2 text-text-muted">
                  {formatDate(m.performedAt)}
                </td>
                <td className="px-3 py-2">
                  <MovementTypeBadge
                    movementType={m.movementType as MovementTypeBadgeProps['movementType']}
                    size="sm"
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-text-primary">
                  {m.quantityCases}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 font-mono text-xs text-text-secondary">
                    <span>{m.fromLocationCode ?? '—'}</span>
                    <IconArrowRight className="h-3 w-3 shrink-0 text-text-muted" />
                    <span>{m.toLocationCode ?? '—'}</span>
                  </div>
                </td>
                <td className="hidden px-3 py-2 text-text-muted sm:table-cell">
                  {m.performedBy.name ?? m.performedBy.email ?? '—'}
                </td>
                <td className="hidden max-w-[260px] truncate px-3 py-2 text-text-muted md:table-cell">
                  {m.reasonCode ? `${m.reasonCode}: ` : ''}
                  {m.notes ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductMovementHistory;
