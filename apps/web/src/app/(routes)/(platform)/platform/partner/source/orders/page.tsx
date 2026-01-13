'use client';

import {
  IconChevronRight,
  IconCurrencyDollar,
  IconInbox,
  IconPackage,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import SupplierOrderStatusBadge from '@/app/_source/components/SupplierOrderStatusBadge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { sourceSupplierOrderStatus } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type SupplierOrderStatus = (typeof sourceSupplierOrderStatus.enumValues)[number];

/**
 * Partner Supplier Orders page - list of orders to confirm
 */
const PartnerSupplierOrdersPage = () => {
  const api = useTRPC();
  const [statusFilter, setStatusFilter] = useState<SupplierOrderStatus | 'all'>('all');

  const { data, isLoading } = useQuery({
    ...api.source.partner.supplierOrders.getMany.queryOptions({
      limit: 50,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
  });

  const orders = data?.items ?? [];

  // Count orders needing action
  const pendingCount = orders.filter((o) => o.status === 'sent').length;

  const statusFilters: Array<{ label: string; value: SupplierOrderStatus | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'sent' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Partial', value: 'partial' },
    { label: 'Rejected', value: 'rejected' },
  ];

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-8">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <Typography variant="headingLg" className="text-lg sm:text-xl">
              Supplier Orders
            </Typography>
            <Typography variant="bodySm" colorRole="muted" className="hidden sm:block">
              Confirm and manage orders from Craft & Culture
            </Typography>
          </div>
          {pendingCount > 0 && (
            <div className="self-start sm:self-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                {pendingCount} pending
              </span>
            </div>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? 'default' : 'ghost'}
              colorRole={statusFilter === filter.value ? 'brand' : 'primary'}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
              className="flex-shrink-0"
            >
              <ButtonContent>{filter.label}</ButtonContent>
            </Button>
          ))}
        </div>

        {/* Order List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-fill-muted rounded w-24 mb-3" />
                  <div className="h-5 bg-fill-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-fill-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <IconInbox className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <Typography variant="headingSm" className="mb-2">
                {statusFilter !== 'all' ? 'No matching orders' : 'No orders yet'}
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="max-w-sm mx-auto">
                {statusFilter !== 'all'
                  ? 'Try selecting a different filter above.'
                  : 'When Craft & Culture sends you an order, it will appear here.'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {orders.map((order) => {
              const needsAction = order.status === 'sent';

              return (
                <Link
                  key={order.id}
                  href={`/platform/partner/source/orders/${order.id}`}
                  className="block"
                >
                  <Card
                    className={`hover:border-border-brand transition-all cursor-pointer active:scale-[0.99] ${
                      needsAction ? 'border-l-4 border-l-amber-500' : ''
                    }`}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        {/* Left content */}
                        <div className="flex-1 min-w-0">
                          {/* Status row */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                            <span className="font-mono text-xs text-text-muted">
                              {order.orderNumber}
                            </span>
                            <SupplierOrderStatusBadge status={order.status} />
                          </div>

                          {/* Customer */}
                          <Typography variant="bodyMd" className="font-semibold line-clamp-1 mb-1">
                            {order.customerCompany || 'Customer Order'}
                          </Typography>

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-text-muted">
                            <span className="flex items-center gap-1">
                              <IconPackage className="h-3.5 w-3.5" />
                              {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <IconCurrencyDollar className="h-3.5 w-3.5" />
                              {formatCurrency(order.totalAmountUsd)}
                            </span>
                            {order.sentAt && (
                              <span>
                                {formatDistanceToNow(new Date(order.sentAt), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Chevron */}
                        <IconChevronRight className="h-5 w-5 text-text-muted flex-shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Count */}
        {!isLoading && orders.length > 0 && (
          <Typography variant="bodyXs" colorRole="muted" className="text-center">
            Showing {orders.length} orders
          </Typography>
        )}
      </div>
    </div>
  );
};

export default PartnerSupplierOrdersPage;
