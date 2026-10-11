'use client';

import { IconAlertTriangle, IconArrowRight, IconCirclePlus, IconCircleX, IconPencil } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import useTRPC from '@/lib/trpc/browser';

export interface BatchChangesProps {
  batchId: string;
}

const LABEL: Record<string, string> = {
  rename: 'Renamed',
  inactivate: 'Made inactive',
  create: 'Created',
  skipped: 'Skipped',
  set_sku: 'SKU changed',
  set_customs: 'HS & origin set',
};

/**
 * What one cleanup batch did, item by item
 *
 * Each write with its before and after, and each skip with the reason — the
 * list to check against Zoho after a pilot.
 */
const BatchChanges = ({ batchId }: BatchChangesProps) => {
  const api = useTRPC();
  const { data, isLoading } = useQuery(api.zohoCodes.batchChanges.queryOptions({ batchId }));

  if (isLoading) return <p className="px-4 py-3 text-xs text-text-muted">Loading…</p>;
  if (!data?.length) return <p className="px-4 py-3 text-xs text-text-muted">Nothing recorded.</p>;

  return (
    <ul className="divide-y divide-border-muted bg-fill-muted/20">
      {data.map((row) => {
        const Icon =
          row.action === 'create' ? IconCirclePlus : row.action === 'skipped' ? IconAlertTriangle : row.action === 'inactivate' ? IconCircleX : IconPencil;
        const tone = row.action === 'skipped' ? 'text-text-warning' : row.action === 'create' ? 'text-text-success' : 'text-text-primary';
        return (
          <li key={row.id} className="flex gap-2 px-4 py-2 text-xs">
            <Icon size={14} className={`mt-0.5 shrink-0 ${tone}`} />
            <div className="min-w-0 flex-1">
              <p className={tone}>
                <span className="font-semibold">{LABEL[row.action] ?? row.action}</span>
                {row.undoneAt && row.action !== 'skipped' ? <span className="text-text-muted"> · undone</span> : null}
              </p>
              {row.action === 'rename' ? (
                <p className="flex flex-wrap items-center gap-1">
                  {row.beforeName} <IconArrowRight size={11} /> {row.afterName}
                </p>
              ) : (
                <p>{row.itemName}</p>
              )}
              <p className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-text-muted">
                {row.beforeSku && row.afterSku && row.beforeSku !== row.afterSku ? (
                  <>
                    {row.beforeSku} <IconArrowRight size={11} /> {row.afterSku}
                  </>
                ) : (
                  (row.afterSku ?? row.beforeSku)
                )}
              </p>
              {row.afterDetails && (row.action === 'set_customs' || row.action === 'create') ? (
                <p className="text-text-muted">
                  HS {row.afterDetails.upc ?? '—'} · Origin {row.afterDetails.isbn ?? 'not on file'}
                </p>
              ) : null}
              {row.action === 'skipped' && row.reason ? <p className="text-text-warning">{row.reason}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default BatchChanges;
