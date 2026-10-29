'use client';

import {
  IconAlertCircle,
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconFile,
  IconFileInvoice,
  IconInfoCircle,
  IconLoader2,
  IconPhone,
  IconPhoto,
  IconPlus,
  IconQuestionMark,
  IconTrash,
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
import CloneOrderDialog from '@/app/_privateClientOrders/components/CloneOrderDialog';
import OrderNoteComposer from '@/app/_privateClientOrders/components/OrderNoteComposer';
import PaymentTracker from '@/app/_privateClientOrders/components/PaymentTracker';
import PrivateOrderStatusBadge from '@/app/_privateClientOrders/components/PrivateOrderStatusBadge';
import ProductPicker from '@/app/_privateClientOrders/components/ProductPicker';
import StockStatusSection from '@/app/_privateClientOrders/components/StockStatusSection';
import SubscriptionBoxPicker from '@/app/_privateClientOrders/components/SubscriptionBoxPicker';
import WorkflowStepper from '@/app/_privateClientOrders/components/WorkflowStepper';
import describePcoLine from '@/app/_privateClientOrders/utils/describePcoLine';
import summarisePcoQuantities from '@/app/_privateClientOrders/utils/summarisePcoQuantities';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import MobileCard from '@/app/_ui/components/MobileCard/MobileCard';
import MobileCardList from '@/app/_ui/components/MobileCard/MobileCardList';
import Typography from '@/app/_ui/components/Typography/Typography';
import USD_TO_AED from '@/lib/currency/usdToAed';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';
import fileHref from '@/utils/fileHref';

type Currency = 'USD' | 'AED';

/** Default UAE exchange rate for AED/USD conversion */

/** Statuses where partner can edit items */
const EDITABLE_STATUSES = ['draft', 'revision_requested'];

interface EditingItem {
  id: string;
  quantity: number;
  pricePerCaseUsd: number;
}

type StockSource = 'partner_local' | 'partner_airfreight' | 'cc_inventory' | 'manual';

interface NewItem {
  productId?: string;
  productOfferId?: string;
  productName: string;
  producer: string;
  vintage: string;
  region: string;
  lwin: string;
  bottleSize: string;
  caseConfig: number;
  quantity: number;
  pricePerCaseUsd: number;
  source: StockSource;
}

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

/** Document types as a partner reads them */
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  partner_invoice: 'Your invoice to C&C',
  partner_sales_order: 'Your sales order',
  cc_invoice: 'C&C invoice',
  distributor_invoice: 'Client invoice',
  payment_proof: 'Payment proof',
  proof_of_delivery: 'Proof of delivery',
};

/**
 * What happens next on an order, for the statuses that have no card of their own
 *
 * The statuses with a dedicated card below (verification, invoice, delivery)
 * already say what is needed. Every other status gets one plain line here, so
 * the top of the page always answers "is this waiting on me?".
 */
const nextStepFor = (
  status: string,
  hasClientInvoice: boolean,
): { title: string; body: string; needsYou: boolean } | null => {
  switch (status) {
    case 'draft':
      return {
        title: 'Draft: not yet sent to C&C',
        body: 'Check the client details and the lines below, then select Submit for review. C&C will review pricing and availability before the order proceeds.',
        needsYou: true,
      };
    case 'submitted':
    case 'under_cc_review':
      return {
        title: 'With C&C for review',
        body: 'No action is needed from you. If anything needs to change, C&C will return the order to you with a note.',
        needsYou: false,
      };
    case 'revision_requested':
      return {
        title: 'Changes requested by C&C',
        body: 'Review the lines below and edit them if needed, then select Approve revisions to resubmit the order.',
        needsYou: true,
      };
    case 'cc_approved':
    case 'awaiting_distributor_verification':
      return {
        title: 'Approved: client verification in progress',
        body: 'The distributor is verifying your client. No action is needed from you at this stage.',
        needsYou: false,
      };
    case 'awaiting_client_payment':
      return hasClientInvoice
        ? null
        : {
            title: 'Awaiting the client invoice',
            body: 'The client invoice will appear on this page once it is issued. You will then be asked to forward it to your client.',
            needsYou: false,
          };
    case 'awaiting_payment_verification':
      return {
        title: 'Client payment being confirmed',
        body: 'The client payment has been reported and is being confirmed. No action is needed from you.',
        needsYou: false,
      };
    case 'awaiting_distributor_payment':
    case 'awaiting_partner_payment':
    case 'partner_paid':
    case 'stock_in_transit':
    case 'with_distributor':
    case 'distributor_paid':
      return {
        title: 'In fulfilment',
        body: 'The wine is being prepared for delivery to your client. No action is needed from you.',
        needsYou: false,
      };
    case 'cancelled':
      return {
        title: 'Order cancelled',
        body: 'This order has been cancelled. No further action is needed.',
        needsYou: false,
      };
    default:
      return null;
  }
};

