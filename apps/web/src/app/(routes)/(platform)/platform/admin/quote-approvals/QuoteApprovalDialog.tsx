'use client';

import type { DialogProps } from '@radix-ui/react-dialog';
import {
  IconCheck,
  IconCreditCard,
  IconDownload,
  IconEdit,
  IconPlayerPlay,
  IconTrash,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import QuoteWorkflowStepper from '@/app/_quotes/components/QuoteWorkflowStepper';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Input from '@/app/_ui/components/Input/Input';
import TextArea from '@/app/_ui/components/TextArea/TextArea';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { Quote } from '@/database/schema';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

import ReviewLineItemRow from './ReviewLineItemRow';

interface QuoteApprovalDialogProps extends DialogProps {
  quote: (Quote & { createdBy?: { id: string; name: string | null; email: string; customerType: 'b2b' | 'b2c' } | null }) | null;
}

/**
 * Dialog for admins to review and take actions on quotes
 */
const QuoteApprovalDialog = ({
  quote,
  open,
  onOpenChange,
}: QuoteApprovalDialogProps) => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  // State for revision form
  const [revisionReason, setRevisionReason] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  // State for confirmation notes
  const [ccNotes, setCcNotes] = useState('');
  const [confirmationNotes, setConfirmationNotes] = useState('');
  const [deliveryLeadTime, setDeliveryLeadTime] = useState('');

  // State for licensed partner and payment
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'link'>('bank_transfer');
  const [paymentDetails, setPaymentDetails] = useState<{
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    sortCode?: string;
    iban?: string;
    swiftBic?: string;
    reference?: string;
    paymentUrl?: string;
  }>({});

  // State for currency display
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'AED'>('USD');

  // State for line item adjustments (admin review)
  const [lineItemAdjustments, setLineItemAdjustments] = useState<
    Record<
      string,
      {
        adjustedPricePerCase?: number;
        confirmedQuantity?: number;
        available: boolean;
        notes?: string;
        adminAlternatives?: Array<{
          productName: string;
          pricePerCase: number;
          bottlesPerCase: number;
          bottleSize: string;
          quantityAvailable: number;
        }>;
      }
    >
  >({});

  // State for tracking which line item is expanded in review mode
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // State for delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Extract pricing data from quoteData
  const quotePricingData = useMemo(() => {
    if (!quote?.quoteData) return null;
    const data = quote.quoteData as {
      lineItems?: Array<{
        productId: string;
        lineItemTotalUsd: number;
        basePriceUsd?: number;
      }>;
    };
    return data;
  }, [quote]);

  // Create pricing map for quick lookup
  const pricingMap = useMemo(() => {
    if (!quotePricingData?.lineItems) return {};
    return quotePricingData.lineItems.reduce(
      (acc, item) => {
        acc[item.productId] = {
          lineItemTotalUsd: item.lineItemTotalUsd,
          basePriceUsd: item.basePriceUsd,
        };
        return acc;
      },
      {} as Record<string, { lineItemTotalUsd: number; basePriceUsd?: number }>,
    );
  }, [quotePricingData]);

  // Parse line items
  const lineItems = useMemo(
    () =>
      (quote?.lineItems || []) as Array<{
        productId: string;
        offerId: string;
        quantity: number;
        vintage?: string;
        alternativeVintages?: string[];
      }>,
    [quote?.lineItems],
  );

  // Extract unique product IDs
  const productIds = useMemo(
    () => [...new Set(lineItems.map((item) => item.productId))],
    [lineItems],
  );

  // Fetch products for the line items
  const { data: productsData } = useQuery({
    ...api.products.getMany.queryOptions({
      productIds,
    }),
    enabled: productIds.length > 0 && open && !!quote,
  });

  // Check if this is a B2C quote (payment flow) or B2B quote (PO flow)
  const isB2C = quote?.createdBy?.customerType === 'b2c';

  // Fetch licensed partners for payment assignment - only for B2C
  const { data: partnersData } = useQuery({
    ...api.partners.getMany.queryOptions({
      status: 'active',
    }),
    enabled: open && !!quote && quote.status === 'under_cc_review' && isB2C,
  });

  // Create a map of productId -> product for quick lookup
  const productMap = useMemo(() => {
    if (!productsData?.data) return {};
    return productsData.data.reduce(
      (acc, product) => {
        acc[product.id] = product;
        return acc;
      },
      {} as Record<string, (typeof productsData.data)[number]>,
    );
  }, [productsData]);

  // Calculate display amount based on selected currency and adjustments
  const displayTotal = useMemo(() => {
    if (!quote) return 0;

    // If under review and we have adjustments, calculate from adjustments
    if (quote.status === 'under_cc_review' && Object.keys(lineItemAdjustments).length > 0) {
      const adjustedTotalUsd = lineItems.reduce((sum, item) => {
        const adjustment = lineItemAdjustments[item.productId];
        if (!adjustment || !adjustment.available) return sum;
        const pricePerCase = adjustment.adjustedPricePerCase || 0;
        const quantity = adjustment.confirmedQuantity || 0;
        return sum + pricePerCase * quantity;
      }, 0);

      return displayCurrency === 'USD' ? adjustedTotalUsd : convertUsdToAed(adjustedTotalUsd);
    }

    // Otherwise use the quote total
    if (displayCurrency === 'USD') {
      return quote.totalUsd;
    }
    return quote.totalAed ?? convertUsdToAed(quote.totalUsd);
  }, [quote, displayCurrency, lineItemAdjustments, lineItems]);

  // Start C&C Review mutation
  const startReviewMutation = useMutation({
    mutationFn: async () => {
      if (!quote) return;
      return trpcClient.quotes.startCCReview.mutate({
        quoteId: quote.id,
        ccNotes: ccNotes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Review started successfully');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setCcNotes('');
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        `Failed to start review: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  // Confirm quote mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!quote) return;

      // Validate that all available items have valid adjustments in review mode
      if (quote.status === 'under_cc_review') {
        const hasInvalidAdjustments = Object.entries(lineItemAdjustments).some(
          ([_, adjustment]) =>
            adjustment.available &&
            (adjustment.confirmedQuantity === undefined ||
              adjustment.confirmedQuantity <= 0 ||
              adjustment.adjustedPricePerCase === undefined ||
              adjustment.adjustedPricePerCase <= 0),
        );

        if (hasInvalidAdjustments) {
          toast.error('Please confirm quantities and prices for all available items');
          return;
        }
      }

      // Validate delivery lead time is provided
      if (!deliveryLeadTime.trim()) {
        toast.error('Delivery lead time is required');
        throw new Error('Delivery lead time is required');
      }

      // B2C-specific validation: partner and payment required
      if (isB2C) {
        // Validate licensed partner is selected
        if (!selectedPartnerId) {
          toast.error('Please select a licensed partner for payment');
          throw new Error('Licensed partner is required');
        }

        // Check that partner has payment configuration
        const partner = partnersData?.find((p) => p.id === selectedPartnerId);
        const hasBankTransfer = !!(
          partner?.paymentDetails?.bankName ||
          partner?.paymentDetails?.iban ||
          partner?.paymentDetails?.accountNumber
        );
        const hasPaymentLink = !!partner?.paymentDetails?.paymentUrl;

        if (!hasBankTransfer && !hasPaymentLink) {
          toast.error('Selected partner has no payment configuration. Please configure payment in Partner Management first.');
          throw new Error('Partner payment config required');
        }

        // Validate payment details based on selected method
        if (paymentMethod === 'bank_transfer') {
          if (!hasBankTransfer) {
            toast.error('Partner bank details not configured. Please select payment link or update partner config.');
            throw new Error('Bank details required');
          }
          if (!partner?.paymentDetails?.accountName || !partner?.paymentDetails?.iban) {
            toast.error('Partner bank details incomplete (missing account name or IBAN). Please update in Partner Management.');
            throw new Error('Bank details incomplete');
          }
        } else if (paymentMethod === 'link') {
          if (!hasPaymentLink) {
            toast.error('Partner payment link not configured. Please select bank transfer or update partner config.');
            throw new Error('Payment URL required');
          }
        }
      }

      return trpcClient.quotes.confirm.mutate({
        quoteId: quote.id,
        deliveryLeadTime: deliveryLeadTime.trim(),
        ccConfirmationNotes: confirmationNotes || undefined,
        // Only include payment fields for B2C
        licensedPartnerId: isB2C ? selectedPartnerId : undefined,
        paymentMethod: isB2C ? paymentMethod : undefined,
        paymentDetails: isB2C ? paymentDetails : undefined,
        lineItemAdjustments:
          quote.status === 'under_cc_review' && Object.keys(lineItemAdjustments).length > 0
            ? lineItemAdjustments
            : undefined,
      });
    },
    onSuccess: () => {
      toast.success(isB2C ? 'Quote approved - awaiting customer payment' : 'Quote confirmed - awaiting PO submission');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setConfirmationNotes('');
      setDeliveryLeadTime('');
      setSelectedPartnerId('');
      setPaymentMethod('bank_transfer');
      setPaymentDetails({});
      setLineItemAdjustments({});
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        `Failed to confirm quote: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  // Request revision mutation
  const requestRevisionMutation = useMutation({
    mutationFn: async () => {
      if (!quote || !revisionReason.trim()) {
        toast.error('Please provide a revision reason');
        return;
      }
      return trpcClient.quotes.requestRevision.mutate({
        quoteId: quote.id,
        revisionReason,
        revisionSuggestions: {
          items: [],
        },
      });
    },
    onSuccess: () => {
      toast.success('Revision requested successfully');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setRevisionReason('');
      setShowRevisionForm(false);
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        `Failed to request revision: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  // Confirm PO mutation
  const confirmPOMutation = useMutation({
    mutationFn: async () => {
      if (!quote) return;
      return trpcClient.quotes.confirmPO.mutate({
        quoteId: quote.id,
        poConfirmationNotes: confirmationNotes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('PO confirmed successfully');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setConfirmationNotes('');
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        `Failed to confirm PO: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  // Mark as Paid mutation (B2C only)
  const markAsPaidMutation = useMutation({
    mutationFn: async () => {
      if (!quote) return;
      return trpcClient.quotes.markAsPaid.mutate({
        quoteId: quote.id,
      });
    },
    onSuccess: () => {
      toast.success('Quote marked as paid');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        `Failed to mark as paid: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  // Delete quote mutation
  const deleteQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!quote) return;
      return trpcClient.quotes.deleteAdmin.mutate({
        id: quote.id,
      });
    },
    onSuccess: () => {
      toast.success('Quote deleted');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setShowDeleteConfirm(false);
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        `Failed to delete quote: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  // Mark as Delivered mutation
  const markAsDeliveredMutation = useMutation({
    mutationFn: async () => {
      if (!quote) return;
      return trpcClient.quotes.markAsDelivered.mutate({
        quoteId: quote.id,
      });
    },
    onSuccess: () => {
      toast.success('Order marked as delivered');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        `Failed to mark as delivered: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  // Initialize adjustments when quote changes to under_cc_review status
  useEffect(() => {
    if (quote && quote.status === 'under_cc_review' && lineItems.length > 0 && Object.keys(lineItemAdjustments).length === 0) {
      const initialAdjustments: typeof lineItemAdjustments = {};
      lineItems.forEach((item) => {
        const pricing = pricingMap[item.productId];
        const pricePerCase = pricing?.lineItemTotalUsd
          ? pricing.lineItemTotalUsd / item.quantity
          : 0;

        initialAdjustments[item.productId] = {
          adjustedPricePerCase: Number(pricePerCase.toFixed(2)),
          confirmedQuantity: Math.floor(Number(item.quantity)),
          available: true,
          notes: '',
        };
      });
      setLineItemAdjustments(initialAdjustments);
    }
  }, [quote, lineItems, pricingMap, lineItemAdjustments]);

  // Auto-populate payment details when partner is selected
  useEffect(() => {
    if (selectedPartnerId && partnersData) {
      const selectedPartner = partnersData.find((p) => p.id === selectedPartnerId);
      if (selectedPartner?.paymentDetails) {
        // Check which payment methods are available
        const hasBankTransfer = !!(
          selectedPartner.paymentDetails.bankName ||
          selectedPartner.paymentDetails.iban ||
          selectedPartner.paymentDetails.accountNumber
        );
        const hasPaymentLink = !!selectedPartner.paymentDetails.paymentUrl;

        // Auto-select payment method: prefer bank transfer if available, otherwise link
        if (hasBankTransfer) {
          setPaymentMethod('bank_transfer');
        } else if (hasPaymentLink) {
          setPaymentMethod('link');
        }
        setPaymentDetails(selectedPartner.paymentDetails);
      }
    }
  }, [selectedPartnerId, partnersData]);

  // Get selected partner details for display
  const selectedPartner = useMemo(() => {
    if (!selectedPartnerId || !partnersData) return null;
    return partnersData.find((p) => p.id === selectedPartnerId);
  }, [selectedPartnerId, partnersData]);

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{quote.name}</DialogTitle>
          <DialogDescription className="text-sm">
            Review and approve this quote
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Compact Customer & Quote Info Bar */}
            <div className="rounded-lg border border-border-muted bg-fill-muted/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {/* Customer */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">👤</span>
                  <span className="text-sm font-semibold">{quote.clientName || 'Unknown'}</span>
                  {quote.clientCompany && (
                    <span className="text-sm text-text-muted">({quote.clientCompany})</span>
                  )}
                </div>

                {/* Email */}
                {quote.clientEmail && (
                  <a
                    href={`mailto:${quote.clientEmail}`}
                    className="flex items-center gap-1.5 text-sm text-text-brand hover:underline"
                  >
                    <span>📧</span>
                    {quote.clientEmail}
                  </a>
                )}

                {/* Divider */}
                <div className="hidden sm:block h-4 w-px bg-border-muted" />

                {/* Submitted Date */}
                <div className="flex items-center gap-1.5 text-sm text-text-muted">
                  <span>📅</span>
                  {quote.buyRequestSubmittedAt
                    ? format(new Date(quote.buyRequestSubmittedAt), 'MMM d, yyyy')
                    : 'N/A'}
                </div>

                {/* Status Badge */}
                <div className="inline-flex items-center gap-1.5 rounded-full bg-fill-brand/10 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-fill-brand animate-pulse" />
                  <span className="text-xs font-bold capitalize text-text-brand">
                    {quote.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items - Detailed Table View */}
            <div>
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <Typography variant="bodyLg" className="font-bold">
                    Order Details
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}
                  </Typography>
                </div>
                <div className="inline-flex items-center rounded-lg bg-fill-muted/50 p-1 border border-border-muted">
                  <button
                    onClick={() => setDisplayCurrency('USD')}
                    className={`px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200 ${
                      displayCurrency === 'USD'
                        ? 'bg-white text-text-brand shadow-sm border border-border-muted'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    USD
                  </button>
                  <button
                    onClick={() => setDisplayCurrency('AED')}
                    className={`px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200 ${
                      displayCurrency === 'AED'
                        ? 'bg-white text-text-brand shadow-sm border border-border-muted'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    AED
                  </button>
                </div>
              </div>

              {quote.status === 'under_cc_review' && (
                <div className="mb-4 rounded-xl border-2 border-border-brand bg-gradient-to-r from-fill-brand/5 to-fill-brand/10 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 text-2xl">📝</div>
                    <div className="flex-1">
                      <Typography variant="bodyMd" className="font-bold text-text-brand mb-1">
                        Review Mode Active
                      </Typography>
                      <Typography variant="bodySm" colorRole="muted">
                        Adjust quantities and prices for each line item. Uncheck &ldquo;Available&rdquo; to mark items as out of stock. All prices must be entered in USD.
                      </Typography>
                    </div>
                  </div>
                </div>
              )}

              {/* Table Header - Compact Grid */}
              {quote.status === 'under_cc_review' && (
                <div className="rounded-t-lg border border-b-0 border-border-muted bg-fill-muted/50 px-4 py-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-bold text-text-muted uppercase tracking-wider">
                    <div className="col-span-5">Product</div>
                    <div className="col-span-1 text-center">Req</div>
                    <div className="col-span-2 text-center">Confirmed</div>
                    <div className="col-span-2 text-right">$/Case</div>
                    <div className="col-span-1 text-right">Total</div>
                    <div className="col-span-1 text-center">Status</div>
                  </div>
                </div>
              )}

              {/* Line Items - Compact Rows */}
              <div className="space-y-2">
                {lineItems.map((item) => {
                  const product = productMap[item.productId];
                  const pricing = pricingMap[item.productId];
                  const pricePerCase = pricing?.lineItemTotalUsd
                    ? pricing.lineItemTotalUsd / item.quantity
                    : 0;

                  const adjustment = lineItemAdjustments[item.productId];
                  const isExpanded = expandedItemId === item.productId;

                  // For non-review mode, show simple read-only cards
                  if (quote.status !== 'under_cc_review') {
                    const displayPricePerCase =
                      displayCurrency === 'USD' ? pricePerCase : convertUsdToAed(pricePerCase);
                    const lineTotal = pricePerCase * item.quantity;
                    const displayLineTotal =
                      displayCurrency === 'USD' ? lineTotal : convertUsdToAed(lineTotal);

                    return (
                      <div
                        key={item.productId}
                        className="rounded-lg border border-border-muted bg-white px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <Typography variant="bodySm" className="font-semibold truncate">
                              {product?.name || item.productId}
                            </Typography>
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                              {product?.producer && <span className="truncate">{product.producer}</span>}
                              {product?.year && <span>• {product.year}</span>}
                              {item.vintage && <span>• V{item.vintage}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <span className="font-semibold">{item.quantity}</span>
                              <span className="text-text-muted ml-1">cases</span>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{formatPrice(displayPricePerCase, displayCurrency)}</div>
                              <div className="text-xs text-text-muted">per case</div>
                            </div>
                            <div className="text-right min-w-[100px]">
                              <Typography variant="bodyMd" className="font-bold text-text-brand">
                                {formatPrice(displayLineTotal, displayCurrency)}
                              </Typography>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Review mode - use the compact ReviewLineItemRow component
                  return (
                    <ReviewLineItemRow
                      key={item.productId}
                      lineItem={item}
                      product={product}
                      pricePerCase={pricePerCase}
                      adjustment={adjustment}
                      isExpanded={isExpanded}
                      displayCurrency={displayCurrency}
                      onToggle={() => setExpandedItemId(isExpanded ? null : item.productId)}
                      onAdjustmentChange={(newAdjustment) => {
                        setLineItemAdjustments({
                          ...lineItemAdjustments,
                          [item.productId]: newAdjustment,
                        });
                      }}
                    />
                  );
                })}
              </div>

              {/* Order Total - Compact */}
              <div className="mt-4 flex justify-end">
                <div className="rounded-lg bg-fill-brand/10 border border-border-brand/30 px-6 py-3 flex items-center gap-4">
                  <span className="text-sm font-semibold text-text-muted uppercase">Total:</span>
                  <Typography variant="headingMd" className="font-bold text-text-brand">
                    {formatPrice(displayTotal, displayCurrency)}
                  </Typography>
                </div>
              </div>
            </div>

            {/* Delivery, Partner & Payment - Under Review */}
            {quote.status === 'under_cc_review' && !showRevisionForm && (
              <div className="rounded-xl bg-gradient-to-br from-fill-brand/5 to-fill-brand/10 p-6 shadow-md border-2 border-border-brand/30 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fill-brand/20">
                    <span className="text-lg">{isB2C ? '💳' : '🚚'}</span>
                  </div>
                  <div>
                    <Typography variant="headingMd" className="font-bold text-text-brand">
                      {isB2C ? 'Payment & Delivery Details' : 'Delivery Details'}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      {isB2C ? 'B2C Customer - Payment via licensed partner' : 'B2B Customer - Payment via PO'}
                    </Typography>
                  </div>
                </div>

                {/* Licensed Partner Selection - B2C only */}
                {isB2C && (
                  <>
                    <div className="rounded-lg bg-white p-5 border border-border-muted">
                      <Typography variant="bodySm" className="mb-2 font-semibold">
                        Licensed Partner <span className="text-text-danger text-base">*</span>
                      </Typography>
                      <select
                        value={selectedPartnerId}
                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                        className="w-full rounded-lg border-2 border-border-muted bg-white px-4 py-2.5 text-sm font-medium focus:border-border-brand focus:ring-2 focus:ring-fill-brand/20 transition-all"
                      >
                        <option value="">Select a partner...</option>
                        {partnersData?.map((partner) => {
                          const hasBankTransfer = !!(
                            partner.paymentDetails?.bankName ||
                            partner.paymentDetails?.iban ||
                            partner.paymentDetails?.accountNumber
                          );
                          const hasPaymentLink = !!partner.paymentDetails?.paymentUrl;
                          const paymentIcons = [
                            hasBankTransfer ? '🏦' : null,
                            hasPaymentLink ? '🔗' : null,
                          ].filter(Boolean).join(' ');

                          return (
                            <option key={partner.id} value={partner.id}>
                              {partner.businessName} {paymentIcons ? `(${paymentIcons})` : '⚠️ No payment config'}
                            </option>
                          );
                        })}
                      </select>
                      <Typography variant="bodyXs" colorRole="muted" className="mt-2">
                        Customer will pay this partner directly
                      </Typography>
                    </div>

                    {/* Show selected partner's payment configuration */}
                    {selectedPartner && selectedPartner.paymentDetails && (() => {
                      const hasBankTransfer = !!(
                        selectedPartner.paymentDetails.bankName ||
                        selectedPartner.paymentDetails.iban ||
                        selectedPartner.paymentDetails.accountNumber
                      );
                      const hasPaymentLink = !!selectedPartner.paymentDetails.paymentUrl;
                      const hasBothMethods = hasBankTransfer && hasPaymentLink;

                      if (!hasBankTransfer && !hasPaymentLink) return null;

                      return (
                        <div className="rounded-lg bg-gradient-to-br from-fill-brand/5 to-fill-brand/10 p-5 border-2 border-border-brand/30">
                          <div className="flex items-center gap-3 mb-4">
                            {selectedPartner.logoUrl && (
                              <img
                                src={selectedPartner.logoUrl}
                                alt={selectedPartner.businessName}
                                className="h-12 w-12 object-contain rounded-lg bg-white border border-border-muted p-1"
                              />
                            )}
                            <div className="flex-1">
                              <Typography variant="bodySm" className="font-bold text-text-brand">
                                {selectedPartner.businessName}
                              </Typography>
                              <div className="flex items-center gap-2 mt-1">
                                {hasBankTransfer && (
                                  <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                                    🏦 Bank
                                  </span>
                                )}
                                {hasPaymentLink && (
                                  <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                                    🔗 Link
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Payment Method Selection - Only show if both methods available */}
                          {hasBothMethods && (
                            <div className="mb-4 p-4 rounded-lg bg-white border border-border-muted">
                              <Typography variant="bodyXs" className="font-semibold text-text-muted uppercase tracking-wide mb-3">
                                Select Payment Method for this Quote
                              </Typography>
                              <div className="flex gap-3">
                                <label className="flex-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="paymentMethod"
                                    value="bank_transfer"
                                    checked={paymentMethod === 'bank_transfer'}
                                    onChange={() => setPaymentMethod('bank_transfer')}
                                    className="sr-only"
                                  />
                                  <div className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                    paymentMethod === 'bank_transfer'
                                      ? 'border-border-brand bg-fill-brand/10 text-text-brand'
                                      : 'border-border-muted hover:border-border-brand/50'
                                  }`}>
                                    <span className="text-lg">🏦</span>
                                    <span className="text-sm font-semibold">Bank Transfer</span>
                                  </div>
                                </label>
                                <label className="flex-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="paymentMethod"
                                    value="link"
                                    checked={paymentMethod === 'link'}
                                    onChange={() => setPaymentMethod('link')}
                                    className="sr-only"
                                  />
                                  <div className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                    paymentMethod === 'link'
                                      ? 'border-border-brand bg-fill-brand/10 text-text-brand'
                                      : 'border-border-muted hover:border-border-brand/50'
                                  }`}>
                                    <span className="text-lg">🔗</span>
                                    <span className="text-sm font-semibold">Payment Link</span>
                                  </div>
                                </label>
                              </div>
                            </div>
                          )}

                          {/* Bank Transfer Details */}
                          {paymentMethod === 'bank_transfer' && hasBankTransfer && (
                            <div className="rounded-lg bg-white p-4 border border-border-muted space-y-2">
                              <Typography variant="bodyXs" className="font-semibold text-text-muted uppercase tracking-wide">
                                Bank Account Details
                              </Typography>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                {selectedPartner.paymentDetails.bankName && (
                                  <>
                                    <span className="text-text-muted">Bank:</span>
                                    <span className="font-medium">{selectedPartner.paymentDetails.bankName}</span>
                                  </>
                                )}
                                {selectedPartner.paymentDetails.accountName && (
                                  <>
                                    <span className="text-text-muted">Account:</span>
                                    <span className="font-medium">{selectedPartner.paymentDetails.accountName}</span>
                                  </>
                                )}
                                {selectedPartner.paymentDetails.iban && (
                                  <>
                                    <span className="text-text-muted">IBAN:</span>
                                    <span className="font-mono font-medium">{selectedPartner.paymentDetails.iban}</span>
                                  </>
                                )}
                                {selectedPartner.paymentDetails.swiftBic && (
                                  <>
                                    <span className="text-text-muted">SWIFT:</span>
                                    <span className="font-mono font-medium">{selectedPartner.paymentDetails.swiftBic}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Payment Link Details */}
                          {paymentMethod === 'link' && hasPaymentLink && (
                            <div className="rounded-lg bg-white p-4 border border-border-muted">
                              <Typography variant="bodyXs" className="font-semibold text-text-muted uppercase tracking-wide mb-2">
                                Payment Link
                              </Typography>
                              <a
                                href={selectedPartner.paymentDetails.paymentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-text-brand hover:underline break-all"
                              >
                                {selectedPartner.paymentDetails.paymentUrl}
                              </a>
                            </div>
                          )}

                          <Typography variant="bodyXs" colorRole="muted" className="mt-3">
                            ✓ Payment details will be sent to customer automatically
                          </Typography>
                        </div>
                      );
                    })()}

                    {/* Warning if partner has no payment config */}
                    {selectedPartner && (() => {
                      const hasBankTransfer = !!(
                        selectedPartner.paymentDetails?.bankName ||
                        selectedPartner.paymentDetails?.iban ||
                        selectedPartner.paymentDetails?.accountNumber
                      );
                      const hasPaymentLink = !!selectedPartner.paymentDetails?.paymentUrl;
                      if (hasBankTransfer || hasPaymentLink) return null;
                      return true;
                    })() && (
                      <div className="rounded-lg bg-fill-warning/10 p-4 border border-border-warning">
                        <div className="flex items-start gap-3">
                          <span className="text-xl">⚠️</span>
                          <div>
                            <Typography variant="bodySm" className="font-semibold text-text-warning">
                              Partner has no payment configuration
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                              Please configure payment details for this partner in the Partners management page before approving quotes.
                            </Typography>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Delivery Lead Time */}
                <div className="rounded-lg bg-white p-5 border border-border-muted">
                  <div className="mb-4">
                    <Typography variant="bodySm" className="mb-2 font-semibold">
                      Delivery Lead Time <span className="text-text-danger text-base">*</span>
                    </Typography>
                    <Input
                      type="text"
                      value={deliveryLeadTime}
                      onChange={(e) => setDeliveryLeadTime(e.target.value)}
                      placeholder="e.g., 14-21 days, 3-4 weeks"
                      className="border-2 focus:border-border-brand focus:ring-2 focus:ring-fill-brand/20 transition-all"
                    />
                    <Typography variant="bodyXs" colorRole="muted" className="mt-2">
                      <strong>Required:</strong> This will be shown to the customer
                    </Typography>
                  </div>

                  <div>
                    <Typography variant="bodySm" className="mb-2 font-semibold">
                      Confirmation Notes <span className="text-text-muted font-normal text-xs">(optional)</span>
                    </Typography>
                    <TextArea
                      value={confirmationNotes}
                      onChange={(e) => setConfirmationNotes(e.target.value)}
                      placeholder="Add any notes about this confirmation..."
                      rows={3}
                      className="border-2 focus:border-border-brand focus:ring-2 focus:ring-fill-brand/20 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PO Information - Always Visible */}
            {quote.status === 'po_submitted' && (
              <div className="rounded-xl bg-white p-6 shadow-sm border border-border-muted space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fill-brand/10">
                    <span className="text-base">📦</span>
                  </div>
                  <Typography variant="bodyLg" className="font-bold">
                    PO Information
                  </Typography>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-fill-muted/30 to-fill-muted/50 p-6 space-y-5 border border-border-muted">
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide font-semibold mb-2">
                      PO Number
                    </Typography>
                    <Typography variant="bodyLg" className="font-bold">
                      {quote.poNumber}
                    </Typography>
                  </div>
                  {quote.poAttachmentUrl && (
                    <div>
                      <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide font-semibold mb-3">
                        Attachment
                      </Typography>
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={quote.poAttachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-text-brand hover:bg-fill-brand/10 font-semibold transition-all border border-border-muted"
                        >
                          <span>📄</span>
                          View Document
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = quote.poAttachmentUrl!;
                            link.download = `PO-${quote.poNumber}.pdf`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            toast.success('Download started');
                          }}
                          className="hover:bg-white transition-all"
                        >
                          <ButtonContent iconLeft={IconDownload}>
                            Download
                          </ButtonContent>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Typography variant="bodySm" className="mb-3 font-semibold">
                    Confirmation Notes <span className="text-text-muted font-normal text-xs">(optional)</span>
                  </Typography>
                  <TextArea
                    id="poNotes"
                    value={confirmationNotes}
                    onChange={(e) => setConfirmationNotes(e.target.value)}
                    placeholder="Add any notes about this PO confirmation..."
                    rows={4}
                    className="border-2 focus:border-border-brand focus:ring-2 focus:ring-fill-brand/20 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Workflow Progress - Always Visible */}
            <div className="rounded-lg border border-border-muted bg-white dark:bg-background-secondary p-6 shadow-sm">
              <div className="mb-6">
                <Typography variant="bodyLg" className="font-semibold mb-2">
                  Order Progress
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  Track the current stage and review status
                </Typography>
              </div>
              <QuoteWorkflowStepper quote={quote} variant="default" />
            </div>

            {/* Action Required Section */}
            {(quote.status === 'buy_request_submitted' ||
              quote.status === 'under_cc_review' ||
              quote.status === 'po_submitted') && (
              <div className="rounded-lg border-2 border-border-brand bg-fill-brand/5 p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-fill-brand text-text-brand-contrast">
                    <span className="text-lg">✓</span>
                  </div>
                  <div className="flex-1">
                    <Typography variant="bodyLg" className="font-semibold mb-1 text-text-brand">
                      {quote.status === 'buy_request_submitted' && 'Ready to Review'}
                      {quote.status === 'under_cc_review' && !showRevisionForm && 'Complete Review'}
                      {quote.status === 'under_cc_review' && showRevisionForm && 'Request Changes'}
                      {quote.status === 'po_submitted' && 'Confirm Purchase Order'}
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      {quote.status === 'buy_request_submitted' && 'Start reviewing this order request and verify product availability'}
                      {quote.status === 'under_cc_review' && !showRevisionForm && 'Confirm pricing and availability, then approve the quote'}
                      {quote.status === 'under_cc_review' && showRevisionForm && 'Explain what needs to be changed for the customer'}
                      {quote.status === 'po_submitted' && 'Review the purchase order and confirm to proceed'}
                    </Typography>
                  </div>
                </div>

                {/* Action Forms */}
                {quote.status === 'buy_request_submitted' && (
                  <div className="space-y-3">
                    <div>
                      <Typography variant="bodySm" className="mb-2 font-medium">
                        Review Notes <span className="text-text-muted font-normal text-xs">(optional)</span>
                      </Typography>
                      <TextArea
                        value={ccNotes}
                        onChange={(e) => setCcNotes(e.target.value)}
                        placeholder="Add notes about your review process..."
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                    <Button
                      variant="default"
                      colorRole="brand"
                      size="lg"
                      onClick={() => startReviewMutation.mutate()}
                      isDisabled={startReviewMutation.isPending}
                      className="w-full sm:w-auto font-semibold"
                    >
                      <ButtonContent iconLeft={IconPlayerPlay}>
                        {startReviewMutation.isPending ? 'Starting Review...' : 'Begin Review'}
                      </ButtonContent>
                    </Button>
                  </div>
                )}

                {quote.status === 'under_cc_review' && !showRevisionForm && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowRevisionForm(true)}
                      className="flex-1 font-medium"
                    >
                      <ButtonContent iconLeft={IconEdit}>Request Changes</ButtonContent>
                    </Button>
                    <Button
                      variant="default"
                      colorRole="brand"
                      size="lg"
                      onClick={() => confirmMutation.mutate()}
                      isDisabled={confirmMutation.isPending}
                      className="flex-1 font-semibold"
                    >
                      <ButtonContent iconLeft={IconCheck}>
                        {confirmMutation.isPending ? 'Confirming...' : 'Approve Quote'}
                      </ButtonContent>
                    </Button>
                  </div>
                )}

                {showRevisionForm && (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-fill-warning/10 border border-border-warning p-4">
                      <Typography variant="bodySm" className="text-text-warning font-medium">
                        The customer will be notified and can resubmit with requested changes
                      </Typography>
                    </div>
                    <div>
                      <Typography variant="bodySm" className="mb-2 font-medium">
                        What needs to be changed? <span className="text-text-danger">*</span>
                      </Typography>
                      <TextArea
                        value={revisionReason}
                        onChange={(e) => setRevisionReason(e.target.value)}
                        placeholder="Example: Please adjust quantities for Chateau Margaux to 50 cases maximum"
                        rows={4}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => {
                          setShowRevisionForm(false);
                          setRevisionReason('');
                        }}
                        className="flex-1 font-medium"
                      >
                        <ButtonContent>Cancel</ButtonContent>
                      </Button>
                      <Button
                        variant="default"
                        colorRole="brand"
                        size="lg"
                        onClick={() => requestRevisionMutation.mutate()}
                        isDisabled={requestRevisionMutation.isPending || !revisionReason.trim()}
                        className="flex-1 font-semibold"
                      >
                        <ButtonContent iconLeft={IconEdit}>
                          {requestRevisionMutation.isPending ? 'Sending...' : 'Send to Customer'}
                        </ButtonContent>
                      </Button>
                    </div>
                  </div>
                )}

                {quote.status === 'po_submitted' && (
                  <Button
                    variant="default"
                    colorRole="brand"
                    size="lg"
                    onClick={() => confirmPOMutation.mutate()}
                    isDisabled={confirmPOMutation.isPending}
                    className="w-full sm:w-auto font-semibold"
                  >
                    <ButtonContent iconLeft={IconCheck}>
                      {confirmPOMutation.isPending ? 'Confirming...' : 'Confirm Purchase Order'}
                    </ButtonContent>
                  </Button>
                )}
              </div>
            )}

            {/* Awaiting Payment Action - B2C only */}
            {quote.status === 'awaiting_payment' && (
              <div className="rounded-lg border-2 border-border-warning bg-fill-warning/5 p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-fill-warning text-text-warning-contrast">
                    <IconCreditCard size={20} />
                  </div>
                  <div className="flex-1">
                    <Typography variant="bodyLg" className="font-semibold mb-1 text-text-warning">
                      Awaiting Customer Payment
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      Quote has been approved and sent to customer. Confirm payment once received.
                    </Typography>
                  </div>
                </div>

                {/* Payment Details Summary */}
                {quote.paymentMethod && (
                  <div className="mb-5 rounded-lg bg-white p-4 border border-border-muted">
                    <Typography variant="bodyXs" className="font-semibold text-text-muted uppercase tracking-wide mb-2">
                      Payment Method
                    </Typography>
                    <Typography variant="bodySm" className="font-medium">
                      {quote.paymentMethod === 'bank_transfer' ? '🏦 Bank Transfer' : '🔗 Payment Link'}
                    </Typography>
                  </div>
                )}

                <Button
                  variant="default"
                  colorRole="brand"
                  size="lg"
                  onClick={() => markAsPaidMutation.mutate()}
                  isDisabled={markAsPaidMutation.isPending}
                  className="w-full sm:w-auto font-semibold"
                >
                  <ButtonContent iconLeft={IconCheck}>
                    {markAsPaidMutation.isPending ? 'Updating...' : 'Confirm Payment Received'}
                  </ButtonContent>
                </Button>
              </div>
            )}

            {/* Ready for Delivery Action - Shows for paid (B2C) or po_confirmed (B2B) */}
            {(quote.status === 'paid' || quote.status === 'po_confirmed') && (
              <div className="rounded-lg border-2 border-border-brand bg-fill-brand/5 p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-fill-brand text-text-brand-contrast">
                    <IconTruck size={20} />
                  </div>
                  <div className="flex-1">
                    <Typography variant="bodyLg" className="font-semibold mb-1 text-text-brand">
                      {quote.status === 'paid' ? 'Payment Confirmed' : 'Purchase Order Confirmed'}
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      {quote.status === 'paid'
                        ? 'Customer has paid. Mark as delivered once the order has been fulfilled.'
                        : 'PO has been confirmed. Mark as delivered once the order has been fulfilled.'}
                    </Typography>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="mb-5 rounded-lg bg-white p-4 border border-border-muted">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Typography variant="bodyXs" className="font-semibold text-text-muted uppercase tracking-wide mb-1">
                        Order Total
                      </Typography>
                      <Typography variant="bodyLg" className="font-bold text-text-brand">
                        {quote.currency} {(quote.currency === 'AED' ? quote.totalAed : quote.totalUsd)?.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Typography>
                    </div>
                    {quote.deliveryLeadTime && (
                      <div>
                        <Typography variant="bodyXs" className="font-semibold text-text-muted uppercase tracking-wide mb-1">
                          Delivery Lead Time
                        </Typography>
                        <Typography variant="bodySm" className="font-medium">
                          {quote.deliveryLeadTime}
                        </Typography>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="default"
                  colorRole="brand"
                  size="lg"
                  onClick={() => markAsDeliveredMutation.mutate()}
                  isDisabled={markAsDeliveredMutation.isPending}
                  className="w-full sm:w-auto font-semibold"
                >
                  <ButtonContent iconLeft={IconTruck}>
                    {markAsDeliveredMutation.isPending ? 'Updating...' : 'Mark as Delivered'}
                  </ButtonContent>
                </Button>
              </div>
            )}

            {/* Delivered State - Display only */}
            {quote.status === 'delivered' && (
              <div className="rounded-lg border-2 border-border-muted bg-fill-muted/30 p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-fill-muted">
                    <IconTruck size={20} className="text-text-muted" />
                  </div>
                  <div className="flex-1">
                    <Typography variant="bodyLg" className="font-semibold mb-1">
                      Order Delivered
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      This order has been completed and delivered to the customer.
                    </Typography>
                    {quote.deliveredAt && (
                      <Typography variant="bodySm" colorRole="muted" className="mt-2">
                        Delivered on {format(new Date(quote.deliveredAt), 'MMM d, yyyy')}
                      </Typography>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="bg-fill-muted/30 border-t border-border-muted">
          <div className="flex w-full items-center justify-between gap-4">
            {/* Delete Button with Confirmation */}
            <div className="flex items-center gap-2">
              {!showDeleteConfirm ? (
                <Button
                  variant="ghost"
                  size="sm"
                  colorRole="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="font-medium"
                >
                  <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
                </Button>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-fill-danger/10 border border-border-danger px-3 py-2">
                  <Typography variant="bodyXs" className="text-text-danger font-medium">
                    Delete this quote?
                  </Typography>
                  <Button
                    variant="default"
                    colorRole="danger"
                    size="sm"
                    onClick={() => deleteQuoteMutation.mutate()}
                    isDisabled={deleteQuoteMutation.isPending}
                  >
                    <ButtonContent>
                      {deleteQuoteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
                    </ButtonContent>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    <ButtonContent>Cancel</ButtonContent>
                  </Button>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                setShowDeleteConfirm(false);
                if (onOpenChange) onOpenChange(false);
              }}
              className="font-medium"
            >
              <ButtonContent>Close</ButtonContent>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteApprovalDialog;
