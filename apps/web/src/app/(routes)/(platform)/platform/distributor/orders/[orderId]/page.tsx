'use client';

import {
  IconArrowLeft,
  IconBuilding,
  IconCheck,
  IconFileInvoice,
  IconLoader2,
  IconPackage,
  IconShieldCheck,
  IconTruck,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import ActivityTimeline from '@/app/_privateClientOrders/components/ActivityTimeline';
import DocumentUpload from '@/app/_privateClientOrders/components/DocumentUpload';
import PaymentTracker from '@/app/_privateClientOrders/components/PaymentTracker';
import PrivateOrderStatusBadge from '@/app/_privateClientOrders/components/PrivateOrderStatusBadge';
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

/**
 * Format a price value with currency
 */
const formatPrice = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Distributor order detail page
 *
 * Shows full order details with action buttons for status updates.
 * Matches admin UX patterns with compact layout.
 */
const DistributorOrderDetailPage = () => {
  const params = useParams();
  const orderId = params.orderId as string;
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState<Currency>('AED');

  const { data: order, isLoading, refetch } = useQuery({
    ...api.privateClientOrders.distributorGetOne.queryOptions({ id: orderId }),
    enabled: !!orderId,
  });

  // Fetch documents to check for invoice status
  const { data: documents } = useQuery({
    ...api.privateClientOrders.getDocuments.queryOptions({ orderId }),
    enabled: !!orderId,
  });

  const hasDistributorInvoice = documents?.some((doc) => doc.documentType === 'distributor_invoice');
  const partnerAcknowledgedInvoice = !!order?.partnerInvoiceAcknowledgedAt;

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      trpcClient.privateClientOrders.distributorUpdateStatus.mutate({
        orderId,
        status: status as
          | 'awaiting_client_payment'
          | 'client_paid'
          | 'awaiting_distributor_payment'
          | 'distributor_paid'
          | 'stock_in_transit'
          | 'with_distributor'
          | 'out_for_delivery'
          | 'delivered',
      }),
    onSuccess: () => {
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
      toast.success('Order status updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  // Distributor verification mutation
  const { mutate: distributorVerification, isPending: isVerifying } = useMutation({
    mutationFn: ({ response, notes }: { response: 'verified' | 'not_verified'; notes?: string }) =>
      trpcClient.privateClientOrders.distributorVerification.mutate({
        orderId,
        response,
        notes,
      }),
    onSuccess: (_data, variables) => {
      if (variables.response === 'verified') {
        toast.success('Client verified. Ready for payment collection.');
      } else {
        toast.info('Client not verified. Order suspended for partner to resolve.');
      }
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to submit verification');
    },
  });

  // Unlock suspended order mutation
  const { mutate: unlockSuspended, isPending: isUnlocking } = useMutation({
    mutationFn: (notes?: string) =>
      trpcClient.privateClientOrders.distributorUnlockSuspended.mutate({
        orderId,
        notes,
      }),
    onSuccess: () => {
      toast.success('Order unlocked. Client verified. Ready for payment collection.');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to unlock order');
    },
  });

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  /**
   * Get next action matching backend distributorTransitions exactly
   *
   * Note: awaiting_distributor_verification is handled by a separate verification UI
   */
  const getNextAction = () => {
    if (!order) return null;

    switch (order.status) {
      // Note: awaiting_partner_verification and awaiting_distributor_verification
      // are handled by dedicated verification UI components, not action buttons
      case 'awaiting_client_payment':
        return { label: 'Confirm Client Payment', status: 'client_paid', icon: IconCheck };
      case 'client_paid':
        return { label: 'Awaiting Distributor Payment', status: 'awaiting_distributor_payment', icon: IconCheck };
      case 'awaiting_distributor_payment':
        return { label: 'Confirm Payment to C&C', status: 'distributor_paid', icon: IconCheck };
      // distributor_paid: Wait for C&C to mark stock_in_transit - no action button
      case 'stock_in_transit':
        return { label: 'Stock Received', status: 'with_distributor', icon: IconPackage };
      case 'with_distributor':
        return { label: 'Start Delivery', status: 'out_for_delivery', icon: IconTruck };
      case 'out_for_delivery':
        return { label: 'Mark Delivered', status: 'delivered', icon: IconCheck };
      default:
        return null;
    }
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
              The order you&apos;re looking for doesn&apos;t exist or is not assigned to you.
            </Typography>
            <Button variant="outline" asChild>
              <Link href="/platform/distributor/orders">Back to Orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nextAction = getNextAction();

  // Calculate exchange rate for AED conversion (use actual rate if available, otherwise default)
  const totalAed = Number(order.totalAed) || 0;
  const totalUsd = Number(order.totalUsd) || 1;
  const usdToAedRate = totalAed > 0 ? totalAed / totalUsd : DEFAULT_EXCHANGE_RATE;

  /**
   * Convert amount to selected currency
   */
  const getAmount = (usdAmount: number | null | undefined) => {
    const amount = Number(usdAmount) || 0;
    return currency === 'USD' ? amount : amount * usdToAedRate;
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-4">
        {/* Header - compact with action button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/distributor/orders">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <Typography variant="headingLg">{order.orderNumber}</Typography>
            <PrivateOrderStatusBadge status={order.status} />
          </div>

          <div className="flex items-center gap-3">
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

            {/* Next Action Button */}
            {nextAction && (
              <Button
                colorRole="brand"
                onClick={() => updateStatus.mutate(nextAction.status)}
                disabled={updateStatus.isPending || (nextAction.status === 'client_paid' && (!hasDistributorInvoice || !partnerAcknowledgedInvoice))}
              >
                <ButtonContent iconLeft={nextAction.icon} isLoading={updateStatus.isPending}>
                  {nextAction.label}
                </ButtonContent>
              </Button>
            )}
          </div>
        </div>

        {/* Workflow Stepper */}
        <WorkflowStepper order={order} />

        {/* Distributor Verification Prompt - shown when awaiting distributor verification */}
        {order.status === 'awaiting_distributor_verification' && (
          <Card className="border-2 border-fill-warning/50 bg-fill-warning/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-warning/20">
                  <Icon icon={IconShieldCheck} size="lg" className="text-fill-warning" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Client Verification Required
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Please verify that <strong>{order.clientName}</strong> is registered in your system.
                    The partner has confirmed the client should be verified with you.
                  </Typography>
                  {order.clientPhone && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      Client phone: {order.clientPhone}
                    </Typography>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2 sm:flex-nowrap">
                  <Button
                    onClick={() => distributorVerification({ response: 'verified' })}
                    disabled={isVerifying}
                    variant="default"
                  >
                    <ButtonContent iconLeft={IconCheck}>Client Verified</ButtonContent>
                  </Button>
                  <Button
                    onClick={() => distributorVerification({ response: 'not_verified', notes: 'Client not found in system' })}
                    disabled={isVerifying}
                    variant="outline"
                  >
                    <ButtonContent iconLeft={IconX}>Not Verified</ButtonContent>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unlock Suspended Order - shown when verification was previously suspended */}
        {order.status === 'verification_suspended' && (
          <Card className="border-2 border-fill-brand/50 bg-fill-brand/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-brand/20">
                  <Icon icon={IconShieldCheck} size="lg" className="text-fill-brand" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Order Suspended - Client Verification Needed
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    This order was suspended because the client (<strong>{order.clientName}</strong>) was not found in your system.
                    If the client has now registered, you can unlock the order to proceed with payment collection.
                  </Typography>
                  {order.clientPhone && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      Client phone: {order.clientPhone}
                    </Typography>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2 sm:flex-nowrap">
                  <Button
                    onClick={() => unlockSuspended('Client now registered and verified')}
                    disabled={isUnlocking}
                    colorRole="brand"
                  >
                    <ButtonContent iconLeft={IconCheck} isLoading={isUnlocking}>
                      Client Verified - Unlock Order
                    </ButtonContent>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Status - shown when awaiting client payment */}
        {order.status === 'awaiting_client_payment' && (
          <Card className={`border-2 ${hasDistributorInvoice && partnerAcknowledgedInvoice ? 'border-fill-success/50 bg-fill-success/5' : 'border-fill-warning/50 bg-fill-warning/5'}`}>
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${hasDistributorInvoice && partnerAcknowledgedInvoice ? 'bg-fill-success/20' : 'bg-fill-warning/20'}`}>
                  <Icon
                    icon={hasDistributorInvoice && partnerAcknowledgedInvoice ? IconCheck : IconFileInvoice}
                    size="lg"
                    className={hasDistributorInvoice && partnerAcknowledgedInvoice ? 'text-fill-success' : 'text-fill-warning'}
                  />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    {hasDistributorInvoice && partnerAcknowledgedInvoice
                      ? 'Ready for Payment Confirmation'
                      : 'Invoice Required Before Payment Confirmation'}
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {!hasDistributorInvoice ? (
                      <>Upload an invoice in the Documents section below before confirming client payment.</>
                    ) : !partnerAcknowledgedInvoice ? (
                      <>Invoice uploaded. Waiting for partner to acknowledge receipt before you can confirm payment.</>
                    ) : (
                      <>Partner has acknowledged the invoice. You can now confirm payment once received from the client.</>
                    )}
                  </Typography>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${hasDistributorInvoice ? 'bg-fill-success/20 text-fill-success' : 'bg-fill-warning/20 text-fill-warning'}`}>
                      {hasDistributorInvoice ? <IconCheck className="h-3 w-3" /> : <IconUpload className="h-3 w-3" />}
                      {hasDistributorInvoice ? 'Invoice Uploaded' : 'Upload Invoice'}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${partnerAcknowledgedInvoice ? 'bg-fill-success/20 text-fill-success' : 'bg-surface-muted text-text-muted'}`}>
                      {partnerAcknowledgedInvoice ? <IconCheck className="h-3 w-3" /> : <IconFileInvoice className="h-3 w-3" />}
                      {partnerAcknowledgedInvoice ? 'Partner Acknowledged' : 'Awaiting Partner'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Reference Display - shown when order has a payment reference */}
        {order.paymentReference && order.status === 'awaiting_client_payment' && (
          <Card className="border-2 border-fill-brand/50 bg-fill-brand/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-fill-brand/20">
                  <Icon icon={IconCheck} size="md" className="text-fill-brand" />
                </div>
                <div>
                  <Typography variant="labelSm" colorRole="muted">
                    Payment Reference
                  </Typography>
                  <Typography variant="headingSm">{order.paymentReference}</Typography>
                </div>
                <div className="ml-auto text-right">
                  <Typography variant="labelSm" colorRole="muted">
                    Amount Due
                  </Typography>
                  <Typography variant="headingSm">
                    {formatPrice(getAmount(order.totalUsd), currency)}
                  </Typography>
                </div>
              </div>
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
                  {formatPrice(getAmount(order.totalUsd), currency)}
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
                      <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">Qty</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide text-text-muted">Total ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted/50">
                    {order.items.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-muted/20">
                        <td className="px-2 py-1.5">
                          <span className="text-xs font-medium">{item.productName}</span>
                        </td>
                        <td className="px-2 py-1.5 text-xs">{item.producer || '-'}</td>
                        <td className="px-2 py-1.5 text-center text-xs">{item.vintage || '-'}</td>
                        <td className="px-2 py-1.5 text-center text-xs font-medium">{item.quantity}</td>
                        <td className="px-2 py-1.5 text-right text-xs font-semibold">
                          {formatPrice(getAmount(item.totalUsd), currency)}
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
                  <span className="text-text-muted">Subtotal</span>
                  <span>{formatPrice(getAmount(order.subtotalUsd), currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Duty (5%)</span>
                  <span>{formatPrice(getAmount(order.dutyUsd), currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">VAT (5%)</span>
                  <span>{formatPrice(getAmount(order.vatUsd), currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Logistics</span>
                  <span>{formatPrice(getAmount(order.logisticsUsd), currency)}</span>
                </div>
                <Divider />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(getAmount(order.totalUsd), currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Info - Compact */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <Typography variant="labelSm" colorRole="muted">
                  Client
                </Typography>
                {order.client?.cityDrinksVerifiedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <IconShieldCheck className="h-3 w-3" />
                    Verified by CD
                  </span>
                )}
              </div>
              <div className="space-y-1 text-sm">
                <Typography variant="bodySm" className="font-medium">
                  {order.clientName || '-'}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {order.clientPhone || '-'}
                </Typography>
                {order.clientAddress && (
                  <Typography variant="bodyXs" colorRole="muted" className="line-clamp-2">
                    {order.clientAddress}
                  </Typography>
                )}
                {order.client?.cityDrinksAccountName && (
                  <Typography variant="bodyXs" colorRole="muted">
                    CD Account: {order.client.cityDrinksAccountName}
                  </Typography>
                )}
                {order.client?.cityDrinksPhone && (
                  <Typography variant="bodyXs" colorRole="muted">
                    CD Phone: {order.client.cityDrinksPhone}
                  </Typography>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Partner Info - Compact with logo */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-2">
                Partner
              </Typography>
              {order.partner ? (
                <div className="flex items-center gap-2">
                  {order.partner.logoUrl ? (
                    <Image
                      src={order.partner.logoUrl}
                      alt={order.partner.businessName}
                      width={28}
                      height={28}
                      className="rounded object-contain"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-fill-muted">
                      <Icon icon={IconBuilding} size="xs" colorRole="muted" />
                    </div>
                  )}
                  <Typography variant="bodySm" className="font-medium">
                    {order.partner.businessName}
                  </Typography>
                </div>
              ) : (
                <Typography variant="bodyXs" colorRole="muted">
                  Unknown
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Key Dates - Compact */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-2">
                Key Dates
              </Typography>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Assigned</span>
                  <span>{formatDate(order.distributorAssignedAt)}</span>
                </div>
                {order.clientPaidAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Client Paid</span>
                    <span>{formatDate(order.clientPaidAt)}</span>
                  </div>
                )}
                {order.distributorPaidAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Paid to C&C</span>
                    <span>{formatDate(order.distributorPaidAt)}</span>
                  </div>
                )}
                {order.stockReceivedAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Stock Received</span>
                    <span>{formatDate(order.stockReceivedAt)}</span>
                  </div>
                )}
                {order.deliveredAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Delivered</span>
                    <span>{formatDate(order.deliveredAt)}</span>
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
              <PaymentTracker
                order={order}
                canConfirmPayments={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-3">
                Documents
              </Typography>
              <DocumentUpload orderId={orderId} />
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
        {(order.distributorNotes || order.deliveryNotes) && (
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {order.deliveryNotes && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Delivery Notes
                    </Typography>
                    <Typography variant="bodySm">{order.deliveryNotes}</Typography>
                  </div>
                )}
                {order.distributorNotes && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Your Notes
                    </Typography>
                    <Typography variant="bodySm">{order.distributorNotes}</Typography>
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

export default DistributorOrderDetailPage;