/**
 * Format a price value with currency
 */
const formatCurrencyValue = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState<NewItem>({
    productName: '',
    producer: '',
    vintage: '',
    region: '',
    lwin: '',
    bottleSize: '750ml',
    caseConfig: 12,
    quantity: 1,
    pricePerCaseUsd: 0,
    source: 'manual',
  });

  // Fetch order details
  const { data: order, isLoading, isError, refetch } = useQuery({
    ...api.privateClientOrders.getOne.queryOptions({ id: orderId }),
    enabled: !!orderId,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Subscription clubs (e.g. a monthly box) get the box tag and clone tool
  const { data: subscriptionAccess } = useQuery(
    api.privateClientOrders.subscriptionAccess.queryOptions(),
  );
  const subscriptionsEnabled = subscriptionAccess?.enabled ?? false;

  // Fetch documents to check for distributor invoice
  const { data: documents } = useQuery({
    ...api.privateClientOrders.getDocuments.queryOptions({ orderId }),
    enabled: !!orderId,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const distributorInvoice = documents?.find((doc) => doc.documentType === 'distributor_invoice');

  // Get partner's allowed stock source (CULT wines → cultx, others → local_inventory)
  const { data: stockSourceData } = useQuery(
    api.privateClientOrders.partnerGetStockSource.queryOptions(),
  );
  const stockSource = stockSourceData?.stockSource;

  // Submit order mutation (for draft orders)
  const { mutate: submitOrder, isPending: isSubmitting } = useMutation(
    api.privateClientOrders.submit.mutationOptions({
      onSuccess: () => {
        toast.success('Order submitted to C&C for review');
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to submit order');
      },
    }),
  );

  // Approve revisions mutation
  const { mutate: approveRevisions, isPending: isApproving } = useMutation(
    api.privateClientOrders.approveRevisions.mutationOptions({
      onSuccess: () => {
        toast.success('Revisions approved. The order has been resubmitted for review.');
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
          toast.success('Verification confirmed. The distributor will now verify the client.');
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
      toast.success('Verification re-initiated. The distributor will now verify the client.');
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
      toast.success('Invoice acknowledged. Client payment will be confirmed on this page.');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to acknowledge invoice');
    },
  });

  // Update item mutation (for editing items in draft/revision_requested orders)
  const { mutate: updateItem, isPending: isUpdatingItem } = useMutation(
    api.privateClientOrders.updateItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item updated');
        setEditingItem(null);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update item');
      },
    }),
  );

  // Add item mutation
  const { mutate: addItem, isPending: isAddingItemPending } = useMutation(
    api.privateClientOrders.addItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item added');
        setIsAddingItem(false);
        setNewItem({
          productName: '',
          producer: '',
          vintage: '',
          region: '',
          lwin: '',
          bottleSize: '750ml',
          caseConfig: 12,
          quantity: 1,
          pricePerCaseUsd: 0,
          source: 'manual',
        });
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to add item');
      },
    }),
  );

  // Remove item mutation
  const { mutate: removeItem, isPending: isRemovingItem } = useMutation(
    api.privateClientOrders.removeItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item removed');
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to remove item');
      },
    }),
  );

  const handleSubmitOrder = () => {
    submitOrder({ orderId });
  };

  const handleApproveRevisions = () => {
    approveRevisions({ orderId });
  };

  const handlePartnerVerification = (response: 'yes' | 'no' | 'dont_know') => {
    partnerVerification({ orderId, response });
  };

  const handleEditItem = (item: { id: string; quantity: number; pricePerCaseUsd: number | string }) => {
    setEditingItem({
      id: item.id,
      quantity: item.quantity,
      pricePerCaseUsd: Number(item.pricePerCaseUsd),
    });
  };

  const handleSaveItem = () => {
    if (!editingItem) return;
    // A cleared price field reads as 0; never save a line at no price by accident
    if (!Number.isFinite(editingItem.pricePerCaseUsd) || editingItem.pricePerCaseUsd <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }
    updateItem({
      itemId: editingItem.id,
      quantity: editingItem.quantity,
      pricePerCaseUsd: editingItem.pricePerCaseUsd,
    });
  };

  const handleAddItem = () => {
    if (!newItem.productName.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (newItem.pricePerCaseUsd <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }
    addItem({
      orderId,
      productId: newItem.productId || undefined,
      productOfferId: newItem.productOfferId || undefined,
      productName: newItem.productName,
      producer: newItem.producer || undefined,
      vintage: newItem.vintage || undefined,
      region: newItem.region || undefined,
      lwin: newItem.lwin || undefined,
      bottleSize: newItem.bottleSize || undefined,
      caseConfig: newItem.caseConfig,
      quantity: newItem.quantity,
      pricePerCaseUsd: newItem.pricePerCaseUsd,
      source: newItem.source,
    });
  };

  const handleRemoveItem = (itemId: string) => {
    if (confirm('Are you sure you want to remove this item?')) {
      removeItem({ itemId });
    }
  };

  // Check if order is editable
  const canEditItems = order && EDITABLE_STATUSES.includes(order.status);

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
    // A failed request is not a missing order: offer a retry rather than "not found"
    const isNotFound = !isError;
    return (
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Typography variant="headingSm" className="mb-2">
              {isNotFound ? 'Order not found' : 'This order could not be loaded'}
            </Typography>
            <Typography variant="bodyMd" colorRole="muted" className="mb-4">
              {isNotFound
                ? 'The order you are looking for does not exist or has been removed.'
                : 'Please check your connection and try again.'}
            </Typography>
            <div className="flex flex-wrap justify-center gap-2">
              {!isNotFound && (
                <Button type="button" variant="outline" onClick={() => void refetch()}>
                  Try again
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link href="/platform/private-orders/orders">Back to orders</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate exchange rate for AED conversion (use actual rate if available, otherwise default)
  // At the fixed peg; the stored ratio carried 3.67 on orders totalled before 28 Oct 2026
  const usdToAedRate = USD_TO_AED;

  /**
   * Convert amount to selected currency
   */
  const getAmount = (usdAmount: number | string | null | undefined) => {
    const amount = Number(usdAmount) || 0;
    return currency === 'USD' ? amount : amount * usdToAedRate;
  };

  const lineCount = order.items?.length ?? 0;
  const nextStep = nextStepFor(order.status, !!distributorInvoice);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-4">
        {/* Header - compact */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/private-orders/orders" aria-label="Back to orders">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <Typography variant="headingLg" className="font-mono">{order.orderNumber}</Typography>
            <PrivateOrderStatusBadge status={order.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Submit for Review button - shown for draft orders */}
            {order.status === 'draft' && (
              <Button
                type="button"
                onClick={handleSubmitOrder}
                disabled={isSubmitting || lineCount === 0}
                isDisabled={isSubmitting || lineCount === 0}
                colorRole="brand"
                title={lineCount === 0 ? 'Add at least one wine before submitting' : undefined}
              >
                <ButtonContent iconLeft={IconCheck}>
                  {isSubmitting ? 'Submitting...' : 'Submit for review'}
                </ButtonContent>
              </Button>
            )}
            {/* Approve Revisions button - shown when C&C has made changes and requested review */}
            {order.status === 'revision_requested' && (
              <Button
                type="button"
                onClick={handleApproveRevisions}
                disabled={isApproving}
                isDisabled={isApproving}
                colorRole="brand"
              >
                <ButtonContent iconLeft={IconCheck}>
                  {isApproving ? 'Approving...' : 'Approve revisions'}
                </ButtonContent>
              </Button>
            )}
            {/* Currency Toggle */}
            <div
              role="group"
              aria-label="Display currency"
              className="inline-flex items-center rounded-lg border border-border-muted bg-surface-secondary/50 p-0.5"
            >
              <button
                type="button"
                aria-pressed={currency === 'USD'}
                onClick={() => setCurrency('USD')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  currency === 'USD'
                    ? 'bg-background-primary text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                USD
              </button>
              <button
                type="button"
                aria-pressed={currency === 'AED'}
                onClick={() => setCurrency('AED')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  currency === 'AED'
                    ? 'bg-background-primary text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                AED
              </button>
            </div>
            {subscriptionsEnabled && (
              <CloneOrderDialog
                audience="partner"
                orderId={order.id}
                orderNumber={order.orderNumber}
                partnerId={order.partnerId}
                clientId={order.clientId}
                subscriptionTier={order.subscriptionTier}
                subscriptionCaseSize={order.subscriptionCaseSize}
                subscriptionVariant={order.subscriptionVariant}
              />
            )}
            <Typography variant="bodySm" colorRole="muted">
              Created {formatDate(order.createdAt)}
            </Typography>
          </div>
        </div>

        {/* What happens next: one line for every status without its own card below */}
        {nextStep && (
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
              nextStep.needsYou
                ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-500/10'
                : 'border-border-muted bg-surface-secondary/40'
            }`}
          >
            <Icon
              icon={nextStep.needsYou ? IconAlertCircle : IconInfoCircle}
              size="sm"
              className={`mt-0.5 shrink-0 ${nextStep.needsYou ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted'}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Typography variant="bodySm" className="font-semibold">
                  {nextStep.title}
                </Typography>
                {nextStep.needsYou && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    Needs your action
                  </span>
                )}
              </div>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                {nextStep.body}
              </Typography>
              {order.status === 'draft' && lineCount === 0 && (
                <Typography variant="bodyXs" className="mt-1 font-medium text-amber-700 dark:text-amber-300">
                  Add at least one wine before submitting.
                </Typography>
              )}
              {order.status === 'revision_requested' && order.revisionReason && (
                <div className="mt-2 rounded-lg border border-border-muted bg-surface-primary px-3 py-2">
                  <Typography variant="bodyXs" colorRole="muted">
                    Note from C&amp;C
                  </Typography>
                  <Typography variant="bodySm" className="whitespace-pre-line">
                    {order.revisionReason}
                  </Typography>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workflow Stepper */}
        <WorkflowStepper order={order} />

        {subscriptionsEnabled && (
          <SubscriptionBoxPicker
            audience="partner"
            key={`${order.subscriptionTier}-${order.subscriptionCaseSize}-${order.subscriptionVariant}`}
            orderId={order.id}
            tier={order.subscriptionTier}
            caseSize={order.subscriptionCaseSize}
            variant={order.subscriptionVariant}
            clientTotalAed={order.totalUsd != null ? Number(order.totalUsd) * USD_TO_AED : null}
          />
        )}

        {/* Partner Verification Prompt - shown when awaiting partner verification */}
        {order.status === 'awaiting_partner_verification' && order.distributor && (
          <Card className="border-2 border-fill-warning/50 bg-fill-warning/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-warning/20">
                  <Icon icon={IconAlertCircle} size="lg" className="text-fill-warning" />
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <Typography variant="headingSm">
                      Client verification required
                    </Typography>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                      Needs your action
                    </span>
                  </div>
                  {/* Partners never see the distributor's name, only its role */}
                  <Typography variant="bodySm" colorRole="muted">
                    Is your client registered and verified with the appointed UAE distributor?
                    This confirmation is required before the order can proceed.
                  </Typography>
                </div>
                <div className="flex flex-wrap justify-center gap-2 sm:flex-nowrap">
                  <Button
                    type="button"
                    onClick={() => handlePartnerVerification('yes')}
                    disabled={isVerifying}
                    isDisabled={isVerifying}
                    variant="default"
                    colorRole="brand"
                  >
                    <ButtonContent iconLeft={IconCheck}>Yes, verified</ButtonContent>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handlePartnerVerification('no')}
                    disabled={isVerifying}
                    isDisabled={isVerifying}
                    variant="outline"
                  >
                    <ButtonContent iconLeft={IconX}>No</ButtonContent>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handlePartnerVerification('dont_know')}
                    disabled={isVerifying}
                    isDisabled={isVerifying}
                    variant="ghost"
                  >
                    <ButtonContent iconLeft={IconQuestionMark}>Not sure</ButtonContent>
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
                    Order on hold: client verification needed
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    This order is on hold because the client could not be verified with the
                    appointed UAE distributor. Once your client has registered, select
                    Client registered to request verification again.
                  </Typography>
                </div>
                <div className="flex flex-wrap justify-center gap-2 sm:flex-nowrap">
                  <Button
                    type="button"
                    onClick={() => reinitiateVerification('Client has now registered with distributor')}
                    disabled={isReinitiating}
                    isDisabled={isReinitiating}
                    colorRole="brand"
                  >
                    <ButtonContent iconLeft={IconCheck} isLoading={isReinitiating}>
                      Client registered
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
                    <div className="mb-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <Typography variant="headingSm">
                        Client invoice received
                      </Typography>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                        Needs your action
                      </span>
                    </div>
                    <Typography variant="bodySm" colorRole="muted">
                      Review the invoice, forward it to your client for payment, then acknowledge it below.
                      Acknowledging does not send anything to your client.
                    </Typography>
                  </div>
                </div>

                {/* Invoice Details Card */}
                <div className="rounded-lg border border-border-muted bg-background-primary p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-fill-info/10">
                        <Icon icon={IconFile} size="md" className="text-fill-info" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Typography variant="bodySm" className="truncate font-medium">
                          {distributorInvoice.fileName}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {formatBytes(distributorInvoice.fileSize)} • Uploaded {new Date(distributorInvoice.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                    <div className="flex shrink-0 gap-2">
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
                    type="button"
                    onClick={() => acknowledgeInvoice()}
                    disabled={isAcknowledging}
                    isDisabled={isAcknowledging}
                    colorRole="brand"
                  >
                    <ButtonContent iconLeft={IconCheck} isLoading={isAcknowledging}>
                      Acknowledge invoice
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
                      Invoice acknowledged: awaiting client payment
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      Make sure your client has the invoice. Payment will be confirmed on this page once it is received.
                    </Typography>
                  </div>
                </div>

                {/* Invoice Details Card */}
                <div className="rounded-lg border border-border-muted bg-background-primary p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-fill-success/10">
                        <Icon icon={IconFile} size="md" className="text-fill-success" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Typography variant="bodySm" className="truncate font-medium">
                          {distributorInvoice.fileName}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {formatBytes(distributorInvoice.fileSize)} • Uploaded {new Date(distributorInvoice.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                    <div className="flex shrink-0 gap-2">
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
                    Payment confirmed: awaiting delivery
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Client payment has been confirmed.{' '}
                    The distributor will contact your client to arrange delivery.
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
                    Delivery being scheduled
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    The distributor is contacting your client to arrange delivery.
                  </Typography>
                  {/* Show contact attempts if any */}
                  {order.deliveryContactAttempts && (order.deliveryContactAttempts as Array<{ attemptedAt: string; notes: string }>).length > 0 && (
                    <div className="mt-3 space-y-2">
                      <Typography variant="labelSm" colorRole="muted">
                        Contact attempts
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
                    Delivery scheduled
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
                        : 'a date to be confirmed'}
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
                    Out for delivery
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    The order is on its way to your client.
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

        {/*
          Delivered. Distributor-paid comes before delivery in the normal flow,
          so it only shows this card when a delivery has actually been recorded.
        */}
        {(order.status === 'delivered' || (order.status === 'distributor_paid' && order.deliveredAt)) && (
          <Card className="border-2 border-fill-success/50 bg-fill-success/5">
            <CardContent className="p-0">
              {/* Collapsible Header */}
              <button
                type="button"
                onClick={() => setIsDeliveredExpanded(!isDeliveredExpanded)}
                aria-expanded={isDeliveredExpanded}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-fill-success/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-fill-success/20">
                    <Icon icon={IconCheck} size="md" className="text-fill-success" />
                  </div>
                  <div>
                    <Typography variant="headingSm" className="mb-0.5">
                      Order delivered
                    </Typography>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1 rounded-full bg-fill-success/20 px-2 py-0.5 text-fill-success">
                        <IconCheck size={12} /> Delivered
                      </span>
                      {order.deliveryPhoto && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-fill-success/20 px-2 py-0.5 text-fill-success">
                          <IconCheck size={12} /> Proof of delivery
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
                            Delivered to your client
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            The order has been delivered to your client.
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
                            Proof of delivery
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            {order.deliveryPhoto
                              ? 'Photo taken at delivery'
                              : 'No delivery photo available'}
                          </Typography>
                        </div>
                      </div>

                      {order.deliveryPhoto && (
                        <a
                          href={fileHref(order.deliveryPhoto)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative overflow-hidden rounded-lg border border-border-muted"
                        >
                          <Image
                            src={fileHref(order.deliveryPhoto)}
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
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Typography variant="headingSm">
                  Wines ({lineCount})
                </Typography>
                {canEditItems && !isAddingItem && (
                  <Button
                    type="button"
                    variant="default"
                    colorRole="brand"
                    size="sm"
                    onClick={() => setIsAddingItem(true)}
                  >
                    <Icon icon={IconPlus} size="xs" />
                    <span className="ml-1">Add wine</span>
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                {lineCount > 0 && <span>{summarisePcoQuantities(order.items ?? [])}</span>}
                <span className="font-semibold tabular-nums text-text-primary">
                  Client price {formatCurrencyValue(getAmount(order.totalUsd), currency)}
                </span>
              </div>
            </div>

            {/* Add Item Form - ProductPicker with stock search */}
            {isAddingItem && (
              <div className="mb-4 rounded-lg border-2 border-text-primary bg-text-primary-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Typography variant="labelMd">Add a wine</Typography>
                  <Button type="button" variant="ghost" size="xs" onClick={() => setIsAddingItem(false)} aria-label="Close">

                    <Icon icon={IconX} size="sm" colorRole="muted" />
                  </Button>
                </div>
                <ProductPicker
                  value={{
                    productId: newItem.productId,
                    productOfferId: newItem.productOfferId,
                    productName: newItem.productName,
                    producer: newItem.producer,
                    vintage: newItem.vintage,
                    region: newItem.region,
                    lwin: newItem.lwin,
                    bottleSize: newItem.bottleSize,
                    caseConfig: newItem.caseConfig,
                    quantity: newItem.quantity,
                    pricePerCaseUsd: newItem.pricePerCaseUsd,
                    source: newItem.source,
                  }}
                  onChange={(data) => setNewItem({
                    productId: data.productId,
                    productOfferId: data.productOfferId,
                    productName: data.productName,
                    producer: data.producer,
                    vintage: data.vintage,
                    region: data.region,
                    lwin: data.lwin,
                    bottleSize: data.bottleSize,
                    caseConfig: data.caseConfig,
                    quantity: data.quantity,
                    pricePerCaseUsd: data.pricePerCaseUsd,
                    source: data.source,
                  })}
                  source={stockSource}
                />
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  {!newItem.productName.trim() && (
                    <Typography variant="bodyXs" colorRole="muted" className="mr-auto">
                      Choose or enter a wine to add it.
                    </Typography>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsAddingItem(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    colorRole="brand"
                    size="sm"
                    onClick={handleAddItem}
                    disabled={isAddingItemPending || !newItem.productName.trim()}
                    isDisabled={isAddingItemPending || !newItem.productName.trim()}
                  >
                    <ButtonContent iconLeft={isAddingItemPending ? IconLoader2 : IconPlus}>
                      {isAddingItemPending ? 'Adding...' : 'Add to order'}
                    </ButtonContent>
                  </Button>
                </div>
              </div>
            )}

            {order.items && order.items.length > 0 ? (
              <>
              {/* Phones read the lines as cards; the table returns while a line is being edited */}
              <div className={`overflow-x-auto ${editingItem ? '' : 'hidden md:block'}`}>
                <table className="w-full text-xs">
                  <thead className="border-b border-border-muted bg-surface-secondary/50">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-text-muted">Product</th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-text-muted">Producer</th>
                      <th className="px-2 py-1.5 text-center text-xs font-medium uppercase tracking-wide text-text-muted">Yr</th>
                      <th className="px-2 py-1.5 text-center text-xs font-medium uppercase tracking-wide text-text-muted">Pack</th>
                      <th className="px-2 py-1.5 text-center text-xs font-medium uppercase tracking-wide text-text-muted">Qty</th>
                      <th className="px-2 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-text-muted">Your price ({currency})</th>
                      <th className="px-2 py-1.5 text-right text-xs font-medium uppercase tracking-wide text-text-muted">Total ({currency})</th>
                      {canEditItems && <th className="px-2 py-1.5 text-center text-xs font-medium uppercase tracking-wide text-text-muted">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted/50">
                    {order.items.map((item) => {
                      const isEditing = editingItem?.id === item.id;
                      // A case of one is a single bottle, never "1 case"
                      const line = describePcoLine(item);

                      if (isEditing && editingItem) {
                        return (
                          <tr key={item.id} className="bg-text-primary/5">
                            <td className="px-2 py-1.5">
                              <span className="text-xs font-medium">{item.productName}</span>
                            </td>
                            <td className="px-2 py-1.5 text-xs">{item.producer || '-'}</td>
                            <td className="px-2 py-1.5 text-center text-xs">{item.vintage || '-'}</td>
                            <td className="px-2 py-1.5 text-center text-xs text-text-muted">{line.pack}</td>
                            <td className="px-2 py-1.5 text-center">
                              <Input
                                type="number"
                                min={1}
                                value={editingItem.quantity}
                                onChange={(e) => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value) || 1 })}
                                className="h-8 w-16 text-center text-sm"
                                aria-label={line.isSingle ? 'Quantity in bottles' : 'Quantity in cases'}
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={editingItem.pricePerCaseUsd}
                                onChange={(e) => setEditingItem({ ...editingItem, pricePerCaseUsd: parseFloat(e.target.value) || 0 })}
                                className="h-8 w-24 text-right text-sm"
                                aria-label={line.isSingle ? 'Price per bottle in USD' : 'Price per case in USD'}
                              />
                              <span className="mt-0.5 block text-[10px] text-text-muted">USD per {line.isSingle ? 'bottle' : 'case'}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right text-xs font-semibold tabular-nums">
                              {formatCurrencyValue(getAmount(editingItem.quantity * editingItem.pricePerCaseUsd), currency)}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <div className="flex justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleSaveItem}
                                  disabled={isUpdatingItem}
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-fill-success/15 text-fill-success transition-colors hover:bg-fill-success/25 disabled:opacity-50"
                                  title="Save changes"
                                  aria-label="Save changes"
                                >
                                  <Icon icon={IconCheck} size="xs" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingItem(null)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-fill-muted/30 text-text-muted transition-colors hover:bg-fill-muted/50"
                                  title="Cancel"
                                  aria-label="Cancel editing"
                                >
                                  <Icon icon={IconX} size="xs" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={item.id} className="hover:bg-surface-muted/20">
                          <td className="px-2 py-1.5">
                            <span className="text-xs font-medium">{item.productName}</span>
                            {item.lwin && (
                              <span className="ml-1 text-xs text-text-muted">
                                ({item.lwin})
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-xs">{item.producer || '-'}</td>
                          <td className="px-2 py-1.5 text-center text-xs">{item.vintage || '-'}</td>
                          <td className="px-2 py-1.5 text-center text-xs text-text-muted">{line.pack}</td>
                          <td className="px-2 py-1.5 text-center text-xs font-medium">{line.count}</td>
                          <td className="px-2 py-1.5 text-right text-xs tabular-nums">
                            {formatCurrencyValue(getAmount(item.pricePerCaseUsd), currency)}
                            <span className="text-text-muted">/{line.unit}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right text-xs font-semibold tabular-nums">
                            {formatCurrencyValue(getAmount(item.totalUsd), currency)}
                          </td>
                          {canEditItems && (
                            <td className="px-2 py-1.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditItem(item)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-text-primary/10 text-text-primary transition-colors hover:bg-text-primary/20"
                                  title="Edit line"
                                  aria-label={`Edit ${item.productName}`}
                                >
                                  <Icon icon={IconEdit} size="xs" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  disabled={isRemovingItem}
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-fill-danger/10 text-fill-danger transition-colors hover:bg-fill-danger/20 disabled:opacity-50"
                                  title="Remove line"
                                  aria-label={`Remove ${item.productName}`}
                                >
                                  <Icon icon={IconTrash} size="xs" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!editingItem && (
                <MobileCardList>
                  {order.items.map((item) => {
                    const line = describePcoLine(item);
                    return (
                      <MobileCard
                        key={item.id}
                        title={item.productName}
                        aside={
                          <span className="text-sm font-semibold tabular-nums">
                            {formatCurrencyValue(getAmount(item.totalUsd), currency)}
                          </span>
                        }
                        meta={[item.producer, item.vintage, line.pack].filter(Boolean).join(' · ')}
                        fields={[
                          { label: 'Quantity', value: line.qty },
                          {
                            label: `Your price per ${line.isSingle ? 'bottle' : 'case'}`,
                            value: formatCurrencyValue(getAmount(item.pricePerCaseUsd), currency),
                          },
                        ]}
                      >
                        {canEditItems && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => handleEditItem(item)}>
                              <Icon icon={IconEdit} size="xs" /> Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={isRemovingItem}
                              isDisabled={isRemovingItem}
                            >
                              <Icon icon={IconTrash} size="xs" colorRole="danger" /> Remove
                            </Button>
                          </div>
                        )}
                      </MobileCard>
                    );
                  })}
                </MobileCardList>
              )}
              </>
            ) : (
              <div className="py-4 text-center">
                <Typography variant="bodySm" colorRole="muted">
                  No wines on this order yet
                </Typography>
                {canEditItems && !isAddingItem && (
                  <Button
                    type="button"
                    variant="default"
                    colorRole="brand"
                    size="sm"
                    onClick={() => setIsAddingItem(true)}
                    className="mx-auto mt-2"
                  >
                    <Icon icon={IconPlus} size="xs" />
                    <span className="ml-1">Add the first wine</span>
                  </Button>
                )}
              </div>
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


        {/* Payments and documents: kept high so they are easy to find */}
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
                      className="flex items-center justify-between gap-3 rounded-lg border border-border-muted bg-surface-secondary/30 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-fill-muted/20">
                          <Icon icon={IconFile} size="sm" colorRole="muted" />
                        </div>
                        <div className="min-w-0">
                          <Typography variant="bodySm" className="truncate font-medium">
                            {DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType.replace(/_/g, ' ')}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted" className="truncate">
                            {doc.fileName} • {formatBytes(doc.fileSize)}
                          </Typography>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${doc.fileName}`}>
                            <Icon icon={IconExternalLink} size="sm" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.fileUrl} download={doc.fileName} aria-label={`Download ${doc.fileName}`}>
                            <Icon icon={IconDownload} size="sm" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Typography variant="bodySm" colorRole="muted">
                  No documents yet. Invoices and proof of delivery appear here as the order progresses.
                </Typography>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Secondary Info - Horizontal Grid Below */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Order Summary - Compact */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-2">
                Summary ({currency})
              </Typography>
              {/* Only the partner's own price and the client's: what lies between is not theirs to see */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Your wine price to C&C</span>
                  <span className="tabular-nums">{formatCurrencyValue(getAmount(order.winePriceUsd), currency)}</span>
                </div>
                <Divider />
                <div className="flex justify-between font-semibold">
                  <span>Client price</span>
                  <span className="tabular-nums">{formatCurrencyValue(getAmount(order.totalUsd), currency)}</span>
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

          {/* Key Dates */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-3">
                Key dates
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

        {/* Activity Timeline */}
        <Card>
          <CardContent className="p-4">
            <Typography variant="headingSm" className="mb-3">
              Activity
            </Typography>
            <OrderNoteComposer
              audience="partner"
              orderId={order.id}
              distributorName={order.distributor ? 'Distributor' : null}
            />
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
                      Delivery address
                    </Typography>
                    <Typography variant="bodySm">{order.clientAddress}</Typography>
                  </div>
                )}
                {order.deliveryNotes && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Delivery notes
                    </Typography>
                    <Typography variant="bodySm">{order.deliveryNotes}</Typography>
                  </div>
                )}
                {order.partnerNotes && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Your notes
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
