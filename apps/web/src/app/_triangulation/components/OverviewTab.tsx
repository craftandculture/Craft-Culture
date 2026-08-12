'use client';

import { IconDownload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import DataQualityNotice from './DataQualityNotice';
import type { DataQualityIssue } from './DataQualityNotice';
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

  /**
   * Everything that qualifies the figures, ordered worst first.
   *
   * `blocking` means a number on screen is wrong until it is fixed; `caution`
   * means it is readable with a caveat. Keeping that distinction explicit stops
   * a stale-date note reading as urgently as an unmapped-lines note.
   */
  const issues: DataQualityIssue[] = [];

  const missingInputs = [
    present.includes('cc_opening') ? null : 'C&C opening stock',
    present.includes('cc_sales_to_cd') ? null : 'C&C sales to City Drinks',
    meta?.ccSystemDate || meta?.ccCountDate ? null : 'C&C stock position (WMS)',
    present.includes('cd_sales') ? null : 'City Drinks sales',
    present.includes('cd_count') ? null : 'City Drinks stock on hand',
  ].filter((entry): entry is string => entry !== null);

  if (missingInputs.length > 0) {
    issues.push({
      label: `${missingInputs.length} input${missingInputs.length === 1 ? '' : 's'} missing`,
      detail: `Not yet received: ${missingInputs.join(', ')}. Every position that depends on them reads low.`,
      severity: 'blocking',
    });
  }

  if ((meta?.unmappedLines ?? 0) > 0) {
    issues.push({
      label: `${meta?.unmappedCodes} unmapped codes`,
      detail: `${meta?.unmappedLines} imported lines carry a product code that does not resolve to a W code, so they are excluded from every figure here. Resolve them on the Mapping tab.`,
      severity: 'blocking',
    });
  }

  if ((summary?.negativeRows ?? 0) > 0) {
    issues.push({
      label: `${summary?.negativeRows} negative`,
      detail:
        'More went out than was ever recorded in. That is a data gap rather than a stock loss — usually missing opening stock, or a code mapped to the wrong wine.',
      severity: 'blocking',
    });
  }

  if (!meta?.ccSystemDate && (meta?.systemImports ?? 0) === 0) {
    issues.push({
      label: 'No WMS snapshot',
      detail:
        'Nothing has been synced from the WMS, so the C&C actual column is empty. Use Refresh live data on the Imports tab.',
      severity: 'blocking',
    });
  }

  if ((meta?.systemImports ?? 0) > 0 && (meta?.systemMappedLines ?? 0) === 0) {
    issues.push({
      label: 'WMS snapshot unmapped',
      detail:
        'A WMS snapshot exists but none of its lines resolved to a W code, so it contributes nothing. Clear the Mapping tab, then re-sync.',
      severity: 'blocking',
    });
  }

  if ((meta?.draftImports ?? 0) > 0) {
    issues.push({
      label: `${meta?.draftImports} draft`,
      detail:
        'Imports stay out of the figures until committed. Commit them on the Imports tab.',
      severity: 'caution',
    });
  }

  if (meta?.ccSystemOutsidePeriod) {
    issues.push({
      label: 'WMS date outside period',
      detail: `The WMS can only be read as it is now, so the snapshot shown is dated ${meta.ccSystemDate} — after this period closed. Its comparison is re-cut to that date and is internally consistent, but it is not a position as at ${meta.cutoff}.`,
      severity: 'caution',
    });
  }

  if (meta?.ccCountOutsidePeriod) {
    issues.push({
      label: 'Count date outside period',
      detail: `The physical count shown is dated ${meta.ccCountDate}, after this period closed.`,
      severity: 'caution',
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Received into C&C"
          value={formatBottles(summary?.ccReceived ?? 0)}
          hint="cumulative"
        />
        <StatTile
          label="Invoiced to City Drinks"
          value={formatBottles(summary?.ccSoldToCd ?? 0)}
          hint="cumulative"
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

      <DataQualityNotice issues={issues} />

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
                    {/* A word on nearly every row stops being a signal — the
                        count lives in the notice, so this is just a marker. */}
                    {row.hasNegative ? (
                      <span
                        title="Calculates to a negative position — more went out than was recorded in"
                        className="bg-fill-danger ml-1.5 inline-block size-1.5 rounded-full align-middle"
                      />
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
