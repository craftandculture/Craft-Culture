'use client';

import {
  IconDots,
  IconEye,
  IconFileText,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

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

type OrderWithDistributor = PrivateClientOrder & {
  distributor: { id: string; businessName: string } | null;
};

/**
 * PrivateOrdersList displays a table of private client orders
 * with search, filter, and action capabilities
 */
const PrivateOrdersList = () => {
  const trpcClient = useTRPCClient();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['privateClientOrders.getMany', { limit: 20, cursor, search: search || undefined }],
    queryFn: () =>
      trpcClient.privateClientOrders.getMany.query({
        limit: 20,
        cursor,
        search: search || undefined,
      }),
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
          <Typography variant="bodySm" className="font-medium">
            {row.original.clientName}
          </Typography>
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
      accessorKey: 'totalUsd',
      header: 'Total',
      cell: ({ row }) => (
        <Typography variant="bodySm" className="font-medium">
          {formatCurrency(row.original.totalUsd)}
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
      {/* Header with search and new order button */}
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
        <Button variant="default" colorRole="brand" asChild>
          <Link href="/platform/private-orders/new">
            <ButtonContent iconLeft={IconPlus}>New Order</ButtonContent>
          </Link>
        </Button>
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

export default PrivateOrdersList;
