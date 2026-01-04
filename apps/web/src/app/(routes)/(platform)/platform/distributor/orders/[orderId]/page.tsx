'use client';

import {
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconCloudUpload,
  IconFile,
  IconFileInvoice,
  IconFileText,
  IconLoader2,
  IconPackage,
  IconPhone,
  IconPhoneOff,
  IconPhoto,
  IconShieldCheck,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
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
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Fetch documents to check for invoice status
  const { data: documents, refetch: refetchDocuments } = useQuery({
    ...api.privateClientOrders.getDocuments.queryOptions({ orderId }),
    enabled: !!orderId,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
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

  // Delivery scheduling state
  const [showScheduleDelivery, setShowScheduleDelivery] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [showContactAttempt, setShowContactAttempt] = useState(false);

  // Delivery mutations
  const { mutate: logContactAttempt, isPending: isLoggingContact } = useMutation({
    mutationFn: (notes: string) =>
      trpcClient.privateClientOrders.logContactAttempt.mutate({
        orderId,
        notes,
      }),
    onSuccess: () => {
      toast.success('Contact attempt logged');
      setShowContactAttempt(false);
      setContactNotes('');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to log contact attempt');
    },
  });

  const { mutate: scheduleDelivery, isPending: isScheduling } = useMutation({
    mutationFn: ({ date, notes }: { date: string; notes?: string }) =>
      trpcClient.privateClientOrders.scheduleDelivery.mutate({
        orderId,
        scheduledDate: date,
        notes,
      }),
    onSuccess: () => {
      toast.success('Delivery scheduled');
      setShowScheduleDelivery(false);
      setScheduledDate('');
      setDeliveryNotes('');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to schedule delivery');
    },
  });

  const { mutate: markInTransit, isPending: isMarkingInTransit } = useMutation({
    mutationFn: (notes?: string) =>
      trpcClient.privateClientOrders.markInTransit.mutate({
        orderId,
        notes,
      }),
    onSuccess: () => {
      toast.success('Order marked as in transit');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to mark as in transit');
    },
  });

  const { mutate: markDelivered, isPending: isMarkingDelivered } = useMutation({
    mutationFn: (notes?: string) =>
      trpcClient.privateClientOrders.markDelivered.mutate({
        orderId,
        notes,
      }),
    onSuccess: () => {
      toast.success('Order marked as delivered');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to mark as delivered');
    },
  });

  // Invoice upload
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);

  const { mutateAsync: uploadInvoice } = useMutation({
    mutationFn: async (data: { file: string; filename: string; fileType: string }) => {
      return trpcClient.privateClientOrders.uploadDocument.mutate({
        orderId,
        documentType: 'distributor_invoice',
        file: data.file,
        filename: data.filename,
        fileType: data.fileType as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg',
      });
    },
    onSuccess: () => {
      toast.success('Invoice uploaded successfully');
      // Refetch documents to show the uploaded invoice
      void refetchDocuments();
      void refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload invoice');
    },
  });

  const handleInvoiceFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please select a PDF or image file (PNG, JPG)');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      setIsUploadingInvoice(true);
      try {
        // Convert to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
        });
        reader.readAsDataURL(file);
        const base64 = await base64Promise;

        await uploadInvoice({
          file: base64,
          filename: file.name,
          fileType: file.type,
        });
      } catch (err) {
        console.error('Error uploading invoice:', err);
      } finally {
        setIsUploadingInvoice(false);
        // Reset input so same file can be selected again
        if (invoiceInputRef.current) {
          invoiceInputRef.current.value = '';
        }
      }
    },
    [uploadInvoice],
  );

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
   * Note: Delivery workflow (client_paid -> delivered) is handled by dedicated delivery UI
   */
  const getNextAction = () => {
    if (!order) return null;

    switch (order.status) {
      // Note: awaiting_partner_verification and awaiting_distributor_verification
      // are handled by dedicated verification UI components, not action buttons
      case 'awaiting_client_payment':
        return { label: 'Confirm Client Payment', status: 'client_paid', icon: IconCheck };
      // After client_paid, delivery workflow is handled by dedicated UI below
      // client_paid, scheduling_delivery, delivery_scheduled, out_for_delivery - all handled by delivery UI
      case 'stock_in_transit':
        return { label: 'Stock Received', status: 'with_distributor', icon: IconPackage };
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
              {/* Hidden file input for invoice upload */}
              <input
                ref={invoiceInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleInvoiceFileSelect}
              />
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
                      <>Upload your invoice to send to the partner for client payment.</>
                    ) : !partnerAcknowledgedInvoice ? (
                      <>Invoice uploaded. Waiting for partner to acknowledge receipt before you can confirm payment.</>
                    ) : (
                      <>Partner has acknowledged the invoice. You can now confirm payment once received from the client.</>
                    )}
                  </Typography>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {hasDistributorInvoice && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-fill-success/20 px-2 py-0.5 text-xs text-fill-success">
                        <IconCheck className="h-3 w-3" />
                        Invoice Uploaded
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${partnerAcknowledgedInvoice ? 'bg-fill-success/20 text-fill-success' : 'bg-surface-muted text-text-muted'}`}>
                      {partnerAcknowledgedInvoice ? <IconCheck className="h-3 w-3" /> : <IconFileInvoice className="h-3 w-3" />}
                      {partnerAcknowledgedInvoice ? 'Partner Acknowledged' : 'Awaiting Partner'}
                    </span>
                  </div>
                </div>
                {/* Upload button */}
                {!hasDistributorInvoice && (
                  <Button
                    onClick={() => invoiceInputRef.current?.click()}
                    disabled={isUploadingInvoice}
                    variant="default"
                  >
                    <ButtonContent iconLeft={isUploadingInvoice ? IconLoader2 : IconCloudUpload} isLoading={isUploadingInvoice}>
                      {isUploadingInvoice ? 'Uploading...' : 'Upload Invoice'}
                    </ButtonContent>
                  </Button>
                )}
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

        {/* Delivery Workflow - Schedule Delivery */}
        {(order.status === 'client_paid' || order.status === 'scheduling_delivery') && (
          <Card className="border-2 border-fill-brand/50 bg-fill-brand/5">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-brand/20">
                    <Icon icon={IconPhone} size="lg" className="text-fill-brand" />
                  </div>
                  <div className="flex-1">
                    <Typography variant="headingSm" className="mb-1">
                      Schedule Delivery
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      Contact {order.clientName} to arrange delivery.
                      {order.clientPhone && <> Phone: <strong>{order.clientPhone}</strong></>}
                    </Typography>
                    {/* Show contact attempts */}
                    {order.deliveryContactAttempts && (order.deliveryContactAttempts as Array<{ attemptedAt: string; notes: string }>).length > 0 && (
                      <div className="mt-2 space-y-1">
                        <Typography variant="labelXs" colorRole="muted">Previous contact attempts:</Typography>
                        {(order.deliveryContactAttempts as Array<{ attemptedAt: string; notes: string }>).map((attempt, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-text-muted">
                            <IconPhoneOff className="h-3 w-3" />
                            <span>{new Date(attempt.attemptedAt).toLocaleString()}: {attempt.notes}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Schedule Form */}
                {showScheduleDelivery ? (
                  <div className="ml-16 space-y-3 rounded-lg border border-border-muted bg-surface-secondary/50 p-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-muted">Delivery Date</label>
                      <input
                        type="datetime-local"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-muted">Notes (optional)</label>
                      <textarea
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="Any special instructions..."
                        className="w-full rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => scheduleDelivery({ date: new Date(scheduledDate).toISOString(), notes: deliveryNotes })}
                        disabled={!scheduledDate || isScheduling}
                        colorRole="brand"
                      >
                        <ButtonContent iconLeft={IconCalendar} isLoading={isScheduling}>
                          Confirm Schedule
                        </ButtonContent>
                      </Button>
                      <Button variant="ghost" onClick={() => setShowScheduleDelivery(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : showContactAttempt ? (
                  <div className="ml-16 space-y-3 rounded-lg border border-border-muted bg-surface-secondary/50 p-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-muted">What happened?</label>
                      <textarea
                        value={contactNotes}
                        onChange={(e) => setContactNotes(e.target.value)}
                        placeholder="e.g., No answer, voicemail left, wrong number..."
                        className="w-full rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => logContactAttempt(contactNotes)}
                        disabled={!contactNotes || isLoggingContact}
                        variant="outline"
                      >
                        <ButtonContent iconLeft={IconPhoneOff} isLoading={isLoggingContact}>
                          Log Attempt
                        </ButtonContent>
                      </Button>
                      <Button variant="ghost" onClick={() => setShowContactAttempt(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="ml-16 flex flex-wrap gap-2">
                    <Button onClick={() => setShowScheduleDelivery(true)} colorRole="brand">
                      <ButtonContent iconLeft={IconCalendar}>
                        Schedule Delivery
                      </ButtonContent>
                    </Button>
                    <Button onClick={() => setShowContactAttempt(true)} variant="outline">
                      <ButtonContent iconLeft={IconPhoneOff}>
                        Couldn&apos;t Reach Client
                      </ButtonContent>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Workflow - Delivery Scheduled, Ready to Dispatch */}
        {order.status === 'delivery_scheduled' && (
          <Card className="border-2 border-fill-success/50 bg-fill-success/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-success/20">
                  <Icon icon={IconCalendar} size="lg" className="text-fill-success" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Delivery Scheduled
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Scheduled for{' '}
                    <strong>
                      {order.scheduledDeliveryDate
                        ? new Date(order.scheduledDeliveryDate).toLocaleDateString('en-GB', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
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
                <Button
                  onClick={() => markInTransit(undefined)}
                  disabled={isMarkingInTransit}
                  colorRole="brand"
                >
                  <ButtonContent iconLeft={IconTruck} isLoading={isMarkingInTransit}>
                    Mark In Transit
                  </ButtonContent>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Workflow - Out for Delivery */}
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
                    Order is being delivered to {order.clientName}.
                    {order.clientAddress && <> Address: {order.clientAddress}</>}
                  </Typography>
                </div>
                <Button
                  onClick={() => markDelivered(undefined)}
                  disabled={isMarkingDelivered}
                  colorRole="brand"
                >
                  <ButtonContent iconLeft={IconCheck} isLoading={isMarkingDelivered}>
                    Mark Delivered
                  </ButtonContent>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Complete */}
        {order.status === 'delivered' && (
          <Card className="border-2 border-fill-success/50 bg-fill-success/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-success/20">
                  <Icon icon={IconCheck} size="lg" className="text-fill-success" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Order Delivered
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Successfully delivered on{' '}
                    {order.deliveredAt
                      ? new Date(order.deliveredAt).toLocaleDateString('en-GB', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Unknown date'}
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
                      <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">Pack</th>
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
                        <td className="px-2 py-1.5 text-center text-xs text-text-muted">{item.caseConfig}×{item.bottleSize}</td>
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

        {/* Stock Status Section - Important for distributor to know what's ready for delivery */}
        {order.items && order.items.length > 0 && (
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
                  <span className="text-text-muted">Landed Duty Free (inc. Transfer)</span>
                  <span>{formatPrice(getAmount((Number(order.subtotalUsd) || 0) + (Number(order.logisticsUsd) || 0)), currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Import Duty (20%)</span>
                  <span>{formatPrice(getAmount(order.dutyUsd), currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">VAT (5%)</span>
                  <span>{formatPrice(getAmount(order.vatUsd), currency)}</span>
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

          {/* Partner Info */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-3">
                Partner
              </Typography>
              {order.partner ? (
                <div className="flex items-center gap-3">
                  {order.partner.logoUrl ? (
                    <Image
                      src={order.partner.logoUrl}
                      alt={order.partner.businessName}
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
                      {order.partner.businessName}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Wine Partner
                    </Typography>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-text-muted">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-fill-muted">
                    <Icon icon={IconBuilding} size="md" colorRole="muted" />
                  </div>
                  <Typography variant="bodySm">Unknown</Typography>
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
                  <span className="text-xs text-text-muted">Assigned</span>
                  <span className="text-xs">{formatDate(order.distributorAssignedAt)}</span>
                </div>
                {order.clientPaidAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">Client Paid</span>
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">{formatDate(order.clientPaidAt)}</span>
                  </div>
                )}
                {order.distributorPaidAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Paid to C&C</span>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{formatDate(order.distributorPaidAt)}</span>
                  </div>
                )}
                {order.stockReceivedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Stock Received</span>
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{formatDate(order.stockReceivedAt)}</span>
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
              {documents && documents.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {documents.map((doc) => {
                    const docTypeLabels: Record<string, string> = {
                      partner_invoice: 'Partner Invoice',
                      cc_invoice: 'C&C Invoice',
                      distributor_invoice: 'Distributor Invoice',
                      payment_proof: 'Payment Proof',
                    };
                    const FileIcon = doc.mimeType?.startsWith('image/') ? IconPhoto : IconFileText;
                    const formatFileSize = (bytes: number | null) => {
                      if (!bytes) return '';
                      if (bytes < 1024) return `${bytes} B`;
                      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                    };
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 rounded-lg border border-border-muted bg-fill-muted/30 px-3 py-2"
                      >
                        <Icon icon={FileIcon} size="md" colorRole="muted" />
                        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <Typography variant="bodySm" className="truncate font-medium">
                              {doc.fileName}
                            </Typography>
                            <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-[10px] text-text-muted">
                              {docTypeLabels[doc.documentType] || doc.documentType}
                            </span>
                          </div>
                          <Typography variant="bodyXs" colorRole="muted">
                            {formatFileSize(doc.fileSize)}
                          </Typography>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Icon icon={IconFile} size="sm" />
                          </a>
                        </Button>
                      </div>
                    );
                  })}
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
