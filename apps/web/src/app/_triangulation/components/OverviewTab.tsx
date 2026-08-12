'use client';

import { IconAlertTriangle, IconDownload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import SkuLedgerPanel from './SkuLedgerPanel';
import StatTile from './StatTile';
import type { TriangulationRow } from '../controller/adminGetTriangulation';
import exportTriangulationToExcel from '../utils/exportTriangulationToExcel';
import formatBottles from '../utils/formatBottles';


export interface OverviewTabProps {
  periodId: string | null;
}

/**
 * The C&C position as actually held, and how far the calculation is from it
 *
 * The warehouse cycle counts continuously, so a count is not an independent
 * check on `wms_stock` — it is folded straight into it. That leaves one true
 * C&C position, and the WMS is it. An uploaded count sheet is only used when
 * no WMS snapshot exists, e.g. stock counted outside the system.
 */
const actualOf = (row: TriangulationRow) =>
  row.ccSystem !== null
    ? { value: row.ccSystem, variance: row.ccSystemVariance }
    : { value: row.ccCounted, variance: row.ccVariance };

/** Colour a variance by whether it is worth a conversation */
const varianceTone = (value: number | null) => {
  if (value === null || value === 0) {
    return '';
  }

  return value < 0 ? 'text-text-danger' : 'text-text-warning';
};

/**
 * The reconciliation itself, one row per W code
 *
 * Reads left to right as stock travels: into C&C, out to City Drinks, out to
 * their consumers — with each party's calculated position set beside the count
 * they declared, and the gap between the two called out.
 */
const OverviewTab = ({ periodId }: OverviewTabProps) => {
  const api = useTRPC();

  const [search, setSearch] = useState('');
  const [variancesOnly, setVariancesOnly] = useState(false);
  const [openSkuId, setOpenSkuId] = useState<string | null>(null);

  const triangulation = useQuery(
    api.triangulation.admin.getTriangulation.queryOptions({
      periodId,
      search: search || undefined,
      variancesOnly,
    }),
  );

  const rows = triangulation.data?.rows ?? [];
  const summary = triangulation.data?.summary;
  const meta = triangulation.data?.meta;

  // `cc_count` now carries two different things — the WMS system position and a
  // physical count — so presence has to be judged on the snapshot dates rather
  // than on the import kind, or having one would imply having both.
  const present = meta?.presentKinds ?? [];

  const missingInputs = [
    present.includes('cc_opening') ? null : 'C&C opening stock',
    present.includes('cc_sales_to_cd') ? null : 'C&C sales to City Drinks',
    meta?.ccSystemDate || meta?.ccCountDate ? null : 'C&C stock position (WMS)',
    present.includes('cd_sales') ? null : 'City Drinks sales',
    present.includes('cd_count') ? null : 'City Drinks stock on hand',
  ].filter((entry): entry is string => entry !== null);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Received into C&C"
          value={formatBottles(summary?.ccReceived ?? 0)}
          hint="bottles, cumulative"
        />
        <StatTile
          label="Invoiced to City Drinks"
          value={formatBottles(summary?.ccSoldToCd ?? 0)}
          hint="bottles, cumulative"
        />
        <StatTile
          label="C&C on hand"
          value={formatBottles(summary?.ccOnHandCalc ?? 0)}
          hint="calculated"
        />
        <StatTile
          label="CD sold through"
          value={formatBottles(summary?.cdSold ?? 0)}
          hint="to consumers"
        />
        <StatTile
          label="CD on hand"
          value={formatBottles(summary?.cdOnHandCalc ?? 0)}
          hint="calculated"
        />
      </div>

      {(meta?.unmappedLines ?? 0) > 0 ||
      (meta?.draftImports ?? 0) > 0 ||
      missingInputs.length > 0 ||
      !meta?.ccSystemDate ||
      meta?.ccSystemOutsidePeriod ||
      meta?.ccCountOutsidePeriod ||
      (meta?.systemMappedLines ?? 0) === 0 ||
      (summary?.negativeRows ?? 0) > 0 ? (
        <div className="border-border-warning/40 bg-fill-warning/10 rounded-xl border p-4">
          <div className="flex items-start gap-2">
            <IconAlertTriangle className="text-text-warning mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <Typography variant="labelSm" colorRole="warning">
                Read these figures with the following in mind
              </Typography>
              <ul className="text-text-muted list-disc space-y-0.5 pl-4 text-sm">
                {missingInputs.length > 0 ? (
                  <li>
                    Not yet received: {missingInputs.join(', ')}.
                  </li>
                ) : null}
                {/* An empty System column has several causes — name the actual one */}
                {!meta?.ccSystemDate && (meta?.systemImports ?? 0) === 0 ? (
                  <li>
                    No WMS stock snapshot has been committed. Use{' '}
                    <strong>Sync from WMS</strong> on the Imports tab — until
                    then the System column stays empty.
                  </li>
                ) : null}
                {!meta?.ccSystemDate && (meta?.systemImports ?? 0) > 0 ? (
                  <li>
                    A WMS snapshot exists but none of its lines resolved to a W
                    code, so it contributes nothing. Clear the Mapping tab and
                    re-sync.
                  </li>
                ) : null}
                {meta?.ccSystemDate && (meta?.systemMappedLines ?? 0) === 0 ? (
                  <li>
                    The WMS snapshot of {meta.ccSystemDate} has no mapped lines —
                    every product code in it is unresolved, so the System column
                    reads empty.
                  </li>
                ) : null}
                {meta?.ccSystemOutsidePeriod ? (
                  <li>
                    The WMS snapshot shown is dated {meta.ccSystemDate}, after
                    this period closed — the WMS can only be read as it is now.
                    Its comparison is re-cut to that date, so it is consistent,
                    but it is not a position as at {meta.cutoff}.
                  </li>
                ) : null}
                {meta?.ccCountOutsidePeriod ? (
                  <li>
                    The physical count shown is dated {meta.ccCountDate}, after
                    this period closed.
                  </li>
                ) : null}
                {(meta?.draftSnapshots ?? 0) > 0 ? (
                  <li>
                    {meta?.draftSnapshots} stock snapshot
                    {meta?.draftSnapshots === 1 ? ' is' : 's are'} still in draft
                    and excluded — commit on the Imports tab.
                  </li>
                ) : null}
                {(meta?.unmappedLines ?? 0) > 0 ? (
                  <li>
                    {meta?.unmappedLines} imported line
                    {meta?.unmappedLines === 1 ? '' : 's'} across{' '}
                    {meta?.unmappedCodes} product code
                    {meta?.unmappedCodes === 1 ? '' : 's'} are excluded — resolve
                    them on the Mapping tab.
                  </li>
                ) : null}
                {(meta?.draftImports ?? 0) > 0 ? (
                  <li>
                    {meta?.draftImports} import
                    {meta?.draftImports === 1 ? '' : 's'} still in draft and not
                    counted.
                  </li>
                ) : null}
                {(summary?.negativeRows ?? 0) > 0 ? (
                  <li>
                    {summary?.negativeRows} SKU
                    {summary?.negativeRows === 1 ? '' : 's'} calculate to a
                    negative position — more went out than was ever recorded in,
                    which points at missing opening stock or a code mapped to the
                    wrong wine.
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64">
            <Typography variant="labelXs" colorRole="muted" asChild>
              <p className="mb-1">Search</p>
            </Typography>
            <Input
              placeholder="W code, CD code, producer or wine…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <label className="flex h-9 items-center gap-2">
            <input
              type="checkbox"
              checked={variancesOnly}
              onChange={(event) => setVariancesOnly(event.target.checked)}
            />
            <Typography variant="bodySm">Variances only</Typography>
          </label>
        </div>

        <div className="flex items-end gap-3">
          {meta ? (
            <Typography variant="bodyXs" colorRole="muted" asChild>
              <p className="text-right">
                {meta.periodLabel}
                <br />
                WMS as at {meta.ccSystemDate ?? meta.ccCountDate ?? 'none'} · CD
                declared {meta.cdCountDate ?? 'none'}
              </p>
            </Typography>
          ) : null}
          <Button
            colorRole="muted"
            variant="outline"
            isDisabled={rows.length === 0}
            onClick={() =>
              meta &&
              exportTriangulationToExcel(rows, {
                periodLabel: meta.periodLabel,
                ccCountDate: meta.ccCountDate,
                cdCountDate: meta.cdCountDate,
              })
            }
          >
            <IconDownload className="mr-1 size-4" />
            Export
          </Button>
        </div>
      </div>

      {triangulation.isLoading ? (
        <Typography variant="bodySm" colorRole="muted">
          Reconciling…
        </Typography>
      ) : rows.length === 0 ? (
        <div className="border-border-primary rounded-xl border p-8 text-center">
          <Typography variant="labelSm">Nothing to reconcile yet</Typography>
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p className="mt-1">
              Upload and commit the inputs on the Imports tab to populate this
              view.
            </p>
          </Typography>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-5xl text-left text-sm">
            <thead className="text-text-muted">
              <tr className="border-border-primary border-b">
                <th className="py-2 pr-3" colSpan={3} />
                <th
                  className="border-border-primary border-x py-2 text-center"
                  colSpan={4}
                >
                  Craft &amp; Culture
                </th>
                <th className="py-2 text-center" colSpan={4}>
                  City Drinks
                </th>
              </tr>
              <tr className="border-border-primary border-b">
                <th className="py-2 pr-3">W code</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">CD code</th>
                <th className="border-border-primary border-l py-2 pr-3 text-right">
                  Received
                </th>
                <th className="py-2 pr-3 text-right">Sold to CD</th>
                <th className="py-2 pr-3 text-right">On hand (calc)</th>
                <th className="border-border-primary border-r py-2 pr-3 text-right">
                  WMS actual / Δ
                </th>
                <th className="py-2 pr-3 text-right">Received</th>
                <th className="py-2 pr-3 text-right">Sold</th>
                <th className="py-2 pr-3 text-right">On hand (calc)</th>
                <th className="py-2 text-right">Declared / Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.skuId}
                  className="border-border-primary hover:bg-fill-muted/20 cursor-pointer border-b"
                  onClick={() => setOpenSkuId(row.skuId)}
                >
                  <td className="py-2 pr-3 font-mono text-xs">{row.wCode}</td>
                  <td className="py-2 pr-3">
                    {row.productName}
                    {row.vintage ? ` ${row.vintage}` : ''}
                    {row.hasNegative ? (
                      <span className="text-text-danger ml-1 text-xs">
                        negative
                      </span>
                    ) : null}
                  </td>
                  <td className="text-text-muted py-2 pr-3 font-mono text-xs">
                    {row.cdCodes ?? '—'}
                  </td>
                  <td className="border-border-primary border-l py-2 pr-3 text-right tabular-nums">
                    {formatBottles(row.ccReceived)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatBottles(row.ccSoldToCd)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatBottles(row.ccOnHandCalc)}
                  </td>
                  <td className="border-border-primary border-r py-2 pr-3 text-right tabular-nums">
                    {formatBottles(actualOf(row).value)}
                    {actualOf(row).variance !== null &&
                    actualOf(row).variance !== 0 ? (
                      <span className={`ml-1 ${varianceTone(actualOf(row).variance)}`}>
                        ({(actualOf(row).variance ?? 0) > 0 ? '+' : ''}
                        {formatBottles(actualOf(row).variance)})
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatBottles(row.cdReceived)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatBottles(row.cdSold)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatBottles(row.cdOnHandCalc)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatBottles(row.cdDeclared)}
                    {row.cdVariance !== null && row.cdVariance !== 0 ? (
                      <span className={`ml-1 ${varianceTone(row.cdVariance)}`}>
                        ({row.cdVariance > 0 ? '+' : ''}
                        {formatBottles(row.cdVariance)})
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openSkuId ? (
        <SkuLedgerPanel
          skuId={openSkuId}
          periodId={periodId}
          onClose={() => setOpenSkuId(null)}
        />
      ) : null}
    </div>
  );
};

export default OverviewTab;
