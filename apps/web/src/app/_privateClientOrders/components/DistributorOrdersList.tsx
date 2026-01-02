'use client';

import {
  IconBuilding,
  IconCheck,
  IconDeviceMobile,
  IconDots,
  IconEye,
  IconPackage,
  IconSearch,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import DataTable from '@/app/_ui/components/DataTable/DataTable';
import DropdownMenu from '@/app/_ui/components/DropdownMenu/DropdownMenu';
import DropdownMenuContent from '@/app/_ui/components/DropdownMenu/DropdownMenuContent';
import DropdownMenuItem from '@/app/_ui/components/DropdownMenu/DropdownMenuItem';
import DropdownMenuSeparator from '@/app/_ui/components/DropdownMenu/DropdownMenuSeparator';
import DropdownMenuTrigger from '@/app/_ui/components/DropdownMenu/DropdownMenuTrigger';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientOrder } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

import PrivateOrderStatusBadge from './PrivateOrderStatusBadge';

type Currency = 'USD' | 'AED';

/** Default UAE exchange rate for AED/USD conversion */
const DEFAULT_EXCHANGE_RATE = 3.67;

type OrderWithPartner = PrivateClientOrder & {
  partner: { id: string; businessName: string; logoUrl: string | null } | null;
};

type StatusFilter = 'all' | 'pending_payment' | 'in_transit' | 'ready_delivery' | 'delivered';

const statusFilters: { value: StatusFilter; label: string; count?: number }[] = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'ready_delivery', label: 'Ready for Delivery' },
  { value: 'delivered', label: 'Delivered' },
];

/**
 * DistributorOrdersList displays a table of assigned orders
 * for distributors with action capabilities
 */
