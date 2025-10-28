'use client';

/* eslint-disable react-compiler/react-compiler */

import {
  IconDots,
  IconDownload,
  IconEdit,
  IconEye,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

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
import type { Quote } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

/**
 * QuotesList component displays a table of saved quotes with search,
 * filter, and action capabilities
 */
const QuotesList = () => {
  const api = useTRPC();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);

  const { data, isLoading, refetch } = api.quotes.getMany.useQuery({
    limit: 20,
    cursor,
    search: search || undefined,
  });

  const deleteMutation = api.quotes.delete.useMutation({
    onSuccess: () => {
      toast.success('Quote deleted successfully');
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete quote: ${error.message}`);
    },
  });

  const handleDelete = async (quoteId: string) => {
    if (
      window.confirm('Are you sure you want to delete this quote? This cannot be undone.')
    ) {
      await deleteMutation.mutateAsync({ id: quoteId });
    }
  };

  const handleDownloadExcel = (quote: Quote) => {
    // TODO: Implement Excel download
    toast.info('Excel download coming soon');
    console.log('Download Excel for quote:', quote.id);
  };

  const columns: ColumnDef<Quote>[] = [
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
      accessorKey: 'clientName',
      header: 'Client',
      cell: ({ row }) => {
        const { clientName, clientCompany } = row.original;
        return (
          <div className="flex flex-col gap-0.5">
            {clientName && (
              <Typography variant="bodySm">{clientName}</Typography>
            )}
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
            {currency} {total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const statusColors = {
          draft: 'text-text-muted',
          sent: 'text-text-brand',
          accepted: 'text-text-success',
          rejected: 'text-text-danger',
          expired: 'text-text-muted',
        };
        return (
          <Typography
            variant="bodySm"
            className={`capitalize ${statusColors[status]}`}
          >
            {status}
          </Typography>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <Typography variant="bodySm" colorRole="muted">
          {format(new Date(row.original.createdAt), 'MMM d, yyyy')}
        </Typography>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const quote = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ButtonContent>
                    <Icon icon={IconDots} size="md" />
                  </ButtonContent>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    // TODO: Navigate to quote details
                    toast.info('Quote details coming soon');
                  }}
                >
                  <Icon icon={IconEye} size="sm" />
                  <span>View Details</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    // TODO: Navigate to edit quote
                    toast.info('Edit quote coming soon');
                  }}
                >
                  <Icon icon={IconEdit} size="sm" />
                  <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadExcel(quote)}>
                  <Icon icon={IconDownload} size="sm" />
                  <span>Download Excel</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void handleDelete(quote.id)}
                  className="text-text-danger focus:text-text-danger"
                >
                  <Icon icon={IconTrash} size="sm" colorRole="danger" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Typography variant="bodySm" colorRole="muted">
          Loading quotes...
        </Typography>
      </div>
    );
  }

  const quotes = data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Search Input */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by quote name, client name, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          iconLeft={IconSearch}
          className="max-w-md"
        />
      </div>

      {/* Quotes Table */}
      {quotes.length === 0 ? (
        <div className="border-border-primary flex h-64 flex-col items-center justify-center rounded-lg border">
          <Typography variant="bodyLg" className="mb-2 font-medium">
            No quotes found
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            {search
              ? 'Try adjusting your search'
              : 'Create your first quote to get started'}
          </Typography>
        </div>
      ) : (
        <DataTable columns={columns} data={quotes} />
      )}

      {/* Pagination Info */}
      {data?.meta && quotes.length > 0 && (
        <div className="flex items-center justify-between">
          <Typography variant="bodySm" colorRole="muted">
            Showing {quotes.length} of {data.meta.totalCount} quotes
          </Typography>
          {data.meta.hasMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor((prev) => prev + 20)}
            >
              <ButtonContent>Load More</ButtonContent>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default QuotesList;
