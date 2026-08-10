'use client';

import { IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import type { TriImportKind } from '../schemas/triangulationSchemas';
import formatBottles from '../utils/formatBottles';
import importKindLabels from '../utils/importKindLabels';

export interface SkuLedgerPanelProps {
  skuId: string;
  periodId: string | null;
  onClose: () => void;
}

/** Inputs that add to a position render positive; the rest draw stock down */
const isInbound = (kind: TriImportKind) => kind === 'cc_opening';

/**
 * Every line behind one SKU's position, newest first
 *
 * When a variance appears, this is where it gets settled — the specific
 * invoice line, count row or pack size that the two sides disagree about.
 */
const SkuLedgerPanel = ({ skuId, periodId, onClose }: SkuLedgerPanelProps) => {
  const api = useTRPC();

  const ledger = useQuery(
    api.triangulation.admin.getSkuLedger.queryOptions({ skuId, periodId }),
  );

  const sku = ledger.data?.sku;
  const entries = ledger.data?.entries ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close ledger"
        className="bg-fill-bold/30 absolute inset-0"
        onClick={onClose}
      />
      <div className="bg-fill-primary border-border-primary relative flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Typography variant="headingSm" asChild>
              <h3>{sku?.productName ?? 'Loading…'}</h3>
            </Typography>
            <Typography variant="bodySm" colorRole="muted" asChild>
              <p className="mt-1">
                <span className="font-mono">{sku?.wCode}</span>
                {sku?.vintage ? ` · ${sku.vintage}` : ''}
                {sku?.caseConfig ? ` · ${sku.caseConfig} btl/case` : ''}
                {sku?.lwin18 ? ` · LWIN ${sku.lwin18}` : ''}
              </p>
            </Typography>
          </div>
          <Button size="sm" colorRole="muted" variant="ghost" onClick={onClose}>
            <IconX className="size-4" />
          </Button>
        </div>

        <div className="mt-5">
          {ledger.isLoading ? (
            <Typography variant="bodySm" colorRole="muted">
              Loading ledger…
            </Typography>
          ) : entries.length === 0 ? (
            <Typography variant="bodySm" colorRole="muted">
              No import lines reference this SKU yet.
            </Typography>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-text-muted border-border-primary border-b">
                <tr>
                  <th className="py-2 pr-3">Input</th>
                  <th className="py-2 pr-3">As at</th>
                  <th className="py-2 pr-3">Doc</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 text-right">Bottles</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-border-primary border-b">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        {importKindLabels[entry.kind].shortLabel}
                        {entry.importStatus === 'draft' ? (
                          <Badge size="xs" colorRole="warning">
                            draft
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-text-muted text-xs">
                        {entry.fileName ?? entry.periodLabel ?? ''}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{entry.asOfDate}</td>
                    <td className="py-2 pr-3">
                      {entry.docRef ?? '—'}
                      {entry.docDate ? (
                        <span className="text-text-muted block text-xs">
                          {entry.docDate}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {entry.quantity} {entry.unit === 'case' ? 'cs' : 'btl'}
                      {entry.unit === 'case' && entry.caseConfig ? (
                        <span className="text-text-muted block text-xs">
                          × {entry.caseConfig}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        isInbound(entry.kind) ? 'text-text-success' : ''
                      }`}
                    >
                      {isInbound(entry.kind) ? '+' : ''}
                      {formatBottles(entry.quantityBottles)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkuLedgerPanel;
