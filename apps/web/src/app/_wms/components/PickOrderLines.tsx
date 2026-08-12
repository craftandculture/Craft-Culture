'use client';

import {
  IconAlertTriangle,
  IconLoader2,
  IconMapPin,
  IconReplace,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import PackBadge from '@/app/_wms/components/PackBadge';
import parseSkuPack from '@/app/_wms/utils/parseSkuPack';
import useTRPC from '@/lib/trpc/browser';

export interface PickOrderLinesProps {
  /** The local zohoSalesOrders.id whose lines should be shown. */
  orderId: string;
}

/**
 * The exact physical pick for one sales order: each line's pack config, bottle
 * total, the bay it will be picked from and whether a case must be broken.
 *
 * Each expanded order owns its own query so several can be open at once —
 * comparing two orders before releasing them is the normal case on the floor.
 */
const PickOrderLines = ({ orderId }: PickOrderLinesProps) => {
  const api = useTRPC();
  const { data: order, isLoading } = useQuery(
    api.zohoSalesOrders.get.queryOptions({ id: orderId }),
  );

  const items = useMemo(() => order?.items ?? [], [order]);

  // Repack roll-up for the whole order (e.g. "2× break 6-pack → 3-pack").
  const repackSummary = useMemo(() => {
    const repacks = items.filter((item) => item.repack?.needsRepack);
    if (repacks.length === 0) return null;
    const groups = new Map<string, number>();
    for (const item of repacks) {
      const from = item.repack?.fromPack;
      const to = item.repack?.orderedPack;
      if (from != null && to != null) {
        const key =
          item.repack?.mode === 'combine'
            ? `combine ${item.repack?.sourceCount ?? 2}× ${from}-pack → ${to}-pack`
            : `break ${from}-pack → ${to}-pack`;
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
    }
    const breakdown = [...groups.entries()]
      .map(([key, n]) => `${n}× ${key}`)
      .join(', ');
    return { count: repacks.length, total: items.length, breakdown };
  }, [items]);

  const unmatchedCount = items.filter(
    (item) => item.repack && !item.repack.hasStock,
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <IconLoader2 className="h-4 w-4 animate-spin text-text-muted" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-1 text-center text-[13px] text-text-muted">No items</p>
    );
  }

  return (
    <div className="space-y-1">
      {unmatchedCount > 0 && (
        <div className="mb-1.5 flex items-start gap-2 rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] leading-snug text-red-800 ring-1 ring-inset ring-red-200">
          <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
          <span>
            <b>
              {unmatchedCount} of {items.length} lines have no matching stock
            </b>{' '}
            &mdash; releasing now leaves them unresolved on the floor
          </span>
        </div>
      )}

      {repackSummary && (
        <div className="mb-1.5 flex items-start gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800 ring-1 ring-inset ring-amber-200">
          <IconReplace className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            <b>
              {repackSummary.count} of {repackSummary.total} lines need repacking
            </b>{' '}
            &mdash; {repackSummary.breakdown}
          </span>
        </div>
      )}

      {items.map((item) => {
        // Pack config is driven by the SKU (the source of truth) when its pack
        // digits are plausible, else the description ("6x75cl") — see
        // parseSkuPack. A stale description or a corrupt SKU can't misstate the
        // bottle count.
        const skuPack = parseSkuPack((item as { sku?: string | null }).sku);
        const packMatch = /^(\d+)\s*[x×]\s*(.*)$/i.exec(
          (item.description ?? '').trim(),
        );
        const perCase =
          skuPack?.pack ??
          (packMatch && Number(packMatch[1]) > 0 ? Number(packMatch[1]) : 1);
        const bottleSize =
          skuPack?.bottleSize || packMatch?.[2]?.trim() || '75cl';
        const totalBottles = item.quantity * perCase;

        const cleanName = (item.name ?? '')
          .replace(/\s*\(single bottle\)\s*/i, '')
          .trim();
        // Zoho sometimes omits the vintage from the line name; recover it from
        // the SKU (lwin7-VINTAGE-…).
        const skuVintage =
          /^\d{7}-((?:19|20)\d{2})-/.exec(
            (item as { sku?: string | null }).sku ?? '',
          )?.[1] ?? null;
        const hasYear = /\b(?:19|20)\d{2}\b/.test(cleanName);
        const displayName =
          !hasYear && skuVintage ? `${cleanName} ${skuVintage}` : cleanName;

        const repack = item.repack;
        const needsRepack = repack?.needsRepack ?? false;
        const noStock = repack ? !repack.hasStock : false;
        const bay = repack?.suggestedLocation ?? null;

        return (
          <div
            key={item.id}
            className={`flex items-start justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] ${
              noStock
                ? 'bg-red-50 ring-1 ring-inset ring-red-200'
                : needsRepack
                  ? 'bg-amber-50 ring-1 ring-inset ring-amber-200'
                  : ''
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-text-primary">{displayName}</p>
                <PackBadge pack={perCase} bottleSize={bottleSize} />
              </div>

              {/* Where it comes from, and what has to happen to it */}
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {noStock ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-700">
                    <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    no stock found
                  </span>
                ) : (
                  bay && (
                    <span className="flex items-center gap-1 text-[11px] font-bold tabular-nums text-emerald-700">
                      <IconMapPin className="h-3.5 w-3.5 shrink-0" />
                      {bay}
                    </span>
                  )
                )}
                {needsRepack && repack?.fromPack && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
                    <IconReplace className="h-3.5 w-3.5 shrink-0" />
                    {repack.mode === 'combine'
                      ? `combine ${repack.sourceCount}× ${repack.fromPack}-pack`
                      : `break a ${repack.fromPack}-pack`}
                  </span>
                )}
              </div>
            </div>

            {/* Bottles lead — that's the unit the floor counts in on a split */}
            <div className="shrink-0 text-right leading-tight">
              <p className="text-[15px] font-bold tabular-nums text-text-primary">
                {totalBottles} btl
              </p>
              <p className="text-[12px] font-medium tabular-nums text-text-muted">
                {item.quantity} {item.quantity === 1 ? 'case' : 'cases'} &middot;{' '}
                {perCase}×{bottleSize}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PickOrderLines;
