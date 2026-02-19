'use client';

import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronRight,
  IconCloudDownload,
  IconLoader2,
  IconReceipt,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (date: Date | null | undefined) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

type StatusColor = 'success' | 'warning' | 'danger' | 'muted' | 'brand';

const statusColors: Record<string, StatusColor> = {
  open: 'brand',
  paid: 'success',
  overdue: 'danger',
  disputed: 'warning',
  cancelled: 'muted',
};

/**
 * Hillebrand invoices list page
 */
const InvoicesPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    ...api.logistics.admin.getInvoices.queryOptions(),
  });

  const { mutate: syncInvoices, isPending: isSyncing } = useMutation({
    ...api.logistics.admin.syncHillebrandInvoices.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Synced: ${result.created} new, ${result.updated} updated`);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getInvoices']] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync invoices');
    },
  });

  const totalOpen = invoices?.reduce((sum, inv) => sum + (inv.status === 'open' ? inv.openAmount : 0), 0) ?? 0;
  const totalOverdue = invoices?.filter((inv) => inv.status === 'overdue').length ?? 0;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/platform/admin/logistics">
              <Button variant="ghost" size="sm">
                <Icon icon={IconArrowLeft} size="sm" />
              </Button>
            </Link>
            <div>
              <Typography variant="headingLg">Invoices</Typography>
              <Typography variant="bodyMd" colorRole="muted">
                Hillebrand freight invoices
              </Typography>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncInvoices()}
            disabled={isSyncing}
          >
            <ButtonContent iconLeft={IconCloudDownload}>
              {isSyncing ? 'Syncing...' : 'Sync Invoices'}
            </ButtonContent>
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingMd">{invoices?.length ?? 0}</Typography>
              <Typography variant="bodyXs" colorRole="muted">Total</Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingMd" className="text-blue-600">
                {formatCurrency(totalOpen, 'USD')}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">Open</Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingMd" className={totalOverdue > 0 ? 'text-red-600' : ''}>
                {totalOverdue}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">Overdue</Typography>
            </CardContent>
          </Card>
        </div>

        {/* Invoice List */}
        {!invoices || invoices.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Icon icon={IconReceipt} size="xl" colorRole="muted" className="mx-auto mb-4" />
              <Typography variant="headingSm" className="mb-2">
                No Invoices
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-4">
                Sync from Hillebrand to import invoices
              </Typography>
              <Button onClick={() => syncInvoices()} disabled={isSyncing}>
                <ButtonContent iconLeft={IconCloudDownload}>Sync Now</ButtonContent>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {/* Table header */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_100px_100px_100px_80px_40px] gap-4 px-4 py-3 border-b border-border-primary bg-fill-secondary text-xs font-medium text-text-muted">
                <span>Invoice</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Open</span>
                <span>Due Date</span>
                <span>Status</span>
                <span />
              </div>

              <div className="divide-y divide-border-primary">
                {invoices.map((invoice) => {
                  const isExpanded = expandedId === invoice.id;

                  return (
                    <div key={invoice.id}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : invoice.id)}
                        className="w-full text-left px-4 py-3 hover:bg-surface-secondary transition-colors"
                      >
                        {/* Mobile layout */}
                        <div className="sm:hidden space-y-2">
                          <div className="flex items-center justify-between">
                            <Typography variant="headingXs">{invoice.invoiceNumber}</Typography>
                            <Badge colorRole={statusColors[invoice.status] ?? 'muted'} size="sm">
                              {invoice.status}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted">{formatDate(invoice.invoiceDate)}</span>
                            <Typography variant="headingSm">
                              {formatCurrency(invoice.totalAmount, invoice.currencyCode)}
                            </Typography>
                          </div>
                        </div>

                        {/* Desktop layout */}
                        <div className="hidden sm:grid sm:grid-cols-[1fr_100px_100px_100px_80px_40px] gap-4 items-center">
                          <div>
                            <Typography variant="headingXs">{invoice.invoiceNumber}</Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {formatDate(invoice.invoiceDate)}
                            </Typography>
                          </div>
                          <Typography variant="bodySm" className="text-right tabular-nums">
                            {formatCurrency(invoice.totalAmount, invoice.currencyCode)}
                          </Typography>
                          <Typography variant="bodySm" className="text-right tabular-nums">
                            {invoice.openAmount > 0
                              ? formatCurrency(invoice.openAmount, invoice.currencyCode)
                              : '-'}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            {formatDate(invoice.paymentDueDate)}
                          </Typography>
                          <Badge colorRole={statusColors[invoice.status] ?? 'muted'} size="sm">
                            {invoice.status}
                          </Badge>
                          <Icon
                            icon={isExpanded ? IconChevronDown : IconChevronRight}
                            size="sm"
                            colorRole="muted"
                          />
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-4 pb-3 bg-surface-secondary">
                          <div className="space-y-2 pt-2">
                            {invoice.paidAt && (
                              <div className="flex justify-between text-sm">
                                <span className="text-text-muted">Paid</span>
                                <span>{formatDate(invoice.paidAt)}</span>
                              </div>
                            )}
                            {invoice.paidAmount && invoice.paidAmount > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-text-muted">Paid Amount</span>
                                <span>{formatCurrency(invoice.paidAmount, invoice.currencyCode)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm">
                              <span className="text-text-muted">Linked Shipments</span>
                              <div className="flex flex-wrap gap-1 justify-end">
                                {invoice.shipmentNumbers.length > 0 ? (
                                  invoice.shipmentNumbers.map((num) => (
                                    <Badge key={num} colorRole="muted" size="sm">
                                      {num}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-text-muted text-xs">None</span>
                                )}
                              </div>
                            </div>
                            {invoice.hillebrandLastSync && (
                              <div className="flex justify-between text-sm">
                                <span className="text-text-muted">Last Synced</span>
                                <span className="text-xs text-text-muted">
                                  {formatDate(invoice.hillebrandLastSync)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InvoicesPage;
