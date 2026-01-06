'use client';

import {
  IconCheck,
  IconClock,
  IconDownload,
  IconEye,
  IconFileText,
  IconRefresh,
  IconSearch,
  IconSend,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import DataTable from '@/app/_ui/components/DataTable/DataTable';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { Quote } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

import QuoteApprovalDialog from './QuoteApprovalDialog';

type QuoteStatus = Quote['status'];

interface StatusFilter {
  label: string;
  value: QuoteStatus | 'all';
  icon: typeof IconFileText;
  color: string;
}

interface FilterGroup {
  label: string;
  filters: StatusFilter[];
}

const filterGroups: FilterGroup[] = [
  {
    label: 'Overview',
    filters: [
      { label: 'All', value: 'all', icon: IconFileText, color: 'text-text-primary' },
    ],
  },
  {
    label: 'Incoming',
    filters: [
      { label: 'Pending', value: 'buy_request_submitted', icon: IconSend, color: 'text-text-brand' },
    ],
  },
  {
    label: 'In Progress',
    filters: [
      { label: 'Under Review', value: 'under_cc_review', icon: IconClock, color: 'text-text-brand' },
      { label: 'Confirmed', value: 'cc_confirmed', icon: IconCheck, color: 'text-text-brand' },
      { label: 'Awaiting Payment', value: 'awaiting_payment', icon: IconClock, color: 'text-text-warning' },
    ],
  },
  {
    label: 'Complete',
    filters: [
      { label: 'Paid', value: 'paid', icon: IconCheck, color: 'text-text-success' },
      { label: 'Delivered', value: 'delivered', icon: IconTruck, color: 'text-text-muted' },
    ],
  },
  {
    label: 'B2B',
    filters: [
      { label: 'PO Submitted', value: 'po_submitted', icon: IconFileText, color: 'text-text-brand' },
      { label: 'PO Confirmed', value: 'po_confirmed', icon: IconCheck, color: 'text-text-brand' },
    ],
  },
];

/**
 * Component to display and manage quote approvals for admin users
 */
const QuoteApprovalsList = () => {
  const trpcClient = useTRPCClient();
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<QuoteStatus | 'all'>('all');

  // Fetch all quotes that need admin attention (using admin endpoint to see all users' quotes)
  const {
    data: quotesData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['admin-quotes', { search: search || undefined }],
    queryFn: () =>
      trpcClient.quotes.getManyAdmin.query({
        limit: 100,
        cursor: 0,
        search: search || undefined,
      }),
    refetchInterval: 5000, // Refresh every 10 seconds
  });

  const quotes = quotesData?.data ?? [];

  // Filter quotes based on active filter
  const filteredQuotes = quotes.filter((quote) => {
    if (activeFilter === 'all') return true;
    return quote.status === activeFilter;
  });

  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsDialogOpen(true);
  };

  // Calculate counts for filter badges
  const getStatusCount = (status: QuoteStatus | 'all') => {
    if (status === 'all') return quotes.length;
    return quotes.filter((q) => q.status === status).length;
  };

  const columns: ColumnDef<Quote & { createdBy?: { id: string; name: string | null; email: string } | null }>[] = [
    {
      accessorKey: 'name',
      header: 'Quote Name',
      cell: ({ row }) => (
        <Typography variant="bodySm" className="font-medium">
          {row.original.name}
        </Typography>
      ),
    },
    {
      accessorKey: 'createdBy',
      header: () => <span className="hidden lg:inline">Created By</span>,
      cell: ({ row }) => {
        const createdBy = row.original.createdBy;
        return (
          <div className="hidden flex-col gap-0.5 lg:flex">
            {createdBy?.name && (
              <Typography variant="bodySm">{createdBy.name}</Typography>
            )}
            {createdBy?.email && (
              <Typography variant="bodyXs" colorRole="muted">
                {createdBy.email}
              </Typography>
            )}
            {!createdBy?.name && (
              <Typography variant="bodySm" colorRole="muted">
                -
              </Typography>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'clientName',
      header: () => <span className="hidden md:inline">Client</span>,
      cell: ({ row }) => {
        const { clientName, clientCompany } = row.original;
        return (
          <div className="hidden flex-col gap-0.5 md:flex">
            {clientName && <Typography variant="bodySm">{clientName}</Typography>}
            {clientCompany && (
              <Typography variant="bodySm" colorRole="muted">
                {clientCompany}
              </Typography>
            )}
            {!clientName && !clientCompany && (
              <Typography variant="bodySm" colorRole="muted">
                -
              </Typography>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'totalUsd',
      header: 'Total',
      cell: ({ row }) => {
        const { currency, totalUsd, totalAed } = row.original;
        const total = currency === 'AED' ? totalAed : totalUsd;
        return (
          <Typography variant="bodySm" className="font-medium">
            {currency}{' '}
            {total?.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Typography>
        );
      },
    },
    {
      accessorKey: 'buyRequestSubmittedAt',
      header: () => <span className="hidden sm:inline">Submitted</span>,
      cell: ({ row }) =>
        row.original.buyRequestSubmittedAt ? (
          <Typography variant="bodySm" colorRole="muted" className="hidden sm:block">
            {format(new Date(row.original.buyRequestSubmittedAt), 'MMM d, yyyy')}
          </Typography>
        ) : (
          <Typography variant="bodySm" colorRole="muted" className="hidden sm:block">
            -
          </Typography>
        ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const quote = row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewQuote(quote)}
            >
              <ButtonContent iconLeft={IconEye}>Review</ButtonContent>
            </Button>
          </div>
        );
      },
    },
  ];

  // Additional columns for confirmed orders (used when filter is po_confirmed)
  const poNumberColumn: ColumnDef<Quote & { createdBy?: { id: string; name: string | null; email: string } | null }> = {
    accessorKey: 'poNumber',
    header: () => <span className="hidden lg:inline">PO Number</span>,
    cell: ({ row }) =>
      row.original.poNumber ? (
        <Typography variant="bodySm" className="hidden font-mono font-semibold lg:block">
          {row.original.poNumber}
        </Typography>
      ) : (
        <Typography variant="bodySm" colorRole="muted" className="hidden lg:block">
          -
        </Typography>
      ),
  };

  const poConfirmedColumn: ColumnDef<Quote & { createdBy?: { id: string; name: string | null; email: string } | null }> = {
    accessorKey: 'poConfirmedAt',
    header: () => <span className="hidden sm:inline">Confirmed</span>,
    cell: ({ row }) =>
      row.original.poConfirmedAt ? (
        <Typography variant="bodySm" colorRole="muted" className="hidden sm:block">
          {format(new Date(row.original.poConfirmedAt), 'MMM d, yyyy')}
        </Typography>
      ) : (
        <Typography variant="bodySm" colorRole="muted" className="hidden sm:block">
          -
        </Typography>
      ),
  };

  // Actions column with conditional PO download button
  const actionsColumn: ColumnDef<Quote & { createdBy?: { id: string; name: string | null; email: string } | null }> = {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const quote = row.original;
      const isConfirmedOrder = quote.status === 'po_confirmed';
      return (
        <div className="flex justify-end gap-2">
          {isConfirmedOrder && quote.poAttachmentUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(quote.poAttachmentUrl!, '_blank')}
            >
              <ButtonContent iconLeft={IconDownload}>
                <span className="hidden lg:inline">Download PO</span>
                <span className="lg:hidden">PO</span>
              </ButtonContent>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewQuote(quote)}
          >
            <ButtonContent iconLeft={IconEye}>
              <span className="hidden sm:inline">{isConfirmedOrder ? 'View' : 'Review'}</span>
              <Icon icon={IconEye} size="sm" className="sm:hidden" />
            </ButtonContent>
          </Button>
        </div>
      );
    },
  };

  // Build columns based on active filter
  const getColumns = () => {
    const baseColumns = columns.slice(0, -1); // All columns except the old actions

    if (activeFilter === 'po_confirmed') {
      // For confirmed orders, show PO-specific columns
      return [...baseColumns.slice(0, 4), poNumberColumn, poConfirmedColumn, actionsColumn];
    }

    // For other statuses, show standard columns
    return [...baseColumns, actionsColumn];
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Typography variant="bodySm" colorRole="muted">
          Loading quotes...
        </Typography>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status Filter Buttons - Grouped by Workflow Stage */}
      <div className="flex flex-wrap items-start gap-4">
        {filterGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5">
            <Typography variant="bodyXs" colorRole="muted" className="px-1 font-medium uppercase tracking-wide">
              {group.label}
            </Typography>
            <div className="flex gap-1.5">
              {group.filters.map((filter) => {
                const isActive = activeFilter === filter.value;
                const count = getStatusCount(filter.value);

                return (
                  <button
                    key={filter.value}
                    onClick={() => setActiveFilter(filter.value)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-fill-brand text-text-brand-contrast shadow-sm'
                        : 'bg-fill-muted/50 text-text-muted hover:bg-fill-muted hover:text-text-primary dark:bg-background-secondary dark:hover:bg-background-tertiary'
                    }`}
                  >
                    <Icon icon={filter.icon} size="xs" className={isActive ? 'text-text-brand-contrast' : filter.color} />
                    <span>{filter.label}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      isActive
                        ? 'bg-white/20 text-text-brand-contrast'
                        : 'bg-fill-primary/50 text-text-muted'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Search Input with Refresh */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by quote name, client name, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          iconLeft={IconSearch}
          className="w-full"
        />
        <Button
          variant="outline"
          size="md"
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0"
        >
          <Icon
            icon={IconRefresh}
            size="sm"
            className={isFetching ? 'animate-spin' : ''}
          />
        </Button>
      </div>

      {/* Quotes Table */}
      {filteredQuotes.length === 0 ? (
        <div className="border-border-primary flex h-64 flex-col items-center justify-center rounded-lg border bg-fill-muted/20 dark:bg-background-secondary">
          <Icon icon={IconFileText} size="xl" colorRole="muted" className="mb-4" />
          <Typography variant="bodyLg" className="mb-2 font-medium">
            {search ? 'No quotes found' : activeFilter === 'all' ? 'No quotes yet' : 'No quotes in this category'}
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="text-center max-w-md">
            {search
              ? 'Try adjusting your search or filter'
              : activeFilter === 'all'
                ? 'Quotes will appear here once customers submit orders'
                : 'All caught up!'}
          </Typography>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden rounded-lg border border-border-muted bg-white dark:bg-background-secondary shadow-sm md:block">
            <DataTable columns={getColumns()} data={filteredQuotes} />
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col divide-y divide-border-muted rounded-lg border border-border-muted bg-white dark:bg-background-secondary shadow-sm md:hidden">
            {filteredQuotes.map((quote) => (
              <button
                key={quote.id}
                onClick={() => handleViewQuote(quote)}
                className="flex flex-col gap-2 p-4 text-left transition-colors hover:bg-surface-secondary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <Typography variant="bodySm" className="font-medium">
                    {quote.name}
                  </Typography>
                  <Typography variant="bodySm" className="shrink-0 font-medium">
                    {quote.currency}{' '}
                    {(quote.currency === 'AED' ? quote.totalAed : quote.totalUsd)?.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </Typography>
                </div>
                {(quote.createdBy?.name || quote.createdBy?.email) && (
                  <Typography variant="bodyXs" colorRole="muted">
                    By: {quote.createdBy?.name || quote.createdBy?.email}
                  </Typography>
                )}
                {(quote.clientName || quote.clientCompany) && (
                  <Typography variant="bodyXs" colorRole="muted">
                    Client: {quote.clientName || quote.clientCompany}
                  </Typography>
                )}
                <div className="flex items-center justify-between">
                  <Typography variant="bodyXs" colorRole="muted">
                    {quote.buyRequestSubmittedAt
                      ? format(new Date(quote.buyRequestSubmittedAt), 'MMM d, yyyy')
                      : '-'}
                  </Typography>
                  <div className="flex items-center gap-1 text-text-brand">
                    <Icon icon={IconEye} size="xs" />
                    <Typography variant="bodyXs" className="font-medium">
                      Review
                    </Typography>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Results Info */}
      {quotes.length > 0 && (
        <div className="flex items-center justify-between">
          <Typography variant="bodySm" colorRole="muted">
            Showing {filteredQuotes.length} of {quotes.length} quotes
          </Typography>
        </div>
      )}

      {/* Quote Approval Dialog */}
      <QuoteApprovalDialog
        quote={selectedQuote}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
};

export default QuoteApprovalsList;
