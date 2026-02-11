'use client';

import {
  IconArrowLeft,
  IconChevronRight,
  IconClipboardList,
  IconLoader2,
  IconPlus,
  IconRefresh,
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

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

/**
 * WMS Pick Lists - List and manage order pick lists
 */
const WMSPickListsPage = () => {
  const api = useTRPC();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  const { data, isLoading, refetch } = useQuery({
    ...api.wms.admin.picking.getMany.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: 50,
      offset: 0,
    }),
  });

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'all', label: 'All' },
  ];

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    const labels: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
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
              Pick Lists
            </Typography>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <Icon icon={IconRefresh} size="sm" />
              </Button>
              <Link href="/platform/admin/wms/pick/new">
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
                <Typography variant="headingLg" className="text-amber-600">
                  {data.summary.pendingCount}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Pending
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg" className="text-blue-600">
                  {data.summary.inProgressCount}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  In Progress
                </Typography>
              </CardContent>
            </Card>
            {data.summary.byStatus
              .filter((s) => s.status !== 'pending' && s.status !== 'in_progress')
              .map((stat) => (
                <Card key={stat.status}>
                  <CardContent className="p-4 text-center">
                    <Typography variant="headingMd">{stat.count}</Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      {stat.status === 'completed' ? 'Completed' : stat.status}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-1 rounded-lg bg-fill-secondary p-1">
          {statusFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === filter.id
                  ? 'bg-fill-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {filter.label}
              {filter.id === 'pending' && data?.summary?.pendingCount ? (
                <span className="ml-1 text-amber-600">({data.summary.pendingCount})</span>
              ) : null}
              {filter.id === 'in_progress' && data?.summary?.inProgressCount ? (
                <span className="ml-1 text-blue-600">({data.summary.inProgressCount})</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
          </div>
        )}

        {/* Pick Lists */}
        {!isLoading && data && (
          <div className="space-y-3">
            {data.pickLists.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Icon icon={IconClipboardList} size="xl" colorRole="muted" className="mx-auto mb-4" />
                  <Typography variant="headingSm" className="mb-2">
                    No Pick Lists
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {statusFilter === 'pending'
                      ? 'No pending pick lists to process'
                      : 'No pick lists match this filter'}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              data.pickLists.map((pickList) => (
                <Link key={pickList.id} href={`/platform/admin/wms/pick/${pickList.id}`}>
                  <Card className="transition-shadow hover:shadow-md hover:border-border-brand">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <Typography variant="bodySm" className="font-semibold">
                              {pickList.pickListNumber}
                            </Typography>
                            {getStatusBadge(pickList.status ?? 'pending')}
                          </div>
                          <Typography variant="bodyXs" colorRole="muted">
                            Order: {pickList.orderNumber}
                          </Typography>
                          <div className="mt-2 flex items-center gap-4">
                            <Typography variant="bodyXs">
                              {pickList.pickedItems}/{pickList.totalItems} items picked
                            </Typography>
                            {pickList.assignedToName && (
                              <Typography variant="bodyXs" colorRole="muted">
                                Assigned to: {pickList.assignedToName}
                              </Typography>
                            )}
                          </div>
                          {/* Progress bar */}
                          <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-fill-secondary">
                            <div
                              className="h-1.5 rounded-full bg-brand-600"
                              style={{
                                width: `${pickList.totalItems > 0 ? (pickList.pickedItems / pickList.totalItems) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                        <IconChevronRight className="h-5 w-5 text-text-muted" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}

            {/* Pagination */}
            {data.pagination.total > 0 && (
              <Typography variant="bodyXs" colorRole="muted" className="text-center">
                Showing {data.pickLists.length} of {data.pagination.total} pick lists
              </Typography>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSPickListsPage;
