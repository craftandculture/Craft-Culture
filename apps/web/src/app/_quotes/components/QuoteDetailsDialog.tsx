'use client';

import type { DialogProps } from '@radix-ui/react-dialog';
import { IconCalendar, IconCurrencyDollar, IconDownload, IconFileText, IconUser } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
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
import Typography from '@/app/_ui/components/Typography/Typography';
import type { Quote } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';
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
  const [isExporting, setIsExporting] = useState(false);

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

  // Fetch user settings for logo/company name
  const { data: settings } = useQuery({
    ...api.settings.get.queryOptions(),
    enabled: !!quote,
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
    if (!quote?.quoteData) return null;
    const data = quote.quoteData as {
      lineItems?: Array<{
        productId: string;
        lineItemTotalUsd: number;
        basePriceUsd?: number;
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
  }, [quote?.quoteData]);

  // Create pricing map by productId
  const pricingMap = useMemo(() => {
    if (!quotePricingData?.lineItems) return {};
    return quotePricingData.lineItems.reduce(
      (acc, item) => {
        acc[item.productId] = item;
        return acc;
      },
      {} as Record<string, { lineItemTotalUsd: number; basePriceUsd?: number }>,
    );
  }, [quotePricingData]);

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
        const pricePerCase = pricing?.lineItemTotalUsd
          ? pricing.lineItemTotalUsd / item.quantity
          : 0;
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
          quantity: item.quantity,
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  In-Bond UAE Price
                </Typography>
                <Typography variant="bodyMd" className="font-semibold">
                  {formatPrice(
                    quote.currency === 'AED' ? quote.totalAed ?? quote.totalUsd : quote.totalUsd,
                    quote.currency as 'USD' | 'AED',
                  )}
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
                  const pricePerCase = pricing?.lineItemTotalUsd
                    ? pricing.lineItemTotalUsd / item.quantity
                    : 0;
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
                              <div className="grid grid-cols-3 gap-2 rounded-lg bg-fill-muted p-3">
                                <div>
                                  <Typography variant="bodyXs" colorRole="muted" className="mb-0.5">
                                    Quantity
                                  </Typography>
                                  <Typography variant="bodySm" className="font-semibold">
                                    {item.quantity} {item.quantity === 1 ? 'case' : 'cases'}
                                  </Typography>
                                </div>
                                <div>
                                  <Typography variant="bodyXs" colorRole="muted" className="mb-0.5">
                                    Price/Case
                                  </Typography>
                                  <Typography variant="bodySm" className="font-semibold">
                                    {formatPrice(
                                      quote.currency === 'AED' && quote.totalAed
                                        ? convertUsdToAed(pricePerCase)
                                        : pricePerCase,
                                      quote.currency as 'USD' | 'AED',
                                    )}
                                  </Typography>
                                </div>
                                <div className="text-right">
                                  <Typography variant="bodyXs" colorRole="muted" className="mb-0.5">
                                    Line Total
                                  </Typography>
                                  <Typography variant="bodySm" className="font-bold text-text-brand">
                                    {formatPrice(
                                      quote.currency === 'AED' && quote.totalAed
                                        ? convertUsdToAed(lineItemTotal)
                                        : lineItemTotal,
                                      quote.currency as 'USD' | 'AED',
                                    )}
                                  </Typography>
                                </div>
                              </div>
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
                              {item.quantity}
                            </Typography>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

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
