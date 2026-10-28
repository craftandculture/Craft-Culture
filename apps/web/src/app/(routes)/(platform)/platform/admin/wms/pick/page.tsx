'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconChevronRight,
  IconClipboardList,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import ClientMark from '@/app/_wms/components/ClientMark';
import useTRPC from '@/lib/trpc/browser';

const PAGE_SIZE = 50;

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

/**
 * WMS Pick Lists - List and manage order pick lists
 */
const WMSPickListsPage = () => {
  const api = useTRPC();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Search the server a moment after typing stops; a new search or filter starts from the top
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setLimit(PAGE_SIZE), [term, statusFilter]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    ...api.wms.admin.picking.getMany.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: term || undefined,
      limit,
      offset: 0,
    }),
    placeholderData: keepPreviousData,
  });

  const shown = data?.pickLists ?? [];

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
    <div className="container mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl px-4 py-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/platform/admin/wms"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary"
          >
            <IconArrowLeft className="h-6 w-6" />
          </Link>
          <Typography variant="headingLg" className="flex-1">
            Pick Lists
          </Typography>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary"
            >
              <IconRefresh className="h-5 w-5" />
            </button>
            <Link href="/platform/admin/wms/pick/new">
              <Button variant="default">
                <ButtonContent iconLeft={IconPlus}>New</ButtonContent>
              </Button>
            </Link>
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
              className={`flex-1 rounded-md px-4 py-3 text-sm font-medium transition-colors ${
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

        {/* Search: client, pick list, invoice, order or PCO number */}
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client or number"
            className="h-12 w-full rounded-xl border border-border-muted bg-fill-primary pl-12 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-border-brand focus:outline-none"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
          </div>
        )}

        {/* Pick Lists */}
        {!isLoading && data && (
          <div className="grid gap-3 md:grid-cols-2">
            {shown.length === 0 ? (
              <Card className="md:col-span-2">
                <CardContent className="p-8 text-center">
                  <Icon icon={IconClipboardList} size="xl" colorRole="muted" className="mx-auto mb-4" />
                  <Typography variant="headingSm" className="mb-2">
                    No Pick Lists
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {term
                      ? `Nothing matches “${search.trim()}”`
                      : statusFilter === 'pending'
                        ? 'No pending pick lists to process'
                        : 'No pick lists match this filter'}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              shown.map((pickList) => {
                const percent = pickList.totalItems > 0 ? (pickList.pickedItems / pickList.totalItems) * 100 : 0;
                const reference =
                  pickList.referenceNumber && pickList.referenceNumber !== pickList.orderNumber ? pickList.referenceNumber : null;
                return (
                  <Link key={pickList.id} href={`/platform/admin/wms/pick/${pickList.id}`}>
                    <Card
                      className={`h-full transition-shadow hover:border-border-brand hover:shadow-md ${
                        pickList.soModifiedAfterRelease ? 'border-amber-400 ring-1 ring-amber-300' : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <ClientMark logoUrl={pickList.customerLogoUrl} name={pickList.customerName} size="lg" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <Typography variant="bodyMd" className="truncate font-semibold">
                                {pickList.customerName ?? 'No client on the order'}
                              </Typography>
                              <span className="shrink-0">{getStatusBadge(pickList.status ?? 'pending')}</span>
                            </div>
                            {/* The pick list, then the numbers the office and paperwork quote */}
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-text-muted">
                              <span className="font-mono font-medium text-text-primary">{pickList.pickListNumber}</span>
                              {pickList.invoiceNumber && <span>· {pickList.invoiceNumber}</span>}
                              {pickList.orderNumber && <span>· {pickList.orderNumber}</span>}
                            </div>
                            {/* The client's own reference: their PO, or the PCO number */}
                            {reference && (
                              <p className="mt-0.5 truncate text-xs text-text-muted" title={reference}>
                                Ref {reference}
                              </p>
                            )}
                            {pickList.soModifiedAfterRelease && (
                              <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                <IconAlertTriangle className="h-3 w-3" />
                                Order changed in Zoho after release
                              </span>
                            )}
                          </div>
                          <Icon icon={IconChevronRight} size="sm" colorRole="muted" className="mt-3 shrink-0" />
                        </div>

                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-2 flex-1 rounded-full bg-border-muted">
                            <div className="h-2 rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
                          </div>
                          <Typography variant="bodyXs" className="shrink-0 font-medium tabular-nums">
                            {pickList.pickedItems}/{pickList.totalItems} picked
                          </Typography>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                          {pickList.orderDate && <span>Ordered {format(new Date(pickList.orderDate), 'dd MMM')}</span>}
                          {pickList.completedAt ? (
                            <span>Completed {format(new Date(pickList.completedAt), 'dd MMM')}</span>
                          ) : pickList.status === 'in_progress' && pickList.startedAt ? (
                            <span className="text-amber-600">
                              Started {formatDistanceToNow(new Date(pickList.startedAt), { addSuffix: true })}
                            </span>
                          ) : (
                            <span>Released {formatDistanceToNow(new Date(pickList.createdAt), { addSuffix: true })}</span>
                          )}
                          {pickList.assignedToName && <span>· {pickList.assignedToName}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            )}

            {/* Pagination */}
            {data.pagination.total > 0 && (
              <div className="flex flex-col items-center gap-2 md:col-span-2">
                <Typography variant="bodyXs" colorRole="muted">
                  Showing {shown.length} of {data.pagination.total} pick lists
                </Typography>
                {shown.length < data.pagination.total && (
                  <Button variant="outline" onClick={() => setLimit((n) => n + PAGE_SIZE)} isDisabled={isFetching}>
                    <ButtonContent>{isFetching ? 'Loading…' : `Show ${Math.min(PAGE_SIZE, data.pagination.total - shown.length)} more`}</ButtonContent>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSPickListsPage;
