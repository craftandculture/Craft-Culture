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
import SummaryBar from './SummaryBar';
import ValueCell from './ValueCell';
import type { TriangulationRow } from '../controller/adminGetTriangulation';
import cleanProductName from '../utils/cleanProductName';
import exportTriangulationToExcel from '../utils/exportTriangulationToExcel';


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

  const doubleCounts = useQuery(
    api.triangulation.admin.findDoubleCounts.queryOptions(),
  );

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
      detail: `${meta?.unmappedLines} imported lines carry a product code that does not resolve to a W code, so they are excluded from every figure here. Map them on the Mapping tab, or set aside the ones that are not this owner's stock — the invoices to City Drinks carry other wines too.`,
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

  const doubleCountRows = doubleCounts.data ?? [];
  // The worst case if every pairing is genuinely the same bottles twice.
  const doubleCountInflation = doubleCountRows.reduce(
    (total, row) => total + (row.total - row.largest),
    0,
  );

  return (
    <div className="space-y-5">
      <SummaryBar
        isFiltered={!!search.trim() || variancesOnly}
        ccReceived={summary?.ccReceived ?? 0}
        ccSoldToCd={summary?.ccSoldToCd ?? 0}
        ccOnHand={summary?.ccOnHandCalc ?? 0}
        cdSold={summary?.cdSold ?? 0}
        cdOnHand={summary?.cdOnHandCalc ?? 0}
      />

      {doubleCountRows.length > 0 ? (
        <div className="border-border-danger/40 bg-fill-danger/10 rounded-xl border p-4">
          <Typography variant="labelSm" colorRole="danger">
            {doubleCountRows.length} SKU
            {doubleCountRows.length === 1 ? '' : 's'} are being counted from two
            sources at once — up to{' '}
            {Math.round(doubleCountInflation).toLocaleString('en-GB')} bottles
            too many
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1 max-w-3xl">
              Each source and what it contributes. Where two describe the same
              bottles, delete the redundant import on the Imports tab; where
              they are two genuine deliveries, leave both.
            </p>
          </Typography>
          <div className="mt-2 max-h-72 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-text-muted bg-fill-danger/10 sticky top-0">
                <tr>
                  <th className="py-1 pr-3 font-medium">W code</th>
                  <th className="py-1 pr-3 font-medium">Product</th>
                  <th className="py-1 pr-3 font-medium">Figure</th>
                  <th className="py-1 pr-3 font-medium">Sources</th>
                  <th className="py-1 pr-3 text-right font-medium">Counted</th>
                  <th className="py-1 text-right font-medium">Largest alone</th>
                </tr>
              </thead>
              <tbody>
                {doubleCountRows.map((row) => (
                  <tr
                    key={`${row.skuId}-${row.kind}-${row.asOfDate ?? 'all'}`}
                    className="border-border-danger/20 border-t align-top"
                  >
                    <td className="py-1 pr-3 font-mono">{row.wCode}</td>
                    <td className="py-1 pr-3">{row.productName}</td>
                    <td className="text-text-muted py-1 pr-3">
                      {row.kind === 'cc_opening'
                        ? 'Received into C&C'
                        : row.kind === 'cc_sales_to_cd'
                          ? 'Sold to City Drinks'
                          : row.kind === 'cc_count'
                            ? `C&C count ${row.asOfDate ?? ''}`
                            : `City Drinks count ${row.asOfDate ?? ''}`}
                    </td>
                    <td className="py-1 pr-3">
                      {row.sources.map((source) => (
                        <div key={`${source.fileName}-${source.asOfDate}`}>
                          {source.fileName}
                          <span className="text-text-muted">
                            {' '}
                            ({source.sourceRef ?? 'uploaded'}) ·{' '}
                            {source.bottles.toLocaleString('en-GB')} btl
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {row.total.toLocaleString('en-GB')}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {row.largest.toLocaleString('en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <DataQualityNotice issues={issues} />

      {/* One control row: filters left, provenance and export right — the
          labelled stack above each control pushed the table below the fold. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-72">
            <Input
              placeholder="Search W code, CD code, producer or wine…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <label
            className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
              variancesOnly
                ? 'border-border-brand bg-fill-brand/10 text-text-brand'
                : 'border-border-primary text-text-muted hover:bg-fill-muted/20'
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={variancesOnly}
              onChange={(event) => setVariancesOnly(event.target.checked)}
            />
            Variances only
          </label>
          <Typography variant="bodyXs" colorRole="muted">
            {rows.length.toLocaleString('en-GB')} SKU
            {rows.length === 1 ? '' : 's'}
          </Typography>
        </div>

        <div className="flex items-center gap-3">
          {meta ? (
            <Typography variant="bodyXs" colorRole="muted" asChild>
              <p className="text-right">
                WMS {meta.ccSystemDate ?? meta.ccCountDate ?? '—'} · CD declared{' '}
                {meta.cdCountDate ?? '—'}
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
        <div className="border-border-primary max-h-[calc(100vh-19rem)] overflow-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            {/* Sticky so the column meaning survives scrolling a few hundred
                SKUs — otherwise every scroll is a trip back to the top. */}
            {/* Sticky sits on every th, not on thead — browsers disagree about
                a sticky thead. The two rows stack: group row at top-0 with a
                fixed height, column row pinned directly beneath it. Header
                cells must be fully opaque or scrolled rows show through. */}
            <thead className="text-text-muted">
              <tr className="border-border-primary border-b">
                <th className="bg-fill-primary sticky left-0 top-0 z-30 h-9 py-2 pl-3 pr-3" />
                <th className="bg-fill-primary sticky top-0 z-20 h-9 py-2 pr-3" colSpan={3} />
                <th
                  className="border-border-primary bg-fill-primary text-text-brand sticky top-0 z-20 h-9 border-x py-2 text-center font-medium"
                  colSpan={4}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="bg-fill-brand size-2 rounded-full" />
                    Craft &amp; Culture
                  </span>
                </th>
                <th
                  className="bg-fill-primary text-text-info sticky top-0 z-20 h-9 py-2 text-center font-medium"
                  colSpan={4}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="bg-fill-info size-2 rounded-full" />
                    City Drinks
                  </span>
                </th>
              </tr>
              <tr className="border-border-primary border-b text-xs">
                {/* W over CD in one column: one identity in two systems, and
                    stacked they cost a third of the width side by side did. */}
                <th className="bg-fill-primary sticky left-0 top-9 z-30 py-2 pl-3 pr-3 font-medium">
                  Codes
                </th>
                <th className="bg-fill-primary sticky top-9 z-20 py-2 pr-3 font-medium">Product</th>
                <th className="bg-fill-primary sticky top-9 z-20 py-2 pr-3 text-right font-medium">Vintage</th>
                <th className="bg-fill-primary sticky top-9 z-20 py-2 pr-3 text-right font-medium">Pack</th>
                <th className="border-border-primary bg-fill-primary sticky top-9 z-20 border-l py-2 pr-3 text-right font-medium">
                  Received
                </th>
                <th className="bg-fill-primary sticky top-9 z-20 py-2 pr-3 text-right font-medium">Sold to CD</th>
                <th className="bg-fill-primary sticky top-9 z-20 py-2 pr-3 text-right font-medium">On hand</th>
                <th
                  className="border-border-primary bg-fill-primary sticky top-9 z-20 border-r py-2 pr-3 text-right font-medium"
                  title="What the WMS holds, with the gap from the calculated position beneath"
                >
                  WMS actual
                </th>
                <th className="bg-fill-primary sticky top-9 z-20 py-2 pr-3 text-right font-medium">
                  Received
                </th>
                <th className="bg-fill-primary sticky top-9 z-20 py-2 pr-3 text-right font-medium">
                  Sold
                </th>
                <th className="bg-fill-primary sticky top-9 z-20 py-2 pr-3 text-right font-medium">
                  On hand
                </th>
                <th
                  className="bg-fill-primary sticky top-9 z-20 py-2 pr-3 text-right font-medium"
                  title="What City Drinks say they hold, with the gap from the calculated position beneath"
                >
                  Declared
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.skuId}
                  className="border-border-primary bg-fill-primary hover:bg-fill-muted/20 cursor-pointer border-b"
                  onClick={() => setOpenSkuId(row.skuId)}
                >
                  {/* The identity column stays put when the eleven numeric
                      columns are scrolled — a figure with no code beside it is
                      unreadable. `bg-inherit` keeps the row hover intact. */}
                  <td
                    className={`sticky left-0 z-[1] whitespace-nowrap bg-inherit py-1.5 pl-3 pr-3 font-mono text-xs ${
                      row.hasNegative ? 'border-l-fill-danger border-l-2' : ''
                    }`}
                    title={
                      row.hasNegative
                        ? `${row.wCode} — calculates to a negative position, so more went out than was recorded in`
                        : row.wCode
                    }
                  >
                    <span className="text-text-primary block leading-tight">
                      {row.wCode.length > 18
                        ? `${row.wCode.slice(0, 17)}…`
                        : row.wCode}
                    </span>
                    <span className="text-text-muted block leading-tight">
                      {row.cdCodes ?? (
                        <span
                          className="text-text-danger"
                          title="No City Drinks code mapped — their sales for this wine cannot be attributed"
                        >
                          unmapped
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="max-w-80 py-1.5 pr-3">
                    {/* One line per row: wrapping doubles the height of every
                        row to accommodate a handful of long names. */}
                    <span className="block truncate" title={row.productName}>
                      {cleanProductName(row.productName, row.vintage)}
                    </span>
                  </td>
                  <td className="text-text-muted py-1.5 pr-3 text-right tabular-nums">
                    {row.vintage ?? '—'}
                  </td>
                  <td className="text-text-muted whitespace-nowrap py-1.5 pr-3 text-right text-xs">
                    {row.caseConfig}
                    {row.bottleSize ? ` × ${row.bottleSize}` : ''}
                  </td>
                  <ValueCell
                    value={row.ccReceived}
                    className="border-border-primary border-l"
                  />
                  <ValueCell value={row.ccSoldToCd} />
                  <ValueCell value={row.ccOnHandCalc} />
                  <ValueCell
                    value={actualOf(row).value}
                    variance={actualOf(row).variance}
                    className="border-border-primary border-r"
                  />
                  <ValueCell value={row.cdReceived} className="bg-fill-info/5" />
                  <ValueCell value={row.cdSold} className="bg-fill-info/5" />
                  <ValueCell value={row.cdOnHandCalc} className="bg-fill-info/5" />
                  <ValueCell
                    value={row.cdDeclared}
                    variance={row.cdVariance}
                    className="bg-fill-info/5"
                  />
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
