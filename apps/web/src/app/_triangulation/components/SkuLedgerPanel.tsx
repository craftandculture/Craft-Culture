'use client';

import { IconArrowLeft, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();

  const ledger = useQuery(
    api.triangulation.admin.getSkuLedger.queryOptions({ skuId, periodId }),
  );

  /** What has been moved onto this SKU since the panel opened */
  const [moved, setMoved] = useState<
    { code: string; bottles: number; lines: number }[]
  >([]);

  const moveCode = useMutation({
    ...api.triangulation.admin.moveCodeToSku.mutationOptions(),
    onSuccess: async (result, variables) => {
      // The group vanishes on success, which reads as the bottles being lost
      // rather than moved. Say where they went, and leave it said.
      setMoved((current) => [
        ...current.filter((entry) => entry.code !== variables.normalizedCode),
        {
          code: variables.normalizedCode,
          bottles: result.bottles,
          lines: result.lines,
        },
      ]);

      toast.success(
        `${formatBottles(result.bottles)} bottles moved onto ${result.wCode} across ${result.remappedImports} import${result.remappedImports === 1 ? '' : 's'}`,
      );
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getSkuLedger.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getTriangulation.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.triangulation.admin.getUnmapped.queryKey(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const sku = ledger.data?.sku;
  const entries = ledger.data?.entries ?? [];
  const strays = ledger.data?.strays ?? [];

  // Grouping by input does two things a flat list cannot: it puts a subtotal
  // beside each source, and it says the file name once instead of on every row.
  const groups = GROUP_ORDER.map((kind) => {
    const forKind = entries.filter((entry) => entry.kind === kind);

    // Only committed lines reach the reconciliation, so only committed lines
    // may be totalled here — a subtotal including a draft is a different
    // number from the one on the row that was clicked to get here.
    const committed = forKind.filter((entry) => entry.importStatus !== 'draft');

    return {
      kind,
      entries: forKind,
      total: committed.reduce((sum, entry) => sum + entry.quantityBottles, 0),
      draftTotal: forKind
        .filter((entry) => entry.importStatus === 'draft')
        .reduce((sum, entry) => sum + entry.quantityBottles, 0),
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

  // Grouped by where the bottles went, because that is what decides the fix:
  // a line on another W code is a mapping to undo, an unresolved one is a
  // mapping to make, and a set-aside one was a deliberate decision.
  const strayGroups = [
    ...new Set(
      strays.map((stray) =>
        stray.mappedTo
          ? `on:${stray.mappedTo}`
          : stray.status === 'ignored'
            ? 'ignored'
            : 'unresolved',
      ),
    ),
  ]
    .map((key) => {
      const lines = strays.filter(
        (stray) =>
          (stray.mappedTo
            ? `on:${stray.mappedTo}`
            : stray.status === 'ignored'
              ? 'ignored'
              : 'unresolved') === key,
      );

      const wCode = key.startsWith('on:') ? key.slice(3) : null;

      return {
        key,
        title: wCode
          ? `Counted on ${wCode} instead`
          : key === 'ignored'
            ? 'Set aside as not our stock'
            : 'Not mapped to any W code yet',
        action: wCode
          ? 'If that is the same wine, merge the two on the SKUs tab; if the mapping is wrong, unmap the code.'
          : key === 'ignored'
            ? 'Someone marked these as not Crurated lines. Undo it on the Mapping tab if that was wrong.'
            : 'Map the code on the Mapping tab and these bottles join the figures above.',
        lines,
        bottles: lines.reduce(
          (total, stray) => total + stray.quantityBottles,
          0,
        ),
        // A group can hold more than one code, and each moves separately.
        codes: [...new Set(lines.map((stray) => stray.normalizedCode))].filter(
          Boolean,
        ),
      };
    })
    .sort((a, b) => b.bottles - a.bottles);

  const strayBottles = strayGroups.reduce(
    (total, group) => total + group.bottles,
    0,
  );

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
                        {group.draftTotal !== 0 ? (
                          <Typography
                            variant="bodyXs"
                            colorRole="warning"
                            asChild
                          >
                            <p>
                              + {formatBottles(group.draftTotal)} in draft, not
                              counted
                            </p>
                          </Typography>
                        ) : null}
                      </div>
                    </div>
                    <table className="w-full text-left text-sm">
                      <tbody>
                        {group.entries.map((entry) => (
                          <tr
                            key={entry.id}
                            className={`border-border-primary border-b last:border-b-0 ${
                              entry.importStatus === 'draft'
                                ? 'text-text-muted line-through decoration-1'
                                : ''
                            }`}
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

        {moved.length > 0 ? (
          <div className="border-border-success/40 bg-fill-success/10 mt-5 rounded-lg border p-3">
            <Typography variant="labelSm" colorRole="success">
              Moved onto {sku?.wCode}
            </Typography>
            <ul className="mt-1 space-y-0.5">
              {moved.map((entry) => (
                <li key={entry.code}>
                  <Typography variant="bodyXs" colorRole="muted" asChild>
                    <p>
                      <span className="font-mono">{entry.code}</span> —{' '}
                      {entry.lines} line{entry.lines === 1 ? '' : 's'},{' '}
                      {formatBottles(entry.bottles)} bottles, now counted in the
                      figures above.
                    </p>
                  </Typography>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {strayGroups.length > 0 ? (
          <div className="border-border-warning/40 bg-fill-warning/10 mt-5 rounded-lg border p-3">
            <Typography variant="labelSm" colorRole="warning">
              {formatBottles(strayBottles)} bottles of this wine are not counted
              here
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" asChild>
              <p className="mt-0.5 mb-2">
                Same wine, same vintage, same bottle size — but sitting
                somewhere else. This is usually the whole of an unexplained
                variance.
              </p>
            </Typography>

            {strayGroups.map((group) => (
              <div key={group.key} className="mt-2">
                <div className="border-border-warning/30 flex items-baseline justify-between gap-3 border-b pb-1">
                  <div>
                    <Typography variant="labelSm">{group.title}</Typography>
                    <Typography variant="bodyXs" colorRole="muted" asChild>
                      <p>{group.action}</p>
                    </Typography>
                  </div>
                  <Typography variant="labelSm" asChild>
                    <span className="shrink-0 tabular-nums">
                      {formatBottles(group.bottles)} btl
                    </span>
                  </Typography>
                </div>
                {group.codes.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {group.codes.map((code) => (
                      <Button
                        key={code}
                        size="xs"
                        colorRole="brand"
                        variant="outline"
                        isDisabled={moveCode.isPending}
                        onClick={() =>
                          moveCode.mutate({ normalizedCode: code, skuId })
                        }
                      >
                        <IconArrowLeft className="mr-1 size-3.5" />
                        Move {code} onto {sku?.wCode}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <table className="w-full text-left text-xs">
                  <tbody>
                    {group.lines.map((stray) => (
                      <tr
                        key={stray.id}
                        className="border-border-warning/20 border-b last:border-b-0"
                      >
                        <td className="text-text-muted py-1 pr-3 tabular-nums">
                          {stray.effectiveDate}
                        </td>
                        <td className="py-1 pr-3 font-mono">
                          {stray.rawCode ?? '—'}
                        </td>
                        <td className="text-text-muted py-1 pr-3">
                          {stray.docRef ?? '—'}
                        </td>
                        <td className="text-text-muted py-1 pr-3 text-right tabular-nums">
                          {stray.quantity}
                          {stray.unit === 'case' ? ' cs' : ' btl'}
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
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SkuLedgerPanel;
