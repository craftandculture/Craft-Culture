'use client';

import type { DialogProps } from '@radix-ui/react-dialog';
import {
  IconCheck,
  IconDownload,
  IconEdit,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import QuoteWorkflowTimeline from '@/app/_quotes/components/QuoteWorkflowTimeline';
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
  quote: Quote | null;
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

  // State for currency display
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'AED'>('USD');

  // State for showing workflow section
  const [showWorkflow, setShowWorkflow] = useState(false);

  // State for line item adjustments (admin review)
  const [lineItemAdjustments, setLineItemAdjustments] = useState<
    Record<
      string,
      {
        adjustedPricePerCase?: number;
        confirmedQuantity?: number;
        available: boolean;
        notes?: string;
      }
    >
  >({});

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

      return trpcClient.quotes.confirm.mutate({
        quoteId: quote.id,
        deliveryLeadTime: deliveryLeadTime.trim(),
        ccConfirmationNotes: confirmationNotes || undefined,
        lineItemAdjustments:
          quote.status === 'under_cc_review' && Object.keys(lineItemAdjustments).length > 0
            ? lineItemAdjustments
            : undefined,
      });
    },
    onSuccess: () => {
      toast.success('Quote confirmed successfully');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setConfirmationNotes('');
      setDeliveryLeadTime('');
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
            {/* Quote Summary */}
            <div className="rounded-xl bg-gradient-to-br from-fill-muted/50 to-fill-muted border border-border-muted p-5">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide font-bold">
                    Client
                  </Typography>
                  <Typography variant="bodySm" className="font-bold">
                    {quote.clientName || 'Unknown'}
                  </Typography>
                  {quote.clientCompany && (
                    <Typography variant="bodyXs" colorRole="muted" className="font-medium">
                      {quote.clientCompany}
                    </Typography>
                  )}
                  {quote.clientEmail && (
                    <Typography variant="bodyXs" colorRole="muted">
                      {quote.clientEmail}
                    </Typography>
                  )}
                </div>
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

              {/* Table Rows */}
              <div className="divide-y divide-border-muted rounded-b-xl border-x border-b border-border-muted bg-white shadow-sm">
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

                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-6 px-6 py-4 hover:bg-fill-muted/30 transition-all duration-200 group"
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
                              <div className="inline-flex items-center gap-1.5 rounded-lg bg-fill-danger/10 border border-border-danger px-2.5 py-1 mt-1">
                                <span className="text-sm">⚠️</span>
                                <Typography variant="bodyXs" colorRole="danger" className="font-bold">
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

            {/* Workflow Actions - Collapsible Section */}
            <div className="rounded-xl border border-border-muted bg-white shadow-md overflow-hidden">
              <button
                type="button"
                onClick={() => setShowWorkflow(!showWorkflow)}
                className="w-full px-6 py-5 flex items-center justify-between bg-gradient-to-r from-fill-muted/20 to-fill-muted/40 hover:from-fill-muted/30 hover:to-fill-muted/50 transition-all duration-300 group border-b border-border-muted"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fill-brand/10 group-hover:bg-fill-brand/20 transition-colors">
                    <span className="text-lg">📋</span>
                  </div>
                  <div className="text-left">
                    <Typography variant="bodyLg" className="font-bold group-hover:text-text-brand transition-colors">
                      Workflow & Actions
                    </Typography>
                    {(quote.status === 'buy_request_submitted' ||
                      quote.status === 'under_cc_review' ||
                      quote.status === 'po_submitted') && (
                      <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                        Action required to proceed
                      </Typography>
                    )}
                  </div>
                  {(quote.status === 'buy_request_submitted' ||
                    quote.status === 'under_cc_review' ||
                    quote.status === 'po_submitted') && (
                    <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-fill-brand animate-pulse" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {(quote.status === 'buy_request_submitted' ||
                    quote.status === 'under_cc_review' ||
                    quote.status === 'po_submitted') && (
                    <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-fill-brand px-3 py-1.5 text-xs font-bold text-white">
                      Action Required
                    </span>
                  )}
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-fill-muted/50 group-hover:bg-fill-brand/10 transition-all duration-300 ${showWorkflow ? 'rotate-180' : ''}`}>
                    <span className="text-sm text-text-muted group-hover:text-text-brand">▼</span>
                  </div>
                </div>
              </button>

              {showWorkflow && (
                <div className="bg-gradient-to-b from-fill-muted/10 to-transparent">
                  {/* Workflow Timeline */}
                  <div className="p-6 pb-4">
                    <div className="rounded-xl bg-white p-5 shadow-sm border border-border-muted">
                      <QuoteWorkflowTimeline quote={quote} />
                    </div>
                  </div>

                  {/* Visual Separator */}
                  <div className="px-6">
                    <div className="border-t border-border-muted" />
                  </div>

                  {/* Action Forms */}
                  <div className="p-6 pt-5">
                    {quote.status === 'buy_request_submitted' && (
                      <div className="rounded-xl bg-white p-6 shadow-sm border border-border-muted">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fill-brand/10">
                            <span className="text-base">🚀</span>
                          </div>
                          <Typography variant="bodyLg" className="font-bold">
                            Start Review
                          </Typography>
                        </div>
                        <div>
                          <Typography variant="bodySm" className="mb-3 font-semibold">
                            Review Notes <span className="text-text-muted font-normal text-xs">(optional)</span>
                          </Typography>
                          <TextArea
                            id="ccNotes"
                            value={ccNotes}
                            onChange={(e) => setCcNotes(e.target.value)}
                            placeholder="Add any notes about this review..."
                            rows={4}
                            className="border-2 focus:border-border-brand focus:ring-2 focus:ring-fill-brand/20 transition-all"
                          />
                        </div>
                      </div>
                    )}

                    {quote.status === 'under_cc_review' && !showRevisionForm && (
                      <div className="rounded-xl bg-white p-6 shadow-sm border border-border-muted space-y-5">
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fill-brand/10">
                              <span className="text-base">🚚</span>
                            </div>
                            <Typography variant="bodyLg" className="font-bold">
                              Delivery Lead Time <span className="text-text-danger">*</span>
                            </Typography>
                          </div>
                          <Input
                            type="text"
                            value={deliveryLeadTime}
                            onChange={(e) => setDeliveryLeadTime(e.target.value)}
                            placeholder="e.g., 14-21 days, 3-4 weeks"
                            className="border-2 focus:border-border-brand focus:ring-2 focus:ring-fill-brand/20 transition-all"
                          />
                          <Typography variant="bodyXs" colorRole="muted" className="mt-2">
                            This will be shown to the customer before they submit their PO
                          </Typography>
                        </div>

                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fill-brand/10">
                              <span className="text-base">✍️</span>
                            </div>
                            <Typography variant="bodyLg" className="font-bold">
                              Confirmation Notes
                            </Typography>
                          </div>
                          <TextArea
                            value={confirmationNotes}
                            onChange={(e) => setConfirmationNotes(e.target.value)}
                            placeholder="Add any notes about this confirmation..."
                            rows={4}
                            className="border-2 focus:border-border-brand focus:ring-2 focus:ring-fill-brand/20 transition-all"
                          />
                        </div>
                      </div>
                    )}

                    {showRevisionForm && (
                      <div className="rounded-xl bg-gradient-to-br from-fill-danger/5 to-fill-danger/10 p-6 shadow-sm border-2 border-border-danger">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fill-danger/20">
                            <span className="text-base">⚠️</span>
                          </div>
                          <Typography variant="bodyLg" className="font-bold text-text-danger">
                            Request Revision
                          </Typography>
                        </div>
                        <div>
                          <Typography variant="bodySm" className="mb-3 font-semibold">
                            Revision Reason <span className="text-text-danger">*</span>
                          </Typography>
                          <TextArea
                            id="revisionReason"
                            value={revisionReason}
                            onChange={(e) => setRevisionReason(e.target.value)}
                            placeholder="Explain what needs to be revised..."
                            rows={4}
                            className="border-2 border-border-danger focus:border-border-danger focus:ring-2 focus:ring-fill-danger/20 transition-all bg-white"
                          />
                        </div>
                      </div>
                    )}

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
                          {quote.deliveryLeadTime && (
                            <div>
                              <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide font-semibold mb-2">
                                Delivery Lead Time
                              </Typography>
                              <Typography variant="bodyLg" className="font-bold">
                                {quote.deliveryLeadTime}
                              </Typography>
                            </div>
                          )}
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
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="bg-gradient-to-r from-fill-muted/30 to-fill-muted/50 border-t-2 border-border-muted">
          {quote.status === 'buy_request_submitted' && (
            <Button
              variant="default"
              colorRole="brand"
              size="lg"
              onClick={() => startReviewMutation.mutate()}
              isDisabled={startReviewMutation.isPending}
              className="font-bold shadow-lg hover:shadow-xl transition-all duration-200 px-8"
            >
              <ButtonContent iconLeft={IconPlayerPlay}>
                {startReviewMutation.isPending ? 'Starting...' : 'Start Review'}
              </ButtonContent>
            </Button>
          )}

          {quote.status === 'under_cc_review' && !showRevisionForm && (
            <>
              <Button
                variant="outline"
                colorRole="danger"
                size="lg"
                onClick={() => setShowRevisionForm(true)}
                className="font-semibold hover:bg-fill-danger/10 transition-all duration-200 px-6"
              >
                <ButtonContent iconLeft={IconEdit}>Request Revision</ButtonContent>
              </Button>
              <Button
                variant="default"
                colorRole="brand"
                size="lg"
                onClick={() => confirmMutation.mutate()}
                isDisabled={confirmMutation.isPending}
                className="font-bold shadow-lg hover:shadow-xl transition-all duration-200 px-8"
              >
                <ButtonContent iconLeft={IconCheck}>
                  {confirmMutation.isPending ? 'Confirming...' : 'Confirm Quote'}
                </ButtonContent>
              </Button>
            </>
          )}

          {showRevisionForm && (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setShowRevisionForm(false);
                  setRevisionReason('');
                }}
                className="font-semibold hover:bg-fill-muted/50 transition-all duration-200 px-6"
              >
                <ButtonContent>Cancel</ButtonContent>
              </Button>
              <Button
                variant="default"
                colorRole="danger"
                size="lg"
                onClick={() => requestRevisionMutation.mutate()}
                isDisabled={
                  requestRevisionMutation.isPending || !revisionReason.trim()
                }
                className="font-bold shadow-lg hover:shadow-xl transition-all duration-200 px-8"
              >
                <ButtonContent iconLeft={IconEdit}>
                  {requestRevisionMutation.isPending
                    ? 'Submitting...'
                    : 'Submit Revision Request'}
                </ButtonContent>
              </Button>
            </>
          )}

          {quote.status === 'po_submitted' && (
            <Button
              variant="default"
              colorRole="brand"
              size="lg"
              onClick={() => confirmPOMutation.mutate()}
              isDisabled={confirmPOMutation.isPending}
              className="font-bold shadow-lg hover:shadow-xl transition-all duration-200 px-8"
            >
              <ButtonContent iconLeft={IconCheck}>
                {confirmPOMutation.isPending ? 'Confirming...' : 'Confirm PO'}
              </ButtonContent>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteApprovalDialog;
