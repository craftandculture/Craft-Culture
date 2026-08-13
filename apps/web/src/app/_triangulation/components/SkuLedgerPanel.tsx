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

/** Movements first in the order they happen, then the stated positions */
const GROUP_ORDER: TriImportKind[] = [
  'cc_opening',
  'cc_sales_to_cd',
  'cd_sales',
  'cc_count',
  'cd_count',
];

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
  const strays = ledger.data?.strays ?? [];

  // Grouping by input does two things a flat list cannot: it puts a subtotal
  // beside each source, and it says the file name once instead of on every row.
  const groups = GROUP_ORDER.map((kind) => {
    const forKind = entries.filter((entry) => entry.kind === kind);

    return {
      kind,
      entries: forKind,
      total: forKind.reduce((sum, entry) => sum + entry.quantityBottles, 0),
      fileNames: [
        ...new Set(
          forKind.map((entry) => entry.fileName ?? entry.periodLabel ?? ''),
        ),
      ].filter(Boolean),
    };
  }).filter((group) => group.entries.length > 0);

  const totalFor = (kind: TriImportKind) =>
    groups.find((group) => group.kind === kind)?.total ?? null;

  const totals = {
    cc_opening: totalFor('cc_opening') ?? 0,
    cc_sales_to_cd: totalFor('cc_sales_to_cd') ?? 0,
    cd_sales: totalFor('cd_sales') ?? 0,
    cc_count: totalFor('cc_count'),
    cd_count: totalFor('cd_count'),
  };

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

        {entries.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {([
              {
                party: 'Craft & Culture',
                dot: 'bg-fill-brand',
                inLabel: 'Received',
                inValue: totals.cc_opening,
                outLabel: 'Sold to CD',
                outValue: totals.cc_sales_to_cd,
                stated: totals.cc_count,
                statedLabel: 'Counted',
              },
              {
                party: 'City Drinks',
                dot: 'bg-fill-info',
                inLabel: 'Received',
                inValue: totals.cc_sales_to_cd,
                outLabel: 'Sold through',
                outValue: totals.cd_sales,
                stated: totals.cd_count,
                statedLabel: 'Declared',
              },
            ] as const).map((chain) => {
              const calculated = chain.inValue - chain.outValue;
              const variance =
                chain.stated === null ? null : chain.stated - calculated;

              return (
                <div
                  key={chain.party}
                  className="border-border-primary rounded-lg border p-3"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${chain.dot}`} />
                    <Typography variant="labelSm">{chain.party}</Typography>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5 text-sm tabular-nums">
                    <span>{formatBottles(chain.inValue)}</span>
                    <span className="text-text-muted">−</span>
                    <span>{formatBottles(chain.outValue)}</span>
                    <span className="text-text-muted">=</span>
                    <span className="font-medium">
                      {formatBottles(calculated)}
                    </span>
                  </div>
                  <Typography variant="bodyXs" colorRole="muted" asChild>
                    <p className="mt-0.5">
                      {chain.inLabel} less {chain.outLabel.toLowerCase()}
                    </p>
                  </Typography>
                  {variance !== null ? (
                    <div className="border-border-primary mt-2 flex items-center justify-between border-t pt-2">
                      <Typography variant="bodyXs" colorRole="muted">
                        {chain.statedLabel} {formatBottles(chain.stated ?? 0)}
                      </Typography>
                      <Badge
                        size="xs"
                        colorRole={variance === 0 ? 'success' : 'danger'}
                      >
                        {variance === 0
                          ? 'agrees'
                          : `${variance > 0 ? '+' : ''}${formatBottles(variance)}`}
                      </Badge>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

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
            <div className="space-y-4">
              {groups.map((group) => {
                const meta = importKindLabels[group.kind];

                return (
                  <div
                    key={group.kind}
                    className="border-border-primary overflow-hidden rounded-lg border"
                  >
                    <div className="border-border-primary bg-fill-muted/20 flex items-center justify-between gap-3 border-b px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`size-2 shrink-0 rounded-full ${
                            meta.side === 'cc' ? 'bg-fill-brand' : 'bg-fill-info'
                          }`}
                        />
                        <div className="min-w-0">
                          <Typography variant="labelSm">
                            {meta.label}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted" asChild>
                            <p className="truncate">
                              {group.fileNames.join(' · ')}
                            </p>
                          </Typography>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Typography variant="labelSm" asChild>
                          <span className="tabular-nums">
                            {meta.behaviour === 'flow' && isInbound(group.kind)
                              ? '+'
                              : ''}
                            {formatBottles(group.total)}
                          </span>
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted" asChild>
                          <p>
                            {group.entries.length} line
                            {group.entries.length === 1 ? '' : 's'} ·{' '}
                            {meta.behaviour === 'snapshot'
                              ? 'stated position'
                              : 'accumulates'}
                          </p>
                        </Typography>
                      </div>
                    </div>
                    <table className="w-full text-left text-sm">
                      <tbody>
                        {group.entries.map((entry) => (
                          <tr
                            key={entry.id}
                            className="border-border-primary border-b last:border-b-0"
                          >
                            <td className="text-text-muted py-1.5 pr-3 pl-3 tabular-nums">
                              {entry.effectiveDate}
                            </td>
                            <td className="py-1.5 pr-3">
                              {entry.docRef ?? (
                                <span className="text-text-muted">—</span>
                              )}
                              {entry.importStatus === 'draft' ? (
                                <Badge size="xs" colorRole="warning">
                                  draft
                                </Badge>
                              ) : null}
                            </td>
                            <td className="text-text-muted py-1.5 pr-3 text-right tabular-nums">
                              {entry.quantity}
                              {entry.unit === 'case' ? ' cs' : ' btl'}
                              {entry.unit === 'case' && entry.caseConfig
                                ? ` × ${entry.caseConfig}`
                                : ''}
                            </td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">
                              {isInbound(entry.kind) ? '+' : ''}
                              {formatBottles(entry.quantityBottles)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {strays.length > 0 ? (
          <div className="border-border-warning/40 bg-fill-warning/10 mt-5 rounded-lg border p-3">
            <Typography variant="labelSm" colorRole="warning">
              {strays.length} line{strays.length === 1 ? '' : 's'} name this wine
              but are not counted on it
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" asChild>
              <p className="mt-0.5">
                Bottles that belong here and went somewhere else — mapped to
                another W code, still unresolved, or set aside. This is usually
                the whole of an unexplained variance.
              </p>
            </Typography>
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">Where it is</th>
                  <th className="py-1 pr-3 font-medium">Code</th>
                  <th className="py-1 pr-3 font-medium">Doc</th>
                  <th className="py-1 pr-3 text-right font-medium">Qty</th>
                  <th className="py-1 text-right font-medium">Bottles</th>
                </tr>
              </thead>
              <tbody>
                {strays.map((stray) => (
                  <tr key={stray.id} className="border-border-warning/20 border-t">
                    <td className="py-1 pr-3">
                      {stray.mappedTo
                        ? `on ${stray.mappedTo}`
                        : stray.status === 'ignored'
                          ? 'set aside'
                          : 'unresolved'}
                      {stray.importStatus === 'draft' ? ' · draft' : ''}
                    </td>
                    <td className="py-1 pr-3 font-mono">{stray.rawCode ?? '—'}</td>
                    <td className="text-text-muted py-1 pr-3">
                      {stray.docRef ?? '—'} · {stray.effectiveDate}
                    </td>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {stray.quantity} {stray.unit === 'case' ? 'cs' : 'btl'}
                      {stray.unit === 'case' && stray.caseConfig
                        ? ` × ${stray.caseConfig}`
                        : ''}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatBottles(stray.quantityBottles)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SkuLedgerPanel;
