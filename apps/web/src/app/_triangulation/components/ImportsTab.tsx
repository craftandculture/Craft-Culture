'use client';

import {
  IconCheck,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import DuplicatePanel from './DuplicatePanel';
import EditImportPanel from './EditImportPanel';
import ImportWizard from './ImportWizard';
import type { TriImportRow } from '../controller/adminGetImports';
import type { TriImportKind } from '../schemas/triangulationSchemas';
import importKindLabels from '../utils/importKindLabels';


/** One feed's outcome from the last refresh, held on screen rather than in a toast */
interface SyncReportEntry {
  feed: string;
  tone: 'ok' | 'warn';
  summary: string;
  detail?: string;
}

export interface ImportsTabProps {
  periodId: string | null;
  periodEnd: string | null;
  isLocked: boolean;
}

/** Where the Zoho customer name for City Drinks is remembered between visits */
const ZOHO_CUSTOMER_KEY = 'triangulation.zohoCustomer';

/** Where the WMS stock owner name is remembered between visits */
const OWNER_NAME_KEY = 'triangulation.ownerName';

const KIND_ORDER: TriImportKind[] = [
  'cc_opening',
  'cc_sales_to_cd',
  'cc_count',
  'cd_sales',
  'cd_count',
];

/**
 * Upload and manage the five monthly inputs for a period
 *
 * Imports land as drafts and are committed explicitly, which keeps a file with
 * unresolved product codes out of the reconciliation until someone has looked
 * at it.
 */
const ImportsTab = ({ periodId, periodEnd, isLocked }: ImportsTabProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [activeKind, setActiveKind] = useState<TriImportKind | null>(null);
  const [editing, setEditing] = useState<TriImportRow | null>(null);
  /** Import whose duplicate warning has been shown and needs a second click */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // City Drinks trade in Zoho under a different name, and that is the sort of
  // thing that changes, so it is editable and remembered rather than compiled in.
  const [zohoCustomer, setZohoCustomer] = useState('CD General');
  const [ownerName, setOwnerName] = useState('Crurated');
  /**
   * What the last refresh actually did, per feed.
   *
   * Refreshing fires four syncs at once, and their toasts stack and expire
   * faster than they can be read — which left the one place the tool explains
   * itself unreadable at exactly the moment it mattered.
   */
  const [syncReport, setSyncReport] = useState<SyncReportEntry[]>([]);

  const report = (entry: SyncReportEntry) =>
    setSyncReport((current) => [
      ...current.filter((existing) => existing.feed !== entry.feed),
      entry,
    ]);

  useEffect(() => {
    const storedCustomer = window.localStorage.getItem(ZOHO_CUSTOMER_KEY);
    const storedOwner = window.localStorage.getItem(OWNER_NAME_KEY);

    if (storedCustomer) {
      setZohoCustomer(storedCustomer);
    }

    if (storedOwner) {
      setOwnerName(storedOwner);
    }
  }, []);

  const imports = useQuery(
    api.triangulation.admin.getImports.queryOptions({ periodId, limit: 200 }),
  );

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: api.triangulation.admin.getImports.queryKey(),
    });
    await queryClient.invalidateQueries({
      queryKey: api.triangulation.admin.getTriangulation.queryKey(),
    });
    await queryClient.invalidateQueries({
      queryKey: api.triangulation.admin.getUnmapped.queryKey(),
    });
  };

  const commitImport = useMutation({
    ...api.triangulation.admin.commitImport.mutationOptions(),
    onSuccess: async (result) => {
      const unmapped = result.rowCount - result.mappedRowCount;

      setConfirmingId(null);
      toast.success(
        unmapped > 0
          ? `Committed — ${unmapped} unmapped rows are excluded from the figures`
          : 'Committed to the reconciliation',
      );
      await invalidate();
    },
    onError: (error, variables) => {
      // A duplicate is a decision, not a dead end: show what collides, then
      // let a second click go through.
      if (error.data?.code === 'CONFLICT') {
        setConfirmingId(variables.importId);
        toast.warning(error.message);
        return;
      }

      toast.error(error.message);
    },
  });

  const syncCount = useMutation({
    ...api.triangulation.admin.syncCountFromWms.mutationOptions(),
    onSuccess: async (result) => {
      const warnings: string[] = [];

      if (result.missingWCodes > 0) {
        warnings.push(`${result.missingWCodes} without a W code`);
      }

      if (result.missingCaseConfig > 0) {
        warnings.push(
          `${result.missingCaseConfig} with no pack size in the WMS, counted as 6s`,
        );
      }

      if (result.manualCountsSameDate > 0) {
        warnings.push(
          `a manual count also exists for ${result.asOfDate} and will be added to this one`,
        );
      }

      if (result.matchedOwners.length > 1) {
        warnings.push(`matched ${result.matchedOwners.length} owners: ${result.matchedOwners.join(', ')}`);
      }

      report({
        feed: 'WMS stock position',
        tone: result.missingWCodes > 0 ? 'warn' : 'ok',
        summary: `${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles from ${result.matchedOwners[0] ?? 'the WMS'} as at ${result.asOfDate}`,
        detail: warnings.join(' · ') || undefined,
      });

      toast.success(
        `Synced ${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles from ${result.matchedOwners[0] ?? 'the WMS'} as at ${result.asOfDate}` +
          (warnings.length > 0 ? ` — ${warnings.join('; ')}` : ''),
      );
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const syncReceipts = useMutation({
    ...api.triangulation.admin.syncReceiptsFromWms.mutationOptions(),
    onSuccess: async (result) => {
      report({
        feed: 'WMS receipts',
        tone: result.receipts === 0 ? 'warn' : 'ok',
        summary:
          result.receipts === 0
            ? 'No receipts in the WMS for this owner'
            : `${result.receipts} receipts · ${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles`,
        detail:
          result.receipts === 0
            ? result.baselineUploads > 0
              ? `Opening stock rests on ${result.baselineUploads} uploaded import${result.baselineUploads === 1 ? '' : 's'}`
              : 'No baseline uploaded either — every position will read low'
            : undefined,
      });

      if (result.receipts === 0) {
        // Expected for stock that landed before WMS receiving existed.
        toast.info(
          result.baselineUploads > 0
            ? `No WMS receipts for this owner — opening stock rests on ${result.baselineUploads} uploaded baseline import${result.baselineUploads === 1 ? '' : 's'} (${Math.round(result.baselineBottles).toLocaleString('en-GB')} bottles)`
            : 'No WMS receipts for this owner, and no baseline uploaded — opening stock is missing, so every position will read low',
        );
      } else {
        toast.success(
          `Synced ${result.receipts} WMS receipts — ${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles`,
        );
      }

      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const syncZoho = useMutation({
    ...api.triangulation.admin.syncSalesFromZoho.mutationOptions(),
    onSuccess: async (result) => {
      report({
        feed: 'Zoho sales to City Drinks',
        tone:
          result.unknownPack > 0 || result.skippedOrders.length > 0
            ? 'warn'
            : 'ok',
        summary: `${result.orderLines} lines from ${result.invoices.length} invoices · ${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles`,
        detail: [
          result.unknownPack > 0
            ? `${result.unknownPack} lines state no pack size, counted as single bottles`
            : null,
          result.packDisagreements > 0
            ? `${result.packDisagreements} where the SKU's pack contradicts the printed format`
            : null,
          result.skippedOrders.length > 0
            ? `Not counted as sold, no invoice on the order: ${result.skippedOrders.join(', ')}`
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
      });

      toast.success(
        `Synced ${result.orderLines} lines from ${result.invoices.length} invoices — ${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles` +
          (result.unknownPack > 0
            ? `; ${result.unknownPack} with no stated pack size`
            : '') +
          (result.packDisagreements > 0
            ? `; ${result.packDisagreements} where the SKU's pack contradicts the printed format`
            : '') +
          (result.skippedOrders.length > 0
            ? `. Not counted as sold (no invoice on the order): ${result.skippedOrders.slice(0, 5).join(', ')}${result.skippedOrders.length > 5 ? '…' : ''}`
            : ''),
      );
      // Logged rather than shown: the list is long, and it is only wanted when
      // a specific invoice is being hunted for.
       
      console.info('[Triangulation] Zoho invoices synced:', result.invoices);
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const syncCycleCount = useMutation({
    ...api.triangulation.admin.syncCycleCountFromWms.mutationOptions(),
    onSuccess: async (result) => {
      report({
        feed: 'WMS cycle count',
        tone: 'ok',
        summary: `Count of ${result.asOfDate} · ${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles`,
      });

      toast.success(
        `Synced the cycle count of ${result.asOfDate} — ${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles counted`,
      );
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const isSyncing =
    syncCount.isPending ||
    syncReceipts.isPending ||
    syncZoho.isPending ||
    syncCycleCount.isPending;

  /**
   * Pull every in-house input in one go; City Drinks' two still arrive as files.
   *
   * Each feed reports its own outcome and one failing must not stop the rest —
   * a missing Zoho customer should not cost you the WMS refresh.
   */
  const refreshLive = async () => {
    setSyncReport([]);
    await syncReceipts.mutateAsync({ ownerName }).catch(() => null);
    await syncZoho.mutateAsync({ customerMatch: zohoCustomer }).catch(() => null);
    await syncCount
      .mutateAsync({ ownerName, periodId })
      .catch(() => null);
    // The physical count only yields anything once a cycle count has been
    // completed in the WMS, so it is expected to no-op much of the time.
    await syncCycleCount
      .mutateAsync({ ownerName, periodId })
      .catch(() => null);
  };

  const deleteImport = useMutation({
    ...api.triangulation.admin.deleteImport.mutationOptions(),
    onSuccess: async () => {
      toast.success('Import deleted');
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = imports.data ?? [];

  if (editing) {
    return <EditImportPanel record={editing} onClose={() => setEditing(null)} />;
  }

  if (activeKind) {
    return (
      <div className="border-border-primary rounded-2xl border p-5">
        <Typography variant="headingSm" asChild>
          <h3 className="mb-1">Import {importKindLabels[activeKind].label}</h3>
        </Typography>
        <ImportWizard
          kind={activeKind}
          periodId={periodId}
          defaultAsOfDate={periodEnd ?? new Date().toISOString().slice(0, 10)}
          onClose={() => setActiveKind(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-border-primary bg-fill-muted/20 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div>
          <Typography variant="labelSm">In-house inputs</Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="mt-1 max-w-xl">
              WMS receipts, Zoho sales and WMS stock, read from our own systems.
              Closed periods stay put — refreshing only adds what happened since.
            </p>
          </Typography>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-text-muted text-xs">Stock owner in the WMS</span>
            <input
              value={ownerName}
              onChange={(event) => {
                setOwnerName(event.target.value);
                window.localStorage.setItem(OWNER_NAME_KEY, event.target.value);
              }}
              placeholder="Crurated"
              className="border-border-primary bg-fill-primary text-text-primary min-h-9 w-40 rounded-md border px-2 text-sm"
            />
          </label>
          <Button
            colorRole="brand"
            isDisabled={isLocked || isSyncing || !ownerName.trim()}
            onClick={() => void refreshLive()}
          >
            <IconRefresh className="mr-1 size-4" />
            {isSyncing ? 'Refreshing…' : 'Refresh live data'}
          </Button>
        </div>
      </div>

      {syncReport.length > 0 ? (
        <div className="border-border-primary rounded-xl border">
          <div className="border-border-primary flex items-center justify-between gap-2 border-b px-4 py-2">
            <Typography variant="labelSm">What the last refresh did</Typography>
            <Button
              size="xs"
              colorRole="muted"
              variant="ghost"
              onClick={() => setSyncReport([])}
            >
              Dismiss
            </Button>
          </div>
          <ul className="divide-border-primary divide-y">
            {syncReport.map((entry) => (
              <li key={entry.feed} className="flex gap-3 px-4 py-2.5">
                <span
                  aria-hidden
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    entry.tone === 'warn' ? 'bg-fill-warning' : 'bg-fill-success'
                  }`}
                />
                <div className="min-w-0">
                  <Typography variant="bodySm" asChild>
                    <p>
                      <span className="font-medium">{entry.feed}</span>
                      {' — '}
                      {entry.summary}
                    </p>
                  </Typography>
                  {entry.detail ? (
                    <Typography variant="bodyXs" colorRole="muted" asChild>
                      <p className="mt-0.5">{entry.detail}</p>
                    </Typography>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {KIND_ORDER.map((kind) => {
          const meta = importKindLabels[kind];
          const forKind = rows.filter((row) => row.kind === kind);
          const committed = forKind.filter((row) => row.status === 'committed');
          const latest = forKind[0];

          return (
            <div
              key={kind}
              className="border-border-primary flex flex-col rounded-xl border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <Typography variant="labelSm">{meta.label}</Typography>
                <Badge
                  size="xs"
                  colorRole={committed.length > 0 ? 'success' : 'warning'}
                >
                  {committed.length > 0 ? 'Received' : 'Awaiting'}
                </Badge>
              </div>
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <p className="mt-1 grow">{meta.description}</p>
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <p className="mt-2">
                  {meta.cadence} ·{' '}
                  {latest
                    ? `latest ${latest.asOfDate} (${latest.rowCount} rows)`
                    : 'nothing uploaded'}
                </p>
              </Typography>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  colorRole="muted"
                  variant="outline"
                  className="grow justify-center"
                  isDisabled={isLocked}
                  onClick={() => setActiveKind(kind)}
                >
                  <IconPlus className="mr-1 size-4" />
                  Upload
                </Button>
                {/* These three are in-house, so they need no spreadsheet */}
                {kind === 'cc_opening' ? (
                  <Button
                    size="sm"
                    colorRole="brand"
                    className="grow justify-center"
                    isDisabled={isLocked || isSyncing}
                    onClick={() => syncReceipts.mutate({ ownerName })}
                  >
                    <IconRefresh className="mr-1 size-4" />
                    {syncReceipts.isPending ? 'Syncing…' : 'Sync receipts'}
                  </Button>
                ) : null}
                {kind === 'cc_sales_to_cd' ? (
                  <div className="flex grow flex-col gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-text-muted text-xs">
                        Zoho customer name
                      </span>
                      <input
                        value={zohoCustomer}
                        onChange={(event) => {
                          setZohoCustomer(event.target.value);
                          window.localStorage.setItem(
                            ZOHO_CUSTOMER_KEY,
                            event.target.value,
                          );
                        }}
                        placeholder="CD General"
                        className="border-border-primary bg-fill-primary text-text-primary min-h-8 rounded-md border px-2 text-sm"
                      />
                    </label>
                    <Button
                      size="sm"
                      colorRole="brand"
                      className="justify-center"
                      isDisabled={isLocked || isSyncing || !zohoCustomer.trim()}
                      onClick={() => syncZoho.mutate({ customerMatch: zohoCustomer })}
                    >
                      <IconRefresh className="mr-1 size-4" />
                      {syncZoho.isPending ? 'Syncing…' : 'Sync Zoho'}
                    </Button>
                  </div>
                ) : null}
                {kind === 'cc_count' ? (
                  <>
                    <Button
                      size="sm"
                      colorRole="brand"
                      className="grow justify-center"
                      isDisabled={isLocked || isSyncing}
                      onClick={() =>
                        syncCount.mutate({ ownerName, periodId })
                      }
                    >
                      <IconRefresh className="mr-1 size-4" />
                      {syncCount.isPending ? 'Syncing…' : 'System'}
                    </Button>
                    <Button
                      size="sm"
                      colorRole="muted"
                      variant="outline"
                      className="grow justify-center"
                      isDisabled={isLocked || isSyncing}
                      onClick={() =>
                        syncCycleCount.mutate({ ownerName, periodId })
                      }
                    >
                      <IconRefresh className="mr-1 size-4" />
                      {syncCycleCount.isPending ? 'Syncing…' : 'Count'}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <Typography variant="headingSm" asChild>
            <h3>Import history</h3>
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="bg-fill-brand size-2 rounded-full" />
                Craft &amp; Culture
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-fill-info size-2 rounded-full" />
                City Drinks
              </span>
              <span>· hover a heading for what it means</span>
            </p>
          </Typography>
        </div>

        {rows.length === 0 ? (
          <Typography variant="bodySm" colorRole="muted">
            No imports yet for this period.
          </Typography>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-text-muted border-border-primary border-b">
                <tr>
                  <th className="py-2 pr-3">Input</th>
                  <th
                    className="py-2 pr-3"
                    title="The date the figures count this data on. For flows it is each line's own document date; for a point-in-time check it is the date it was taken."
                  >
                    As at
                  </th>
                  <th className="py-2 pr-3">File</th>
                  <th
                    className="py-2 pr-3"
                    title="How the source stated its quantities, and the pack sizes used to convert cases to bottles"
                  >
                    Unit
                  </th>
                  <th className="py-2 pr-3 text-right">Rows</th>
                  <th
                    className="py-2 pr-3 text-right"
                    title="Rows resolved to a W code. Unmapped rows are excluded from every figure until they are mapped or set aside on the Mapping tab."
                  >
                    Mapped
                  </th>
                  <th
                    className="py-2 pr-3 text-right"
                    title="What this import contributes, in bottles — mapped rows only"
                  >
                    Bottles
                  </th>
                  <th
                    className="py-2 pr-3"
                    title="Drafts are excluded from the figures until committed"
                  >
                    Status
                  </th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const unmapped = row.rowCount - row.mappedRowCount;

                  return (
                    <Fragment key={row.id}>
                    <tr className="border-border-primary border-b">
                      <td className="max-w-72 py-2 pr-3">
                        <span className="flex items-start gap-2">
                          <span
                            className={`mt-1.5 size-2 shrink-0 rounded-full ${
                              importKindLabels[row.kind].side === 'cc'
                                ? 'bg-fill-brand'
                                : 'bg-fill-info'
                            }`}
                          />
                          <span>
                            {importKindLabels[row.kind].label}
                            <span className="text-text-muted block text-xs">
                              {importKindLabels[row.kind].effect}
                              {importKindLabels[row.kind].behaviour === 'snapshot'
                                ? ' · point in time'
                                : ' · accumulates'}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{row.asOfDate}</td>
                      <td className="text-text-muted py-2 pr-3">
                        {row.fileName ?? row.sourceRef ?? '—'}
                      </td>
                      <td className="py-2 pr-3">
                        {row.unit === 'case' ? 'Cases' : row.unit === 'bottle' ? 'Bottles' : (row.unit ?? '—')}
                        {row.caseConfig ? (
                          <span className="text-text-muted block text-xs">
                            × {row.caseConfig}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {row.rowCount}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {unmapped > 0 ? (
                          <span className="text-text-warning">
                            {row.mappedRowCount} ({unmapped} unmapped)
                          </span>
                        ) : (
                          row.mappedRowCount
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {Math.round(row.totalBottles).toLocaleString('en-GB')}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          size="xs"
                          colorRole={row.status === 'committed' ? 'success' : 'muted'}
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          {row.status === 'draft' ? (
                            <Button
                              size="xs"
                              colorRole={
                                confirmingId === row.id ? 'danger' : 'brand'
                              }
                              isDisabled={isLocked || commitImport.isPending}
                              onClick={() =>
                                commitImport.mutate({
                                  importId: row.id,
                                  acknowledgeDuplicates: confirmingId === row.id,
                                })
                              }
                            >
                              <IconCheck className="mr-1 size-3.5" />
                              {confirmingId === row.id
                                ? 'Commit anyway'
                                : 'Commit'}
                            </Button>
                          ) : null}
                          <Button
                            size="xs"
                            colorRole="muted"
                            variant="outline"
                            isDisabled={isLocked}
                            onClick={() => setEditing(row)}
                          >
                            <IconPencil className="mr-1 size-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            colorRole="danger"
                            variant="ghost"
                            isDisabled={isLocked || deleteImport.isPending}
                            onClick={() => deleteImport.mutate({ importId: row.id })}
                          >
                            <IconTrash className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                      {/* The collisions sit under the row they belong to, so
                          the call is made on the evidence rather than on the
                          warning alone. */}
                      {confirmingId === row.id ? (
                        <tr>
                          <td colSpan={9} className="pb-3">
                            <DuplicatePanel importId={row.id} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportsTab;
