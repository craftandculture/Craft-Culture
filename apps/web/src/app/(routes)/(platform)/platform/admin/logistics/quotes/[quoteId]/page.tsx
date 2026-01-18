'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconEdit,
  IconFileInvoice,
  IconGitCompare,
  IconLoader2,
  IconShip,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import TextArea from '@/app/_ui/components/TextArea/TextArea';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { logisticsQuoteStatus } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type QuoteStatus = (typeof logisticsQuoteStatus.enumValues)[number];

const statusBadgeVariants: Record<QuoteStatus, 'default' | 'warning' | 'success' | 'error' | 'secondary'> = {
  draft: 'secondary',
  pending: 'warning',
  accepted: 'success',
  rejected: 'error',
  expired: 'default',
};

const statusIcons: Record<QuoteStatus, typeof IconClock> = {
  draft: IconFileInvoice,
  pending: IconClock,
  accepted: IconCheck,
  rejected: IconX,
  expired: IconAlertTriangle,
};

const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
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

/**
 * Quote detail page
 */
const QuoteDetailPage = () => {
  const params = useParams();
  const quoteId = params.quoteId as string;
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: quote, isLoading } = useQuery({
    ...api.logistics.admin.quotes.getOne.queryOptions({ quoteId }),
  });

  const { mutate: acceptQuote, isPending: isAccepting } = useMutation({
    ...api.logistics.admin.quotes.accept.mutationOptions(),
    onSuccess: () => {
      toast.success('Quote accepted successfully');
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'quotes']] });
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getDashboardMetrics']] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to accept quote');
    },
  });

  const { mutate: rejectQuote, isPending: isRejecting } = useMutation({
    ...api.logistics.admin.quotes.reject.mutationOptions(),
    onSuccess: () => {
      toast.success('Quote rejected');
      setShowRejectDialog(false);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'quotes']] });
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getDashboardMetrics']] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reject quote');
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Icon icon={IconFileInvoice} size="xl" className="mx-auto mb-4 text-text-muted" />
            <Typography variant="headingSm" className="mb-2">
              Quote Not Found
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              This quote may have been deleted or does not exist.
            </Typography>
            <Button className="mt-4" asChild>
              <Link href="/platform/admin/logistics/quotes">Back to Quotes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = statusIcons[quote.status];
  const isEditable = quote.status === 'draft' || quote.status === 'pending';
  const canAcceptReject = quote.status === 'pending';

  // Group line items by category
  const lineItemsByCategory = quote.lineItems.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, typeof quote.lineItems>,
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/admin/logistics/quotes">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Typography variant="headingLg">{quote.quoteNumber}</Typography>
                <Badge variant={statusBadgeVariants[quote.status]}>
                  <Icon icon={StatusIcon} size="xs" className="mr-1" />
                  {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                </Badge>
              </div>
              <Typography variant="bodySm" colorRole="muted">
                Created {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditable && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/platform/admin/logistics/quotes/${quote.id}/edit`}>
                  <ButtonContent iconLeft={IconEdit}>Edit</ButtonContent>
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/platform/admin/logistics/quotes/compare?ids=${quote.id}`}>
                <ButtonContent iconLeft={IconGitCompare}>Compare</ButtonContent>
              </Link>
            </Button>
          </div>
        </div>

        {/* Actions for pending quotes */}
        {canAcceptReject && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Typography variant="bodySm" colorRole="muted">
                  This quote is pending review. Accept or reject it.
                </Typography>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={isRejecting}
                  >
                    <ButtonContent iconLeft={IconX}>Reject</ButtonContent>
                  </Button>
                  <Button
                    onClick={() =>
                      acceptQuote({
                        quoteId: quote.id,
                        shipmentId: quote.shipmentId ?? undefined,
                        updateShipmentCosts: !!quote.shipmentId,
                      })
                    }
                    disabled={isAccepting}
                  >
                    {isAccepting ? (
                      <ButtonContent iconLeft={IconLoader2} iconLeftClassName="animate-spin">
                        Accepting...
                      </ButtonContent>
                    ) : (
                      <ButtonContent iconLeft={IconCheck}>Accept Quote</ButtonContent>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reject Dialog */}
        {showRejectDialog && (
          <Card className="border-red-200 dark:border-red-800">
            <div className="p-4 pb-0">
              <CardTitle>Reject Quote</CardTitle>
            </div>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="rejectReason">Reason for rejection (optional)</label>
                <TextArea
                  id="rejectReason"
                  placeholder="Enter reason for rejecting this quote..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => rejectQuote({ quoteId: quote.id, reason: rejectReason || undefined })}
                  disabled={isRejecting}
                >
                  {isRejecting ? (
                    <ButtonContent iconLeft={IconLoader2} iconLeftClassName="animate-spin">
                      Rejecting...
                    </ButtonContent>
                  ) : (
                    <ButtonContent iconLeft={IconX}>Confirm Rejection</ButtonContent>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Summary */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="p-4 pb-0">
              <CardTitle>Quote Summary</CardTitle>
            </div>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                    Forwarder
                  </Typography>
                  <Typography variant="headingSm" className="mt-1">
                    {quote.forwarderName}
                  </Typography>
                  {quote.forwarderContact && (
                    <Typography variant="bodySm" colorRole="muted">
                      {quote.forwarderContact}
                    </Typography>
                  )}
                  {quote.forwarderEmail && (
                    <Typography variant="bodySm" colorRole="muted">
                      {quote.forwarderEmail}
                    </Typography>
                  )}
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                    Route
                  </Typography>
                  <Typography variant="headingSm" className="mt-1">
                    {quote.originCity || quote.originCountry || 'Origin'} →{' '}
                    {quote.destinationCity || quote.destinationCountry || 'Destination'}
                  </Typography>
                  {quote.transportMode && (
                    <Typography variant="bodySm" colorRole="muted">
                      {quote.transportMode.replace('_', ' ')}
                    </Typography>
                  )}
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                    Transit Time
                  </Typography>
                  <Typography variant="headingSm" className="mt-1">
                    {quote.transitDays ? `${quote.transitDays} days` : '-'}
                  </Typography>
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                    Validity
                  </Typography>
                  <Typography variant="bodySm" className="mt-1">
                    {quote.validFrom && quote.validUntil
                      ? `${formatDate(quote.validFrom)} - ${formatDate(quote.validUntil)}`
                      : quote.validUntil
                        ? `Until ${formatDate(quote.validUntil)}`
                        : '-'}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <div className="p-4 pb-0">
              <CardTitle>Total Price</CardTitle>
            </div>
            <CardContent>
              <Typography variant="headingLg" className="text-text-brand">
                {formatCurrency(quote.totalPrice, quote.currency)}
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mt-2">
                {quote.lineItems.length} line items
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Linked Shipment */}
        {quote.shipment && (
          <Card>
            <div className="p-4 pb-0">
              <CardTitle className="flex items-center gap-2">
                <Icon icon={IconShip} size="sm" colorRole="muted" />
                Linked Shipment
              </CardTitle>
            </div>
            <CardContent>
              <Link
                href={`/platform/admin/logistics/shipments/${quote.shipment.id}`}
                className="flex items-center justify-between rounded-lg border border-border-primary p-4 hover:border-border-brand transition-colors"
              >
                <div>
                  <Typography variant="bodySm" className="font-mono text-text-muted">
                    {quote.shipment.shipmentNumber}
                  </Typography>
                  <Typography variant="headingSm">
                    {quote.shipment.originCountry ?? 'Origin'} → {quote.shipment.destinationCountry ?? 'Destination'}
                  </Typography>
                </div>
                <Icon icon={IconArrowLeft} size="sm" className="rotate-180" />
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Cost Breakdown */}
        <Card>
          <div className="p-4 pb-0">
            <CardTitle>Cost Breakdown</CardTitle>
          </div>
          <CardContent>
            {quote.lineItems.length === 0 ? (
              <Typography variant="bodySm" colorRole="muted">
                No line items added to this quote.
              </Typography>
            ) : (
              <div className="space-y-6">
                {Object.entries(lineItemsByCategory).map(([category, items]) => (
                  <div key={category}>
                    <Typography variant="bodySm" className="font-medium mb-2">
                      {category}
                    </Typography>
                    <div className="rounded-lg border border-border-primary overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-surface-secondary">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">
                              Description
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-text-muted">
                              Unit Price
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-text-muted">
                              Qty
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-text-muted">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-primary">
                          {items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-2 text-sm">{item.description}</td>
                              <td className="px-4 py-2 text-sm text-right">
                                {item.unitPrice
                                  ? formatCurrency(item.unitPrice, item.currency || quote.currency)
                                  : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                              <td className="px-4 py-2 text-sm text-right font-medium">
                                {formatCurrency(item.total, item.currency || quote.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-surface-secondary">
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-sm font-medium text-right">
                              Subtotal:
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-right">
                              {formatCurrency(
                                items.reduce((sum, item) => sum + item.total, 0),
                                quote.currency,
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-end gap-4 border-t border-border-primary pt-4">
                  <Typography variant="headingSm">Grand Total:</Typography>
                  <Typography variant="headingMd" className="text-text-brand">
                    {formatCurrency(quote.totalPrice, quote.currency)}
                  </Typography>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {(quote.notes || quote.internalNotes) && (
          <Card>
            <div className="p-4 pb-0">
              <CardTitle>Notes</CardTitle>
            </div>
            <CardContent className="space-y-4">
              {quote.notes && (
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide mb-1">
                    General Notes
                  </Typography>
                  <Typography variant="bodySm" className="whitespace-pre-wrap">
                    {quote.notes}
                  </Typography>
                </div>
              )}
              {quote.internalNotes && (
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide mb-1">
                    Internal Notes
                  </Typography>
                  <Typography variant="bodySm" className="whitespace-pre-wrap">
                    {quote.internalNotes}
                  </Typography>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Acceptance/Rejection Info */}
        {quote.status === 'accepted' && quote.acceptedAt && (
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <IconCheck className="h-5 w-5" />
                <Typography variant="bodySm">
                  Accepted on {formatDate(quote.acceptedAt)}
                </Typography>
              </div>
            </CardContent>
          </Card>
        )}

        {quote.status === 'rejected' && quote.rejectedAt && (
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <IconX className="h-5 w-5" />
                <Typography variant="bodySm">
                  Rejected on {formatDate(quote.rejectedAt)}
                  {quote.rejectionReason && ` - ${quote.rejectionReason}`}
                </Typography>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default QuoteDetailPage;
