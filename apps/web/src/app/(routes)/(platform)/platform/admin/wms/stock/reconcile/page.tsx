'use client';

import {
  IconAlertTriangle,
  IconCheck,
  IconLoader2,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Stock Reconciliation Page
 * Compares movements vs stock and identifies discrepancies
 */
const ReconcilePage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [deleteReason, setDeleteReason] = useState('Duplicate/orphan stock record from receiving retry');

  const { data, isLoading, refetch } = useQuery({
    ...api.wms.admin.stock.reconcile.queryOptions(),
  });

  const deleteMutation = useMutation({
    ...api.wms.admin.stock.deleteRecord.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wms', 'admin', 'stock'] });
      void refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  const isReconciled = data?.summary.isReconciled;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link href="/platform/admin/wms/stock" className="text-text-muted hover:text-text-primary">
                <Typography variant="bodySm">Stock</Typography>
              </Link>
              <Typography variant="bodySm" colorRole="muted">/</Typography>
              <Typography variant="bodySm">Reconcile</Typography>
            </div>
            <Typography variant="headingLg" className="mb-1">
              Stock Reconciliation
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              Compare movements against stock records to find discrepancies
            </Typography>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <ButtonContent iconLeft={IconRefresh}>Refresh</ButtonContent>
          </Button>
        </div>

        {/* Status Banner */}
        <Card className={isReconciled ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Icon
                icon={isReconciled ? IconCheck : IconAlertTriangle}
                size="lg"
                className={isReconciled ? 'text-emerald-600' : 'text-red-600'}
              />
              <div>
                <Typography variant="headingSm" className={isReconciled ? 'text-emerald-800' : 'text-red-800'}>
                  {isReconciled ? 'Stock is Reconciled' : 'Discrepancy Detected'}
                </Typography>
                <Typography variant="bodySm" className={isReconciled ? 'text-emerald-700' : 'text-red-700'}>
                  {isReconciled
                    ? 'Movement history matches stock records'
                    : `${Math.abs(data?.summary.discrepancy ?? 0)} case${Math.abs(data?.summary.discrepancy ?? 0) !== 1 ? 's' : ''} ${(data?.summary.discrepancy ?? 0) > 0 ? 'over' : 'under'}`}
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-blue-600">
                {data?.summary.movementsReceived}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Cases Received (Movements)
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-amber-600">
                {data?.summary.movementsPicked}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Cases Picked
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-emerald-600">
                {data?.summary.expectedStock}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Expected Stock
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography
                variant="headingLg"
                className={isReconciled ? 'text-emerald-600' : 'text-red-600'}
              >
                {data?.summary.actualStock}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Actual Stock
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Discrepancy */}
        {!isReconciled && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-2 text-red-800">
                Discrepancy: {data?.summary.discrepancy} cases
              </Typography>
              <Typography variant="bodySm" className="text-red-700">
                {(data?.summary.discrepancy ?? 0) > 0
                  ? 'There are more cases in stock than recorded in movements. This usually means duplicate stock records exist.'
                  : 'There are fewer cases in stock than movements show. This could mean stock was deleted without a movement record.'}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Duplicate Groups */}
        {data?.issues.hasDuplicates && (
          <div>
            <Typography variant="headingSm" className="mb-4 text-red-700">
              Duplicate Stock Records
            </Typography>
            <div className="space-y-3">
              {data.issues.duplicateGroups.map((group: { lwin18: string; location_id: string; record_count: number; total_cases: number; stock_ids: string[] }, idx: number) => (
                <Card key={idx} className="border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <Typography variant="bodySm" className="font-mono">
                          {group.lwin18}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {group.record_count} records × {group.total_cases} total cases
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                          IDs: {(group.stock_ids as string[]).join(', ')}
                        </Typography>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Orphan Records */}
        {data?.issues.hasOrphans && (
          <div>
            <Typography variant="headingSm" className="mb-4 text-amber-700">
              Orphan Stock Records (No matching receive movement)
            </Typography>
            <div className="mb-4">
              <label className="block text-sm text-text-muted mb-1">Delete reason:</label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full rounded border border-border-primary px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-3">
              {data.issues.orphanRecords.map((record) => (
                <Card key={record.id} className="border-amber-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <Typography variant="bodySm" className="font-medium">
                          {record.productName}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted" className="font-mono">
                          {record.lwin18}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {record.quantityCases} cases
                        </Typography>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${record.quantityCases} cases of ${record.productName}?`)) {
                            deleteMutation.mutate({
                              stockId: record.id,
                              reason: deleteReason,
                            });
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Good */}
        {isReconciled && !data?.issues.hasDuplicates && !data?.issues.hasOrphans && (
          <Card className="bg-emerald-50">
            <CardContent className="p-8 text-center">
              <Icon icon={IconCheck} size="xl" className="mx-auto mb-4 text-emerald-600" />
              <Typography variant="headingSm" className="mb-2 text-emerald-800">
                Everything Looks Good
              </Typography>
              <Typography variant="bodySm" className="text-emerald-700">
                No discrepancies, duplicates, or orphan records found.
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Manual Comparison - Show when discrepancy but no auto-detected issues */}
        {!isReconciled && !data?.issues.hasOrphans && !data?.issues.hasDuplicates && (
          <div>
            <Typography variant="headingSm" className="mb-4">
              All Stock Records ({data?.allStockRecords?.length ?? 0})
            </Typography>
            <Typography variant="bodySm" colorRole="muted" className="mb-4">
              Compare these with the receive movements below to identify the extra records.
            </Typography>
            <div className="mb-4">
              <label className="block text-sm text-text-muted mb-1">Delete reason:</label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full rounded border border-border-primary px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              {data?.allStockRecords?.map((record) => (
                <Card key={record.id} className="border-border-secondary">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <Typography variant="bodySm" className="font-medium truncate">
                          {record.productName}
                        </Typography>
                        <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                          <span className="font-mono">{record.lwin18}</span>
                          <span>•</span>
                          <span>{record.locationCode}</span>
                          <span>•</span>
                          <span className="font-semibold text-blue-600">{record.quantityCases} cases</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${record.quantityCases} cases of ${record.productName}?`)) {
                            deleteMutation.mutate({
                              stockId: record.id,
                              reason: deleteReason,
                            });
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="border-red-300 text-red-600 hover:bg-red-50 shrink-0"
                      >
                        <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Typography variant="headingSm" className="mb-4 mt-8">
              All Receive Movements ({data?.allReceiveMovements?.length ?? 0})
            </Typography>
            <Typography variant="bodySm" colorRole="muted" className="mb-4">
              These are the source of truth - stock should match these totals.
            </Typography>
            <div className="space-y-2">
              {data?.allReceiveMovements?.map((movement) => (
                <Card key={movement.id} className="border-border-secondary bg-emerald-50/50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <Typography variant="bodySm" className="font-medium truncate">
                          {movement.productName}
                        </Typography>
                        <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                          <span className="font-mono">{movement.lwin18}</span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-600">{movement.quantityCases} cases</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Counts */}
        <Card className="bg-fill-secondary">
          <CardContent className="p-4">
            <Typography variant="bodySm" colorRole="muted">
              {data?.counts.receiveMovements} receive movements • {data?.counts.stockRecords} stock records
            </Typography>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReconcilePage;
