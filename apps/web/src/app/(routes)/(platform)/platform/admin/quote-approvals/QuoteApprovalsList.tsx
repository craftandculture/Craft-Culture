'use client';

import { IconDownload, IconEye } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import DataTable from '@/app/_ui/components/DataTable/DataTable';
import Tabs from '@/app/_ui/components/Tabs/Tabs';
import TabsContent from '@/app/_ui/components/Tabs/TabsContent';
import TabsList from '@/app/_ui/components/Tabs/TabsList';
import TabsTrigger from '@/app/_ui/components/Tabs/TabsTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { Quote } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

import QuoteApprovalDialog from './QuoteApprovalDialog';

/**
 * Component to display and manage quote approvals for admin users
 */
const QuoteApprovalsList = () => {
  const trpcClient = useTRPCClient();
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch all quotes that need admin attention (using admin endpoint to see all users' quotes)
  const { data: quotesData, isLoading } = useQuery({
    queryKey: ['admin-quotes'],
    queryFn: () =>
      trpcClient.quotes.getManyAdmin.query({
        limit: 100,
        cursor: 0,
      }),
  });

  const quotes = quotesData?.data ?? [];

  // Filter quotes by status
  const pendingBuyRequests = quotes.filter(
    (q) => q.status === 'buy_request_submitted',
  );
  const underReview = quotes.filter((q) => q.status === 'under_cc_review');
  const confirmed = quotes.filter((q) => q.status === 'cc_confirmed');
  const poSubmitted = quotes.filter((q) => q.status === 'po_submitted');
  const confirmedOrders = quotes.filter((q) => q.status === 'po_confirmed');

  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setIsDialogOpen(true);
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
      header: 'Created By',
      cell: ({ row }) => {
        const createdBy = row.original.createdBy;
        return (
          <div className="flex flex-col gap-0.5">
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
      header: 'Client',
      cell: ({ row }) => {
        const { clientName, clientCompany } = row.original;
        return (
          <div className="flex flex-col gap-0.5">
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
      header: 'Submitted',
      cell: ({ row }) =>
        row.original.buyRequestSubmittedAt ? (
          <Typography variant="bodySm" colorRole="muted">
            {format(new Date(row.original.buyRequestSubmittedAt), 'MMM d, yyyy h:mm a')}
          </Typography>
        ) : (
          <Typography variant="bodySm" colorRole="muted">
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

  // Columns for confirmed orders with PO information
  const confirmedOrdersColumns: ColumnDef<Quote & { createdBy?: { id: string; name: string | null; email: string } | null }>[] = [
    {
      accessorKey: 'name',
      header: 'Order Name',
      cell: ({ row }) => (
        <Typography variant="bodySm" className="font-medium">
          {row.original.name}
        </Typography>
      ),
    },
    {
      accessorKey: 'createdBy',
      header: 'Created By',
      cell: ({ row }) => {
        const createdBy = row.original.createdBy;
        return (
          <div className="flex flex-col gap-0.5">
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
      header: 'Client',
      cell: ({ row }) => {
        const { clientName, clientCompany } = row.original;
        return (
          <div className="flex flex-col gap-0.5">
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
      accessorKey: 'poNumber',
      header: 'PO Number',
      cell: ({ row }) =>
        row.original.poNumber ? (
          <Typography variant="bodySm" className="font-mono font-semibold">
            {row.original.poNumber}
          </Typography>
        ) : (
          <Typography variant="bodySm" colorRole="muted">
            -
          </Typography>
        ),
    },
    {
      accessorKey: 'poConfirmedAt',
      header: 'Confirmed',
      cell: ({ row }) =>
        row.original.poConfirmedAt ? (
          <Typography variant="bodySm" colorRole="muted">
            {format(new Date(row.original.poConfirmedAt), 'MMM d, yyyy h:mm a')}
          </Typography>
        ) : (
          <Typography variant="bodySm" colorRole="muted">
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
            {quote.poAttachmentUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(quote.poAttachmentUrl!, '_blank')}
              >
                <ButtonContent iconLeft={IconDownload}>Download PO</ButtonContent>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewQuote(quote)}
            >
              <ButtonContent iconLeft={IconEye}>View</ButtonContent>
            </Button>
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

  return (
    <>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingBuyRequests.length})
          </TabsTrigger>
          <TabsTrigger value="review">
            Under Review ({underReview.length})
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Confirmed ({confirmed.length})
          </TabsTrigger>
          <TabsTrigger value="po">
            PO Submitted ({poSubmitted.length})
          </TabsTrigger>
          <TabsTrigger value="orders">
            Confirmed Orders ({confirmedOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingBuyRequests.length === 0 ? (
            <div className="border-border-primary flex h-64 flex-col items-center justify-center rounded-lg border">
              <Typography variant="bodyLg" className="mb-2 font-medium">
                No pending buy requests
              </Typography>
              <Typography variant="bodySm" colorRole="muted">
                All caught up!
              </Typography>
            </div>
          ) : (
            <DataTable columns={columns} data={pendingBuyRequests} />
          )}
        </TabsContent>

        <TabsContent value="review">
          {underReview.length === 0 ? (
            <div className="border-border-primary flex h-64 flex-col items-center justify-center rounded-lg border">
              <Typography variant="bodyLg" className="mb-2 font-medium">
                No quotes under review
              </Typography>
            </div>
          ) : (
            <DataTable columns={columns} data={underReview} />
          )}
        </TabsContent>

        <TabsContent value="confirmed">
          {confirmed.length === 0 ? (
            <div className="border-border-primary flex h-64 flex-col items-center justify-center rounded-lg border">
              <Typography variant="bodyLg" className="mb-2 font-medium">
                No confirmed quotes
              </Typography>
            </div>
          ) : (
            <DataTable columns={columns} data={confirmed} />
          )}
        </TabsContent>

        <TabsContent value="po">
          {poSubmitted.length === 0 ? (
            <div className="border-border-primary flex h-64 flex-col items-center justify-center rounded-lg border">
              <Typography variant="bodyLg" className="mb-2 font-medium">
                No POs submitted
              </Typography>
            </div>
          ) : (
            <DataTable columns={columns} data={poSubmitted} />
          )}
        </TabsContent>

        <TabsContent value="orders">
          {confirmedOrders.length === 0 ? (
            <div className="border-border-primary flex h-64 flex-col items-center justify-center rounded-lg border">
              <Typography variant="bodyLg" className="mb-2 font-medium">
                No confirmed orders
              </Typography>
              <Typography variant="bodySm" colorRole="muted">
                Orders will appear here once POs are confirmed
              </Typography>
            </div>
          ) : (
            <DataTable columns={confirmedOrdersColumns} data={confirmedOrders} />
          )}
        </TabsContent>
      </Tabs>

      {/* Quote Approval Dialog */}
      <QuoteApprovalDialog
        quote={selectedQuote}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
};

export default QuoteApprovalsList;
