'use client';

import type { DialogProps } from '@radix-ui/react-dialog';
import { IconCalendar, IconCurrencyDollar, IconDownload, IconFileText, IconPaperclip, IconSend, IconUser } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

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
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { Quote } from '@/database/schema';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

import exportQuoteToPDF from '../utils/exportQuoteToPDF';

interface QuoteDetailsDialogProps extends DialogProps {
  quote: Quote | null;
}

/**
 * Dialog component to display full quote details
 */
const QuoteDetailsDialog = ({ quote, open, onOpenChange }: QuoteDetailsDialogProps) => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);

  // PO submission state
  const [poNumber, setPoNumber] = useState('');
  const [showPOForm, setShowPOForm] = useState(false);
  const [poDocumentUrl, setPoDocumentUrl] = useState('');
  const [isUploadingPO, setIsUploadingPO] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Currency display state
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'AED'>('USD');

  // Fetch fresh quote data to ensure we have latest totals and pricing
  const { data: freshQuoteData, refetch: refetchQuote } = useQuery({
    ...api.quotes.getOne.queryOptions({ id: quote?.id ?? '' }),
    enabled: !!quote?.id && open,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // Use fresh data if available, otherwise fall back to prop
  const currentQuote = freshQuoteData ?? quote;

  // Calculate display amount based on selected currency
  const displayTotal = useMemo(() => {
    if (!currentQuote) return 0;
    if (displayCurrency === 'USD') {
      return currentQuote.totalUsd;
    }
    return currentQuote.totalAed ?? convertUsdToAed(currentQuote.totalUsd);
  }, [currentQuote, displayCurrency]);

  const lineItems = useMemo(
    () =>
      (currentQuote?.lineItems || []) as Array<{
        productId: string;
        offerId: string;
        quantity: number;
        vintage?: string;
      }>,
    [currentQuote?.lineItems],
  );

  // Fetch user settings for logo/company name
  const { data: settings } = useQuery({
    ...api.settings.get.queryOptions(),
    enabled: !!quote,
  });

  // Fetch partner info for payment display
  const { data: partnerInfo } = useQuery({
    ...api.partners.getPublicInfo.queryOptions({
      partnerId: currentQuote?.licensedPartnerId ?? '',
    }),
    enabled: !!currentQuote?.licensedPartnerId && open,
  });

  // Extract unique product IDs from line items
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

  // Extract pricing data from quoteData
  const quotePricingData = useMemo(() => {
    if (!currentQuote?.quoteData) return null;
    const data = currentQuote.quoteData as {
      lineItems?: Array<{
        productId: string;
        lineItemTotalUsd: number;
        basePriceUsd?: number;
        confirmedQuantity?: number;
        originalQuantity?: number;
        adminNotes?: string;
        adminAlternatives?: Array<{
          productName: string;
          pricePerCase: number;
          bottlesPerCase: number;
          bottleSize: string;
          quantityAvailable: number;
        }>;
        acceptedAlternative?: {
          productName: string;
          pricePerCase: number;
          bottlesPerCase: number;
          bottleSize: string;
          quantityAvailable: number;
          acceptedAt: string;
        };
      }>;
      marginConfig?: {
        type: 'percentage' | 'fixed';
        value: number;
        transferCost: number;
        importTax: number;
      };
      customerQuotePrice?: number;
    };
    return data;
  }, [currentQuote?.quoteData]);

  // Create pricing map by productId
  const pricingMap = useMemo(() => {
    if (!quotePricingData?.lineItems) return {};
    return quotePricingData.lineItems.reduce(
      (acc, item) => {
        acc[item.productId] = item;
        return acc;
      },
      {} as Record<
        string,
        {
          lineItemTotalUsd: number;
          basePriceUsd?: number;
          confirmedQuantity?: number;
          originalQuantity?: number;
          adminNotes?: string;
          adminAlternatives?: Array<{
            productName: string;
            pricePerCase: number;
            bottlesPerCase: number;
            bottleSize: string;
            quantityAvailable: number;
          }>;
          acceptedAlternative?: {
            productName: string;
            pricePerCase: number;
            bottlesPerCase: number;
            bottleSize: string;
            quantityAvailable: number;
            acceptedAt: string;
          };
        }
      >,
    );
  }, [quotePricingData]);

  // Mutation for submitting buy request
  const submitBuyRequestMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const result = await trpcClient.quotes.submitBuyRequest.mutate({ quoteId });
      return result;
    },
    onSuccess: () => {
      toast.success('Order request submitted successfully! C&C team will review shortly.');
      void queryClient.invalidateQueries({ queryKey: ['quotes'] });
      if (onOpenChange) {
        onOpenChange(false);
      }
    },
    onError: (error) => {
      toast.error(`Failed to submit buy request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Handle submit buy request
  const handleSubmitBuyRequest = () => {
    if (!quote) return;

    const confirmMessage = quote.status === 'revision_requested'
      ? 'Resubmit this order request?'
      : 'Place this order request?';

    if (window.confirm(confirmMessage)) {
      submitBuyRequestMutation.mutate(quote.id);
    }
  };

  // Accept alternative mutation
  const acceptAlternativeMutation = useMutation({
    mutationFn: async ({ productId, alternativeIndex }: { productId: string; alternativeIndex: number }) => {
      if (!quote) return;
      return trpcClient.quotes.acceptAlternative.mutate({
        quoteId: quote.id,
        productId,
        alternativeIndex,
      });
    },
    onSuccess: async (_data, variables) => {
      toast.success(variables.alternativeIndex === -1 ? 'Alternative removed' : 'Alternative product accepted');
      // Invalidate all quotes queries to refresh totals
      void queryClient.invalidateQueries({ queryKey: ['quotes'] });
      // Explicitly refetch the current quote to update totals immediately
      await refetchQuote();
    },
    onError: (error) => {
      toast.error(
        `Failed to accept alternative: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
  });

  // Upload PO document mutation
  const uploadPODocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;

      return trpcClient.quotes.uploadPODocument.mutate({
        file: base64,
        filename: file.name,
        fileType: file.type as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/jpg',
      });
    },
    onSuccess: (data) => {
      setPoDocumentUrl(data.url);
      toast.success('Document uploaded successfully');
    },
    onError: (error) => {
      toast.error(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Handle file selection
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF or image file (PNG, JPG)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploadingPO(true);
    try {
      await uploadPODocumentMutation.mutateAsync(file);
    } finally {
      setIsUploadingPO(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Submit PO mutation
  const submitPOMutation = useMutation({
    mutationFn: async () => {
      if (!quote || !poNumber.trim()) {
        toast.error('Please provide a PO number');
        return;
      }
      if (!poDocumentUrl) {
        toast.error('Please attach a PO document');
        return;
      }
      return trpcClient.quotes.submitPO.mutate({
        quoteId: quote.id,
        poNumber: poNumber.trim(),
        poAttachmentUrl: poDocumentUrl,
      });
    },
    onSuccess: () => {
      toast.success('PO submitted successfully!');
      void queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setPoNumber('');
      setPoDocumentUrl('');
      setShowPOForm(false);
      if (onOpenChange) {
        onOpenChange(false);
      }
    },
    onError: (error) => {
      toast.error(`Failed to submit PO: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Handle PDF export
  const handleExportPDF = async () => {
    if (!quote || !productsData?.data) {
      toast.error('Cannot export quote - missing data');
      return;
    }

    setIsExporting(true);
    try {
      // Build line items for PDF
      const pdfLineItems = lineItems.map((item) => {
        const product = productMap[item.productId];
        const pricing = pricingMap[item.productId];

        // Use confirmed quantity and price if available (after admin approval)
        const displayQuantity = pricing?.confirmedQuantity ?? item.quantity;
        const pricePerCase = pricing?.basePriceUsd ??
          (pricing?.lineItemTotalUsd ? pricing.lineItemTotalUsd / item.quantity : 0);
        const lineTotal = pricing?.lineItemTotalUsd || 0;

        // Convert to display currency if needed
        const displayPricePerCase =
          quote.currency === 'AED' && quote.totalAed
            ? convertUsdToAed(pricePerCase)
            : pricePerCase;
        const displayLineTotal =
          quote.currency === 'AED' && quote.totalAed
            ? convertUsdToAed(lineTotal)
            : lineTotal;

        // Get bottles per case from product offer
        const bottlesPerCase = product?.productOffers?.[0]?.unitCount || 12;

        return {
          productName: product?.name || item.productId,
          producer: product?.producer || null,
          region: product?.region || null,
          year: product?.year ? String(product.year) : null,
          quantity: displayQuantity,
          bottlesPerCase,
          pricePerCase: displayPricePerCase,
          lineTotal: displayLineTotal,
        };
      });

      await exportQuoteToPDF(
        quote,
        pdfLineItems,
        {
          companyName: settings?.companyName || null,
          companyLogo: settings?.companyLogo || null,
          companyAddress: settings?.companyAddress || null,
          companyPhone: settings?.companyPhone || null,
          companyEmail: settings?.companyEmail || null,
          companyWebsite: settings?.companyWebsite || null,
          companyVatNumber: settings?.companyVatNumber || null,
        },
      );

      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  if (!quote) return null;

  const statusColors = {
    draft: 'text-text-muted',
    sent: 'text-text-brand',
    accepted: 'text-text-success',
    rejected: 'text-text-danger',
    expired: 'text-text-muted',
    buy_request_submitted: 'text-text-warning',
    under_cc_review: 'text-text-warning',
    revision_requested: 'text-text-danger',
    cc_confirmed: 'text-text-success',
    awaiting_payment: 'text-text-warning',
    paid: 'text-text-success',
    po_submitted: 'text-text-brand',
    po_confirmed: 'text-text-success',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote.name}</DialogTitle>
          <DialogDescription>
            Quote details and line items
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Status and Date Info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fill-muted">
                  <Icon icon={IconFileText} size="sm" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                    Status
                  </Typography>
                  <Typography variant="bodySm" className={`capitalize font-medium ${statusColors[quote.status]}`}>
                    {quote.status}
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fill-muted">
                  <Icon icon={IconCalendar} size="sm" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                    Created
                  </Typography>
                  <Typography variant="bodySm" className="font-medium">
                    {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                  </Typography>
                </div>
              </div>
            </div>

            {/* Client Information */}
            {(quote.clientName || quote.clientEmail || quote.clientCompany) && (
              <>
                <Divider />
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Icon icon={IconUser} size="sm" colorRole="muted" />
                    <Typography variant="bodySm" className="font-semibold">
                      Client Information
                    </Typography>
                  </div>
                  <div className="space-y-2 rounded-lg bg-fill-muted p-4">
                    {quote.clientName && (
                      <div>
                        <Typography variant="bodyXs" colorRole="muted">
                          Name
                        </Typography>
                        <Typography variant="bodySm">{quote.clientName}</Typography>
                      </div>
                    )}
                    {quote.clientEmail && (
                      <div>
                        <Typography variant="bodyXs" colorRole="muted">
                          Email
                        </Typography>
                        <Typography variant="bodySm">{quote.clientEmail}</Typography>
                      </div>
                    )}
                    {quote.clientCompany && (
                      <div>
                        <Typography variant="bodyXs" colorRole="muted">
                          Company
                        </Typography>
                        <Typography variant="bodySm">{quote.clientCompany}</Typography>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Total */}
            <Divider />
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Icon icon={IconCurrencyDollar} size="sm" colorRole="muted" />
                <Typography variant="bodySm" className="font-semibold">
                  Pricing
                </Typography>
              </div>

              {/* In-Bond Price */}
              <div className="mb-2 rounded-lg bg-fill-muted/30 p-3">
                <div className="flex items-center justify-between mb-1">
                  <Typography variant="bodyXs" colorRole="muted">
                    In-Bond UAE Price
                  </Typography>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDisplayCurrency(displayCurrency === 'USD' ? 'AED' : 'USD')}
                    className="h-5 px-2 text-xs"
                  >
                    <ButtonContent>{displayCurrency === 'USD' ? 'Show AED' : 'Show USD'}</ButtonContent>
                  </Button>
                </div>
                <Typography variant="bodyMd" className="font-semibold">
                  {formatPrice(displayTotal, displayCurrency)}
                </Typography>
              </div>

              {/* Margin Configuration (B2B only) */}
              {quotePricingData?.marginConfig && (
                <div className="mb-2 space-y-2 rounded-lg border border-border-muted bg-fill-muted/30 p-3">
                  <Typography variant="bodyXs" className="font-semibold">
                    Margin Configuration
                  </Typography>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Typography variant="bodyXs" colorRole="muted">
                        Distributor Margin
                      </Typography>
                      <Typography variant="bodyXs" className="font-medium">
                        {quotePricingData.marginConfig.type === 'percentage'
                          ? `${quotePricingData.marginConfig.value}%`
                          : formatPrice(
                              quotePricingData.marginConfig.value,
                              quote.currency as 'USD' | 'AED',
                            )}
                      </Typography>
                    </div>
                    <div>
                      <Typography variant="bodyXs" colorRole="muted">
                        Import Tax
                      </Typography>
                      <Typography variant="bodyXs" className="font-medium">
                        {quotePricingData.marginConfig.importTax}%
                      </Typography>
                    </div>
                    <div>
                      <Typography variant="bodyXs" colorRole="muted">
                        Transfer Cost
                      </Typography>
                      <Typography variant="bodyXs" className="font-medium">
                        ${quotePricingData.marginConfig.transferCost}
                      </Typography>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Quote Price (if margins applied) */}
              {quotePricingData?.customerQuotePrice && (
                <div className="rounded-lg bg-fill-brand/10 p-4">
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                    Customer Quote Price (Inc. VAT)
                  </Typography>
                  <Typography variant="headingMd" className="font-bold text-text-brand">
                    {formatPrice(
                      quote.currency === 'AED'
                        ? convertUsdToAed(quotePricingData.customerQuotePrice)
                        : quotePricingData.customerQuotePrice,
                      quote.currency as 'USD' | 'AED',
                    )}
                  </Typography>
                </div>
              )}
            </div>

            {/* Admin Adjustments Summary - show when confirmed by C&C */}
            {(quote.status === 'cc_confirmed' ||
              quote.status === 'po_submitted' ||
              quote.status === 'po_confirmed') &&
              quotePricingData?.lineItems && (
                <>
                  <Divider />
                  <div className="rounded-lg border-2 border-border-success bg-fill-success/10 p-4">
                    <Typography variant="bodySm" className="mb-3 font-semibold text-text-success">
                      ✓ Quote Confirmed by C&C Team
                    </Typography>

                    {/* Check if any adjustments were made */}
                    {quotePricingData.lineItems.some(
                      (item) =>
                        item.confirmedQuantity !== item.originalQuantity ||
                        item.adminNotes ||
                        (item.adminAlternatives && item.adminAlternatives.length > 0)
                    ) && (
                      <div className="space-y-2">
                        <Typography variant="bodyXs" className="font-medium">
                          The following adjustments were made:
                        </Typography>
                        {quotePricingData.lineItems.map((pricingItem) => {
                          const hasQuantityChange = pricingItem.confirmedQuantity !== pricingItem.originalQuantity;
                          const hasNotes = !!pricingItem.adminNotes;
                          const hasAlternatives = pricingItem.adminAlternatives && pricingItem.adminAlternatives.length > 0;

                          if (!hasQuantityChange && !hasNotes && !hasAlternatives) return null;

                          const product = productMap[pricingItem.productId];

                          return (
                            <div
                              key={pricingItem.productId}
                              className="rounded-lg border border-border-muted bg-background-primary p-3 space-y-2"
                            >
                              <Typography variant="bodyXs" className="font-medium">
                                {product?.name || pricingItem.productId}
                              </Typography>
                              {hasQuantityChange && (
                                <Typography variant="bodyXs" colorRole="muted">
                                  Quantity adjusted: {pricingItem.originalQuantity} → {pricingItem.confirmedQuantity} cases
                                </Typography>
                              )}
                              {hasNotes && (
                                <Typography variant="bodyXs" className="italic">
                                  &ldquo;{pricingItem.adminNotes}&rdquo;
                                </Typography>
                              )}
                              {hasAlternatives && (
                                <div className="mt-2 pt-2 border-t border-border-muted">
                                  <Typography variant="bodyXs" className="font-semibold text-text-success mb-2">
                                    💡 Alternative Options:
                                  </Typography>
                                  <div className="space-y-2">
                                    {pricingItem.adminAlternatives!.map((alt, altIdx) => (
                                      <div key={altIdx} className="ml-4 rounded-md bg-fill-success/10 border border-border-success p-2">
                                        <Typography variant="bodyXs" className="font-bold mb-1">
                                          {alt.productName}
                                        </Typography>
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                          <Typography variant="bodyXs" colorRole="muted">
                                            ${alt.pricePerCase.toFixed(2)}/case
                                          </Typography>
                                          <Typography variant="bodyXs" colorRole="muted">
                                            {alt.quantityAvailable} available
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
                          );
                        })}
                      </div>
                    )}

                    {quote.deliveryLeadTime && (
                      <div className="mt-3 rounded-lg bg-fill-brand/10 border border-border-brand p-3">
                        <Typography variant="bodyXs" className="mb-1 font-medium text-text-brand">
                          🚚 Delivery Lead Time:
                        </Typography>
                        <Typography variant="bodyXs" className="font-semibold">
                          {quote.deliveryLeadTime}
                        </Typography>
                      </div>
                    )}

                    {quote.ccConfirmationNotes && (
                      <div className="mt-3 rounded-lg bg-background-primary p-3">
                        <Typography variant="bodyXs" className="mb-1 font-medium">
                          Additional Notes:
                        </Typography>
                        <Typography variant="bodyXs" className="whitespace-pre-wrap">
                          {quote.ccConfirmationNotes}
                        </Typography>
                      </div>
                    )}
                  </div>
                </>
              )}

            {/* Line Items */}
            <Divider />
            <div>
              <Typography variant="bodySm" className="mb-3 font-semibold">
                Line Items ({lineItems.length})
              </Typography>
              <div className="space-y-3">
                {lineItems.map((item, index) => {
                  const product = productMap[item.productId];
                  const pricing = pricingMap[item.productId];

                  // Use confirmed quantity and price if available (after admin approval)
                  const displayQuantity = pricing?.confirmedQuantity ?? item.quantity;
                  const pricePerCase = pricing?.basePriceUsd ??
                    (pricing?.lineItemTotalUsd ? pricing.lineItemTotalUsd / item.quantity : 0);
                  const lineItemTotal = pricing?.lineItemTotalUsd || 0;

                  return (
                    <div
                      key={index}
                      className="rounded-lg border border-border-muted bg-background-primary p-4"
                    >
                      {product ? (
                        <>
                          {/* Product Info and Pricing */}
                          <div className="mb-3">
                            <div className="mb-2 flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <Typography variant="bodySm" className="mb-1 font-semibold">
                                  {product.name}
                                </Typography>
                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                  {product.producer && (
                                    <Typography variant="bodyXs" colorRole="muted">
                                      {product.producer}
                                    </Typography>
                                  )}
                                  {product.year && (
                                    <Typography variant="bodyXs" colorRole="muted">
                                      {product.year}
                                    </Typography>
                                  )}
                                  {product.region && (
                                    <Typography variant="bodyXs" colorRole="muted">
                                      {product.region}
                                    </Typography>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Pricing Breakdown */}
                            {pricing && (
                              <>
                                <div className="rounded-lg border border-border-muted bg-white p-4 space-y-3">
                                  {/* Case Configuration */}
                                  {product.productOffers?.[0]?.unitCount && (
                                    <div className="flex items-center gap-2 text-text-muted">
                                      <Typography variant="bodyXs">
                                        📦 {product.productOffers?.[0]?.unitCount} bottles × {product.productOffers?.[0]?.unitSize || '750ml'} per case
                                      </Typography>
                                    </div>
                                  )}

                                  {/* Pricing Grid */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-3">
                                      <div>
                                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                                          Quantity
                                        </Typography>
                                        <Typography variant="bodyLg" className="font-bold">
                                          {displayQuantity} {displayQuantity === 1 ? 'case' : 'cases'}
                                        </Typography>
                                        {pricing?.confirmedQuantity && pricing.confirmedQuantity !== pricing.originalQuantity && (
                                          <Typography variant="bodyXs" colorRole="muted" className="line-through">
                                            Was: {pricing.originalQuantity}
                                          </Typography>
                                        )}
                                        {product.productOffers?.[0]?.unitCount && (
                                          <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                                            = {displayQuantity * product.productOffers?.[0]?.unitCount} bottles
                                          </Typography>
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <div>
                                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                                          Price Per Case
                                        </Typography>
                                        <Typography variant="bodyLg" className="font-bold text-text-brand">
                                          {formatPrice(
                                            displayCurrency === 'AED'
                                              ? convertUsdToAed(pricePerCase)
                                              : pricePerCase,
                                            displayCurrency,
                                          )}
                                        </Typography>
                                        {product.productOffers?.[0]?.unitCount && pricePerCase && (
                                          <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                                            {formatPrice(
                                              displayCurrency === 'AED'
                                                ? convertUsdToAed(pricePerCase / product.productOffers?.[0]?.unitCount)
                                                : pricePerCase / product.productOffers?.[0]?.unitCount,
                                              displayCurrency,
                                            )} per bottle
                                          </Typography>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Line Total */}
                                  <div className="pt-3 border-t border-border-muted">
                                    <div className="flex items-center justify-between">
                                      <Typography variant="bodySm" colorRole="muted">
                                        Line Total
                                      </Typography>
                                      <Typography variant="headingSm" className="font-bold text-text-brand">
                                        {formatPrice(
                                          displayCurrency === 'AED'
                                            ? convertUsdToAed(lineItemTotal)
                                            : lineItemTotal,
                                          displayCurrency,
                                        )}
                                      </Typography>
                                    </div>
                                  </div>
                                </div>

                                {/* Admin Notes - show when quote is confirmed or in later stages */}
                                {pricing.adminNotes &&
                                  (quote.status === 'cc_confirmed' ||
                                   quote.status === 'po_submitted' ||
                                   quote.status === 'po_confirmed') && (
                                  <div className="mt-2 rounded-lg border border-border-brand bg-fill-brand/10 p-3">
                                    <Typography variant="bodyXs" className="mb-1 font-semibold text-text-brand">
                                      Admin Note:
                                    </Typography>
                                    <Typography variant="bodyXs" className="whitespace-pre-wrap">
                                      {pricing.adminNotes}
                                    </Typography>
                                  </div>
                                )}

                                {/* Admin Alternative Suggestions */}
                                {pricing.adminAlternatives && pricing.adminAlternatives.length > 0 &&
                                  (quote.status === 'cc_confirmed' ||
                                   quote.status === 'po_submitted' ||
                                   quote.status === 'po_confirmed') && (
                                  <div className="mt-2 rounded-lg border-2 border-border-success bg-fill-success/10 p-3">
                                    <div className="flex items-center gap-1.5 mb-3">
                                      <span className="text-base">💡</span>
                                      <Typography variant="bodySm" className="font-bold text-text-success">
                                        Alternative Products Available: ({pricing.adminAlternatives.length})
                                      </Typography>
                                    </div>
                                    <div className="space-y-3">
                                      {pricing.adminAlternatives.map((alt, altIdx) => {
                                        const isAccepted = pricing.acceptedAlternative?.productName === alt.productName;

                                        return (
                                        <div
                                          key={altIdx}
                                          className={`rounded-lg border-2 p-4 transition-all ${
                                            isAccepted
                                              ? 'border-border-success bg-fill-success/20 shadow-md'
                                              : 'border-border-muted bg-white hover:border-border-success'
                                          }`}
                                        >
                                          <div className="flex items-start justify-between gap-3 mb-3">
                                            <Typography variant="bodyMd" className="font-bold">
                                              {alt.productName || '[NO PRODUCT NAME]'}
                                            </Typography>
                                            {isAccepted && (
                                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-fill-success text-white text-xs font-bold">
                                                ✓ Selected
                                              </span>
                                            )}
                                          </div>

                                          <div className="grid grid-cols-3 gap-3 mb-3">
                                            <div>
                                              <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide mb-1">
                                                Price /Case
                                              </Typography>
                                              <Typography variant="bodySm" className="font-bold">
                                                {alt.pricePerCase ? formatPrice(
                                                  displayCurrency === 'AED'
                                                    ? convertUsdToAed(alt.pricePerCase)
                                                    : alt.pricePerCase,
                                                  displayCurrency
                                                ) : '[NO PRICE]'}
                                              </Typography>
                                            </div>
                                            <div>
                                              <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide mb-1">
                                                Available
                                              </Typography>
                                              <Typography variant="bodySm" className="font-semibold">
                                                {alt.quantityAvailable || '[NO QTY]'} cases
                                              </Typography>
                                            </div>
                                            <div>
                                              <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide mb-1">
                                                Case Config
                                              </Typography>
                                              <Typography variant="bodySm" className="font-semibold">
                                                {alt.bottlesPerCase || '[NO BOTTLES]'} × {alt.bottleSize || '[NO SIZE]'}
                                              </Typography>
                                            </div>
                                          </div>

                                          {/* Action buttons - only show when quote is confirmed (before PO submission) */}
                                          {quote.status === 'cc_confirmed' && (
                                            <div className="flex gap-2 pt-3 border-t border-border-muted">
                                              {isAccepted ? (
                                                <Button
                                                  variant="outline"
                                                  colorRole="danger"
                                                  size="sm"
                                                  onClick={() => acceptAlternativeMutation.mutate({
                                                    productId: item.productId,
                                                    alternativeIndex: -1  // -1 means remove acceptance
                                                  })}
                                                  isDisabled={acceptAlternativeMutation.isPending}
                                                  className="flex-1"
                                                >
                                                  <ButtonContent>
                                                    {acceptAlternativeMutation.isPending ? 'Removing...' : 'Remove Selection'}
                                                  </ButtonContent>
                                                </Button>
                                              ) : (
                                                <Button
                                                  variant="default"
                                                  colorRole="brand"
                                                  size="sm"
                                                  onClick={() => acceptAlternativeMutation.mutate({
                                                    productId: item.productId,
                                                    alternativeIndex: altIdx
                                                  })}
                                                  isDisabled={acceptAlternativeMutation.isPending}
                                                  className="flex-1"
                                                >
                                                  <ButtonContent>
                                                    {acceptAlternativeMutation.isPending ? 'Accepting...' : 'Accept This Alternative'}
                                                  </ButtonContent>
                                                </Button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Additional Details */}
                          <div className="flex items-center gap-4 border-t border-border-muted pt-3">
                            <div>
                              <Typography variant="bodyXs" colorRole="muted">
                                Bottle Reference
                              </Typography>
                              <Typography variant="bodyXs" className="font-mono">
                                {product.lwin18}
                              </Typography>
                            </div>
                            {item.vintage && (
                              <div>
                                <Typography variant="bodyXs" colorRole="muted">
                                  Vintage
                                </Typography>
                                <Typography variant="bodyXs" className="font-medium">
                                  {item.vintage}
                                </Typography>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                              Product ID
                            </Typography>
                            <Typography variant="bodySm" className="font-mono">
                              {item.productId}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                              (Product details unavailable)
                            </Typography>
                          </div>
                          <div className="text-right">
                            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                              Quantity
                            </Typography>
                            <Typography variant="bodySm" className="font-semibold">
                              {displayQuantity}
                            </Typography>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Revision Feedback - shown when C&C requests changes */}
            {quote.status === 'revision_requested' && quote.revisionReason && (
              <>
                <Divider />
                <div className="rounded-lg border-2 border-border-danger bg-fill-danger/10 p-4">
                  <Typography variant="bodySm" className="mb-2 font-semibold text-text-danger">
                    Revision Requested by C&C Team
                  </Typography>
                  <Typography variant="bodySm" className="whitespace-pre-wrap">
                    {quote.revisionReason}
                  </Typography>
                  {quote.revisionRequestedAt && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-2">
                      Requested on {format(new Date(quote.revisionRequestedAt), 'MMM d, yyyy')}
                    </Typography>
                  )}
                </div>
              </>
            )}

            {/* PO Submission Form - shown when quote is confirmed by C&C */}
            {quote.status === 'cc_confirmed' && (
              <>
                <Divider />
                <div className="rounded-lg border-2 border-border-success bg-fill-success/10 p-4">
                  <Typography variant="bodySm" className="mb-2 font-semibold text-text-success">
                    Quote Confirmed by C&C Team
                  </Typography>
                  <Typography variant="bodySm" className="mb-3">
                    Your quote has been confirmed. Please submit your Purchase Order to proceed.
                  </Typography>
                  {quote.deliveryLeadTime && (
                    <div className="rounded-lg bg-white border border-border-brand p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Typography variant="bodyXs" className="font-semibold text-text-brand">
                          🚚 Delivery Lead Time:
                        </Typography>
                        <Typography variant="bodyXs" className="font-bold">
                          {quote.deliveryLeadTime}
                        </Typography>
                      </div>
                    </div>
                  )}
                  {showPOForm ? (
                    <div className="space-y-4">
                      <div>
                        <Typography variant="bodySm" className="mb-2 font-medium">
                          PO Number *
                        </Typography>
                        <Input
                          type="text"
                          placeholder="Enter your PO number"
                          value={poNumber}
                          onChange={(e) => setPoNumber(e.target.value)}
                          className="max-w-md"
                        />
                      </div>
                      <div>
                        <Typography variant="bodySm" className="mb-2 font-medium">
                          PO Document *
                        </Typography>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            isDisabled={isUploadingPO}
                          >
                            <ButtonContent iconLeft={IconPaperclip}>
                              {isUploadingPO ? 'Uploading...' : poDocumentUrl ? 'Change Document' : 'Attach Document'}
                            </ButtonContent>
                          </Button>
                          {poDocumentUrl && (
                            <Typography variant="bodyXs" className="text-text-success">
                              ✓ Document attached
                            </Typography>
                          )}
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf,image/png,image/jpeg,image/jpg"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                          PDF or image, max 5MB (required)
                        </Typography>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowPOForm(false);
                            setPoNumber('');
                            setPoDocumentUrl('');
                          }}
                        >
                          <ButtonContent>Cancel</ButtonContent>
                        </Button>
                        <Button
                          variant="default"
                          colorRole="brand"
                          size="sm"
                          onClick={() => submitPOMutation.mutate()}
                          isDisabled={submitPOMutation.isPending || !poNumber.trim() || !poDocumentUrl}
                        >
                          <ButtonContent>
                            {submitPOMutation.isPending ? 'Submitting...' : 'Submit PO'}
                          </ButtonContent>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="default"
                      colorRole="brand"
                      size="md"
                      onClick={() => setShowPOForm(true)}
                    >
                      <ButtonContent>Submit Purchase Order</ButtonContent>
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* Payment Instructions - shown when quote is awaiting payment */}
            {quote.status === 'awaiting_payment' && quote.paymentMethod && (
              <>
                <Divider />
                <div className="rounded-lg border-2 border-border-warning bg-fill-warning/10 p-4">
                  {/* Partner Branding & Contact Details */}
                  {partnerInfo && (
                    <div className="mb-4 pb-4 border-b border-border-muted">
                      <div className="flex items-start gap-3 mb-3">
                        {partnerInfo.logoUrl && (
                          <img
                            src={partnerInfo.logoUrl}
                            alt={partnerInfo.businessName}
                            className="h-16 w-16 object-contain rounded-lg border border-border-muted bg-white flex-shrink-0"
                          />
                        )}
                        <div className="flex-1">
                          <Typography variant="bodyXs" colorRole="muted">
                            Licensed Partner
                          </Typography>
                          <Typography variant="bodyMd" className="font-bold">
                            {partnerInfo.businessName}
                          </Typography>
                          {partnerInfo.taxId && (
                            <Typography variant="bodyXs" colorRole="muted">
                              TRN: {partnerInfo.taxId}
                            </Typography>
                          )}
                        </div>
                      </div>
                      {/* Contact Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {partnerInfo.businessAddress && (
                          <div className="flex items-start gap-1.5">
                            <span className="flex-shrink-0">📍</span>
                            <span className="text-text-muted">{partnerInfo.businessAddress}</span>
                          </div>
                        )}
                        {partnerInfo.businessEmail && (
                          <div className="flex items-center gap-1.5">
                            <span className="flex-shrink-0">📧</span>
                            <a href={`mailto:${partnerInfo.businessEmail}`} className="text-text-brand hover:underline">
                              {partnerInfo.businessEmail}
                            </a>
                          </div>
                        )}
                        {partnerInfo.businessPhone && (
                          <div className="flex items-center gap-1.5">
                            <span className="flex-shrink-0">📞</span>
                            <a href={`tel:${partnerInfo.businessPhone}`} className="text-text-brand hover:underline">
                              {partnerInfo.businessPhone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Typography variant="bodySm" className="mb-3 font-semibold text-text-warning">
                    💳 Payment Required
                  </Typography>

                  {quote.deliveryLeadTime && (
                    <div className="mb-4 rounded-lg bg-white border border-border-brand p-3">
                      <div className="flex items-center gap-2">
                        <Typography variant="bodyXs" className="font-semibold text-text-brand">
                          🚚 Delivery Lead Time:
                        </Typography>
                        <Typography variant="bodyXs" className="font-bold">
                          {quote.deliveryLeadTime}
                        </Typography>
                      </div>
                    </div>
                  )}

                  {quote.paymentMethod === 'link' && quote.paymentDetails?.paymentUrl && (
                    <div className="space-y-3">
                      <Typography variant="bodySm">
                        Please complete your payment using the secure payment link below:
                      </Typography>
                      <a
                        href={quote.paymentDetails.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-fill-brand px-4 py-3 text-white font-semibold hover:bg-fill-brand/90 transition-colors"
                      >
                        <span>💳</span>
                        Pay Now
                        <span>→</span>
                      </a>
                    </div>
                  )}

                  {quote.paymentMethod === 'bank_transfer' && quote.paymentDetails && (
                    <div className="space-y-3">
                      <Typography variant="bodySm">
                        Please transfer the total amount to the following bank account:
                      </Typography>
                      <div className="rounded-lg bg-white border border-border-muted p-4 space-y-2">
                        {quote.paymentDetails.bankName && (
                          <div className="flex justify-between">
                            <Typography variant="bodyXs" colorRole="muted">Bank Name</Typography>
                            <Typography variant="bodyXs" className="font-medium">{quote.paymentDetails.bankName}</Typography>
                          </div>
                        )}
                        {quote.paymentDetails.accountName && (
                          <div className="flex justify-between">
                            <Typography variant="bodyXs" colorRole="muted">Account Name</Typography>
                            <Typography variant="bodyXs" className="font-medium">{quote.paymentDetails.accountName}</Typography>
                          </div>
                        )}
                        {quote.paymentDetails.accountNumber && (
                          <div className="flex justify-between">
                            <Typography variant="bodyXs" colorRole="muted">Account Number</Typography>
                            <Typography variant="bodyXs" className="font-mono font-medium">{quote.paymentDetails.accountNumber}</Typography>
                          </div>
                        )}
                        {quote.paymentDetails.sortCode && (
                          <div className="flex justify-between">
                            <Typography variant="bodyXs" colorRole="muted">Sort Code</Typography>
                            <Typography variant="bodyXs" className="font-mono font-medium">{quote.paymentDetails.sortCode}</Typography>
                          </div>
                        )}
                        {quote.paymentDetails.iban && (
                          <div className="flex justify-between">
                            <Typography variant="bodyXs" colorRole="muted">IBAN</Typography>
                            <Typography variant="bodyXs" className="font-mono font-medium">{quote.paymentDetails.iban}</Typography>
                          </div>
                        )}
                        {quote.paymentDetails.swiftBic && (
                          <div className="flex justify-between">
                            <Typography variant="bodyXs" colorRole="muted">SWIFT/BIC</Typography>
                            <Typography variant="bodyXs" className="font-mono font-medium">{quote.paymentDetails.swiftBic}</Typography>
                          </div>
                        )}
                        {quote.paymentDetails.reference && (
                          <div className="flex justify-between pt-2 border-t border-border-muted">
                            <Typography variant="bodyXs" colorRole="muted">Payment Reference</Typography>
                            <Typography variant="bodyXs" className="font-mono font-bold text-text-brand">{quote.paymentDetails.reference}</Typography>
                          </div>
                        )}
                      </div>
                      <div className="rounded-lg bg-fill-brand/10 border border-border-brand p-3">
                        <Typography variant="bodyXs" className="font-semibold text-text-brand mb-1">
                          Amount to Transfer:
                        </Typography>
                        <Typography variant="headingMd" className="font-bold text-text-brand">
                          {formatPrice(displayTotal, displayCurrency)}
                        </Typography>
                      </div>
                    </div>
                  )}

                  <Typography variant="bodyXs" colorRole="muted" className="mt-4">
                    Once payment is received, your order will be confirmed by our team.
                  </Typography>
                </div>
              </>
            )}

            {/* Paid Status - shown when payment has been confirmed */}
            {quote.status === 'paid' && (
              <>
                <Divider />
                <div className="rounded-lg border-2 border-border-success bg-fill-success/10 p-4">
                  <Typography variant="bodySm" className="mb-2 font-semibold text-text-success">
                    ✓ Payment Confirmed
                  </Typography>
                  <Typography variant="bodySm">
                    Your payment has been received. Your order is being processed.
                  </Typography>
                  {quote.paidAt && (
                    <Typography variant="bodyXs" colorRole="muted" className="mt-2">
                      Paid on {format(new Date(quote.paidAt), 'MMM d, yyyy')}
                    </Typography>
                  )}
                  {quote.deliveryLeadTime && (
                    <div className="mt-3 rounded-lg bg-white border border-border-brand p-3">
                      <div className="flex items-center gap-2">
                        <Typography variant="bodyXs" className="font-semibold text-text-brand">
                          🚚 Expected Delivery:
                        </Typography>
                        <Typography variant="bodyXs" className="font-bold">
                          {quote.deliveryLeadTime}
                        </Typography>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* PO Submitted Status - shown when PO is awaiting confirmation */}
            {quote.status === 'po_submitted' && (
              <>
                <Divider />
                <div className="rounded-lg border border-border-brand bg-fill-brand/10 p-4">
                  <Typography variant="bodySm" className="mb-2 font-semibold text-text-brand">
                    Purchase Order Submitted
                  </Typography>
                  <div className="space-y-2">
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
                            className="text-text-brand hover:underline text-sm"
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
                    {quote.poSubmittedAt && (
                      <Typography variant="bodyXs" colorRole="muted">
                        Submitted on {format(new Date(quote.poSubmittedAt), 'MMM d, yyyy')}
                      </Typography>
                    )}
                  </div>
                  <Typography variant="bodySm" className="mt-3">
                    Your PO is awaiting C&C team confirmation.
                  </Typography>
                </div>
              </>
            )}

            {/* PO Confirmed Status */}
            {quote.status === 'po_confirmed' && (
              <>
                <Divider />
                <div className="rounded-lg border-2 border-border-success bg-fill-success/10 p-4">
                  <Typography variant="bodySm" className="mb-2 font-semibold text-text-success">
                    Purchase Order Confirmed
                  </Typography>
                  <div className="space-y-2">
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
                            className="text-text-brand hover:underline text-sm"
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
                    {quote.poConfirmedAt && (
                      <Typography variant="bodyXs" colorRole="muted">
                        Confirmed on {format(new Date(quote.poConfirmedAt), 'MMM d, yyyy')}
                      </Typography>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {quote.notes && (
              <>
                <Divider />
                <div>
                  <Typography variant="bodySm" className="mb-2 font-semibold">
                    Notes
                  </Typography>
                  <div className="rounded-lg bg-fill-muted p-4">
                    <Typography variant="bodySm" className="whitespace-pre-wrap">
                      {quote.notes}
                    </Typography>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          {/* Submit Buy Request button - show only for quotes that haven't been submitted yet */}
          {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'revision_requested') && (
            <Button
              variant="default"
              colorRole="brand"
              size="md"
              onClick={handleSubmitBuyRequest}
              isDisabled={submitBuyRequestMutation.isPending}
            >
              <ButtonContent iconLeft={IconSend}>
                {submitBuyRequestMutation.isPending
                  ? 'Submitting...'
                  : quote.status === 'revision_requested'
                    ? 'Resubmit Order Request'
                    : 'Place Order Request'}
              </ButtonContent>
            </Button>
          )}

          {/* Show status message for quotes in approval workflow */}
          {(quote.status === 'buy_request_submitted' ||
            quote.status === 'under_cc_review' ||
            quote.status === 'cc_confirmed' ||
            quote.status === 'awaiting_payment' ||
            quote.status === 'paid') && (
            <div className={`flex-1 rounded-lg p-3 ${
              quote.status === 'paid'
                ? 'bg-fill-success/10'
                : quote.status === 'awaiting_payment'
                  ? 'bg-fill-warning/10'
                  : 'bg-fill-warning/10'
            }`}>
              <Typography variant="bodySm" className={
                quote.status === 'paid' ? 'text-text-success' : 'text-text-warning'
              }>
                {quote.status === 'buy_request_submitted' && 'Order request submitted for review'}
                {quote.status === 'under_cc_review' && 'Order request is under review'}
                {quote.status === 'cc_confirmed' && 'Quote confirmed by C&C - ready to send to customer'}
                {quote.status === 'awaiting_payment' && 'Payment required - see payment details above'}
                {quote.status === 'paid' && 'Payment confirmed - order is being processed'}
              </Typography>
            </div>
          )}

          <Button
            variant="default"
            colorRole="brand"
            size="md"
            onClick={handleExportPDF}
            isDisabled={isExporting || !productsData?.data}
          >
            <ButtonContent iconLeft={IconDownload}>
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </ButtonContent>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteDetailsDialog;
