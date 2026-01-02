'use client';

import {
  IconDots,
  IconEye,
  IconPencil,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconTrash,
  IconUser,
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
import type { PrivateClientContact } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

/**
 * List of client contacts for wine partners
 */
const ClientContactsList = () => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: [
      'privateClientContacts.getMany',
      { limit: 20, cursor, search: search || undefined },
    ],
    queryFn: () =>
      trpcClient.privateClientContacts.getMany.query({
        limit: 20,
        cursor,
        search: search || undefined,
      }),
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) => trpcClient.privateClientContacts.delete.mutate({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['privateClientContacts.getMany'] });
      toast.success('Client deleted');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete client');
    },
  });

  const contacts = data?.data ?? [];
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

  const columns: ColumnDef<PrivateClientContact>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <Typography variant="bodySm" className="font-medium">
              {row.original.name}
            </Typography>
            {row.original.cityDrinksVerifiedAt && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                title="City Drinks Verified"
              >
                <Icon icon={IconShieldCheck} size="xs" />
                <span className="text-[10px] font-medium">Verified</span>
              </span>
            )}
          </div>
          {row.original.email && (
            <Typography variant="bodyXs" colorRole="muted">
              {row.original.email}
            </Typography>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => (
        <Typography variant="bodySm">{row.original.phone ?? '-'}</Typography>
      ),
    },
    {
      accessorKey: 'city',
      header: 'Location',
      cell: ({ row }) => (
        <Typography variant="bodySm">
          {[row.original.city, row.original.country].filter(Boolean).join(', ') || '-'}
        </Typography>
      ),
    },
    {
      accessorKey: 'totalOrders',
      header: 'Orders',
      cell: ({ row }) => (
        <Typography variant="bodySm">{row.original.totalOrders}</Typography>
      ),
    },
    {
      accessorKey: 'totalSpendUsd',
      header: 'Total Spend',
      cell: ({ row }) => (
        <Typography variant="bodySm" className="font-medium">
          {formatCurrency(row.original.totalSpendUsd)}
        </Typography>
      ),
    },
    {
      accessorKey: 'lastOrderAt',
      header: 'Last Order',
      cell: ({ row }) => (
        <Typography variant="bodyXs" colorRole="muted">
          {row.original.lastOrderAt
            ? format(new Date(row.original.lastOrderAt), 'MMM d, yyyy')
            : 'Never'}
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
              <Link href={`/platform/clients/${row.original.id}`}>
                <Icon icon={IconEye} size="sm" className="mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/platform/clients/${row.original.id}/edit`}>
                <Icon icon={IconPencil} size="sm" className="mr-2" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (confirm('Are you sure you want to delete this client?')) {
                  deleteContact.mutate(row.original.id);
                }
              }}
              disabled={deleteContact.isPending}
              className="text-fill-danger"
            >
              <Icon icon={IconTrash} size="sm" className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header with search and add button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Icon
            icon={IconSearch}
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCursor(0);
            }}
            className="pl-9"
          />
        </div>
        <Button asChild>
          <Link href="/platform/clients/new">
            <Icon icon={IconPlus} size="sm" className="mr-2" />
            Add Client
          </Link>
        </Button>
      </div>

      {/* Contacts table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Typography variant="bodySm" colorRole="muted">
            Loading clients...
          </Typography>
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border-muted bg-surface-secondary/30 py-12">
          <Icon icon={IconUser} size="lg" className="text-text-muted" />
          <div className="text-center">
            <Typography variant="bodySm" className="font-medium">
              No clients yet
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Add your first client to start creating orders
            </Typography>
          </div>
          <Button asChild>
            <Link href="/platform/clients/new">
              <Icon icon={IconPlus} size="sm" className="mr-2" />
              Add Client
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={contacts} />

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <Typography variant="bodyXs" colorRole="muted">
              Showing {cursor + 1}-{Math.min(cursor + contacts.length, totalCount)} of {totalCount}
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

export default ClientContactsList;
