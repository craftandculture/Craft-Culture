'use client';

import {
  IconCheck,
  IconClock,
  IconDownload,
  IconEye,
  IconFileText,
  IconSearch,
  IconSend,
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

const statusFilters: StatusFilter[] = [
  { label: 'All Quotes', value: 'all', icon: IconFileText, color: 'text-text-primary' },
  { label: 'Pending', value: 'buy_request_submitted', icon: IconSend, color: 'text-text-brand' },
  { label: 'Under Review', value: 'under_cc_review', icon: IconClock, color: 'text-text-brand' },
  { label: 'Confirmed', value: 'cc_confirmed', icon: IconCheck, color: 'text-text-brand' },
  { label: 'PO Submitted', value: 'po_submitted', icon: IconFileText, color: 'text-text-brand' },
  { label: 'Confirmed Orders', value: 'po_confirmed', icon: IconCheck, color: 'text-text-muted' },
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
  const { data: quotesData, isLoading } = useQuery({
    queryKey: ['admin-quotes', { search: search || undefined }],
    queryFn: () =>
      trpcClient.quotes.getManyAdmin.query({
        limit: 100,
        cursor: 0,
        search: search || undefined,
      }),
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
      {/* Status Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => {
          const isActive = activeFilter === filter.value;
          const count = getStatusCount(filter.value);

          return (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-fill-brand text-text-brand-contrast shadow-md'
                  : 'bg-fill-muted/50 text-text-muted hover:bg-fill-muted hover:text-text-primary dark:bg-background-secondary dark:hover:bg-background-tertiary'
              }`}
            >
              <Icon icon={filter.icon} size="sm" className={isActive ? 'text-text-brand-contrast' : filter.color} />
              <span>{filter.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${
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

      {/* Search Input */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by quote name, client name, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          iconLeft={IconSearch}
          className="w-full"
        />
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
        <div className="rounded-lg border border-border-muted bg-white dark:bg-background-secondary shadow-sm">
          <DataTable columns={getColumns()} data={filteredQuotes} />
        </div>
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
