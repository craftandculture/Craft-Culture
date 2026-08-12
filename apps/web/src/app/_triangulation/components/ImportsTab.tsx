'use client';

import {
  IconCheck,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import EditImportPanel from './EditImportPanel';
import ImportWizard from './ImportWizard';
import type { TriImportRow } from '../controller/adminGetImports';
import type { TriImportKind } from '../schemas/triangulationSchemas';
import importKindLabels from '../utils/importKindLabels';


export interface ImportsTabProps {
  periodId: string | null;
  periodEnd: string | null;
  isLocked: boolean;
}

/** Where the Zoho customer name for City Drinks is remembered between visits */
const ZOHO_CUSTOMER_KEY = 'triangulation.zohoCustomer';

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
  // City Drinks trade in Zoho under a different name, and that is the sort of
  // thing that changes, so it is editable and remembered rather than compiled in.
  const [zohoCustomer, setZohoCustomer] = useState('CD General');

  useEffect(() => {
    const stored = window.localStorage.getItem(ZOHO_CUSTOMER_KEY);

    if (stored) {
      setZohoCustomer(stored);
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

      toast.success(
        unmapped > 0
          ? `Committed — ${unmapped} unmapped rows are excluded from the figures`
          : 'Committed to the reconciliation',
      );
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
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

      toast.success(
        `Synced ${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles from the WMS as at ${result.asOfDate}` +
          (warnings.length > 0 ? ` — ${warnings.join('; ')}` : ''),
      );
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const syncReceipts = useMutation({
    ...api.triangulation.admin.syncReceiptsFromWms.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        `Synced ${result.receipts} WMS receipts — ${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles`,
      );
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const syncZoho = useMutation({
    ...api.triangulation.admin.syncSalesFromZoho.mutationOptions(),
    onSuccess: async (result) => {
      toast.success(
        `Synced ${result.orderLines} Zoho lines — ${Math.round(result.totalBottles).toLocaleString('en-GB')} bottles` +
          (result.unknownPack > 0
            ? `; ${result.unknownPack} with no stated pack size, using the SKU's`
            : ''),
      );
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const syncCycleCount = useMutation({
    ...api.triangulation.admin.syncCycleCountFromWms.mutationOptions(),
    onSuccess: async (result) => {
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
    await syncReceipts.mutateAsync({ ownerName: 'Crurated' }).catch(() => null);
    await syncZoho.mutateAsync({ customerMatch: zohoCustomer }).catch(() => null);
    await syncCount
      .mutateAsync({ ownerName: 'Crurated', periodId })
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
            <p className="mt-1 max-w-2xl">
              WMS receipts, Zoho sales and the WMS stock position are read
              straight from our own systems — no spreadsheets. Each line keeps
              its own date, so a closed period stays put; refreshing only brings
              in what has happened since.
            </p>
          </Typography>
        </div>
        <Button
          colorRole="brand"
          isDisabled={isLocked || isSyncing}
          onClick={() => void refreshLive()}
        >
          <IconRefresh className="mr-1 size-4" />
          {isSyncing ? 'Refreshing…' : 'Refresh live data'}
        </Button>
      </div>

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
                    onClick={() => syncReceipts.mutate({ ownerName: 'Crurated' })}
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
                        syncCount.mutate({ ownerName: 'Crurated', periodId })
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
                        syncCycleCount.mutate({ ownerName: 'Crurated', periodId })
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
        <Typography variant="headingSm" asChild>
          <h3 className="mb-3">Import history</h3>
        </Typography>

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
                  <th className="py-2 pr-3">As at</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Unit</th>
                  <th className="py-2 pr-3 text-right">Rows</th>
                  <th className="py-2 pr-3 text-right">Mapped</th>
                  <th className="py-2 pr-3 text-right">Bottles</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const unmapped = row.rowCount - row.mappedRowCount;

                  return (
                    <tr key={row.id} className="border-border-primary border-b">
                      <td className="py-2 pr-3">{importKindLabels[row.kind].label}</td>
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
                              colorRole="brand"
                              isDisabled={isLocked || commitImport.isPending}
                              onClick={() =>
                                commitImport.mutate({ importId: row.id })
                              }
                            >
                              <IconCheck className="mr-1 size-3.5" />
                              Commit
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
