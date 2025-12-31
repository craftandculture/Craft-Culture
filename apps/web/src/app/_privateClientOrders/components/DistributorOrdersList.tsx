'use client';

import {
  IconCheck,
  IconDots,
  IconEye,
  IconPackage,
  IconSearch,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

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

type OrderWithPartner = PrivateClientOrder & {
  partner: { id: string; businessName: string } | null;
};

/**
 * DistributorOrdersList displays a table of assigned orders
 * for distributors with action capabilities
 */
const DistributorOrdersList = () => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);

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

  const orders = data?.data ?? [];
  const totalCount = data?.meta?.totalCount ?? 0;
  const hasMore = data?.meta?.hasMore ?? false;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getAvailableActions = (status: string) => {
    const actions: { label: string; status: string; icon: typeof IconCheck }[] = [];

    switch (status) {
      case 'cc_approved':
      case 'awaiting_client_payment':
        actions.push({
          label: 'Confirm Client Payment',
          status: 'client_paid',
          icon: IconCheck,
        });
        break;
      case 'client_paid':
        actions.push({
          label: 'Confirm Payment to C&C',
          status: 'distributor_paid',
          icon: IconCheck,
        });
        break;
      case 'distributor_paid':
        actions.push({
          label: 'Stock In Transit',
          status: 'stock_in_transit',
          icon: IconTruck,
        });
        break;
      case 'stock_in_transit':
        actions.push({
          label: 'Stock Received',
          status: 'with_distributor',
          icon: IconPackage,
        });
        break;
      case 'with_distributor':
        actions.push({
          label: 'Start Delivery',
          status: 'out_for_delivery',
          icon: IconTruck,
        });
        break;
      case 'out_for_delivery':
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
        <Typography variant="bodySm">{row.original.partner?.businessName ?? '-'}</Typography>
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
      accessorKey: 'totalAed',
      header: 'Total (AED)',
      cell: ({ row }) => (
        <Typography variant="bodySm" className="font-medium">
          {formatCurrency(row.original.totalAed)} AED
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
      {/* Header with search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
