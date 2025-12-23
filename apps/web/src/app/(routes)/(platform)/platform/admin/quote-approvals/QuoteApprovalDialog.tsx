'use client';

import type { DialogProps } from '@radix-ui/react-dialog';
import {
  IconCheck,
  IconCreditCard,
  IconDownload,
  IconEdit,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
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

  // State for adding new alternatives (structured)
  const [newAlternative, setNewAlternative] = useState<Record<string, {
    productName: string;
    pricePerCase: string;
    bottlesPerCase: string;
    bottleSize: string;
    quantityAvailable: string;
  }>>({});

  // State for tracking which line items have alternatives section expanded
  const [expandedAlternatives, setExpandedAlternatives] = useState<Record<string, boolean>>({});

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
            {/* Customer Information Card */}
            <div className="rounded-xl bg-gradient-to-br from-fill-brand/10 via-fill-brand/5 to-transparent border-2 border-border-brand/30 p-6 shadow-lg">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-fill-brand/20 shadow-sm flex-shrink-0">
                  <span className="text-2xl">👤</span>
                </div>
                <div className="flex-1">
                  <Typography variant="headingMd" className="font-bold text-text-brand mb-1">
                    Customer Information
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Quote request from the following customer
                  </Typography>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-white border border-border-muted">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">👤</span>
                    <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide font-bold">
                      Name
                    </Typography>
                  </div>
                  <Typography variant="bodyMd" className="font-bold">
                    {quote.clientName || 'Unknown'}
                  </Typography>
                </div>

                {quote.clientCompany && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🏢</span>
                      <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide font-bold">
                        Company
                      </Typography>
                    </div>
                    <Typography variant="bodyMd" className="font-bold">
                      {quote.clientCompany}
                    </Typography>
                  </div>
                )}

                {quote.clientEmail && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📧</span>
                      <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide font-bold">
                        Email
                      </Typography>
                    </div>
                    <a
                      href={`mailto:${quote.clientEmail}`}
                      className="text-sm font-semibold text-text-brand hover:underline"
                    >
                      {quote.clientEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Quote Summary */}
            <div className="rounded-xl bg-gradient-to-br from-fill-muted/50 to-fill-muted border border-border-muted p-5">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide font-bold">
                    Submitted
                  </Typography>
                  <Typography variant="bodySm" className="font-bold">
                    {quote.buyRequestSubmittedAt
                      ? format(new Date(quote.buyRequestSubmittedAt), 'MMM d, yyyy')
                      : 'N/A'}
                  </Typography>
                </div>
                <div className="space-y-1">
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide font-bold">
                    Status
                  </Typography>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-fill-brand/10 px-2.5 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-fill-brand animate-pulse" />
                    <Typography variant="bodyXs" className="font-bold capitalize text-text-brand">
                      {quote.status.replace(/_/g, ' ')}
                    </Typography>
                  </div>
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

              {/* Table Header */}
              <div className="rounded-t-xl border border-border-muted bg-gradient-to-r from-fill-muted/80 to-fill-muted px-6 py-4 shadow-sm">
                {quote.status === 'under_cc_review' ? (
                  <div className="grid grid-cols-12 gap-6 text-xs font-bold text-text-muted uppercase tracking-wider">
                    <div className="col-span-5">Product Details</div>
                    <div className="col-span-2 text-center">Requested</div>
                    <div className="col-span-2 text-center">Confirmed</div>
                    <div className="col-span-2 text-right">Price/Case</div>
                    <div className="col-span-1 text-right">Total</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-12 gap-6 text-xs font-bold text-text-muted uppercase tracking-wider">
                    <div className="col-span-6">Product Details</div>
                    <div className="col-span-2 text-center">Requested</div>
                    <div className="col-span-2 text-right">Price/Case</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="space-y-3 mt-4">
                {lineItems.map((item, idx) => {
                  const product = productMap[item.productId];
                  const pricing = pricingMap[item.productId];
                  const pricePerCase = pricing?.lineItemTotalUsd
                    ? pricing.lineItemTotalUsd / item.quantity
                    : 0;

                  const adjustment = lineItemAdjustments[item.productId];
                  const finalPricePerCase = adjustment?.adjustedPricePerCase ?? pricePerCase;
                  const finalQuantity = adjustment?.confirmedQuantity ?? item.quantity;
                  const lineTotal = finalPricePerCase * finalQuantity;

                  const displayPricePerCase =
                    displayCurrency === 'USD' ? pricePerCase : convertUsdToAed(pricePerCase);
                  const displayLineTotal =
                    displayCurrency === 'USD' ? lineTotal : convertUsdToAed(lineTotal);

                  const isReviewMode = quote.status === 'under_cc_review';

                  const hasAlternatives = item.alternativeVintages && item.alternativeVintages.length > 0;

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border-2 border-border-muted dark:border-border-muted bg-white dark:bg-background-secondary shadow-sm hover:shadow-md hover:border-border-brand transition-all duration-200"
                    >
                    <div
                      className="grid grid-cols-12 gap-4 sm:gap-6 px-4 sm:px-6 py-5 group"
                    >
                      {product ? (
                        <>
                          {/* Product Info */}
                          <div className={`${isReviewMode ? 'col-span-5' : 'col-span-6'} space-y-1.5 pr-4`}>
                            <Typography variant="bodySm" className="font-bold group-hover:text-text-brand transition-colors line-clamp-2 leading-tight">
                              {product.name}
                            </Typography>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {product.producer && (
                                <Typography variant="bodyXs" colorRole="muted" className="truncate max-w-[180px]">
                                  {product.producer}
                                </Typography>
                              )}
                              {product.year && (
                                <Typography variant="bodyXs" colorRole="muted" className="flex-shrink-0">
                                  • {product.year}
                                </Typography>
                              )}
                              {item.vintage && (
                                <Typography variant="bodyXs" colorRole="muted" className="flex-shrink-0">
                                  • Vintage {item.vintage}
                                </Typography>
                              )}
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-md bg-fill-muted/50 px-2 py-0.5">
                              <Typography variant="bodyXs" colorRole="muted" className="font-mono text-[9px]">
                                {product.lwin18}
                              </Typography>
                            </div>
                            {isReviewMode && adjustment && !adjustment.available && (
                              <div className="inline-flex items-center gap-1.5 rounded-lg bg-fill-warning/10 border border-border-warning px-2.5 py-1 mt-1">
                                <span className="text-sm">⚠️</span>
                                <Typography variant="bodyXs" colorRole="warning" className="font-bold">
                                  Out of Stock
                                </Typography>
                              </div>
                            )}
                          </div>

                          {/* Requested Quantity */}
                          <div className="col-span-2 flex items-center justify-center">
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <Typography variant="bodyLg" className="font-bold text-text-brand">
                                {item.quantity}
                              </Typography>
                              <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide text-[10px]">
                                {item.quantity === 1 ? 'case' : 'cases'}
                              </Typography>
                            </div>
                          </div>

                          {isReviewMode ? (
                            <>
                              {/* Confirmed Quantity (Editable) */}
                              <div className="col-span-2 flex flex-col items-center justify-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  value={adjustment?.confirmedQuantity ?? item.quantity}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    setLineItemAdjustments({
                                      ...lineItemAdjustments,
                                      [item.productId]: {
                                        adjustedPricePerCase: adjustment?.adjustedPricePerCase ?? pricePerCase,
                                        confirmedQuantity: value,
                                        available: value > 0,
                                        notes: adjustment?.notes,
                                      },
                                    });
                                  }}
                                  className="w-24 text-center font-bold text-base border-2 focus:border-border-brand focus:ring-2 focus:ring-fill-brand/20 transition-all"
                                />
                                <label className="flex items-center gap-1.5 cursor-pointer group/checkbox">
                                  <input
                                    type="checkbox"
                                    checked={adjustment?.available ?? true}
                                    onChange={(e) => {
                                      setLineItemAdjustments({
                                        ...lineItemAdjustments,
                                        [item.productId]: {
                                          adjustedPricePerCase: adjustment?.adjustedPricePerCase ?? pricePerCase,
                                          confirmedQuantity: e.target.checked
                                            ? adjustment?.confirmedQuantity ?? item.quantity
                                            : 0,
                                          available: e.target.checked,
                                          notes: adjustment?.notes,
                                        },
                                      });
                                    }}
                                    className="h-3.5 w-3.5 rounded border-2 cursor-pointer"
                                  />
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted group-hover/checkbox:text-text transition-colors">
                                    In Stock
                                  </span>
                                </label>
                              </div>

                              {/* Price per Case (Editable USD) */}
                              <div className="col-span-2 flex items-center justify-end">
                                <div className="flex flex-col items-end gap-1">
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted font-semibold text-sm">$</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={adjustment?.adjustedPricePerCase ?? pricePerCase}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        setLineItemAdjustments({
                                          ...lineItemAdjustments,
                                          [item.productId]: {
                                            adjustedPricePerCase: value,
                                            confirmedQuantity: adjustment?.confirmedQuantity ?? item.quantity,
                                            available: adjustment?.available ?? true,
                                            notes: adjustment?.notes,
                                          },
                                        });
                                      }}
                                      className="w-32 pl-6 text-right font-bold text-base border-2 focus:border-border-brand focus:ring-2 focus:ring-fill-brand/20 transition-all"
                                    />
                                  </div>
                                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide text-[10px]">
                                    per case
                                  </Typography>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Price per Case (Read-only) */}
                              <div className="col-span-2 flex items-center justify-end">
                                <div className="flex flex-col items-end gap-0.5">
                                  <Typography variant="bodySm" className="font-bold">
                                    {formatPrice(displayPricePerCase, displayCurrency)}
                                  </Typography>
                                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide text-[10px]">
                                    per case
                                  </Typography>
                                </div>
                              </div>
                            </>
                          )}

                          {/* Line Total */}
                          <div className={`${isReviewMode ? 'col-span-1' : 'col-span-2'} flex items-center justify-end`}>
                            <Typography variant="bodyLg" className="font-bold text-text-brand">
                              {formatPrice(displayLineTotal, displayCurrency)}
                            </Typography>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-12">
                          <Typography variant="bodySm" className="mb-1 font-mono">
                            {item.productId}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="danger">
                            Product details unavailable • Quantity: {item.quantity}
                          </Typography>
                        </div>
                      )}
                    </div>

                    {/* Alternative Vintages Section */}
                    {product && hasAlternatives && (
                      <div className="px-6 py-3 bg-fill-muted/20">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">📅</span>
                          <Typography variant="bodySm" className="font-semibold">
                            Customer Requested Alternatives:
                          </Typography>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.alternativeVintages?.map((vintage, vIdx) => (
                            <span
                              key={vIdx}
                              className="inline-flex items-center gap-1 rounded-md bg-fill-brand/10 border border-border-brand/30 px-3 py-1 text-xs font-semibold text-text-brand"
                            >
                              {vintage}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Admin Notes for Line Item */}
                    {isReviewMode && product && (
                      <div className="px-6 py-3 bg-white border-t border-border-muted space-y-4">
                        <div>
                          <Typography variant="bodySm" className="mb-2 font-semibold">
                            Notes for this item <span className="text-text-muted font-normal text-xs">(optional)</span>
                          </Typography>
                          <TextArea
                            value={adjustment?.notes || ''}
                            onChange={(e) => {
                              setLineItemAdjustments({
                                ...lineItemAdjustments,
                                [item.productId]: {
                                  adjustedPricePerCase: adjustment?.adjustedPricePerCase ?? pricePerCase,
                                  confirmedQuantity: adjustment?.confirmedQuantity ?? item.quantity,
                                  available: adjustment?.available ?? true,
                                  notes: e.target.value,
                                  adminAlternatives: adjustment?.adminAlternatives,
                                },
                              });
                            }}
                            placeholder="e.g., Substituted with 2019 vintage, Price adjusted due to supplier discount"
                            rows={2}
                            className="text-sm border-2 focus:border-border-brand focus:ring-2 focus:ring-fill-brand/20 transition-all"
                          />
                        </div>

                        {/* Admin Alternative Suggestions - Collapsible */}
                        <div className="rounded-lg border border-border-muted overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedAlternatives({
                                ...expandedAlternatives,
                                [item.productId]: !expandedAlternatives[item.productId],
                              });
                            }}
                            className="w-full flex items-center justify-between p-3 hover:bg-fill-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">💡</span>
                              <Typography variant="bodySm" className="font-semibold">
                                Suggest Alternative Products
                                {adjustment?.adminAlternatives && adjustment.adminAlternatives.length > 0 && (
                                  <span className="ml-2 text-text-brand">
                                    ({adjustment.adminAlternatives.length})
                                  </span>
                                )}
                              </Typography>
                            </div>
                            <div className={`transition-transform duration-200 ${expandedAlternatives[item.productId] ? 'rotate-180' : ''}`}>
                              <span className="text-sm text-text-muted">▼</span>
                            </div>
                          </button>

                          {expandedAlternatives[item.productId] && (
                            <div className="p-4 bg-gradient-to-br from-fill-warning/10 to-fill-warning/5 border-t border-border-warning">
                              <Typography variant="bodyXs" colorRole="muted" className="mb-4">
                                Add alternative products with pricing that aren&apos;t in your catalog
                              </Typography>

                              {/* Structured form for new alternative */}
                              <div className="space-y-3 mb-4">
                                <div className="grid grid-cols-2 gap-3">
                              <div className="col-span-2">
                                <Typography variant="bodyXs" className="mb-1 font-medium">
                                  Product Name <span className="text-text-danger">*</span>
                                </Typography>
                                <Input
                                  type="text"
                                  size="sm"
                                  placeholder="e.g., Chateau Margaux 2019"
                                  value={newAlternative[item.productId]?.productName || ''}
                                  onChange={(e) => {
                                    setNewAlternative({
                                      ...newAlternative,
                                      [item.productId]: {
                                        ...newAlternative[item.productId],
                                        productName: e.target.value,
                                        pricePerCase: newAlternative[item.productId]?.pricePerCase || '',
                                        bottlesPerCase: newAlternative[item.productId]?.bottlesPerCase || '',
                                        bottleSize: newAlternative[item.productId]?.bottleSize || '',
                                        quantityAvailable: newAlternative[item.productId]?.quantityAvailable || '',
                                      },
                                    });
                                  }}
                                />
                              </div>
                              <div>
                                <Typography variant="bodyXs" className="mb-1 font-medium">
                                  Price/Case (USD) <span className="text-text-danger">*</span>
                                </Typography>
                                <Input
                                  type="number"
                                  size="sm"
                                  placeholder="180"
                                  min="0"
                                  step="0.01"
                                  value={newAlternative[item.productId]?.pricePerCase || ''}
                                  onChange={(e) => {
                                    setNewAlternative({
                                      ...newAlternative,
                                      [item.productId]: {
                                        ...newAlternative[item.productId],
                                        productName: newAlternative[item.productId]?.productName || '',
                                        pricePerCase: e.target.value,
                                        bottlesPerCase: newAlternative[item.productId]?.bottlesPerCase || '',
                                        bottleSize: newAlternative[item.productId]?.bottleSize || '',
                                        quantityAvailable: newAlternative[item.productId]?.quantityAvailable || '',
                                      },
                                    });
                                  }}
                                />
                              </div>
                              <div>
                                <Typography variant="bodyXs" className="mb-1 font-medium">
                                  Qty Available <span className="text-text-danger">*</span>
                                </Typography>
                                <Input
                                  type="number"
                                  size="sm"
                                  placeholder="100"
                                  min="0"
                                  value={newAlternative[item.productId]?.quantityAvailable || ''}
                                  onChange={(e) => {
                                    setNewAlternative({
                                      ...newAlternative,
                                      [item.productId]: {
                                        ...newAlternative[item.productId],
                                        productName: newAlternative[item.productId]?.productName || '',
                                        pricePerCase: newAlternative[item.productId]?.pricePerCase || '',
                                        bottlesPerCase: newAlternative[item.productId]?.bottlesPerCase || '',
                                        bottleSize: newAlternative[item.productId]?.bottleSize || '',
                                        quantityAvailable: e.target.value,
                                      },
                                    });
                                  }}
                                />
                              </div>
                              <div>
                                <Typography variant="bodyXs" className="mb-1 font-medium">
                                  Bottles/Case <span className="text-text-danger">*</span>
                                </Typography>
                                <Input
                                  type="number"
                                  size="sm"
                                  placeholder="12"
                                  min="1"
                                  value={newAlternative[item.productId]?.bottlesPerCase || ''}
                                  onChange={(e) => {
                                    setNewAlternative({
                                      ...newAlternative,
                                      [item.productId]: {
                                        ...newAlternative[item.productId],
                                        productName: newAlternative[item.productId]?.productName || '',
                                        pricePerCase: newAlternative[item.productId]?.pricePerCase || '',
                                        bottlesPerCase: e.target.value,
                                        bottleSize: newAlternative[item.productId]?.bottleSize || '',
                                        quantityAvailable: newAlternative[item.productId]?.quantityAvailable || '',
                                      },
                                    });
                                  }}
                                />
                              </div>
                              <div>
                                <Typography variant="bodyXs" className="mb-1 font-medium">
                                  Bottle Size <span className="text-text-danger">*</span>
                                </Typography>
                                <Input
                                  type="text"
                                  size="sm"
                                  placeholder="750ml"
                                  value={newAlternative[item.productId]?.bottleSize || ''}
                                  onChange={(e) => {
                                    setNewAlternative({
                                      ...newAlternative,
                                      [item.productId]: {
                                        ...newAlternative[item.productId],
                                        productName: newAlternative[item.productId]?.productName || '',
                                        pricePerCase: newAlternative[item.productId]?.pricePerCase || '',
                                        bottlesPerCase: newAlternative[item.productId]?.bottlesPerCase || '',
                                        bottleSize: e.target.value,
                                        quantityAvailable: newAlternative[item.productId]?.quantityAvailable || '',
                                      },
                                    });
                                  }}
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="default"
                              colorRole="brand"
                              size="sm"
                              onClick={() => {
                                const alt = newAlternative[item.productId];
                                if (
                                  alt?.productName?.trim() &&
                                  alt?.pricePerCase &&
                                  alt?.bottlesPerCase &&
                                  alt?.bottleSize?.trim() &&
                                  alt?.quantityAvailable
                                ) {
                                  const currentAlternatives = adjustment?.adminAlternatives || [];
                                  setLineItemAdjustments({
                                    ...lineItemAdjustments,
                                    [item.productId]: {
                                      adjustedPricePerCase: adjustment?.adjustedPricePerCase ?? pricePerCase,
                                      confirmedQuantity: adjustment?.confirmedQuantity ?? item.quantity,
                                      available: adjustment?.available ?? true,
                                      notes: adjustment?.notes,
                                      adminAlternatives: [
                                        ...currentAlternatives,
                                        {
                                          productName: alt.productName.trim(),
                                          pricePerCase: parseFloat(alt.pricePerCase),
                                          bottlesPerCase: parseInt(alt.bottlesPerCase),
                                          bottleSize: alt.bottleSize.trim(),
                                          quantityAvailable: parseInt(alt.quantityAvailable),
                                        },
                                      ],
                                    },
                                  });
                                  // Clear form
                                  setNewAlternative({
                                    ...newAlternative,
                                    [item.productId]: {
                                      productName: '',
                                      pricePerCase: '',
                                      bottlesPerCase: '',
                                      bottleSize: '',
                                      quantityAvailable: '',
                                    },
                                  });
                                }
                              }}
                              isDisabled={
                                !newAlternative[item.productId]?.productName?.trim() ||
                                !newAlternative[item.productId]?.pricePerCase ||
                                !newAlternative[item.productId]?.bottlesPerCase ||
                                !newAlternative[item.productId]?.bottleSize?.trim() ||
                                !newAlternative[item.productId]?.quantityAvailable
                              }
                              className="w-full"
                            >
                              <ButtonContent iconLeft={IconPlus}>Add Alternative</ButtonContent>
                            </Button>
                          </div>

                          {/* Display added alternatives */}
                          {adjustment?.adminAlternatives && adjustment.adminAlternatives.length > 0 && (
                            <div className="space-y-2">
                              <Typography variant="bodyXs" className="font-semibold">
                                Alternative Products ({adjustment.adminAlternatives.length}):
                              </Typography>
                              <div className="space-y-2">
                                {adjustment.adminAlternatives.map((alt, altIdx) => (
                                  <div
                                    key={altIdx}
                                    className="rounded-md bg-fill-brand/10 border border-border-success p-3"
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <Typography variant="bodyXs" className="font-bold text-text-brand flex-1">
                                        {alt.productName}
                                      </Typography>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedAlternatives = adjustment.adminAlternatives!.filter(
                                            (_, i) => i !== altIdx
                                          );
                                          setLineItemAdjustments({
                                            ...lineItemAdjustments,
                                            [item.productId]: {
                                              ...adjustment,
                                              adminAlternatives: updatedAlternatives.length > 0 ? updatedAlternatives : undefined,
                                            },
                                          });
                                        }}
                                        className="text-text-danger hover:text-text-danger/80 transition-colors text-sm font-bold"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                      <Typography variant="bodyXs" colorRole="muted">
                                        Price: ${alt.pricePerCase.toFixed(2)}/case
                                      </Typography>
                                      <Typography variant="bodyXs" colorRole="muted">
                                        {alt.quantityAvailable} cases available
                                      </Typography>
                                      <Typography variant="bodyXs" colorRole="muted" className="col-span-2">
                                        {alt.bottlesPerCase} × {alt.bottleSize}
                                      </Typography>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>

              {/* Order Total */}
              <div className="mt-8 flex justify-end">
                <div className="rounded-xl bg-gradient-to-br from-fill-brand/10 to-fill-brand/20 border-2 border-border-brand/30 px-10 py-6 min-w-[280px] shadow-lg">
                  <Typography variant="bodySm" colorRole="muted" className="mb-3 text-right uppercase tracking-wider font-bold">
                    Order Total
                  </Typography>
                  <Typography variant="headingLg" className="font-black text-text-brand text-right">
                    {formatPrice(displayTotal, displayCurrency)}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mt-2 text-right uppercase tracking-wide">
                    {displayCurrency === 'USD' ? 'US Dollars' : 'UAE Dirham'}
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
