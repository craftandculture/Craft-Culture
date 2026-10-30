'use client';

import {
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconCloudUpload,
  IconCopy,
  IconDownload,
  IconFile,
  IconFileInvoice,
  IconFileText,
  IconLoader2,
  IconMail,
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
import DeliveryPhotoUpload from '@/app/_privateClientOrders/components/DeliveryPhotoUpload';
import DistributorSkuCard from '@/app/_privateClientOrders/components/DistributorSkuCard';
import OrderNoteComposer from '@/app/_privateClientOrders/components/OrderNoteComposer';
import PaymentTracker from '@/app/_privateClientOrders/components/PaymentTracker';
import PrivateOrderStatusBadge from '@/app/_privateClientOrders/components/PrivateOrderStatusBadge';
import StockReceiptConfirmation from '@/app/_privateClientOrders/components/StockReceiptConfirmation';
import StockStatusSection from '@/app/_privateClientOrders/components/StockStatusSection';
import WorkflowStepper from '@/app/_privateClientOrders/components/WorkflowStepper';
import { DELIVERY_STAGE_STATUSES } from '@/app/_privateClientOrders/constants';
import describePcoLine from '@/app/_privateClientOrders/utils/describePcoLine';
import summarisePcoQuantities from '@/app/_privateClientOrders/utils/summarisePcoQuantities';
import AlertDialog from '@/app/_ui/components/AlertDialog/AlertDialog';
import AlertDialogAction from '@/app/_ui/components/AlertDialog/AlertDialogAction';
import AlertDialogCancel from '@/app/_ui/components/AlertDialog/AlertDialogCancel';
import AlertDialogContent from '@/app/_ui/components/AlertDialog/AlertDialogContent';
import AlertDialogDescription from '@/app/_ui/components/AlertDialog/AlertDialogDescription';
import AlertDialogFooter from '@/app/_ui/components/AlertDialog/AlertDialogFooter';
import AlertDialogHeader from '@/app/_ui/components/AlertDialog/AlertDialogHeader';
import AlertDialogTitle from '@/app/_ui/components/AlertDialog/AlertDialogTitle';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import USD_TO_AED from '@/lib/currency/usdToAed';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

type Currency = 'USD' | 'AED';

/** Default UAE exchange rate for AED/USD conversion */

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
 * A small button that copies one value, for client details read out or pasted
 * into a delivery app
 */
const CopyButton = ({ value, label }: { value: string; label: string }) => (
  <button
    type="button"
    onClick={() => {
      if (!navigator.clipboard) {
        toast.error('Copying is not available in this browser');
        return;
      }
      navigator.clipboard.writeText(value).then(
        () => toast.success(`${label} copied`),
        () => toast.error('Could not copy'),
      );
    }}
    aria-label={`Copy ${label.toLowerCase()}`}
    title={`Copy ${label.toLowerCase()}`}
    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-fill-muted hover:text-text-primary"
  >
    <Icon icon={IconCopy} size="sm" />
  </button>
);

/** An irreversible step, held until the distributor confirms it */
interface PendingConfirm {
  title: string;
  body: string;
  confirmLabel: string;
  run: () => void;
}

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
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const { data: order, isLoading, error, refetch } = useQuery({
    ...api.privateClientOrders.distributorGetOne.queryOptions({ id: orderId }),
    enabled: !!orderId,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch documents to check for invoice status
  const { data: documents, refetch: refetchDocuments } = useQuery({
    ...api.privateClientOrders.getDocuments.queryOptions({ orderId }),
    enabled: !!orderId,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const hasDistributorInvoice = documents?.some((doc) => doc.documentType === 'distributor_invoice');

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

  // Payment to C&C when delivery was scheduled before the payment steps
  const { mutate: confirmPaymentToCc, isPending: isConfirmingPayment } = useMutation({
    mutationFn: () =>
      trpcClient.privateClientOrders.distributorConfirmPayment.mutate({ orderId }),
    onSuccess: () => {
      toast.success('Payment to Craft & Culture recorded');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to record payment');
    },
  });

  // The partner says the client has paid: the distributor confirms it
  const { mutate: verifyClientPayment, isPending: isVerifyingPayment } = useMutation({
    mutationFn: () =>
      trpcClient.privateClientOrders.distributorPaymentVerification.mutate({ orderId }),
    onSuccess: () => {
      toast.success('Client payment verified');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to verify payment');
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

  // Send proforma invoice to finance via Loops
  const { mutate: sendToFinance, isPending: isSendingToFinance } = useMutation({
    mutationFn: () =>
      trpcClient.privateClientOrders.distributorResendProformaInvoice.mutate({
        orderId,
      }),
    onSuccess: (data) => {
      toast.success(`Proforma invoice sent to ${data.email}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send proforma invoice');
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
        return {
          label: 'Confirm Client Payment',
          status: 'client_paid',
          icon: IconCheck,
          hint: 'When the client has paid you in full, confirm it here.',
          confirm:
            'Confirm that the client has paid you in full. This cannot be undone from the portal.',
        };
      // The same payment steps the order list offers, so the Pay C&C task can be done here.
      // Delivery scheduling for these statuses stays in the delivery card below.
      case 'client_paid':
        return {
          label: 'Mark Awaiting Distributor Payment',
          status: 'awaiting_distributor_payment',
          icon: IconCheck,
          hint: 'The client has paid. Record that your payment to Craft & Culture is being raised.',
          confirm: 'Record that your payment to Craft & Culture is being raised.',
        };
      case 'awaiting_distributor_payment':
        return {
          label: 'Confirm Payment to C&C',
          status: 'distributor_paid',
          icon: IconCheck,
          hint: 'Once your payment to Craft & Culture has been sent, confirm it here.',
          confirm:
            'Confirm that your payment to Craft & Culture has been sent. Craft & Culture then releases the stock to you.',
        };
      // scheduling_delivery, delivery_scheduled, out_for_delivery - all handled by delivery UI
      case 'stock_in_transit':
        return {
          label: 'Stock Received',
          status: 'with_distributor',
          icon: IconPackage,
          hint: 'Craft & Culture has sent the stock. Confirm when it reaches your warehouse.',
          confirm:
            'Confirm that the stock for this order has arrived at your warehouse. Check the case labels against the order first.',
        };
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
    // Not found and not assigned read the same; a failed load says so instead
    const notFound =
      !error || (error as { data?: { code?: string } | null }).data?.code === 'NOT_FOUND';
    return (
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Typography variant="headingSm" className="mb-2">
              {notFound ? 'Order Not Found' : 'The order could not be loaded'}
            </Typography>
            <Typography variant="bodyMd" colorRole="muted" className="mb-4">
              {notFound
                ? 'This order does not exist or is not assigned to you.'
                : 'Check your connection and try again.'}
            </Typography>
            <div className="flex flex-wrap justify-center gap-2">
              {!notFound && (
                <Button type="button" onClick={() => void refetch()}>
                  Try again
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link href="/platform/distributor/orders">Back to Assigned Orders</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nextAction = getNextAction();

  // The one status change waiting on the distributor, shown first on the page
  const nextStep =
    order.status === 'awaiting_payment_verification'
      ? {
          label: 'Verify Client Payment',
          icon: IconCheck,
          hint: 'The partner reports that the client has paid. Check that the payment has reached you, then verify it.',
          confirm: "Confirm that the client's payment has reached you.",
          run: () => verifyClientPayment(),
          isPending: isVerifyingPayment,
        }
      : nextAction
        ? {
            label: nextAction.label,
            icon: nextAction.icon,
            hint: nextAction.hint,
            confirm: nextAction.confirm,
            run: () => updateStatus.mutate(nextAction.status),
            isPending: updateStatus.isPending,
          }
        : (DELIVERY_STAGE_STATUSES as readonly string[]).includes(order.status) &&
            !order.distributorPaidAt
          ? {
              label: 'Confirm Payment to C&C',
              icon: IconCheck,
              hint: 'Delivery is under way. Once your payment to Craft & Culture has been sent, confirm it here.',
              confirm: 'Confirm that your payment to Craft & Culture has been sent.',
              run: () => confirmPaymentToCc(),
              isPending: isConfirmingPayment,
            }
          : null;
  // The server refuses client payment without the distributor's invoice
  const invoiceMissing =
    order.status === 'awaiting_client_payment' && documents !== undefined && !hasDistributorInvoice;
  // Not a block: the server looks the SKU up in the distributor's feed on confirming
  const skuMissing =
    order.status === 'awaiting_client_payment' &&
    !!order.distributor?.requiresOrderSku &&
    !order.distributorSku;

  // Calculate exchange rate for AED conversion (use actual rate if available, otherwise default)
  // At the fixed peg; the stored ratio carried 3.67 on orders totalled before 28 Oct 2026
  const usdToAedRate = USD_TO_AED;

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
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/distributor/orders" aria-label="Back to Assigned Orders">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <Typography variant="headingLg" className="font-mono">
              {order.orderNumber}
            </Typography>
            <PrivateOrderStatusBadge status={order.status} />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Currency Toggle */}
            <div
              className="inline-flex items-center rounded-lg border border-border-muted bg-surface-secondary/50 p-0.5"
              role="group"
              aria-label="Currency"
            >
              {(['AED', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  aria-pressed={currency === c}
                  className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    currency === c
                      ? 'bg-background-primary text-text-primary shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Download PDF Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(`/api/distributor/pco/proforma?orderId=${orderId}`, '_blank')}
              aria-label="Download proforma PDF"
            >
              <ButtonContent iconLeft={IconDownload}>
                <span className="hidden sm:inline">Download</span> PDF
              </ButtonContent>
            </Button>

            {/* Send to Finance Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => sendToFinance()}
              disabled={isSendingToFinance}
              aria-label="Email the proforma to your finance team"
              title={order.distributor?.financeEmail ? `Sends to ${order.distributor.financeEmail}` : undefined}
            >
              <ButtonContent iconLeft={IconMail} isLoading={isSendingToFinance}>
                <span className="hidden sm:inline">Send to</span> Finance
              </ButtonContent>
            </Button>

          </div>
        </div>

        {/* Next step: the one status change waiting on the distributor, first on the page */}
        {nextStep && (
          <Card className="border-2 border-fill-warning/50 bg-fill-warning/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <Typography variant="labelSm" colorRole="muted" className="uppercase tracking-wider">
                  Next step
                </Typography>
                <Typography variant="headingSm" className="mt-0.5">
                  {nextStep.label}
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="mt-1">
                  {nextStep.hint}
                </Typography>
                {invoiceMissing && (
                  <Typography variant="bodyXs" className="mt-1 font-medium text-text-warning">
                    Upload your invoice first. It is needed before client payment can be confirmed.
                  </Typography>
                )}
                {skuMissing && (
                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                    No bundle SKU is recorded yet. It is looked up in your stock feed when you
                    confirm; if it is not found there, enter it in the SKU card below.
                  </Typography>
                )}
              </div>
              <Button
                type="button"
                colorRole="brand"
                size="lg"
                className="w-full shrink-0 sm:w-auto"
                disabled={nextStep.isPending || invoiceMissing}
                onClick={() =>
                  setPendingConfirm({
                    title: nextStep.label,
                    body: nextStep.confirm,
                    confirmLabel: nextStep.label,
                    run: nextStep.run,
                  })
                }
              >
                <ButtonContent iconLeft={nextStep.icon} isLoading={nextStep.isPending}>
                  {nextStep.label}
                </ButtonContent>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* First thing on a received order: the bundle SKU in their system */}
        {order.distributor?.requiresOrderSku && (
          <DistributorSkuCard
            key={order.distributorSku ?? 'none'}
            audience="distributor"
            orderId={order.id}
            orderNumber={order.orderNumber}
            status={order.status}
            distributorName={order.distributor.businessName}
            sku={order.distributorSku}
            source={order.distributorSkuSource}
            distributorRef={order.distributorRef}
          />
        )}

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
                    Check that <strong>{order.clientName}</strong> is registered in your system.
                    The partner has confirmed the client should be verified with you.
                  </Typography>
                  {order.clientPhone && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      Client phone:{' '}
                      <a href={`tel:${order.clientPhone}`} className="font-medium text-text-primary underline-offset-2 hover:underline">
                        {order.clientPhone}
                      </a>
                    </Typography>
                  )}
                  {order.clientEmail && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      Client email:{' '}
                      <a href={`mailto:${order.clientEmail}`} className="font-medium text-text-primary underline-offset-2 hover:underline">
                        {order.clientEmail}
                      </a>
                    </Typography>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2 sm:flex-nowrap">
                  <Button
                    type="button"
                    onClick={() => distributorVerification({ response: 'verified' })}
                    disabled={isVerifying}
                    colorRole="brand"
                  >
                    <ButtonContent iconLeft={IconCheck} isLoading={isVerifying}>
                      Client Verified
                    </ButtonContent>
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      setPendingConfirm({
                        title: 'Client not verified',
                        body: `The order is suspended and Craft & Culture and the partner are told that ${order.clientName} was not found in your system. You can unlock it later if the client registers.`,
                        confirmLabel: 'Not Verified',
                        run: () =>
                          distributorVerification({
                            response: 'not_verified',
                            notes: 'Client not found in system',
                          }),
                      })
                    }
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
          <Card className="border-2 border-text-primary/50 bg-text-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-text-primary/20">
                  <Icon icon={IconShieldCheck} size="lg" className="text-text-primary" />
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
                  {order.clientEmail && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                      Client email: {order.clientEmail}
                    </Typography>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2 sm:flex-nowrap">
                  <Button
                    type="button"
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

        {/* Invoice Status - shown when awaiting client payment and no invoice uploaded */}
        {order.status === 'awaiting_client_payment' && !hasDistributorInvoice && (
          <Card className="border-2 border-fill-warning/50 bg-fill-warning/5">
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
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-warning/20">
                  <Icon icon={IconFileInvoice} size="lg" className="text-fill-warning" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Upload your invoice
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Needed before you can confirm the client&rsquo;s payment. It is also shared with
                    the partner for their records. PDF, PNG or JPG, up to 10 MB.
                  </Typography>
                </div>
                <Button
                  type="button"
                  onClick={() => invoiceInputRef.current?.click()}
                  disabled={isUploadingInvoice}
                  colorRole="brand"
                  className="w-full sm:w-auto"
                >
                  <ButtonContent iconLeft={isUploadingInvoice ? IconLoader2 : IconCloudUpload} isLoading={isUploadingInvoice}>
                    {isUploadingInvoice ? 'Uploading…' : 'Upload Invoice'}
                  </ButtonContent>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Reference Display - shown when order has a payment reference */}
        {order.paymentReference && order.status === 'awaiting_client_payment' && (
          <Card className="border-2 border-text-primary/50 bg-text-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-text-primary/20">
                  <Icon icon={IconCheck} size="md" className="text-text-primary" />
                </div>
                <div className="flex min-w-0 items-center gap-1">
                  <div className="min-w-0">
                    <Typography variant="labelSm" colorRole="muted">
                      Payment Reference
                    </Typography>
                    <Typography variant="headingSm" className="break-all font-mono">
                      {order.paymentReference}
                    </Typography>
                  </div>
                  <CopyButton value={order.paymentReference} label="Payment reference" />
                </div>
                <div className="ml-auto text-right">
                  <Typography variant="labelSm" colorRole="muted">
                    Amount Due
                  </Typography>
                  <Typography variant="headingSm" className="tabular-nums">
                    {formatPrice(getAmount(order.totalUsd), currency)}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Workflow - Schedule Delivery */}
        {/* Payment may complete before delivery - show delivery UI for all post-payment statuses */}
        {(order.status === 'client_paid' ||
          order.status === 'awaiting_distributor_payment' ||
          order.status === 'distributor_paid' ||
          order.status === 'awaiting_partner_payment' ||
          order.status === 'partner_paid' ||
          order.status === 'scheduling_delivery') && (
          <Card className="border-2 border-text-primary/50 bg-text-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-text-primary/20">
                    <Icon icon={IconPhone} size="lg" className="text-text-primary" />
                  </div>
                  <div className="flex-1">
                    <Typography variant="headingSm" className="mb-1">
                      Schedule Delivery
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      Contact {order.clientName} to arrange delivery.
                      {order.clientPhone && (
                        <>
                          {' '}Phone:{' '}
                          <a href={`tel:${order.clientPhone}`} className="font-semibold text-text-primary underline-offset-2 hover:underline">
                            {order.clientPhone}
                          </a>
                        </>
                      )}
                    </Typography>
                    {order.clientEmail && (
                      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                        If the client cannot be reached by phone or WhatsApp, email:{' '}
                        <a href={`mailto:${order.clientEmail}`} className="font-medium text-text-primary underline-offset-2 hover:underline">
                          {order.clientEmail}
                        </a>
                      </Typography>
                    )}
                    {order.clientAddress && (
                      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                        Address: {order.clientAddress}
                      </Typography>
                    )}
                    {/* Show contact attempts */}
                    {order.deliveryContactAttempts && (order.deliveryContactAttempts as Array<{ attemptedAt: string; notes: string }>).length > 0 && (
                      <div className="mt-2 space-y-1">
                        <Typography variant="labelXs" colorRole="muted">Previous contact attempts:</Typography>
                        {(order.deliveryContactAttempts as Array<{ attemptedAt: string; notes: string }>).map((attempt, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-text-muted">
                            <IconPhoneOff className="h-3 w-3" />
                            <span>
                              {new Date(attempt.attemptedAt).toLocaleString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              : {attempt.notes}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Schedule Form */}
                {showScheduleDelivery ? (
                  <div className="space-y-3 rounded-lg border border-border-muted bg-surface-secondary/50 p-4 sm:ml-16">
                    <div>
                      <label htmlFor="pco-delivery-date" className="mb-1 block text-xs font-medium text-text-muted">
                        Delivery date and time
                      </label>
                      <input
                        id="pco-delivery-date"
                        type="datetime-local"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="min-h-10 w-full rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="pco-delivery-notes" className="mb-1 block text-xs font-medium text-text-muted">
                        Notes (optional)
                      </label>
                      <textarea
                        id="pco-delivery-notes"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="Any special instructions"
                        className="w-full rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm"
                        rows={2}
                      />
                    </div>
                    {!scheduledDate && (
                      <Typography variant="bodyXs" colorRole="muted">
                        Choose a date and time to confirm the schedule.
                      </Typography>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => scheduleDelivery({ date: new Date(scheduledDate).toISOString(), notes: deliveryNotes })}
                        disabled={!scheduledDate || isScheduling}
                        colorRole="brand"
                      >
                        <ButtonContent iconLeft={IconCalendar} isLoading={isScheduling}>
                          Confirm Schedule
                        </ButtonContent>
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setShowScheduleDelivery(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : showContactAttempt ? (
                  <div className="space-y-3 rounded-lg border border-border-muted bg-surface-secondary/50 p-4 sm:ml-16">
                    <div>
                      <label htmlFor="pco-contact-notes" className="mb-1 block text-xs font-medium text-text-muted">
                        What happened?
                      </label>
                      <textarea
                        id="pco-contact-notes"
                        value={contactNotes}
                        onChange={(e) => setContactNotes(e.target.value)}
                        placeholder="For example: no answer, voicemail left, wrong number"
                        className="w-full rounded-md border border-border-muted bg-background-primary px-3 py-2 text-sm"
                        rows={2}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => logContactAttempt(contactNotes)}
                        disabled={!contactNotes.trim() || isLoggingContact}
                        variant="outline"
                      >
                        <ButtonContent iconLeft={IconPhoneOff} isLoading={isLoggingContact}>
                          Log Attempt
                        </ButtonContent>
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setShowContactAttempt(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 sm:ml-16">
                    <Button type="button" onClick={() => setShowScheduleDelivery(true)} colorRole="brand">
                      <ButtonContent iconLeft={IconCalendar}>
                        Schedule Delivery
                      </ButtonContent>
                    </Button>
                    <Button type="button" onClick={() => setShowContactAttempt(true)} variant="outline">
                      <ButtonContent iconLeft={IconPhoneOff}>
                        Could Not Reach Client
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
                  type="button"
                  onClick={() => markInTransit(undefined)}
                  disabled={isMarkingInTransit}
                  colorRole="brand"
                  className="w-full sm:w-auto"
                >
                  <ButtonContent iconLeft={IconTruck} isLoading={isMarkingInTransit}>
                    Mark Out for Delivery
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
                    Being delivered to {order.clientName}.
                    {order.clientAddress && <> Address: {order.clientAddress}</>}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                    Mark it delivered once the client has the wine, and upload the proof of delivery
                    below.
                  </Typography>
                </div>
                <Button
                  type="button"
                  onClick={() =>
                    setPendingConfirm({
                      title: 'Mark delivered',
                      body: `Confirm that ${order.clientName} has received the order. This completes the order and cannot be undone from the portal. You can still upload the proof of delivery afterwards.`,
                      confirmLabel: 'Mark Delivered',
                      run: () => markDelivered(undefined),
                    })
                  }
                  disabled={isMarkingDelivered}
                  colorRole="brand"
                  className="w-full sm:w-auto"
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

        {/* Delivery Photo Upload - Available during and after delivery */}
        {(order.status === 'out_for_delivery' || order.status === 'delivered') && (
          <DeliveryPhotoUpload
            orderId={orderId}
            existingPhotoUrl={order.deliveryPhoto}
            orderStatus={order.status}
            onUploaded={() => void refetch()}
          />
        )}

        <WorkflowStepper order={order} />

        {/* Line Items - Full Width, Primary Focus */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <Typography variant="headingSm">
                Line Items ({order.items?.length ?? 0})
              </Typography>
              <div className="flex items-center gap-4 text-sm text-text-muted">
                <span>{summarisePcoQuantities(order.items ?? [])}</span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {formatPrice(getAmount(order.totalUsd), currency)}
                </span>
              </div>
            </div>

            {order.items && order.items.length > 0 ? (
              (() => {
                // Each line's share of the client price, worked out on the server
                const orderTotal = order.totalUsd ?? 0;
                // A subscription box is priced as a whole, not wine by wine
                const isBox = order.items.some((item) => item.inBox);

                return (
                  <>
                    {/* Mobile: Card layout */}
                    <div className="flex flex-col divide-y divide-border-muted md:hidden">
                      {order.items.map((item) => {
                        const clientTotal = item.clientTotalUsd;
                        const clientPricePerCase = item.clientPricePerCaseUsd;
                        const distributorCostPerCase = item.distributorCostPerCaseUsd;
                        const line = describePcoLine(item);
                        return (
                          <div key={item.id} className="py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <Typography variant="bodySm" className="font-medium">
                                  {item.productName}
                                </Typography>
                                <Typography variant="bodyXs" colorRole="muted">
                                  {item.producer || '-'} {item.vintage ? `· ${item.vintage}` : ''}
                                </Typography>
                              </div>
                              <Typography variant="bodySm" className="flex-shrink-0 font-semibold tabular-nums">
                                {item.inBox ? 'In box' : formatPrice(getAmount(clientTotal), currency)}
                              </Typography>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-text-muted">
                              <span className="font-medium text-text-primary">{line.qty}</span>
                              <span>{line.pack}</span>
                              {!item.inBox && (
                                <>
                                  <span>Client: {formatPrice(getAmount(clientPricePerCase), currency)}/{line.unit}</span>
                                  <span>Your cost: {formatPrice(getAmount(distributorCostPerCase), currency)}/{line.unit}</span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop: Table layout */}
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full">
                        <thead className="border-b border-border-muted">
                          <tr>
                            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted text-left">Wine</th>
                            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted text-left">Quantity</th>
                            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted whitespace-nowrap text-right">Your cost</th>
                            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted whitespace-nowrap text-right">Client price</th>
                            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted whitespace-nowrap text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-muted/60">
                          {order.items.map((item) => {
                            const clientTotal = item.clientTotalUsd;
                            const clientPricePerCase = item.clientPricePerCaseUsd;
                            const distributorCostPerCase = item.distributorCostPerCaseUsd;
                            const line = describePcoLine(item);
                            return (
                              <tr key={item.id} className="align-top hover:bg-surface-muted/20">
                                <td className="px-4 py-3.5">
                                  <Typography variant="bodySm" className="font-medium leading-snug">
                                    {item.productName}
                                  </Typography>
                                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                                    {[item.producer, item.vintage].filter(Boolean).join(' · ') || '—'}
                                  </Typography>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3.5">
                                  <Typography variant="bodySm" className="font-medium">
                                    {line.count}
                                  </Typography>
                                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                                    {line.isSingle ? line.pack : `${line.pack} · ${line.bottles} btl`}
                                  </Typography>
                                </td>
                                {item.inBox ? (
                                  <td className="whitespace-nowrap px-4 py-3.5 text-right" colSpan={3}>
                                    <Typography variant="bodySm" colorRole="muted">
                                      In box
                                    </Typography>
                                  </td>
                                ) : (
                                  <>
                                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">
                                      <Typography variant="bodySm" colorRole="muted">
                                        {formatPrice(getAmount(distributorCostPerCase), currency)}
                                        <span className="text-xs"> /{line.unit}</span>
                                      </Typography>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">
                                      <Typography variant="bodySm">
                                        {formatPrice(getAmount(clientPricePerCase), currency)}
                                        <span className="text-xs text-text-muted"> /{line.unit}</span>
                                      </Typography>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">
                                      <Typography variant="bodySm" className="font-semibold">
                                        {formatPrice(getAmount(clientTotal), currency)}
                                      </Typography>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t border-border-muted">
                          <tr>
                            <td className="px-4 py-3.5">
                              <Typography variant="bodySm" className="font-semibold">
                                {isBox ? 'Box price' : 'Total'}
                              </Typography>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5" colSpan={3}>
                              <Typography variant="bodySm" colorRole="muted">
                                {summarisePcoQuantities(order.items)}
                              </Typography>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">
                              <Typography variant="bodySm" className="font-semibold">
                                {formatPrice(getAmount(orderTotal), currency)}
                              </Typography>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                );
              })()
            ) : (
              <Typography variant="bodySm" colorRole="muted">
                No line items
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Stock Receipt Confirmation - Shows when items are in transit to distributor */}
        {order.items && order.items.some(
          (item) =>
            item.stockStatus === 'in_transit_to_distributor' ||
            item.stockStatus === 'at_cc_bonded',
        ) && (
          <StockReceiptConfirmation
            orderId={orderId}
            items={order.items.map((item) => ({
              id: item.id,
              productName: item.productName,
              vintage: item.vintage,
              quantity: item.quantity,
              stockStatus: item.stockStatus,
              caseConfig: item.caseConfig,
              bottleSize: item.bottleSize,
            }))}
            onConfirmed={() => void refetch()}
          />
        )}

        {/* Stock Status Section - Important for distributor to know what's ready for delivery */}
        {order.items && order.items.length > 0 && (
          <StockStatusSection
            items={order.items.map((item) => ({
              id: item.id,
              productName: item.productName,
              vintage: item.vintage,
              quantity: item.quantity,
              caseConfig: item.caseConfig,
              bottleSize: item.bottleSize,
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
              <div className="space-y-1 text-sm tabular-nums">
                <div className="flex justify-between gap-2">
                  <span className="text-text-muted">Your cost: landed duty free (incl. transfer)</span>
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <IconShieldCheck className="h-3.5 w-3.5" />
                    Verified by CD
                  </span>
                )}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between gap-1">
                  <Typography variant="bodySm" className="font-medium">
                    {order.clientName || '-'}
                  </Typography>
                  {(order.clientPhone || order.clientEmail || order.clientAddress) && (
                    <CopyButton
                      value={[order.clientName, order.clientPhone, order.clientEmail, order.clientAddress]
                        .filter(Boolean)
                        .join('\n')}
                      label="Delivery details"
                    />
                  )}
                </div>
                {order.clientPhone ? (
                  <a
                    href={`tel:${order.clientPhone}`}
                    className="inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-text-primary underline-offset-2 hover:underline"
                  >
                    <Icon icon={IconPhone} size="xs" />
                    {order.clientPhone}
                  </a>
                ) : (
                  <Typography variant="bodyXs" colorRole="muted">
                    No phone number
                  </Typography>
                )}
                {order.clientEmail ? (
                  <a
                    href={`mailto:${order.clientEmail}`}
                    className="inline-flex min-h-8 items-center gap-1.5 break-all text-xs font-medium text-text-primary underline-offset-2 hover:underline"
                  >
                    <Icon icon={IconMail} size="xs" />
                    {order.clientEmail}
                  </a>
                ) : (
                  <Typography variant="bodyXs" colorRole="muted">
                    No email address
                  </Typography>
                )}
                {order.clientAddress && (
                  <Typography variant="bodyXs" colorRole="muted" className="whitespace-pre-line">
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
                  {order.partner.logoUrl && order.partner.logoUrl.startsWith('http') ? (
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
                      Placed by
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
              <PaymentTracker order={order} canVerifyPayments={true} audience="distributor" />
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
                      cc_invoice: 'C&C Invoice',
                      distributor_invoice: 'Your Invoice',
                      payment_proof: 'Payment Proof',
                      proof_of_delivery: 'Proof of Delivery',
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
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${doc.fileName}`}
                            title="Open"
                          >
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
            <OrderNoteComposer
              audience="distributor"
              orderId={order.id}
              partnerName={order.partner ? order.partner.businessName : null}
              distributorName={order.distributor?.businessName}
            />
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

      {/* Irreversible steps are confirmed before they are sent */}
      <AlertDialog
        open={!!pendingConfirm}
        onOpenChange={(open) => {
          if (!open) setPendingConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingConfirm?.title} · {order.orderNumber}
            </AlertDialogTitle>
            <AlertDialogDescription>{pendingConfirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                colorRole="brand"
                onClick={() => {
                  pendingConfirm?.run();
                  setPendingConfirm(null);
                }}
              >
                {pendingConfirm?.confirmLabel}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DistributorOrderDetailPage;
