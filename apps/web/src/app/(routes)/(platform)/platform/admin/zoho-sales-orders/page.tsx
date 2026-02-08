'use client';

import {
  IconChevronRight,
  IconCloudDownload,
  IconLoader2,
  IconPackage,
  IconRefresh,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

type StatusFilter =
  | 'all'
  | 'ready'
  | 'pending'
  | 'picking'
  | 'picked'
  | 'dispatched'
  | 'delivered';

/**
 * Admin page for managing Zoho Sales Orders
 *
 * Displays synced sales orders from Zoho Books.
 * Allows release to pick for invoiced orders (buffered from changes).
 */
const ZohoSalesOrdersPage = () => {
  const api = useTRPC();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ready');

  const { data, isLoading, refetch, isFetching } = useQuery({
    ...api.zohoSalesOrders.list.queryOptions(),
    staleTime: 0,
    refetchInterval: 30000,
  });

  const { mutate: releaseToPick, isPending: isReleasing } = useMutation(
    api.zohoSalesOrders.releaseToPick.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to release to pick');
      },
    }),
  );

  const { mutate: syncOrders, isPending: isSyncing } = useMutation(
    api.zohoSalesOrders.sync.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to sync from Zoho');
      },
    }),
  );

  const orders = data ?? [];

  // Filter orders by status
  // 'ready' = invoiced in Zoho and synced (ready to release)
  // 'pending' = open in Zoho (awaiting invoice)
  const filteredOrders = (() => {
    switch (statusFilter) {
      case 'ready':
        return orders.filter((o) => o.status === 'synced' && o.zohoStatus === 'invoiced');
      case 'pending':
        return orders.filter((o) => o.status === 'synced' && o.zohoStatus !== 'invoiced');
      case 'all':
        return orders;
      default:
        return orders.filter((o) => o.status === statusFilter);
    }
  })();

  // Count orders by status for summary
  const statusCounts = {
    ready: orders.filter((o) => o.status === 'synced' && o.zohoStatus === 'invoiced').length,
    pending: orders.filter((o) => o.status === 'synced' && o.zohoStatus !== 'invoiced').length,
    picking: orders.filter((o) => o.status === 'picking').length,
    picked: orders.filter((o) => o.status === 'picked').length,
    dispatched: orders.filter((o) => o.status === 'dispatched').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  };

  const statusFilters: { id: StatusFilter; label: string; count?: number }[] = [
    { id: 'ready', label: 'Ready for Release', count: statusCounts.ready },
    { id: 'pending', label: 'Pending Invoice', count: statusCounts.pending },
    { id: 'picking', label: 'Picking', count: statusCounts.picking },
    { id: 'picked', label: 'Picked', count: statusCounts.picked },
    { id: 'dispatched', label: 'Dispatched', count: statusCounts.dispatched },
    { id: 'all', label: 'All' },
  ];

  const getStatusBadge = (order: { status: string | null; zohoStatus: string }) => {
    // For synced orders, show whether they're ready (invoiced) or pending
    if (order.status === 'synced') {
      if (order.zohoStatus === 'invoiced') {
        return (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
            Ready for Release
          </span>
        );
      }
      return (
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Pending Invoice
        </span>
      );
    }

    const colors: Record<string, string> = {
      picking:
        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      picked:
        'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
      dispatched:
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      delivered:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      cancelled:
        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    const labels: Record<string, string> = {
      picking: 'Picking',
      picked: 'Picked',
      dispatched: 'Dispatched',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };
    return (
      <span
        className={`rounded px-2 py-0.5 text-xs font-medium ${colors[order.status ?? ''] || 'bg-fill-secondary text-text-muted'}`}
      >
        {labels[order.status ?? ''] || order.status}
      </span>
    );
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleReleaseToPick = (salesOrderId: string) => {
    releaseToPick({ salesOrderId });
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link
                href="/platform/admin"
                className="text-text-muted hover:text-text-primary"
              >
                <Typography variant="bodySm">Admin</Typography>
              </Link>
              <IconChevronRight className="h-4 w-4 text-text-muted" />
              <Typography variant="bodySm">Zoho Sales Orders</Typography>
            </div>
            <Typography variant="headingLg" className="mb-1">
              Zoho Sales Orders
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              Manage synced sales orders from Zoho Books
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncOrders()}
              disabled={isSyncing}
            >
              <ButtonContent iconLeft={isSyncing ? IconLoader2 : IconCloudDownload}>
                {isSyncing ? 'Syncing...' : 'Sync from Zoho'}
              </ButtonContent>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <ButtonContent iconLeft={IconRefresh}>
                {isFetching ? 'Refreshing...' : 'Refresh'}
              </ButtonContent>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-emerald-600">
                {statusCounts.ready}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Ready for Release
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-amber-600">
                {statusCounts.pending}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Pending Invoice
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-purple-600">
                {statusCounts.picking}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Picking
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-cyan-600">
                {statusCounts.picked}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Picked
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-indigo-600">
                {statusCounts.dispatched}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Dispatched
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-emerald-600">
                {statusCounts.delivered}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Delivered
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-fill-secondary p-1">
          {statusFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`flex-shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === filter.id
                  ? 'bg-fill-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {filter.label}
              {filter.count !== undefined && filter.count > 0 && (
                <span className="ml-1 text-xs opacity-70">({filter.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Info Banner for Ready for Release */}
        {statusFilter === 'ready' && filteredOrders.length > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20">
            <Typography variant="bodySm" className="text-emerald-800 dark:text-emerald-200">
              These orders are invoiced in Zoho and ready to be released to the warehouse for picking.
            </Typography>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Icon
              icon={IconLoader2}
              className="animate-spin"
              colorRole="muted"
              size="lg"
            />
          </div>
        )}

        {/* Orders List */}
        {!isLoading && (
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Icon
                    icon={IconPackage}
                    size="xl"
                    colorRole="muted"
                    className="mx-auto mb-4"
                  />
                  <Typography variant="headingSm" className="mb-2">
                    No Orders
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {statusFilter === 'ready'
                      ? 'No orders ready for release'
                      : statusFilter === 'pending'
                        ? 'No orders pending invoice'
                        : `No ${statusFilter} orders found`}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              filteredOrders.map((order) => (
                <Card
                  key={order.id}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Order Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Typography variant="bodySm" className="font-semibold">
                            {order.salesOrderNumber}
                          </Typography>
                          {getStatusBadge(order)}
                          {order.referenceNumber && (
                            <Typography variant="bodyXs" colorRole="muted">
                              Ref: {order.referenceNumber}
                            </Typography>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <Typography variant="bodyXs">
                            <span className="text-text-muted">Customer:</span>{' '}
                            {order.customerName}
                          </Typography>
                          <Typography variant="bodyXs">
                            <span className="text-text-muted">Date:</span>{' '}
                            {formatDate(order.orderDate)}
                          </Typography>
                          <Typography variant="bodyXs">
                            <span className="text-text-muted">Items:</span>{' '}
                            {order.itemCount} ({order.totalQuantity} cases)
                          </Typography>
                          <Typography variant="bodyXs" className="font-semibold">
                            {formatPrice(order.total, order.currencyCode ?? 'USD')}
                          </Typography>
                        </div>

                        {order.notes && (
                          <Typography variant="bodyXs" colorRole="muted">
                            {order.notes}
                          </Typography>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {/* Release to Pick button for invoiced orders */}
                        {order.status === 'synced' && order.zohoStatus === 'invoiced' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleReleaseToPick(order.id)}
                            disabled={isReleasing}
                          >
                            <ButtonContent iconLeft={isReleasing ? IconLoader2 : IconTruckDelivery}>
                              Release to Pick
                            </ButtonContent>
                          </Button>
                        )}
                        {order.pickListId && (
                          <Link href={`/platform/admin/wms/pick/${order.pickListId}`}>
                            <Button variant="ghost" size="sm">
                              <ButtonContent iconRight={IconChevronRight}>
                                View Pick List
                              </ButtonContent>
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Count */}
            {filteredOrders.length > 0 && (
              <Typography variant="bodyXs" colorRole="muted" className="text-center">
                Showing {filteredOrders.length} order
                {filteredOrders.length !== 1 ? 's' : ''}
              </Typography>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ZohoSalesOrdersPage;