const DistributorOrdersList = () => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  const [currency, setCurrency] = useState<Currency>('AED');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading } = useQuery({
    queryKey: [
      'privateClientOrders.distributorGetMany',
      { limit: 20, cursor, search: search || undefined },
    ],
    queryFn: () =>
      trpcClient.privateClientOrders.distributorGetMany.query({
        limit: 20,
        cursor,
        search: search || undefined,
      }),
  });

  const updateStatus = useMutation({
    mutationFn: (params: { orderId: string; status: string }) =>
      trpcClient.privateClientOrders.distributorUpdateStatus.mutate({
        orderId: params.orderId,
        status: params.status as
          | 'awaiting_client_verification'
          | 'awaiting_client_payment'
          | 'client_paid'
          | 'awaiting_distributor_payment'
          | 'distributor_paid'
          | 'stock_in_transit'
          | 'with_distributor'
          | 'out_for_delivery'
          | 'delivered',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders.distributorGetMany'] });
      toast.success('Order status updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  const allOrders = data?.data ?? [];
  const totalCount = data?.meta?.totalCount ?? 0;
  const hasMore = data?.meta?.hasMore ?? false;

  // Filter orders by status category
  const filterByStatus = (orders: OrderWithPartner[], filter: StatusFilter) => {
    if (filter === 'all') return orders;

    const statusCategories: Record<StatusFilter, string[]> = {
      all: [],
      pending_payment: ['cc_approved', 'awaiting_client_payment', 'client_paid', 'awaiting_distributor_payment'],
      in_transit: ['distributor_paid', 'stock_in_transit'],
      ready_delivery: ['with_distributor', 'out_for_delivery'],
      delivered: ['delivered'],
    };

    return orders.filter((order) => statusCategories[filter].includes(order.status));
  };

  const orders = filterByStatus(allOrders, statusFilter);

  const formatCurrencyValue = (order: OrderWithPartner) => {
    const usdAmount = order.totalUsd ?? 0;
    const aedAmount = order.totalAed ?? 0;
    let amount: number;
    if (currency === 'USD') {
      amount = usdAmount;
    } else {
      // Use AED if available, otherwise calculate from USD
      amount = aedAmount > 0 ? aedAmount : usdAmount * DEFAULT_EXCHANGE_RATE;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Get available actions matching backend distributorTransitions exactly
   */
  const getAvailableActions = (status: string) => {
    const actions: { label: string; status: string; icon: typeof IconCheck }[] = [];

    switch (status) {
      case 'cc_approved':
        // After approval, client needs to verify on City Drinks app
        actions.push({
          label: 'Client Verified',
          status: 'awaiting_client_verification',
          icon: IconDeviceMobile,
        });
        break;
      case 'awaiting_client_verification':
        // Client has verified, now awaiting payment
        actions.push({
          label: 'Confirm Verified',
          status: 'awaiting_client_payment',
          icon: IconCheck,
        });
        break;
      case 'awaiting_client_payment':
        // Distributor can confirm client payment received
        actions.push({
          label: 'Confirm Client Payment',
          status: 'client_paid',
          icon: IconCheck,
        });
        break;
      case 'client_paid':
        // After client pays, transition to awaiting distributor payment
        actions.push({
          label: 'Awaiting Distributor Payment',
          status: 'awaiting_distributor_payment',
          icon: IconCheck,
        });
        break;
      case 'awaiting_distributor_payment':
        // Distributor confirms payment to C&C
        actions.push({
          label: 'Confirm Payment to C&C',
          status: 'distributor_paid',
          icon: IconCheck,
        });
        break;
      // distributor_paid: Wait for C&C admin to mark stock_in_transit - no action here
      case 'stock_in_transit':
        // Stock has arrived at distributor
        actions.push({
          label: 'Stock Received',
          status: 'with_distributor',
          icon: IconPackage,
        });
        break;
      case 'with_distributor':
        // Ready for delivery
        actions.push({
          label: 'Start Delivery',
          status: 'out_for_delivery',
          icon: IconTruck,
        });
        break;
      case 'out_for_delivery':
        // Mark as delivered
        actions.push({
          label: 'Mark Delivered',
          status: 'delivered',
          icon: IconCheck,
        });
        break;
    }

    return actions;
  };

  const columns: ColumnDef<OrderWithPartner>[] = [
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
      accessorKey: 'partner.businessName',
      header: 'Partner',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.partner?.logoUrl ? (
            <Image
              src={row.original.partner.logoUrl}
              alt={row.original.partner?.businessName ?? 'Partner'}
              width={20}
              height={20}
              className="h-5 w-5 rounded object-contain"
            />
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded bg-fill-muted">
              <Icon icon={IconBuilding} size="xs" colorRole="muted" />
            </div>
          )}
          <Typography variant="bodySm">{row.original.partner?.businessName ?? '-'}</Typography>
        </div>
      ),
    },
    {
      accessorKey: 'clientName',
      header: 'Client',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <Typography variant="bodySm" className="font-medium">
            {row.original.clientName}
          </Typography>
          {row.original.clientPhone && (
            <Typography variant="bodyXs" colorRole="muted">
              {row.original.clientPhone}
            </Typography>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'caseCount',
      header: 'Cases',
      cell: ({ row }) => <Typography variant="bodySm">{row.original.caseCount}</Typography>,
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
      accessorKey: 'distributorAssignedAt',
      header: 'Assigned',
      cell: ({ row }) => (
        <Typography variant="bodyXs" colorRole="muted">
          {row.original.distributorAssignedAt
            ? format(new Date(row.original.distributorAssignedAt), 'MMM d, yyyy')
            : '-'}
        </Typography>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const availableActions = getAvailableActions(row.original.status);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Icon icon={IconDots} size="sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/platform/distributor/orders/${row.original.id}`}>
                  <Icon icon={IconEye} size="sm" className="mr-2" />
                  View Details
                </Link>
              </DropdownMenuItem>

              {availableActions.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {availableActions.map((action) => (
                    <DropdownMenuItem
                      key={action.status}
                      onClick={() =>
                        updateStatus.mutate({
                          orderId: row.original.id,
                          status: action.status,
                        })
                      }
                      disabled={updateStatus.isPending}
                    >
                      <Icon icon={action.icon} size="sm" className="mr-2" />
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
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
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
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

      {/* Header with search and currency toggle */}
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

        {/* Currency Toggle */}
        <div className="inline-flex items-center rounded-lg border border-border-muted bg-surface-secondary/50 p-0.5">
          <button
            type="button"
            onClick={() => setCurrency('USD')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
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
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              currency === 'AED'
                ? 'bg-background-primary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            AED
          </button>
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
          <Icon icon={IconPackage} size="lg" className="text-text-muted" />
          <div className="text-center">
            <Typography variant="bodySm" className="font-medium">
              No assigned orders
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Orders will appear here when assigned to you
            </Typography>
          </div>
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={orders} />

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <Typography variant="bodyXs" colorRole="muted">
              Showing {cursor + 1}-{Math.min(cursor + orders.length, totalCount)} of {totalCount}
            </Typography>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCursor(Math.max(0, cursor - 20))}
                disabled={cursor === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
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

export default DistributorOrdersList;
