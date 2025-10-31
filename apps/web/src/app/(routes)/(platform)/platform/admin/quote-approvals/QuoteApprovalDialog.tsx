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
import Divider from '@/app/_ui/components/Divider/Divider';
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

      return trpcClient.quotes.confirm.mutate({
        quoteId: quote.id,
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
      if (!deliveryLeadTime.trim()) {
        toast.error('Please provide delivery lead time');
        return;
      }
      return trpcClient.quotes.confirmPO.mutate({
        quoteId: quote.id,
        deliveryLeadTime: deliveryLeadTime.trim(),
        poConfirmationNotes: confirmationNotes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('PO confirmed successfully');
      void queryClient.invalidateQueries({ queryKey: ['admin-quotes'] });
      setConfirmationNotes('');
      setDeliveryLeadTime('');
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
          adjustedPricePerCase: pricePerCase,
          confirmedQuantity: item.quantity,
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{quote.name}</DialogTitle>
          <DialogDescription>
            Review and approve this quote - Status: {quote.status}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Quote Summary */}
            <div className="rounded-lg bg-fill-muted p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Client
                  </Typography>
                  <Typography variant="bodySm" className="font-medium">
                    {quote.clientName || 'N/A'}
                  </Typography>
                  {quote.clientCompany && (
                    <Typography variant="bodyXs" colorRole="muted">
                      {quote.clientCompany}
                    </Typography>
                  )}
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Submitted
                  </Typography>
                  <Typography variant="bodySm">
                    {quote.buyRequestSubmittedAt
                      ? format(new Date(quote.buyRequestSubmittedAt), 'MMM d, yyyy')
                      : 'N/A'}
                  </Typography>
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Status
                  </Typography>
                  <Typography variant="bodySm" className="font-medium capitalize">
                    {quote.status.replace(/_/g, ' ')}
                  </Typography>
                </div>
              </div>
            </div>

            {/* Line Items - Detailed Table View */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Typography variant="bodySm" className="font-semibold">
                  Order Details ({lineItems.length} {lineItems.length === 1 ? 'item' : 'items'})
                </Typography>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisplayCurrency(displayCurrency === 'USD' ? 'AED' : 'USD')}
                  className="h-7 px-3 text-xs"
                >
                  <ButtonContent>View in {displayCurrency === 'USD' ? 'AED' : 'USD'}</ButtonContent>
                </Button>
              </div>

              {quote.status === 'under_cc_review' && (
                <div className="mb-3 rounded-lg border border-border-brand bg-fill-brand/10 p-3">
                  <Typography variant="bodySm" className="font-medium text-text-brand">
                    📝 Review Mode: Adjust quantities and prices as needed
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                    Confirm availability, adjust quantities, and set final prices (in USD). Uncheck &ldquo;Available&rdquo; to mark items as out of stock.
                  </Typography>
                </div>
              )}

              {/* Table Header */}
              <div className="rounded-t-lg border border-border-muted bg-fill-muted/50 px-4 py-2">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-text-muted">
                  <div className="col-span-4">Product</div>
                  <div className="col-span-2 text-right">Requested Qty</div>
                  {quote.status === 'under_cc_review' && (
                    <>
                      <div className="col-span-2 text-right">Confirmed Qty</div>
                      <div className="col-span-2 text-right">Price/Case (USD)</div>
                    </>
                  )}
                  {quote.status !== 'under_cc_review' && (
                    <>
                      <div className="col-span-2 text-right">Price/Case</div>
                    </>
                  )}
                  <div className="col-span-2 text-right">Line Total</div>
                </div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-border-muted rounded-b-lg border-x border-b border-border-muted">
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
                      className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-fill-muted/30"
                    >
                      {product ? (
                        <>
                          {/* Product Info */}
                          <div className="col-span-4">
                            <Typography variant="bodySm" className="mb-1 font-medium">
                              {product.name}
                            </Typography>
                            <div className="flex flex-wrap gap-x-2 gap-y-1">
                              {product.producer && (
                                <Typography variant="bodyXs" colorRole="muted">
                                  {product.producer}
                                </Typography>
                              )}
                              {product.year && (
                                <Typography variant="bodyXs" colorRole="muted">
                                  • {product.year}
                                </Typography>
                              )}
                              {item.vintage && (
                                <Typography variant="bodyXs" colorRole="muted">
                                  • Vintage: {item.vintage}
                                </Typography>
                              )}
                            </div>
                            <Typography variant="bodyXs" colorRole="muted" className="mt-1 font-mono">
                              {product.lwin18}
                            </Typography>
                            {isReviewMode && adjustment && !adjustment.available && (
                              <Typography variant="bodyXs" colorRole="danger" className="mt-1">
                                ⚠️ Marked as unavailable
                              </Typography>
                            )}
                          </div>

                          {/* Requested Quantity */}
                          <div className="col-span-2 text-right">
                            <div className="inline-flex flex-col items-end">
                              <Typography variant="bodyLg" className="font-bold text-text-brand">
                                {item.quantity}
                              </Typography>
                              <Typography variant="bodyXs" colorRole="muted">
                                {item.quantity === 1 ? 'case' : 'cases'}
                              </Typography>
                            </div>
                          </div>

                          {isReviewMode ? (
                            <>
                              {/* Confirmed Quantity (Editable) */}
                              <div className="col-span-2 flex flex-col items-end gap-1">
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
                                  className="w-20 text-right"
                                />
                                <label className="flex items-center gap-1 text-xs">
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
                                  />
                                  <span className="text-text-muted">Available</span>
                                </label>
                              </div>

                              {/* Price per Case (Editable USD) */}
                              <div className="col-span-2 flex flex-col items-end">
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
                                  className="w-28 text-right"
                                />
                                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                                  per case
                                </Typography>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Price per Case (Read-only) */}
                              <div className="col-span-2 text-right">
                                <Typography variant="bodySm" className="font-medium">
                                  {formatPrice(displayPricePerCase, displayCurrency)}
                                </Typography>
                                <Typography variant="bodyXs" colorRole="muted">
                                  per case
                                </Typography>
                              </div>
                            </>
                          )}

                          {/* Line Total */}
                          <div className="col-span-2 text-right">
                            <Typography variant="bodySm" className="font-bold">
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
              <div className="mt-3 flex justify-end">
                <div className="rounded-lg bg-fill-brand/10 px-6 py-3">
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1 text-right">
                    Order Total
                  </Typography>
                  <Typography variant="bodyLg" className="font-bold text-text-brand">
                    {formatPrice(displayTotal, displayCurrency)}
                  </Typography>
                </div>
              </div>
            </div>

            {/* Workflow Actions - Collapsible Section */}
            <div className="rounded-lg border border-border-muted">
              <button
                type="button"
                onClick={() => setShowWorkflow(!showWorkflow)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-fill-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Typography variant="bodySm" className="font-semibold">
                    Workflow & Actions
                  </Typography>
                  {(quote.status === 'buy_request_submitted' ||
                    quote.status === 'under_cc_review' ||
                    quote.status === 'po_submitted') && (
                    <span className="rounded-full bg-fill-brand px-2 py-0.5 text-xs font-medium text-white">
                      Action Required
                    </span>
                  )}
                </div>
                <Typography variant="bodyXs" colorRole="muted">
                  {showWorkflow ? 'Hide' : 'Show'}
                </Typography>
              </button>

              {showWorkflow && (
                <div className="border-t border-border-muted p-4 space-y-6">
                  {/* Workflow Timeline */}
                  <QuoteWorkflowTimeline quote={quote} />

                  <Divider />

                  {/* Action Forms */}
                  {quote.status === 'buy_request_submitted' && (
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-semibold">
                  Start Review
                </Typography>
                <div>
                  <Typography variant="bodySm" className="mb-2">
                    Review Notes (optional)
                  </Typography>
                  <TextArea
                    id="ccNotes"
                    value={ccNotes}
                    onChange={(e) => setCcNotes(e.target.value)}
                    placeholder="Add any notes about this review..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {quote.status === 'under_cc_review' && !showRevisionForm && (
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-semibold">
                  Confirmation Notes (optional)
                </Typography>
                <TextArea
                  value={confirmationNotes}
                  onChange={(e) => setConfirmationNotes(e.target.value)}
                  placeholder="Add any notes about this confirmation..."
                  rows={3}
                />
              </div>
            )}

            {showRevisionForm && (
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-semibold">
                  Request Revision
                </Typography>
                <div>
                  <Typography variant="bodySm" className="mb-2">
                    Revision Reason *
                  </Typography>
                  <TextArea
                    id="revisionReason"
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    placeholder="Explain what needs to be revised..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {quote.status === 'po_submitted' && (
              <div className="space-y-4">
                <Typography variant="bodySm" className="font-semibold">
                  PO Information
                </Typography>
                <div className="rounded-lg bg-fill-muted p-4 space-y-3">
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      PO Number
                    </Typography>
                    <Typography variant="bodySm" className="font-medium">
                      {quote.poNumber}
                    </Typography>
                  </div>
                  {quote.deliveryLeadTime && (
                    <div>
                      <Typography variant="bodyXs" colorRole="muted">
                        Delivery Lead Time
                      </Typography>
                      <Typography variant="bodySm" className="font-medium">
                        {quote.deliveryLeadTime}
                      </Typography>
                    </div>
                  )}
                  {quote.poAttachmentUrl && (
                    <div>
                      <Typography variant="bodyXs" colorRole="muted" className="mb-2">
                        Attachment
                      </Typography>
                      <div className="flex items-center gap-2">
                        <a
                          href={quote.poAttachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-brand hover:underline text-sm font-medium"
                        >
                          View Document
                        </a>
                        <span className="text-text-muted">•</span>
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
                  <Typography variant="bodySm" className="mb-2 font-medium">
                    Delivery Lead Time *
                  </Typography>
                  <Input
                    type="text"
                    placeholder="e.g., 2-3 weeks, 30 days, etc."
                    value={deliveryLeadTime}
                    onChange={(e) => setDeliveryLeadTime(e.target.value)}
                  />
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="mt-1"
                  >
                    Expected delivery timeframe for this order
                  </Typography>
                </div>
                <div>
                  <Typography variant="bodySm" className="mb-2">
                    Confirmation Notes (optional)
                  </Typography>
                  <TextArea
                    id="poNotes"
                    value={confirmationNotes}
                    onChange={(e) => setConfirmationNotes(e.target.value)}
                    placeholder="Add any notes about this PO confirmation..."
                    rows={3}
                  />
                </div>
              </div>
            )}
                </div>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          {quote.status === 'buy_request_submitted' && (
            <Button
              variant="default"
              colorRole="brand"
              size="md"
              onClick={() => startReviewMutation.mutate()}
              isDisabled={startReviewMutation.isPending}
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
                size="md"
                onClick={() => setShowRevisionForm(true)}
              >
                <ButtonContent iconLeft={IconEdit}>Request Revision</ButtonContent>
              </Button>
              <Button
                variant="default"
                colorRole="brand"
                size="md"
                onClick={() => confirmMutation.mutate()}
                isDisabled={confirmMutation.isPending}
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
                size="md"
                onClick={() => {
                  setShowRevisionForm(false);
                  setRevisionReason('');
                }}
              >
                <ButtonContent>Cancel</ButtonContent>
              </Button>
              <Button
                variant="default"
                colorRole="danger"
                size="md"
                onClick={() => requestRevisionMutation.mutate()}
                isDisabled={
                  requestRevisionMutation.isPending || !revisionReason.trim()
                }
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
              size="md"
              onClick={() => confirmPOMutation.mutate()}
              isDisabled={confirmPOMutation.isPending || !deliveryLeadTime.trim()}
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
