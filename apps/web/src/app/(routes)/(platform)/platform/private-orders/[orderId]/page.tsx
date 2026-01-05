'use client';

import {
  IconAlertCircle,
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconDownload,
  IconExternalLink,
  IconFile,
  IconFileInvoice,
  IconLoader2,
  IconPhone,
  IconPhoto,
  IconQuestionMark,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import ActivityTimeline from '@/app/_privateClientOrders/components/ActivityTimeline';
import PaymentTracker from '@/app/_privateClientOrders/components/PaymentTracker';
import PrivateOrderStatusBadge from '@/app/_privateClientOrders/components/PrivateOrderStatusBadge';
import StockStatusSection from '@/app/_privateClientOrders/components/StockStatusSection';
import WorkflowStepper from '@/app/_privateClientOrders/components/WorkflowStepper';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

type Currency = 'USD' | 'AED';

/** Default UAE exchange rate for AED/USD conversion */
const DEFAULT_EXCHANGE_RATE = 3.67;

/** Format file size in human-readable format */
const formatBytes = (bytes: number | null | undefined) => {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * Format a price value with currency
 */
const formatCurrencyValue = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Partner detail view for a single private client order
 *
 * Shows full order details including line items in read-only mode.
 * Matches admin UX patterns with compact layout.
 */
const PrivateOrderDetailPage = () => {
  const params = useParams();
  const orderId = params.orderId as string;
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState<Currency>('USD');
  const [isDeliveredExpanded, setIsDeliveredExpanded] = useState(true);

  // Fetch order details
  const { data: order, isLoading, refetch } = useQuery({
    ...api.privateClientOrders.getOne.queryOptions({ id: orderId }),
    enabled: !!orderId,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Fetch documents to check for distributor invoice
  const { data: documents } = useQuery({
    ...api.privateClientOrders.getDocuments.queryOptions({ orderId }),
    enabled: !!orderId,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const distributorInvoice = documents?.find((doc) => doc.documentType === 'distributor_invoice');

  // Approve revisions mutation
  const { mutate: approveRevisions, isPending: isApproving } = useMutation(
    api.privateClientOrders.approveRevisions.mutationOptions({
      onSuccess: () => {
        toast.success('Revisions approved! Order resubmitted for review.');
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to approve revisions');
      },
    }),
  );

  // Partner verification mutation
  const { mutate: partnerVerification, isPending: isVerifying } = useMutation(
    api.privateClientOrders.partnerVerification.mutationOptions({
      onSuccess: (_data, variables) => {
        if (variables.response === 'yes') {
          toast.success('Verification confirmed. Distributor will now verify the client.');
        } else {
          toast.info('Order suspended. Please resolve client verification with the distributor.');
        }
        void refetch();
        void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to submit verification response');
      },
    }),
  );

  // Re-initiate verification mutation (for suspended orders)
  const { mutate: reinitiateVerification, isPending: isReinitiating } = useMutation({
    mutationFn: (notes?: string) =>
      trpcClient.privateClientOrders.partnerReinitiateVerification.mutate({
        orderId,
        notes,
      }),
    onSuccess: () => {
      toast.success('Verification re-initiated. Distributor will now verify the client.');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to re-initiate verification');
    },
  });

  // Acknowledge invoice mutation
  const { mutate: acknowledgeInvoice, isPending: isAcknowledging } = useMutation({
    mutationFn: () =>
      trpcClient.privateClientOrders.partnerAcknowledgeInvoice.mutate({
        orderId,
      }),
    onSuccess: () => {
      toast.success('Invoice acknowledged. You can now monitor for client payment.');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to acknowledge invoice');
    },
  });

  const handleApproveRevisions = () => {
    approveRevisions({ orderId });
  };

  const handlePartnerVerification = (response: 'yes' | 'no' | 'dont_know') => {
    partnerVerification({ orderId, response });
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Typography variant="headingSm" className="mb-2">
              Order Not Found
            </Typography>
            <Typography variant="bodyMd" colorRole="muted" className="mb-4">
              The order you&apos;re looking for doesn&apos;t exist or has been deleted.
            </Typography>
            <Button variant="outline" asChild>
              <Link href="/platform/private-orders">Back to Orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate exchange rate for AED conversion (use actual rate if available, otherwise default)
  const totalAed = Number(order.totalAed) || 0;
  const totalUsd = Number(order.totalUsd) || 1;
  const usdToAedRate = totalAed > 0 ? totalAed / totalUsd : DEFAULT_EXCHANGE_RATE;

  /**
   * Convert amount to selected currency
   */
  const getAmount = (usdAmount: number | string | null | undefined) => {
    const amount = Number(usdAmount) || 0;
    return currency === 'USD' ? amount : amount * usdToAedRate;
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-4">
        {/* Header - compact */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/private-orders">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <Typography variant="headingLg">{order.orderNumber}</Typography>
            <PrivateOrderStatusBadge status={order.status} />
          </div>
          <div className="flex items-center gap-3">
            {/* Approve Revisions button - shown when C&C has made changes and requested review */}
            {order.status === 'revision_requested' && (
              <Button
                onClick={handleApproveRevisions}
                disabled={isApproving}
              >
                <ButtonContent iconLeft={IconCheck}>
                  {isApproving ? 'Approving...' : 'Approve Revisions'}
                </ButtonContent>
              </Button>
            )}
            {/* Currency Toggle */}
            <div className="inline-flex items-center rounded-lg border border-border-muted bg-surface-secondary/50 p-0.5">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  currency === 'USD'
                    ? 'bg-background-primary text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => setCurrency('AED')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  currency === 'AED'
                    ? 'bg-background-primary text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                AED
              </button>
            </div>
            <Typography variant="bodySm" colorRole="muted">
              Created {formatDate(order.createdAt)}
            </Typography>
          </div>
        </div>

        {/* Workflow Stepper */}
        <WorkflowStepper order={order} />

        {/* Partner Verification Prompt - shown when awaiting partner verification */}
        {order.status === 'awaiting_partner_verification' && order.distributor && (
          <Card className="border-2 border-fill-warning/50 bg-fill-warning/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-warning/20">
                  <Icon icon={IconAlertCircle} size="lg" className="text-fill-warning" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Client Verification Required
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Is your client verified with <strong>{order.distributor.businessName}</strong>?
                    This confirmation is required before the order can proceed.
                  </Typography>
                </div>
                <div className="flex flex-wrap justify-center gap-2 sm:flex-nowrap">
                  <Button
                    onClick={() => handlePartnerVerification('yes')}
                    disabled={isVerifying}
                    variant="default"
                  >
                    <ButtonContent iconLeft={IconCheck}>Yes, Verified</ButtonContent>
                  </Button>
                  <Button
                    onClick={() => handlePartnerVerification('no')}
                    disabled={isVerifying}
                    variant="outline"
                  >
                    <ButtonContent iconLeft={IconX}>No</ButtonContent>
                  </Button>
                  <Button
                    onClick={() => handlePartnerVerification('dont_know')}
                    disabled={isVerifying}
                    variant="ghost"
                  >
                    <ButtonContent iconLeft={IconQuestionMark}>Don&apos;t Know</ButtonContent>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verification Suspended Notice with Re-initiate Button */}
        {order.status === 'verification_suspended' && (
          <Card className="border-2 border-fill-warning/50 bg-fill-warning/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-warning/20">
                  <Icon icon={IconAlertCircle} size="lg" className="text-fill-warning" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Order Suspended - Client Verification Needed
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    This order is suspended because the client could not be verified with{' '}
                    <strong>{order.distributor?.businessName ?? 'the distributor'}</strong>.
                    Once your client has registered with the distributor, click the button to re-initiate verification.
                  </Typography>
                </div>
                <div className="flex flex-wrap justify-center gap-2 sm:flex-nowrap">
                  <Button
                    onClick={() => reinitiateVerification('Client has now registered with distributor')}
                    disabled={isReinitiating}
                    colorRole="brand"
                  >
                    <ButtonContent iconLeft={IconCheck} isLoading={isReinitiating}>
                      Client Registered - Re-verify
                    </ButtonContent>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Acknowledgment Required - shown when invoice uploaded but not acknowledged */}
        {order.status === 'awaiting_client_payment' && distributorInvoice && !order.partnerInvoiceAcknowledgedAt && (
          <Card className="border-2 border-fill-info/50 bg-fill-info/5">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-info/20">
                    <Icon icon={IconFileInvoice} size="lg" className="text-fill-info" />
                  </div>
                  <div className="flex-1">
                    <Typography variant="headingSm" className="mb-1">
                      Invoice Received - Acknowledgment Required
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      <strong>{order.distributor?.businessName ?? 'The distributor'}</strong> has uploaded an invoice.
                      Please review and forward it to your client for payment.
                    </Typography>
                  </div>
                </div>

                {/* Invoice Details Card */}
                <div className="rounded-lg border border-border-muted bg-background-primary p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-fill-info/10">
                        <Icon icon={IconFile} size="md" className="text-fill-info" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Typography variant="bodySm" className="truncate font-medium">
                          {distributorInvoice.fileName}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {formatBytes(distributorInvoice.fileSize)} • Uploaded {new Date(distributorInvoice.uploadedAt).toLocaleDateString()}
                        </Typography>
                        {/* Show extracted invoice number if available */}
                        {distributorInvoice.extractedData?.invoiceNumber && (
                          <Typography variant="bodyXs" className="mt-1 font-medium text-fill-info">
                            Invoice #: {distributorInvoice.extractedData.invoiceNumber}
                          </Typography>
                        )}
                        {/* Show extracted payment reference if available */}
                        {distributorInvoice.extractedData?.paymentReference && (
                          <Typography variant="bodyXs" className="font-medium text-fill-success">
                            Payment Ref: {distributorInvoice.extractedData.paymentReference}
                          </Typography>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={distributorInvoice.fileUrl} target="_blank" rel="noopener noreferrer">
                          <ButtonContent iconLeft={IconExternalLink}>View</ButtonContent>
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={distributorInvoice.fileUrl} download={distributorInvoice.fileName}>
                          <ButtonContent iconLeft={IconDownload}>Download</ButtonContent>
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={() => acknowledgeInvoice()}
                    disabled={isAcknowledging}
                    colorRole="brand"
                  >
                    <ButtonContent iconLeft={IconCheck} isLoading={isAcknowledging}>
                      Acknowledge Invoice & Forward to Client
                    </ButtonContent>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Acknowledged - shown when acknowledged and awaiting client payment */}
        {order.status === 'awaiting_client_payment' && order.partnerInvoiceAcknowledgedAt && distributorInvoice && (
          <Card className="border-2 border-fill-success/50 bg-fill-success/5">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-success/20">
                    <Icon icon={IconCheck} size="lg" className="text-fill-success" />
                  </div>
                  <div className="flex-1">
                    <Typography variant="headingSm" className="mb-1">
                      Invoice Acknowledged - Awaiting Client Payment
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      Forward the invoice to your client. Once payment is received, the distributor will confirm.
                    </Typography>
                  </div>
                </div>

                {/* Invoice Details Card */}
                <div className="rounded-lg border border-border-muted bg-background-primary p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-fill-success/10">
                        <Icon icon={IconFile} size="md" className="text-fill-success" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Typography variant="bodySm" className="truncate font-medium">
                          {distributorInvoice.fileName}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {formatBytes(distributorInvoice.fileSize)} • Uploaded {new Date(distributorInvoice.uploadedAt).toLocaleDateString()}
                        </Typography>
                        {/* Show extracted invoice number if available */}
                        {distributorInvoice.extractedData?.invoiceNumber && (
                          <Typography variant="bodyXs" className="mt-1 font-medium text-fill-info">
                            Invoice #: {distributorInvoice.extractedData.invoiceNumber}
                          </Typography>
                        )}
                        {/* Show extracted payment reference if available */}
                        {distributorInvoice.extractedData?.paymentReference && (
                          <Typography variant="bodyXs" className="font-medium text-fill-success">
                            Payment Ref: {distributorInvoice.extractedData.paymentReference}
                          </Typography>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={distributorInvoice.fileUrl} target="_blank" rel="noopener noreferrer">
                          <ButtonContent iconLeft={IconExternalLink}>View</ButtonContent>
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={distributorInvoice.fileUrl} download={distributorInvoice.fileName}>
                          <ButtonContent iconLeft={IconDownload}>Download</ButtonContent>
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client Paid - Awaiting Delivery Scheduling */}
        {order.status === 'client_paid' && (
          <Card className="border-2 border-fill-success/50 bg-fill-success/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-success/20">
                  <Icon icon={IconCheck} size="lg" className="text-fill-success" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Payment Confirmed - Awaiting Delivery
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Client payment has been confirmed.{' '}
                    <strong>{order.distributor?.businessName ?? 'The distributor'}</strong> will contact your client to arrange delivery.
                  </Typography>
                  {order.clientPaidAt && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      Payment confirmed:{' '}
                      {new Date(order.clientPaidAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Typography>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Scheduling in Progress - shown when distributor is trying to contact client */}
        {order.status === 'scheduling_delivery' && (
          <Card className="border-2 border-fill-info/50 bg-fill-info/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-info/20">
                  <Icon icon={IconPhone} size="lg" className="text-fill-info" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Delivery Being Scheduled
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    <strong>{order.distributor?.businessName ?? 'The distributor'}</strong> is contacting your client to arrange delivery.
                  </Typography>
                  {/* Show contact attempts if any */}
                  {order.deliveryContactAttempts && (order.deliveryContactAttempts as Array<{ attemptedAt: string; notes: string }>).length > 0 && (
                    <div className="mt-3 space-y-2">
                      <Typography variant="labelSm" colorRole="muted">
                        Contact Attempts:
                      </Typography>
                      {(order.deliveryContactAttempts as Array<{ attemptedAt: string; notes: string }>).map((attempt, idx) => (
                        <div key={idx} className="rounded-md border border-border-muted bg-background-primary p-2">
                          <Typography variant="bodyXs" colorRole="muted">
                            {new Date(attempt.attemptedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Typography>
                          <Typography variant="bodySm">{attempt.notes}</Typography>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Scheduled - shown when delivery date is set */}
        {order.status === 'delivery_scheduled' && (
          <Card className="border-2 border-fill-info/50 bg-fill-info/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-info/20">
                  <Icon icon={IconCalendar} size="lg" className="text-fill-info" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Delivery Scheduled
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Delivery to your client is scheduled for{' '}
                    <strong>
                      {order.scheduledDeliveryDate
                        ? new Date(order.scheduledDeliveryDate).toLocaleDateString('en-GB', {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })
                        : 'TBD'}
                    </strong>
                  </Typography>
                  {order.deliveryNotes && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      Notes: {order.deliveryNotes}
                    </Typography>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Out for Delivery - shown when order is in transit */}
        {order.status === 'out_for_delivery' && (
          <Card className="border-2 border-fill-warning/50 bg-fill-warning/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-warning/20">
                  <Icon icon={IconTruck} size="lg" className="text-fill-warning" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Out for Delivery
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Your client&apos;s order is currently being delivered by{' '}
                    <strong>{order.distributor?.businessName ?? 'the distributor'}</strong>.
                  </Typography>
                  {order.outForDeliveryAt && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      Dispatched:{' '}
                      {new Date(order.outForDeliveryAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivered - shown when order has been delivered */}
        {order.status === 'delivered' && (
          <Card className="border-2 border-fill-success/50 bg-fill-success/5">
            <CardContent className="p-0">
              {/* Collapsible Header */}
              <button
                type="button"
                onClick={() => setIsDeliveredExpanded(!isDeliveredExpanded)}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-fill-success/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-fill-success/20">
                    <Icon icon={IconCheck} size="md" className="text-fill-success" />
                  </div>
                  <div>
                    <Typography variant="headingSm" className="mb-0.5">
                      Order Delivered
                    </Typography>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1 rounded-full bg-fill-success/20 px-2 py-0.5 text-fill-success">
                        <IconCheck size={12} /> Delivered
                      </span>
                      {order.deliveryPhoto && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-fill-success/20 px-2 py-0.5 text-fill-success">
                          <IconCheck size={12} /> Proof of Delivery
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Icon
                  icon={IconChevronDown}
                  size="md"
                  className={`text-text-muted transition-transform ${isDeliveredExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Collapsible Content */}
              {isDeliveredExpanded && (
                <div className="border-t border-fill-success/20 p-4 pt-4">
                  <div className="space-y-4">
                    {/* Delivery Confirmation */}
                    <div className="flex flex-col gap-3 rounded-lg bg-background-primary/50 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-fill-success/20">
                          <Icon icon={IconCheck} size="sm" className="text-fill-success" />
                        </div>
                        <div>
                          <Typography variant="labelMd" className="mb-0.5">
                            Successfully Delivered
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            Your client&apos;s order has been successfully delivered.
                          </Typography>
                          {order.deliveredAt && (
                            <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                              {new Date(order.deliveredAt).toLocaleDateString('en-GB', {
                                weekday: 'long',
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                              })}{' '}
                              at{' '}
                              {new Date(order.deliveredAt).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Proof of Delivery */}
                    <div className="flex flex-col gap-3 rounded-lg bg-background-primary/50 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                          order.deliveryPhoto ? 'bg-fill-success/20' : 'bg-fill-muted'
                        }`}>
                          <Icon
                            icon={order.deliveryPhoto ? IconCheck : IconPhoto}
                            size="sm"
                            className={order.deliveryPhoto ? 'text-fill-success' : 'text-text-muted'}
                          />
                        </div>
                        <div>
                          <Typography variant="labelMd" className="mb-0.5">
                            Proof of Delivery
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            {order.deliveryPhoto
                              ? 'Photo uploaded by distributor'
                              : 'No delivery photo available'}
                          </Typography>
                        </div>
                      </div>

                      {order.deliveryPhoto && (
                        <a
                          href={order.deliveryPhoto}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative overflow-hidden rounded-lg border border-border-muted"
                        >
                          <Image
                            src={order.deliveryPhoto}
                            alt="Proof of delivery"
                            width={120}
                            height={80}
                            className="h-[80px] w-[120px] object-cover transition-transform group-hover:scale-105"
                            unoptimized
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                            <IconExternalLink className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Line Items - Full Width, Primary Focus */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <Typography variant="headingSm">
                Line Items ({order.items?.length ?? 0})
              </Typography>
              <div className="flex items-center gap-4 text-sm text-text-muted">
                <span>{order.caseCount ?? 0} cases</span>
                <span className="font-semibold text-text-primary">
                  {formatCurrencyValue(getAmount(order.totalUsd), currency)}
                </span>
              </div>
            </div>

            {order.items && order.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border-muted bg-surface-secondary/50">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">Product</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">Producer</th>
                      <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">Yr</th>
                      <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">Pack</th>
                      <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">Qty</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide text-text-muted">{currency}/Case</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide text-text-muted">Total ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted/50">
                    {order.items.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-muted/20">
                        <td className="px-2 py-1.5">
                          <span className="text-xs font-medium">{item.productName}</span>
                          {item.lwin && (
                            <span className="ml-1 text-[10px] text-text-muted">
                              ({item.lwin})
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-xs">{item.producer || '-'}</td>
                        <td className="px-2 py-1.5 text-center text-xs">{item.vintage || '-'}</td>
                        <td className="px-2 py-1.5 text-center text-xs text-text-muted">{item.caseConfig}×{item.bottleSize}</td>
                        <td className="px-2 py-1.5 text-center text-xs font-medium">{item.quantity}</td>
                        <td className="px-2 py-1.5 text-right text-xs">
                          {formatCurrencyValue(getAmount(item.pricePerCaseUsd), currency)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs font-semibold">
                          {formatCurrencyValue(getAmount(item.totalUsd), currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Typography variant="bodySm" colorRole="muted">
                No line items
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Stock Status Section - Show after order is approved */}
        {order.items && order.items.length > 0 && order.status !== 'submitted' && order.status !== 'under_cc_review' && order.status !== 'revision_requested' && (
          <StockStatusSection
            items={order.items.map((item) => ({
              id: item.id,
              productName: item.productName,
              vintage: item.vintage,
              quantity: item.quantity,
              source: item.source,
              stockStatus: item.stockStatus,
              stockExpectedAt: item.stockExpectedAt ? new Date(item.stockExpectedAt) : null,
              stockConfirmedAt: item.stockConfirmedAt ? new Date(item.stockConfirmedAt) : null,
            }))}
          />
        )}


        {/* Secondary Info - Horizontal Grid Below */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Order Summary - Compact */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-2">
                Summary ({currency})
              </Typography>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Landed Duty Free</span>
                  <span>{formatCurrencyValue(getAmount(order.subtotalUsd), currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Import Duty (20%)</span>
                  <span>{formatCurrencyValue(getAmount(order.dutyUsd), currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Transfer (0.75%)</span>
                  <span>{formatCurrencyValue(getAmount(order.logisticsUsd), currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">VAT (5%)</span>
                  <span>{formatCurrencyValue(getAmount(order.vatUsd), currency)}</span>
                </div>
                <Divider />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrencyValue(getAmount(order.totalUsd), currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Info - Compact */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-2">
                Client
              </Typography>
              <div className="space-y-1 text-sm">
                <Typography variant="bodySm" className="font-medium">
                  {order.clientName || '-'}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {order.clientEmail || '-'}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {order.clientPhone || '-'}
                </Typography>
              </div>
            </CardContent>
          </Card>

          {/* Distributor Info */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-3">
                Distributor
              </Typography>
              {order.distributor ? (
                <div className="flex items-center gap-3">
                  {order.distributor.logoUrl ? (
                    <Image
                      src={order.distributor.logoUrl}
                      alt={order.distributor.businessName}
                      width={44}
                      height={44}
                      className="rounded-lg object-contain"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-fill-muted">
                      <Icon icon={IconBuilding} size="md" colorRole="muted" />
                    </div>
                  )}
                  <div>
                    <Typography variant="bodySm" className="font-semibold">
                      {order.distributor.businessName}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Assigned Distributor
                    </Typography>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-text-muted">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-dashed border-border-muted">
                    <Icon icon={IconBuilding} size="md" colorRole="muted" />
                  </div>
                  <Typography variant="bodySm">Not yet assigned</Typography>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Key Dates */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-3">
                Key Dates
              </Typography>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Created</span>
                  <span className="text-xs">{formatDate(order.createdAt)}</span>
                </div>
                {order.submittedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Submitted</span>
                    <span className="text-xs font-medium">{formatDate(order.submittedAt)}</span>
                  </div>
                )}
                {order.ccApprovedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">Approved</span>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">{formatDate(order.ccApprovedAt)}</span>
                  </div>
                )}
                {order.deliveredAt && (
                  <div className="flex items-center justify-between rounded-md bg-green-50 px-2 py-1.5 dark:bg-green-900/20">
                    <span className="text-xs font-semibold text-green-700 dark:text-green-300">Delivered</span>
                    <span className="text-xs font-semibold text-green-700 dark:text-green-300">{formatDate(order.deliveredAt)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment, Documents & Activity - Full Width Grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <PaymentTracker order={order} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-3">
                Documents
              </Typography>
              {documents && documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border border-border-muted bg-surface-secondary/30 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-fill-muted/20">
                          <Icon icon={IconFile} size="sm" colorRole="muted" />
                        </div>
                        <div>
                          <Typography variant="bodySm" className="font-medium">
                            {doc.fileName}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            {doc.documentType.replace(/_/g, ' ')} • {formatBytes(doc.fileSize)}
                          </Typography>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Icon icon={IconExternalLink} size="sm" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.fileUrl} download={doc.fileName}>
                            <Icon icon={IconDownload} size="sm" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Typography variant="bodySm" colorRole="muted">
                  No documents uploaded yet
                </Typography>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card>
          <CardContent className="p-4">
            <Typography variant="headingSm" className="mb-3">
              Activity Timeline
            </Typography>
            <ActivityTimeline activities={order.activityLogs ?? []} />
          </CardContent>
        </Card>

        {/* Notes - if present */}
        {(order.partnerNotes || order.deliveryNotes || order.clientAddress) && (
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {order.clientAddress && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Delivery Address
                    </Typography>
                    <Typography variant="bodySm">{order.clientAddress}</Typography>
                  </div>
                )}
                {order.deliveryNotes && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Delivery Notes
                    </Typography>
                    <Typography variant="bodySm">{order.deliveryNotes}</Typography>
                  </div>
                )}
                {order.partnerNotes && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Internal Notes
                    </Typography>
                    <Typography variant="bodySm">{order.partnerNotes}</Typography>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PrivateOrderDetailPage;
