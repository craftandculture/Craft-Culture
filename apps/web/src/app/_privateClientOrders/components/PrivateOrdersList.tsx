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
import { useSearchParams } from 'next/navigation';
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
import USD_TO_AED from '@/lib/currency/usdToAed';
import { useTRPCClient } from '@/lib/trpc/browser';

import PrivateOrderStatusBadge from './PrivateOrderStatusBadge';
import formatSubscriptionBox from '../utils/formatSubscriptionBox';
import type { PartnerOrder } from '../utils/partnerOrderView';

type Currency = 'USD' | 'AED';

type OrderWithDistributor = PartnerOrder & {
  distributor: { id: string; businessName: string } | null;
  client: { id: string; cityDrinksVerifiedAt: Date | null } | null;
};

type StatusFilter = 'all' | 'action' | 'draft' | 'pending' | 'active' | 'completed';

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All orders' },
  { value: 'action', label: 'Needs your action' },
  { value: 'draft', label: 'Drafts' },
  { value: 'pending', label: 'In review' },
  { value: 'active', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

/** Statuses that wait on the partner: send a draft, accept changes, confirm or re-verify the client */
const NEEDS_PARTNER_ACTION = [
  'draft',
  'revision_requested',
  'awaiting_partner_verification',
  'verification_suspended',
];

/*
  The tabs sort the orders already loaded, so the page loads the most the
  list endpoint allows. With 20 a page, a tab counted only the newest 20.
*/
const PAGE_SIZE = 100;

/**
 * PrivateOrdersList displays a table of private client orders
 * with search, filter, and action capabilities
 */
const PrivateOrdersList = () => {
  const trpcClient = useTRPCClient();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  const [currency, setCurrency] = useState<Currency>('USD');
  const searchParams = useSearchParams();

  /*
    The dashboard's pipeline links here with ?status=<stage>. The list was
    ignoring it and opening on All, so every tile showed every order.
  */
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const stage = searchParams.get('status');
    if (stage === 'action' || stage === 'draft' || stage === 'pending' || stage === 'completed') return stage;
    if (stage === 'verification' || stage === 'payment' || stage === 'fulfillment') return 'active';
    return 'all';
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['privateClientOrders.getMany', { limit: PAGE_SIZE, cursor, search: search || undefined }],
    queryFn: () =>
      trpcClient.privateClientOrders.getMany.query({
        limit: PAGE_SIZE,
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
    if (filter === 'action') return orders.filter((order) => NEEDS_PARTNER_ACTION.includes(order.status));

    const statusCategories: Record<Exclude<StatusFilter, 'all' | 'active' | 'action'>, string[]> = {
      draft: ['draft'],
      pending: ['submitted', 'under_cc_review', 'revision_requested'],
      completed: ['delivered', 'cancelled'],
    };

    // In progress is everything still live, so no status can fall between the tabs
    if (filter === 'active') {
      const notLive = Object.values(statusCategories).flat();
      return orders.filter((order) => !notLive.includes(order.status));
    }

    return orders.filter((order) => statusCategories[filter].includes(order.status));
  };

  const orders = filterByStatus(allOrders, statusFilter);

  const formatCurrencyValue = (order: OrderWithDistributor) => {
    const amount = currency === 'USD' ? (order.totalUsd ?? 0) : (order.totalUsd ?? 0) * USD_TO_AED;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  /*
    The stored case count adds single bottles to cases, so it is shown as
    units (a case or a bottle) rather than called "cases".
  */
  const describeUnits = (order: OrderWithDistributor) => {
    const units = order.caseCount ?? 0;
    const lines = order.itemCount ?? 0;
    return `${lines} ${lines === 1 ? 'wine' : 'wines'} · ${units} ${units === 1 ? 'unit' : 'units'}`;
  };

  const columns: ColumnDef<OrderWithDistributor>[] = [
    {
      accessorKey: 'orderNumber',
      header: 'Order',
      cell: ({ row }) => (
        <Link
          href={`/platform/private-orders/${row.original.id}`}
          className="font-mono text-sm font-medium underline-offset-2 hover:underline"
        >
          {row.original.orderNumber}
        </Link>
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
                title="Client verified with the distributor"
              >
                <Icon icon={IconShieldCheck} size="xs" />
                <span className="text-xs font-medium">Verified</span>
              </span>
            )}
            {formatSubscriptionBox(row.original) && (
              <span className="rounded-full bg-text-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-text-primary">
                {formatSubscriptionBox(row.original)}
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
      header: 'Wines',
      cell: ({ row }) => (
        <Typography variant="bodySm" title="Units are cases or single bottles">
          {describeUnits(row.original)}
        </Typography>
      ),
    },
    {
      accessorKey: 'total',
      header: () => <span>Client price ({currency})</span>,
      cell: ({ row }) => (
        <Typography variant="bodySm" className="font-medium tabular-nums">
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
          {format(new Date(row.original.createdAt), 'd MMM yyyy')}
        </Typography>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" aria-label={`Actions for ${row.original.orderNumber}`}>
              <Icon icon={IconDots} size="sm" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/platform/private-orders/${row.original.id}`}>
                <Icon icon={IconEye} size="sm" className="mr-2" />
                View details
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
          // Waiting on the partner reads amber when there is something in it
          const isUrgent = filter.value === 'action' && count > 0 && !isActive;

          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              aria-pressed={isActive}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-text-primary text-surface-primary'
                  : isUrgent
                    ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900/50'
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
            aria-label="Search orders"
            placeholder="Search by order number, client or email"
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
          <div
            role="group"
            aria-label="Display currency"
            className="inline-flex items-center rounded-lg border border-border-muted bg-surface-secondary/50 p-0.5"
          >
            <button
              type="button"
              aria-pressed={currency === 'USD'}
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
              aria-pressed={currency === 'AED'}
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
              <ButtonContent iconLeft={IconPlus}>New order</ButtonContent>
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
      ) : isError && !data ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border-muted bg-surface-secondary/30 py-12">
          <Typography variant="bodySm" className="font-medium">
            Your orders could not be loaded
          </Typography>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : orders.length === 0 ? (
        allOrders.length > 0 || search ? (
          // Orders exist, but none in this tab or search: say so, and offer the way back
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border-muted bg-surface-secondary/30 py-12 text-center">
            <Typography variant="bodySm" className="font-medium">
              {statusFilter === 'action'
                ? 'Nothing needs your action'
                : search
                  ? 'No orders match this search'
                  : 'No orders in this view'}
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              {statusFilter === 'action'
                ? 'Orders waiting on you will appear here.'
                : 'Try another tab or clear the search.'}
            </Typography>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setSearch('');
                setCursor(0);
              }}
            >
              Show all orders
            </Button>
          </div>
        ) : (
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
                <ButtonContent iconLeft={IconPlus}>Create order</ButtonContent>
              </Link>
            </Button>
          </div>
        )
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
                <div className="flex items-start justify-between gap-2">
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
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      title="Client verified with the distributor"
                      aria-label="Client verified"
                    >
                      <Icon icon={IconShieldCheck} size="xs" />
                    </span>
                  )}
                  {formatSubscriptionBox(order) && (
                    <span className="rounded-full bg-text-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-text-primary">
                      {formatSubscriptionBox(order)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Typography variant="bodyXs" colorRole="muted">
                    {describeUnits(order)}
                  </Typography>
                  <Typography variant="bodySm" className="font-semibold tabular-nums">
                    {formatCurrencyValue(order)}
                  </Typography>
                </div>
                <Typography variant="bodyXs" colorRole="muted">
                  {format(new Date(order.createdAt), 'd MMM yyyy')}
                </Typography>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Typography variant="bodyXs" colorRole="muted">
              {statusFilter === 'all'
                ? `Showing ${cursor + 1}–${cursor + allOrders.length} of ${totalCount}`
                : `${orders.length} shown from orders ${cursor + 1}–${cursor + allOrders.length} of ${totalCount}`}
            </Typography>
            {(cursor > 0 || hasMore) && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setCursor(Math.max(0, cursor - PAGE_SIZE))}
                  disabled={cursor === 0}
                  isDisabled={cursor === 0}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setCursor(cursor + PAGE_SIZE)}
                  disabled={!hasMore}
                  isDisabled={!hasMore}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PrivateOrdersList;
