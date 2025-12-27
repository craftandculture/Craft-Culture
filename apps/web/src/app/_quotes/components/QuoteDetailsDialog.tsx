'use client';

import type { DialogProps } from '@radix-ui/react-dialog';
import {
  IconArrowRight,
  IconBulb,
  IconCalendar,
  IconCheck,
  IconCreditCard,
  IconCurrencyDollar,
  IconDownload,
  IconFileText,
  IconPaperclip,
  IconSend,
  IconTrash,
  IconTruck,
  IconUser,
} from '@tabler/icons-react';
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

  // Payment proof state
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [isUploadingPaymentProof, setIsUploadingPaymentProof] = useState(false);
  const paymentProofInputRef = useRef<HTMLInputElement>(null);

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
  // Note: This will be recalculated after pricingMap is available to exclude unavailable items
  const baseDisplayTotal = useMemo(() => {
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
      outOfCatalogueRequests?: Array<{
        id: string;
        productName: string;
        vintage?: string;
        quantity?: number;
        priceExpectation?: string;
        notes?: string;
      }>;
      fulfilledOocItems?: Array<{
        requestId: string;
        productName: string;
        vintage?: string;
        quantity: number;
        pricePerCase: number;
        lineItemTotalUsd: number;
      }>;
    };
    return data;
  }, [currentQuote?.quoteData]);

  // Extract out-of-catalogue requests
  const outOfCatalogueRequests = useMemo(() => {
    return quotePricingData?.outOfCatalogueRequests || [];
  }, [quotePricingData]);

  // Extract fulfilled out-of-catalogue items (added by admin with pricing)
  const fulfilledOocItems = useMemo(() => {
    return quotePricingData?.fulfilledOocItems || [];
  }, [quotePricingData]);

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

  // Calculate the actual display total, excluding items with alternatives but no accepted one
  const displayTotal = useMemo(() => {
    // If no pricing data, use base total
    if (!quotePricingData?.lineItems || Object.keys(pricingMap).length === 0) {
      return baseDisplayTotal;
    }

    // Calculate total from line items, excluding unavailable ones (has alternatives but none accepted)
    let adjustedTotalUsd = 0;

    quotePricingData.lineItems.forEach((item) => {
      const hasAlternatives = item.adminAlternatives && item.adminAlternatives.length > 0;
      const hasAcceptedAlternative = !!item.acceptedAlternative;

      // Only include if no alternatives OR has accepted alternative
      if (!hasAlternatives || hasAcceptedAlternative) {
        adjustedTotalUsd += item.lineItemTotalUsd;
      }
    });

    // Add fulfilled OOC items
    fulfilledOocItems.forEach((item) => {
      adjustedTotalUsd += item.lineItemTotalUsd;
    });

    // Convert to display currency if needed
    if (displayCurrency === 'AED') {
      return convertUsdToAed(adjustedTotalUsd);
    }
    return adjustedTotalUsd;
  }, [quotePricingData, pricingMap, fulfilledOocItems, displayCurrency, baseDisplayTotal]);

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

  // Remove line item mutation
  const removeLineItemMutation = useMutation({
    mutationFn: async ({ productId }: { productId: string }) => {
      if (!quote) return;
      return trpcClient.quotes.removeLineItem.mutate({
        quoteId: quote.id,
        productId,
      });
    },
    onSuccess: async () => {
      toast.success('Line item removed');
      // Invalidate all quotes queries to refresh totals
      void queryClient.invalidateQueries({ queryKey: ['quotes'] });
      // Explicitly refetch the current quote to update totals immediately
      await refetchQuote();
    },
    onError: (error) => {
      toast.error(
        `Failed to remove line item: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  // Upload payment proof mutation
  const uploadPaymentProofMutation = useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;

      return trpcClient.quotes.uploadPaymentProof.mutate({
        file: base64,
        filename: file.name,
        fileType: file.type as 'image/png' | 'image/jpeg' | 'image/jpg' | 'application/pdf',
      });
    },
    onSuccess: (data) => {
      setPaymentProofUrl(data.url);
      toast.success('Payment proof uploaded successfully');
    },
    onError: (error) => {
      toast.error(`Failed to upload payment proof: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Submit payment proof mutation
  const submitPaymentProofMutation = useMutation({
    mutationFn: async () => {
      if (!quote || !paymentProofUrl) {
        toast.error('Please upload a payment screenshot first');
        return;
      }
      return trpcClient.quotes.submitPaymentProof.mutate({
        quoteId: quote.id,
        paymentProofUrl,
      });
    },
    onSuccess: () => {
      toast.success('Payment proof submitted! We will verify and confirm your order shortly.');
      void queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setPaymentProofUrl('');
    },
    onError: (error) => {
      toast.error(`Failed to submit payment proof: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Handle payment proof file selection
  const handlePaymentProofChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploadingPaymentProof(true);
    try {
      await uploadPaymentProofMutation.mutateAsync(file);
    } finally {
      setIsUploadingPaymentProof(false);
      // Reset input
      if (paymentProofInputRef.current) {
        paymentProofInputRef.current.value = '';
      }
    }
  };

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

        // Use accepted alternative details if available, otherwise use original product
        const acceptedAlt = pricing?.acceptedAlternative;
        const bottlesPerCase = acceptedAlt
          ? acceptedAlt.bottlesPerCase
          : (product?.productOffers?.[0]?.unitCount || 12);
        const productName = acceptedAlt
          ? `${acceptedAlt.productName} (Alternative)`
          : (product?.name || item.productId);

        return {
          productName,
          producer: acceptedAlt ? null : (product?.producer || null),
          region: acceptedAlt ? null : (product?.region || null),
          year: acceptedAlt ? null : (product?.year ? String(product.year) : null),
          quantity: displayQuantity,
          bottlesPerCase,
          pricePerCase: displayPricePerCase,
          lineTotal: displayLineTotal,
        };
      });

      // Build fulfilled OOC items for PDF
      const pdfFulfilledOocItems = fulfilledOocItems.map((item) => {
        const pricePerCase = item.pricePerCase;
        const lineTotal = item.lineItemTotalUsd;

        // Convert to display currency if needed
        const displayPricePerCase =
          quote.currency === 'AED' && quote.totalAed
            ? convertUsdToAed(pricePerCase)
            : pricePerCase;
        const displayLineTotal =
          quote.currency === 'AED' && quote.totalAed
            ? convertUsdToAed(lineTotal)
            : lineTotal;

        return {
          productName: item.productName,
          vintage: item.vintage,
          quantity: item.quantity,
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
        pdfFulfilledOocItems.length > 0 ? pdfFulfilledOocItems : undefined,
        partnerInfo ? {
          businessName: partnerInfo.businessName,
          businessAddress: partnerInfo.businessAddress,
          businessPhone: partnerInfo.businessPhone,
          businessEmail: partnerInfo.businessEmail,
          logoUrl: partnerInfo.logoUrl,
        } : undefined,
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
    delivered: 'text-text-muted',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote.name}</DialogTitle>
          <DialogDescription>
            Quote details and line items
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            {/* Status and Date Info - Compact inline */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Icon icon={IconFileText} size="xs" colorRole="muted" />
                <span className="text-text-muted">Status:</span>
                <span className={`font-medium capitalize ${statusColors[quote.status]}`}>
                  {quote.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon={IconCalendar} size="xs" colorRole="muted" />
                <span className="text-text-muted">Created:</span>
                <span className="font-medium">
                  {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
            </div>

            {/* Client Information - Compact inline */}
            {(quote.clientName || quote.clientEmail || quote.clientCompany) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border-muted bg-surface-muted/30 px-3 py-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <Icon icon={IconUser} size="xs" colorRole="muted" />
                  <span className="font-medium text-text-muted">Client:</span>
                </div>
                {quote.clientName && <span>{quote.clientName}</span>}
                {quote.clientCompany && (
                  <span className="text-text-muted">({quote.clientCompany})</span>
                )}
                {quote.clientEmail && (
                  <span className="text-text-muted">{quote.clientEmail}</span>
                )}
              </div>
            )}

            {/* Total - Compact */}
            <Divider />
            <div className="flex items-center justify-between gap-4 rounded-lg bg-fill-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <Icon icon={IconCurrencyDollar} size="xs" colorRole="muted" />
                <Typography variant="bodyXs" colorRole="muted">In-Bond UAE</Typography>
              </div>
              <div className="flex items-center gap-3">
                <Typography variant="bodyMd" className="font-bold">
                  {formatPrice(displayTotal, displayCurrency)}
                </Typography>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisplayCurrency(displayCurrency === 'USD' ? 'AED' : 'USD')}
                  className="h-5 px-2 text-xs"
                >
                  <ButtonContent>{displayCurrency === 'USD' ? 'AED' : 'USD'}</ButtonContent>
                </Button>
              </div>
            </div>

            {/* Margin Configuration (B2B only) - Compact */}
            {quotePricingData?.marginConfig && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border-muted bg-fill-muted/30 px-3 py-2 text-xs">
                <span className="font-medium text-text-muted">Margins:</span>
                <span>
                  {quotePricingData.marginConfig.type === 'percentage'
                    ? `${quotePricingData.marginConfig.value}%`
                    : formatPrice(quotePricingData.marginConfig.value, quote.currency as 'USD' | 'AED')}
                </span>
                <span className="text-text-muted">|</span>
                <span>Tax {quotePricingData.marginConfig.importTax}%</span>
                <span className="text-text-muted">|</span>
                <span>Transfer ${quotePricingData.marginConfig.transferCost}</span>
              </div>
            )}

            {/* Customer Quote Price (if margins applied) - Compact */}
            {quotePricingData?.customerQuotePrice && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-fill-brand/10 px-3 py-2">
                <Typography variant="bodyXs" colorRole="muted">
                  Customer Quote (Inc. VAT)
                </Typography>
                <Typography variant="bodyMd" className="font-bold text-text-brand">
                  {formatPrice(
                    quote.currency === 'AED'
                      ? convertUsdToAed(quotePricingData.customerQuotePrice)
                      : quotePricingData.customerQuotePrice,
                    quote.currency as 'USD' | 'AED',
                  )}
                </Typography>
              </div>
            )}

            {/* Fulfilled Out-of-Catalogue Items - Compact */}
            {fulfilledOocItems.length > 0 && (
              <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <Typography variant="bodyXs" className="font-semibold text-green-800 mb-1.5">
                  Special Order Items ({fulfilledOocItems.length})
                </Typography>
                <div className="space-y-1.5">
                  {fulfilledOocItems.map((item, index) => (
                    <div
                      key={item.requestId || index}
                      className="flex items-center justify-between gap-2 rounded bg-white border border-green-200 px-2 py-1.5 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-green-900">{item.productName}</span>
                        <span className="text-green-700 ml-2">
                          {item.vintage && `${item.vintage} · `}{item.quantity}× ${item.pricePerCase.toFixed(0)}/cs
                        </span>
                      </div>
                      <span className="font-bold text-green-800 shrink-0">
                        ${item.lineItemTotalUsd.toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Out-of-Catalogue Requests - Compact */}
            {outOfCatalogueRequests.length > 0 && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <Typography variant="bodyXs" className="font-semibold text-amber-800 mb-1.5">
                  Pending Requests ({outOfCatalogueRequests.length}) <span className="font-normal text-amber-600">· not in total</span>
                </Typography>
                <div className="space-y-1.5">
                  {outOfCatalogueRequests.map((request, index) => (
                    <div
                      key={request.id || index}
                      className="rounded bg-white border border-amber-200 px-2 py-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-amber-900">{request.productName}</span>
                        <span className="text-amber-700 shrink-0">
                          {request.vintage && `${request.vintage} · `}
                          {request.quantity && `${request.quantity}×`}
                          {request.priceExpectation && ` · ${request.priceExpectation}`}
                        </span>
                      </div>
                      {request.notes && (
                        <div className="text-amber-600 italic mt-0.5 truncate">{request.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Adjustments Summary - show when confirmed by C&C */}
            {(quote.status === 'cc_confirmed' ||
              quote.status === 'awaiting_payment' ||
              quote.status === 'paid' ||
              quote.status === 'po_submitted' ||
              quote.status === 'po_confirmed') &&
              quotePricingData?.lineItems && (
                <>
                  <Divider />
                  <div className="rounded-lg border-2 border-border-success bg-fill-success/10 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Icon icon={IconCheck} size="sm" className="text-text-success" />
                      <Typography variant="bodySm" className="font-semibold text-text-success">
                        Quote Confirmed by C&C Team
                      </Typography>
                    </div>

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
                                  <div className="mb-2 flex items-center gap-1.5">
                                    <Icon icon={IconBulb} size="xs" className="text-text-success" />
                                    <Typography variant="bodyXs" className="font-semibold text-text-success">
                                      Alternative Options:
                                    </Typography>
                                  </div>
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
                        <div className="mb-1 flex items-center gap-1.5">
                          <Icon icon={IconTruck} size="xs" className="text-text-brand" />
                          <Typography variant="bodyXs" className="font-medium text-text-brand">
                            Delivery Lead Time:
                          </Typography>
                        </div>
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

            {/* Line Items - Compact */}
            <Divider />
            <div>
              <Typography variant="bodyXs" className="mb-2 font-semibold text-text-muted uppercase tracking-wide">
                Line Items ({lineItems.length})
              </Typography>
              <div className="space-y-1.5">
                {lineItems.map((item, index) => {
                  const product = productMap[item.productId];
                  const pricing = pricingMap[item.productId];

                  // Check if alternatives exist but none accepted - item is unavailable
                  const hasAlternatives = pricing?.adminAlternatives && pricing.adminAlternatives.length > 0;
                  const hasAcceptedAlternative = !!pricing?.acceptedAlternative;
                  const isUnavailable = hasAlternatives && !hasAcceptedAlternative;

                  // Use confirmed quantity and price if available (after admin approval)
                  // If item is unavailable (has alternatives but none accepted), show $0
                  const displayQuantity = pricing?.confirmedQuantity ?? item.quantity;
                  const pricePerCase = isUnavailable ? 0 : (pricing?.basePriceUsd ??
                    (pricing?.lineItemTotalUsd ? pricing.lineItemTotalUsd / item.quantity : 0));
                  const lineItemTotal = isUnavailable ? 0 : (pricing?.lineItemTotalUsd || 0);

                  return (
                    <div
                      key={index}
                      className={`rounded-lg border px-3 py-2 ${
                        isUnavailable
                          ? 'border-border-warning bg-fill-warning/5'
                          : 'border-border-muted bg-background-primary'
                      }`}
                    >
                      {product ? (
                        <>
                          {/* Compact Product Row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Show accepted alternative name if exists, otherwise original product */}
                              {pricing?.acceptedAlternative ? (
                                <>
                                  <div className="flex items-center gap-2">
                                    <Typography variant="bodySm" className="font-semibold truncate text-text-success">
                                      {pricing.acceptedAlternative.productName}
                                    </Typography>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-fill-success/20 px-2 py-0.5 text-xs font-medium text-text-success">
                                      <IconCheck className="h-3 w-3" />
                                      Alternative
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                    <Typography variant="bodyXs" colorRole="muted">
                                      {pricing.acceptedAlternative.bottlesPerCase}×{pricing.acceptedAlternative.bottleSize}
                                    </Typography>
                                    <Typography variant="bodyXs" colorRole="muted" className="line-through">
                                      · was: {product.name}
                                    </Typography>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <Typography variant="bodySm" className={`font-semibold truncate ${isUnavailable ? 'text-text-muted line-through' : ''}`}>
                                      {product.name}
                                    </Typography>
                                    {isUnavailable && (
                                      <span className="inline-flex items-center rounded-full bg-fill-warning px-2 py-0.5 text-xs font-medium text-white">
                                        Unavailable
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                    {product.producer && (
                                      <Typography variant="bodyXs" colorRole="muted">
                                        {product.producer}
                                      </Typography>
                                    )}
                                    {product.year && (
                                      <Typography variant="bodyXs" colorRole="muted">
                                        · {product.year}
                                      </Typography>
                                    )}
                                    {product.productOffers?.[0]?.unitCount && (
                                      <Typography variant="bodyXs" colorRole="muted">
                                        · {product.productOffers?.[0]?.unitCount}×{product.productOffers?.[0]?.unitSize || '750ml'}
                                      </Typography>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                            {pricing && (
                              <div className="text-right shrink-0">
                                <Typography variant="bodySm" className={`font-bold ${isUnavailable ? 'text-text-muted' : 'text-text-brand'}`}>
                                  {formatPrice(
                                    displayCurrency === 'AED'
                                      ? convertUsdToAed(lineItemTotal)
                                      : lineItemTotal,
                                    displayCurrency,
                                  )}
                                </Typography>
                              </div>
                            )}
                          </div>

                          {/* Pricing Details - Inline */}
                          {pricing && (
                            <div className="mt-1.5 flex items-center gap-3 text-xs text-text-muted">
                              <span>
                                <span className="font-semibold text-text-primary">{displayQuantity}</span>
                                {pricing?.confirmedQuantity && pricing.confirmedQuantity !== pricing.originalQuantity && (
                                  <span className="line-through ml-1">{pricing.originalQuantity}</span>
                                )}
                                {' '}× {formatPrice(displayCurrency === 'AED' ? convertUsdToAed(pricePerCase) : pricePerCase, displayCurrency)}
                              </span>
                              {product.productOffers?.[0]?.unitCount && (
                                <span>· {displayQuantity * product.productOffers?.[0]?.unitCount} btls</span>
                              )}
                            </div>
                          )}

                          {/* Admin Notes - inline */}
                          {pricing?.adminNotes &&
                            (quote.status === 'cc_confirmed' ||
                             quote.status === 'awaiting_payment' ||
                             quote.status === 'paid' ||
                             quote.status === 'po_submitted' ||
                             quote.status === 'po_confirmed') && (
                            <div className="mt-1.5 text-xs text-text-brand italic">
                              {pricing.adminNotes}
                            </div>
                          )}

                          {/* Admin Alternatives - compact */}
                          {pricing?.adminAlternatives && pricing.adminAlternatives.length > 0 &&
                            (quote.status === 'cc_confirmed' ||
                             quote.status === 'awaiting_payment' ||
                             quote.status === 'paid' ||
                             quote.status === 'po_submitted' ||
                             quote.status === 'po_confirmed') && (
                            <div className="mt-2 rounded-md border border-border-success bg-fill-success/10 p-2">
                              <div className="flex items-center gap-1.5 mb-2">
                                <Icon icon={IconBulb} size="xs" className="text-text-success" />
                                <Typography variant="bodyXs" className="font-semibold text-text-success">
                                  Alternatives ({pricing.adminAlternatives.length})
                                </Typography>
                              </div>
                              <div className="space-y-1.5">
                                {pricing.adminAlternatives.map((alt, altIdx) => {
                                  const isAccepted = pricing.acceptedAlternative?.productName === alt.productName;
                                  return (
                                    <div
                                      key={altIdx}
                                      className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs ${
                                        isAccepted ? 'bg-fill-success/20 font-medium' : 'bg-white'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {isAccepted && <IconCheck className="h-3 w-3 text-text-success shrink-0" />}
                                        <span className="truncate">{alt.productName}</span>
                                      </div>
                                      <div className="flex items-center gap-3 shrink-0">
                                        <span className="font-medium">
                                          {formatPrice(
                                            displayCurrency === 'AED' ? convertUsdToAed(alt.pricePerCase) : alt.pricePerCase,
                                            displayCurrency
                                          )}
                                        </span>
                                        {(quote.status === 'cc_confirmed' || quote.status === 'awaiting_payment') && (
                                          <Button
                                            variant={isAccepted ? 'outline' : 'default'}
                                            colorRole={isAccepted ? 'danger' : 'brand'}
                                            size="sm"
                                            onClick={() => acceptAlternativeMutation.mutate({
                                              productId: item.productId,
                                              alternativeIndex: isAccepted ? -1 : altIdx
                                            })}
                                            isDisabled={acceptAlternativeMutation.isPending}
                                            className="h-6 px-2 text-xs"
                                          >
                                            <ButtonContent>
                                              {isAccepted ? 'Remove' : 'Accept'}
                                            </ButtonContent>
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Remove Line Item - compact link style */}
                          {(quote.status === 'cc_confirmed' || quote.status === 'awaiting_payment') &&
                            lineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Remove "${product.name}" from this quote?`)) {
                                  removeLineItemMutation.mutate({ productId: item.productId });
                                }
                              }}
                              disabled={removeLineItemMutation.isPending}
                              className="mt-1.5 flex items-center gap-1 text-xs text-text-danger hover:underline disabled:opacity-50"
                            >
                              <IconTrash className="h-3 w-3" />
                              {removeLineItemMutation.isPending ? 'Removing...' : 'Remove'}
                            </button>
                          )}
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
                    <div className="mb-4 rounded-lg border border-border-brand bg-white p-3">
                      <div className="flex items-center gap-2">
                        <Icon icon={IconTruck} size="xs" className="text-text-brand" />
                        <Typography variant="bodyXs" className="font-semibold text-text-brand">
                          Delivery Lead Time:
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
                            <span className="inline-flex items-center gap-1 text-text-success">
                              <Icon icon={IconCheck} size="xs" className="text-text-success" />
                              <Typography variant="bodyXs" className="text-text-success">
                                Document attached
                              </Typography>
                            </span>
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
                <div className="rounded-xl border-2 border-border-warning bg-gradient-to-b from-fill-warning/5 to-fill-warning/15 overflow-hidden">
                  {/* Header with Amount */}
                  <div className="bg-fill-warning/20 px-5 py-4 border-b border-border-warning/30">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Icon icon={IconCreditCard} size="md" className="text-text-warning" />
                        <Typography variant="bodyMd" className="font-bold text-text-warning">
                          Payment Required
                        </Typography>
                      </div>
                      <div className="text-right">
                        <Typography variant="bodyXs" colorRole="muted">
                          Amount Due
                        </Typography>
                        <Typography variant="headingMd" className="font-bold">
                          {formatPrice(displayTotal, displayCurrency)}
                        </Typography>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Partner Info - Compact */}
                    {partnerInfo && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-border-muted">
                        {partnerInfo.logoUrl && (
                          <img
                            src={partnerInfo.logoUrl}
                            alt={partnerInfo.businessName}
                            className="h-10 w-10 object-contain rounded-md border border-border-muted flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <Typography variant="bodySm" className="font-semibold truncate">
                            {partnerInfo.businessName}
                          </Typography>
                          <div className="flex items-center gap-3 text-xs text-text-muted">
                            {partnerInfo.taxId && <span>TRN: {partnerInfo.taxId}</span>}
                            {partnerInfo.businessPhone && (
                              <a href={`tel:${partnerInfo.businessPhone}`} className="text-text-brand hover:underline">
                                {partnerInfo.businessPhone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delivery Lead Time */}
                    {quote.deliveryLeadTime && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fill-brand/10 border border-border-brand">
                        <Icon icon={IconTruck} size="sm" className="text-text-brand" />
                        <Typography variant="bodySm" className="text-text-brand">
                          <span className="font-medium">Delivery:</span> {quote.deliveryLeadTime}
                        </Typography>
                      </div>
                    )}

                    {/* Payment Link */}
                    {quote.paymentMethod === 'link' && quote.paymentDetails?.paymentUrl && (
                      <div className="text-center space-y-3">
                        <Typography variant="bodySm" colorRole="muted">
                          Complete your payment securely:
                        </Typography>
                        <a
                          href={quote.paymentDetails.paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-fill-brand px-6 py-3 text-white font-semibold hover:bg-fill-brand/90 transition-colors shadow-md"
                        >
                          <IconCreditCard className="h-5 w-5" />
                          Pay {formatPrice(displayTotal, displayCurrency)}
                          <IconArrowRight className="h-4 w-4" />
                        </a>
                      </div>
                    )}

                    {/* Bank Transfer Details */}
                    {quote.paymentMethod === 'bank_transfer' && quote.paymentDetails && (
                      <div className="space-y-3">
                        <Typography variant="bodySm" className="font-medium">
                          Transfer to:
                        </Typography>
                        <div className="rounded-lg bg-white border border-border-muted overflow-hidden">
                          <table className="w-full text-sm">
                            <tbody className="divide-y divide-border-muted">
                              {quote.paymentDetails.bankName && (
                                <tr>
                                  <td className="px-4 py-2.5 text-text-muted w-32">Bank</td>
                                  <td className="px-4 py-2.5 font-medium">{quote.paymentDetails.bankName}</td>
                                </tr>
                              )}
                              {quote.paymentDetails.accountName && (
                                <tr>
                                  <td className="px-4 py-2.5 text-text-muted">Account</td>
                                  <td className="px-4 py-2.5 font-medium">{quote.paymentDetails.accountName}</td>
                                </tr>
                              )}
                              {quote.paymentDetails.iban && (
                                <tr>
                                  <td className="px-4 py-2.5 text-text-muted">IBAN</td>
                                  <td className="px-4 py-2.5 font-mono font-medium tracking-wide">{quote.paymentDetails.iban}</td>
                                </tr>
                              )}
                              {quote.paymentDetails.accountNumber && !quote.paymentDetails.iban && (
                                <tr>
                                  <td className="px-4 py-2.5 text-text-muted">Account #</td>
                                  <td className="px-4 py-2.5 font-mono font-medium">{quote.paymentDetails.accountNumber}</td>
                                </tr>
                              )}
                              {quote.paymentDetails.sortCode && (
                                <tr>
                                  <td className="px-4 py-2.5 text-text-muted">Sort Code</td>
                                  <td className="px-4 py-2.5 font-mono font-medium">{quote.paymentDetails.sortCode}</td>
                                </tr>
                              )}
                              {quote.paymentDetails.swiftBic && (
                                <tr>
                                  <td className="px-4 py-2.5 text-text-muted">SWIFT</td>
                                  <td className="px-4 py-2.5 font-mono font-medium">{quote.paymentDetails.swiftBic}</td>
                                </tr>
                              )}
                              {quote.paymentDetails.reference && (
                                <tr className="bg-fill-brand/5">
                                  <td className="px-4 py-2.5 text-text-brand font-medium">Reference</td>
                                  <td className="px-4 py-2.5 font-mono font-bold text-text-brand">{quote.paymentDetails.reference}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <Typography variant="bodyXs" colorRole="muted" className="text-center">
                      Your order will be confirmed once payment is received.
                    </Typography>

                    {/* Payment Proof Upload Section */}
                    <div className="mt-4 pt-4 border-t border-border-warning/30 space-y-2">
                      <Typography variant="bodyXs" className="font-medium text-text-muted uppercase tracking-wide">
                        Payment Proof
                      </Typography>

                      {/* Show existing payment proof if already submitted */}
                      {currentQuote?.paymentProofUrl ? (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-fill-success/10">
                          <Icon icon={IconCheck} size="sm" className="text-text-success shrink-0" />
                          <div className="flex-1 min-w-0">
                            <Typography variant="bodySm" className="font-medium text-text-success">
                              Proof submitted
                            </Typography>
                            {currentQuote.paymentProofSubmittedAt && (
                              <Typography variant="bodyXs" colorRole="muted">
                                {format(new Date(currentQuote.paymentProofSubmittedAt), 'PPp')}
                              </Typography>
                            )}
                          </div>
                          <a
                            href={currentQuote.paymentProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text-brand hover:underline text-xs font-medium shrink-0"
                          >
                            View
                          </a>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Hidden file input */}
                          <input
                            type="file"
                            ref={paymentProofInputRef}
                            onChange={handlePaymentProofChange}
                            accept="image/png,image/jpeg,image/jpg,application/pdf"
                            className="hidden"
                          />

                          {paymentProofUrl ? (
                            // File selected - show submit UI
                            <div className="flex flex-col sm:flex-row gap-2">
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fill-muted flex-1 min-w-0">
                                <Icon icon={IconFileText} size="xs" className="text-text-muted shrink-0" />
                                <Typography variant="bodyXs" className="truncate flex-1">
                                  File ready
                                </Typography>
                                <button
                                  type="button"
                                  onClick={() => setPaymentProofUrl('')}
                                  className="text-text-muted hover:text-text-danger text-xs shrink-0"
                                >
                                  Remove
                                </button>
                              </div>
                              <Button
                                variant="default"
                                colorRole="brand"
                                size="sm"
                                onClick={() => submitPaymentProofMutation.mutate()}
                                isDisabled={submitPaymentProofMutation.isPending}
                                className="shrink-0"
                              >
                                <ButtonContent>
                                  <Icon icon={IconSend} size="xs" />
                                  {submitPaymentProofMutation.isPending ? 'Submitting...' : 'Submit'}
                                </ButtonContent>
                              </Button>
                            </div>
                          ) : (
                            // No file - show upload button
                            <button
                              type="button"
                              onClick={() => paymentProofInputRef.current?.click()}
                              disabled={isUploadingPaymentProof}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border-muted hover:border-border-brand hover:bg-fill-muted/50 transition-colors text-sm text-text-muted hover:text-text-primary disabled:opacity-50"
                            >
                              <Icon icon={IconPaperclip} size="sm" />
                              {isUploadingPaymentProof ? 'Uploading...' : 'Upload bank transfer screenshot'}
                            </button>
                          )}

                          <Typography variant="bodyXs" colorRole="muted" className="text-center">
                            PNG, JPG, or PDF (max 5MB)
                          </Typography>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Paid Status - shown when payment has been confirmed */}
            {quote.status === 'paid' && (
              <>
                <Divider />
                <div className="rounded-lg border-2 border-border-success bg-fill-success/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon icon={IconCheck} size="sm" className="text-text-success" />
                    <Typography variant="bodySm" className="font-semibold text-text-success">
                      Payment Confirmed
                    </Typography>
                  </div>
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
                        <Icon icon={IconTruck} size="xs" className="text-text-brand" />
                        <Typography variant="bodyXs" className="font-semibold text-text-brand">
                          Expected Delivery:
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

        <DialogFooter className="flex-col-reverse gap-3 sm:flex-row sm:items-center">
          {/* Export PDF button - secondary action */}
          <Button
            variant="outline"
            size="md"
            onClick={handleExportPDF}
            isDisabled={isExporting || !productsData?.data}
            className="w-full sm:w-auto"
          >
            <ButtonContent iconLeft={IconDownload}>
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </ButtonContent>
          </Button>

          {/* Show status message for quotes in approval workflow */}
          {(quote.status === 'buy_request_submitted' ||
            quote.status === 'under_cc_review' ||
            quote.status === 'cc_confirmed' ||
            quote.status === 'awaiting_payment' ||
            quote.status === 'paid') && (
            <div className={`flex-1 rounded-lg p-3 text-center sm:text-left ${
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
                {quote.status === 'under_cc_review' && 'Order is under review'}
                {quote.status === 'cc_confirmed' && 'Confirmed - ready to send to customer'}
                {quote.status === 'awaiting_payment' && 'Payment required - see details above'}
                {quote.status === 'paid' && 'Payment confirmed - processing order'}
              </Typography>
            </div>
          )}

          {/* Submit Buy Request button - show only for quotes that haven't been submitted yet */}
          {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'revision_requested') && (
            <Button
              variant="default"
              colorRole="brand"
              size="md"
              onClick={handleSubmitBuyRequest}
              isDisabled={submitBuyRequestMutation.isPending}
              className="w-full sm:w-auto"
            >
              <ButtonContent iconLeft={IconSend}>
                {submitBuyRequestMutation.isPending
                  ? 'Submitting...'
                  : quote.status === 'revision_requested'
                    ? 'Resubmit Order'
                    : 'Place Order Request'}
              </ButtonContent>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteDetailsDialog;
