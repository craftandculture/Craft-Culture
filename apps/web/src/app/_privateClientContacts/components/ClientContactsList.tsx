'use client';

import {
  IconDots,
  IconEye,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import AlertDialog from '@/app/_ui/components/AlertDialog/AlertDialog';
import AlertDialogAction from '@/app/_ui/components/AlertDialog/AlertDialogAction';
import AlertDialogCancel from '@/app/_ui/components/AlertDialog/AlertDialogCancel';
import AlertDialogContent from '@/app/_ui/components/AlertDialog/AlertDialogContent';
import AlertDialogDescription from '@/app/_ui/components/AlertDialog/AlertDialogDescription';
import AlertDialogFooter from '@/app/_ui/components/AlertDialog/AlertDialogFooter';
import AlertDialogHeader from '@/app/_ui/components/AlertDialog/AlertDialogHeader';
import AlertDialogTitle from '@/app/_ui/components/AlertDialog/AlertDialogTitle';
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: [
      'privateClientContacts.getMany',
      { limit: 20, cursor, search: debouncedSearch || undefined },
    ],
    queryFn: () =>
      trpcClient.privateClientContacts.getMany.query({
        limit: 20,
        cursor,
        search: debouncedSearch || undefined,
      }),
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) => trpcClient.privateClientContacts.delete.mutate({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['privateClientContacts.getMany'] });
      setPendingDelete(null);
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
                className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60"
                title="Verified with the distributor"
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
        <Typography variant="bodySm">{row.original.phone ?? '—'}</Typography>
      ),
    },
    {
      accessorKey: 'city',
      header: 'Location',
      cell: ({ row }) => (
        <Typography variant="bodySm">
          {[row.original.city, row.original.country].filter(Boolean).join(', ') || '—'}
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
      header: 'Total spend',
      cell: ({ row }) => (
        <Typography variant="bodySm" className="font-medium">
          {formatCurrency(row.original.totalSpendUsd)}
        </Typography>
      ),
    },
    {
      accessorKey: 'lastOrderAt',
      header: 'Last order',
      cell: ({ row }) => (
        <Typography variant="bodyXs" colorRole="muted">
          {row.original.lastOrderAt
            ? format(new Date(row.original.lastOrderAt), 'd MMM yyyy')
            : 'No orders yet'}
        </Typography>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Icon icon={IconDots} size="sm" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/platform/clients/${row.original.id}`}>
                <Icon icon={IconEye} size="sm" className="mr-2" />
                View details
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
              onSelect={() =>
                setPendingDelete({ id: row.original.id, name: row.original.name })
              }
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
        <Input
          placeholder="Search clients by name, email or phone"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCursor(0);
          }}
          iconLeft={IconSearch}
          size="lg"
          className="h-11 w-full rounded-xl sm:flex-1"
        />
        <Button asChild>
          <Link href="/platform/clients/new">
            <Icon icon={IconPlus} size="sm" className="mr-2" />
            Add client
          </Link>
        </Button>
      </div>

      {/* Contacts table */}
      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-surface-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border-muted bg-surface-primary py-12 text-center shadow-sm">
          <Typography variant="bodySm" className="font-medium">
            Clients could not be loaded
          </Typography>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Icon icon={IconRefresh} size="sm" />
            {isFetching ? 'Loading…' : 'Try again'}
          </button>
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border-muted bg-surface-primary py-12 shadow-sm">
          <Icon icon={IconUser} size="lg" className="text-text-muted" />
          <div className="text-center">
            <Typography variant="bodySm" className="font-medium">
              {debouncedSearch ? 'No clients match your search' : 'No clients yet'}
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              {debouncedSearch ? 'Try a different name, email or phone.' : 'Add your first client to start creating orders'}
            </Typography>
          </div>
          <Button asChild>
            <Link href="/platform/clients/new">
              <Icon icon={IconPlus} size="sm" className="mr-2" />
              Add client
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable columns={columns} data={contacts} />
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col divide-y divide-border-muted overflow-hidden rounded-xl border border-border-muted bg-surface-primary shadow-sm md:hidden">
            {contacts.map((contact) => (
              <Link
                key={contact.id}
                href={`/platform/clients/${contact.id}`}
                className="flex flex-col gap-2 p-4 transition-colors hover:bg-surface-secondary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Typography variant="bodySm" className="font-medium">
                      {contact.name}
                    </Typography>
                    {contact.cityDrinksVerifiedAt && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60"
                        title="Verified with the distributor"
                      >
                        <Icon icon={IconShieldCheck} size="xs" />
                      </span>
                    )}
                  </div>
                  <Typography variant="bodySm" className="shrink-0 font-semibold">
                    {formatCurrency(contact.totalSpendUsd)}
                  </Typography>
                </div>
                {contact.email && (
                  <Typography variant="bodyXs" colorRole="muted">
                    {contact.email}
                  </Typography>
                )}
                <div className="flex items-center justify-between">
                  <Typography variant="bodyXs" colorRole="muted">
                    {[contact.city, contact.country].filter(Boolean).join(', ') || '—'}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    {contact.totalOrders} {contact.totalOrders === 1 ? 'order' : 'orders'}
                  </Typography>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Typography variant="bodyXs" colorRole="muted">
              Showing {cursor + 1}–{Math.min(cursor + contacts.length, totalCount)} of {totalCount}
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

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteContact.isPending) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{pendingDelete?.name}</strong> from your clients? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" size="sm" isDisabled={deleteContact.isPending}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                size="sm"
                colorRole="danger"
                isDisabled={deleteContact.isPending}
                onClick={(e) => {
                  // Keep the dialog open until the delete settles
                  e.preventDefault();
                  if (pendingDelete) deleteContact.mutate(pendingDelete.id);
                }}
              >
                {deleteContact.isPending ? 'Deleting…' : 'Delete client'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientContactsList;
