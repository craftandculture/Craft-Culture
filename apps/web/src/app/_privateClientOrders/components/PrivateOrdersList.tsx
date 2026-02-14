'use client';

import {
  IconDots,
  IconEye,
  IconFileText,
  IconPlus,
  IconSearch,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import DataTable from '@/app/_ui/components/DataTable/DataTable';
import DropdownMenu from '@/app/_ui/components/DropdownMenu/DropdownMenu';
import DropdownMenuContent from '@/app/_ui/components/DropdownMenu/DropdownMenuContent';
import DropdownMenuItem from '@/app/_ui/components/DropdownMenu/DropdownMenuItem';
import DropdownMenuTrigger from '@/app/_ui/components/DropdownMenu/DropdownMenuTrigger';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientOrder } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

import PrivateOrderStatusBadge from './PrivateOrderStatusBadge';

type Currency = 'USD' | 'AED';

type OrderWithDistributor = PrivateClientOrder & {
  distributor: { id: string; businessName: string } | null;
  client: { id: string; cityDrinksVerifiedAt: Date | null } | null;
};

type StatusFilter = 'all' | 'draft' | 'pending' | 'active' | 'completed';

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Orders' },
  { value: 'draft', label: 'Drafts' },
  { value: 'pending', label: 'Pending Approval' },
  { value: 'active', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

/**
 * PrivateOrdersList displays a table of private client orders
 * with search, filter, and action capabilities
 */
const PrivateOrdersList = () => {
  const trpcClient = useTRPCClient();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['privateClientOrders.getMany', { limit: 20, cursor, search: search || undefined }],
    queryFn: () =>
      trpcClient.privateClientOrders.getMany.query({
        limit: 20,
        cursor,
        search: search || undefined,
      }),
  });

  const allOrders = data?.data ?? [];
  const totalCount = data?.meta?.totalCount ?? 0;
  const hasMore = data?.meta?.hasMore ?? false;

  // Filter orders by status category
  const filterByStatus = (orders: OrderWithDistributor[], filter: StatusFilter) => {
    if (filter === 'all') return orders;

    const statusCategories: Record<StatusFilter, string[]> = {
      all: [],
      draft: ['draft'],
      pending: ['submitted', 'under_cc_review', 'revision_requested'],
      active: ['cc_approved', 'awaiting_client_payment', 'client_paid', 'awaiting_distributor_payment', 'distributor_paid', 'stock_in_transit', 'with_distributor', 'out_for_delivery'],
      completed: ['delivered', 'cancelled'],
    };

    return orders.filter((order) => statusCategories[filter].includes(order.status));
  };

  const orders = filterByStatus(allOrders, statusFilter);

  const formatCurrencyValue = (order: OrderWithDistributor) => {
    const amount = currency === 'USD' ? (order.totalUsd ?? 0) : (order.totalAed ?? 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const columns: ColumnDef<OrderWithDistributor>[] = [
    {
      accessorKey: 'orderNumber',
      header: 'Order #',
      cell: ({ row }) => (
        <Typography variant="bodySm" className="font-mono font-medium">
          {row.original.orderNumber}
        </Typography>
      ),
    },
    {
      accessorKey: 'clientName',
      header: 'Client',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <Typography variant="bodySm" className="font-medium">
              {row.original.clientName}
            </Typography>
            {row.original.client?.cityDrinksVerifiedAt && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                title="City Drinks Verified"
              >
                <Icon icon={IconShieldCheck} size="xs" />
                <span className="text-xs font-medium">Verified</span>
              </span>
            )}
          </div>
          {row.original.clientEmail && (
            <Typography variant="bodyXs" colorRole="muted">
              {row.original.clientEmail}
            </Typography>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'itemCount',
      header: 'Items',
      cell: ({ row }) => (
        <Typography variant="bodySm">
          {row.original.itemCount} items ({row.original.caseCount} cases)
        </Typography>
      ),
    },
    {
      accessorKey: 'total',
      header: () => <span>Total ({currency})</span>,
      cell: ({ row }) => (
        <Typography variant="bodySm" className="font-medium">
          {formatCurrencyValue(row.original)}
        </Typography>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <PrivateOrderStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <Typography variant="bodyXs" colorRole="muted">
          {format(new Date(row.original.createdAt), 'MMM d, yyyy')}
        </Typography>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Icon icon={IconDots} size="sm" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/platform/private-orders/${row.original.id}`}>
                <Icon icon={IconEye} size="sm" className="mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Status Filter Tabs */}
      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {statusFilters.map((filter) => {
          const count = filterByStatus(allOrders, filter.value).length;
          const isActive = statusFilter === filter.value;

          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-fill-brand text-white'
                  : 'bg-surface-secondary/50 text-text-muted hover:bg-surface-secondary hover:text-text-primary'
              }`}
            >
              {filter.label}
              <Badge
                size="sm"
                colorRole={isActive ? 'brand' : 'muted'}
                className={isActive ? 'bg-white/20 text-white' : ''}
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Header with search, currency toggle, and new order button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Icon
            icon={IconSearch}
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCursor(0);
            }}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Currency Toggle */}
          <div className="inline-flex items-center rounded-lg border border-border-muted bg-surface-secondary/50 p-0.5">
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                currency === 'USD'
                  ? 'bg-background-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              USD
            </button>
            <button
              type="button"
              onClick={() => setCurrency('AED')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                currency === 'AED'
                  ? 'bg-background-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              AED
            </button>
          </div>

          <Button variant="default" colorRole="brand" asChild>
            <Link href="/platform/private-orders/new">
              <ButtonContent iconLeft={IconPlus}>New Order</ButtonContent>
            </Link>
          </Button>
        </div>
      </div>

      {/* Orders table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Typography variant="bodySm" colorRole="muted">
            Loading orders...
          </Typography>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border-muted bg-surface-secondary/30 py-12">
          <Icon icon={IconFileText} size="lg" className="text-text-muted" />
          <div className="text-center">
            <Typography variant="bodySm" className="font-medium">
              No orders yet
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Create your first private client order to get started
            </Typography>
          </div>
          <Button variant="default" colorRole="brand" asChild>
            <Link href="/platform/private-orders/new">
              <ButtonContent iconLeft={IconPlus}>Create Order</ButtonContent>
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable columns={columns} data={orders} />
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col divide-y divide-border-muted rounded-lg border border-border-muted md:hidden">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/platform/private-orders/${order.id}`}
                className="flex flex-col gap-2 p-4 transition-colors hover:bg-surface-secondary/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Typography variant="bodySm" className="font-mono font-medium">
                      {order.orderNumber}
                    </Typography>
                  </div>
                  <PrivateOrderStatusBadge status={order.status} />
                </div>
                <div className="flex items-center gap-1.5">
                  <Typography variant="bodySm" className="font-medium">
                    {order.clientName}
                  </Typography>
                  {order.client?.cityDrinksVerifiedAt && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Icon icon={IconShieldCheck} size="xs" />
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Typography variant="bodyXs" colorRole="muted">
                    {order.itemCount} items · {order.caseCount} cases
                  </Typography>
                  <Typography variant="bodySm" className="font-semibold">
                    {formatCurrencyValue(order)}
                  </Typography>
                </div>
                <Typography variant="bodyXs" colorRole="muted">
                  {format(new Date(order.createdAt), 'MMM d, yyyy')}
                </Typography>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <Typography variant="bodyXs" colorRole="muted">
              Showing {cursor + 1}-{Math.min(cursor + orders.length, totalCount)} of {totalCount}
            </Typography>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setCursor(Math.max(0, cursor - 20))}
                disabled={cursor === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setCursor(cursor + 20)}
                disabled={!hasMore}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PrivateOrdersList;
