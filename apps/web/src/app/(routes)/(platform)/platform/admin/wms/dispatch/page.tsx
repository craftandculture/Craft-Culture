'use client';

import {
  IconArrowLeft,
  IconChevronRight,
  IconLoader2,
  IconPackageExport,
  IconPlus,
  IconRefresh,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter = 'all' | 'draft' | 'picking' | 'staged' | 'dispatched' | 'delivered';

/**
 * WMS Dispatch Batches - Batch orders for dispatch to distributors
 */
const WMSDispatchBatchesPage = () => {
  const api = useTRPC();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('draft');

  const { data, isLoading, refetch } = useQuery({
    ...api.wms.admin.dispatch.getMany.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: 50,
      offset: 0,
    }),
  });

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: 'draft', label: 'Draft' },
    { id: 'picking', label: 'Picking' },
    { id: 'staged', label: 'Staged' },
    { id: 'dispatched', label: 'Dispatched' },
    { id: 'all', label: 'All' },
  ];

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
      picking: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      staged: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      dispatched: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      delivered: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    };
    const labels: Record<string, string> = {
      draft: 'Draft',
      picking: 'Picking',
      staged: 'Staged',
      dispatched: 'Dispatched',
      delivered: 'Delivered',
    };
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-fill-secondary text-text-muted'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="container mx-auto max-w-lg px-4 py-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link
            href="/platform/admin/wms"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary"
          >
            <IconArrowLeft className="h-6 w-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <Typography variant="headingLg" className="mb-1">
              Dispatch
            </Typography>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <Icon icon={IconRefresh} size="sm" />
              </Button>
              <Link href="/platform/admin/wms/dispatch/new">
                <Button variant="default" size="sm">
                  <ButtonContent iconLeft={IconPlus}>New</ButtonContent>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg" className="text-gray-600">
                  {data.summary.draftCount}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Draft
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg" className="text-blue-600">
                  {data.summary.pickingCount}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Picking
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg" className="text-amber-600">
                  {data.summary.stagedCount}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Staged
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingMd">{data.pagination.total}</Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Total Batches
                </Typography>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-fill-secondary p-1">
          {statusFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === filter.id
                  ? 'bg-fill-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
          </div>
        )}

        {/* Batches List */}
        {!isLoading && data && (
          <div className="space-y-3">
            {data.batches.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Icon icon={IconPackageExport} size="xl" colorRole="muted" className="mx-auto mb-4" />
                  <Typography variant="headingSm" className="mb-2">
                    No Dispatch Batches
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {statusFilter === 'draft'
                      ? 'Create a new batch to start batching orders'
                      : 'No batches match this filter'}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              data.batches.map((batch) => (
                <Link key={batch.id} href={`/platform/admin/wms/dispatch/${batch.id}`}>
                  <Card className="transition-shadow hover:shadow-md hover:border-border-brand">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fill-brand/10">
                            <Icon icon={IconTruck} size="md" className="text-text-brand" />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <Typography variant="bodySm" className="font-semibold">
                                {batch.batchNumber}
                              </Typography>
                              {getStatusBadge(batch.status ?? 'draft')}
                            </div>
                            <Typography variant="bodyXs" colorRole="muted">
                              {batch.distributorName}
                            </Typography>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <Typography variant="bodySm" className="font-semibold">
                              {batch.orderCount}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              orders
                            </Typography>
                          </div>
                          <div className="text-right">
                            <Typography variant="bodySm" className="font-semibold">
                              {batch.totalCases}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              cases
                            </Typography>
                          </div>
                          <IconChevronRight className="h-5 w-5 text-text-muted" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}

            {/* Pagination */}
            {data.pagination.total > 0 && (
              <Typography variant="bodyXs" colorRole="muted" className="text-center">
                Showing {data.batches.length} of {data.pagination.total} batches
              </Typography>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSDispatchBatchesPage;
