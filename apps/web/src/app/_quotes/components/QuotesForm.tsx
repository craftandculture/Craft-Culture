'use client';

import { IconDownload, IconInfoCircle, IconPlaneInflight, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { parseAsArrayOf, parseAsJson, useQueryState, useQueryStates } from 'nuqs';
import React, { useEffect, useMemo, useState } from 'react';

import CatalogBrowser from '@/app/_products/components/CatalogBrowser';
import { Product } from '@/app/_products/controller/productsGetMany';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import LiveStatus from '@/app/_ui/components/LiveStatus/LiveStatus';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

import B2BCalculator from './B2BCalculator';
import CommissionBreakdown from './CommissionBreakdown';
import LineItemRow from './LineItemRow';
import PriceInfoTooltip from './PriceInfoTooltip';
import ProductFilters from './ProductFilters';
import quotesSearchParams from '../search-params/filtersSearchParams';
import exportInventoryToExcel from '../utils/exportInventoryToExcel';
import exportQuoteToExcel from '../utils/exportQuoteToExcel';

interface URLLineItem {
  productId: string;
  offerId: string;
  quantity: number;
  vintage?: string;
}

const MAX_LINE_ITEMS = 10;

type LineItemBase = {
  id: string;
  product?: Product;
  productId?: string;
  offerId?: string;
  quantity?: number;
  vintage?: string;
};

type DerivedLineItem =
  | (LineItemBase & {
      source: 'url';
      urlIndex: number;
    })
  | (LineItemBase & {
      source: 'placeholder';
    });

const QuotesForm = () => {
  const api = useTRPC();

  // Get current user to check customer type
  const { data: userData } = useQuery(api.users.getMe.queryOptions());
  const customerType = userData?.customerType;

  // Get current filter state from URL
  const [filterState] = useQueryStates(quotesSearchParams, {
    shallow: true,
    scroll: false,
    history: 'replace',
  });

  // Fetch filter options for dropdowns, passing current filters to refine vintages
  const { data: filterOptions, isLoading: isLoadingFilterOptions } = useQuery({
    ...api.products.getFilterOptions.queryOptions({
      countries: filterState.countries,
      regions: filterState.regions,
      producers: filterState.producers,
    }),
    placeholderData: (previousData) => previousData,
  });

  // Fetch lead time settings from database
  const { data: leadTimeMinData } = useQuery(
    api.admin.settings.get.queryOptions({ key: 'leadTimeMin' }),
  );
  const { data: leadTimeMaxData } = useQuery(
    api.admin.settings.get.queryOptions({ key: 'leadTimeMax' }),
  );

  const leadTimeMin = leadTimeMinData ? Number(leadTimeMinData) : 14;
  const leadTimeMax = leadTimeMaxData ? Number(leadTimeMaxData) : 21;

  // Currency display toggle
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'AED'>('AED');

  // URL is the single source of truth
  const [urlLineItems, setUrlLineItems] = useQueryState<URLLineItem[]>(
    'items',
    parseAsArrayOf(
      parseAsJson<URLLineItem>((value) => {
        if (
          typeof value === 'object' &&
          value !== null &&
          'productId' in value &&
          'offerId' in value &&
          'quantity' in value
        ) {
          return value as URLLineItem;
        }
        return null;
      }),
    ).withDefault([]),
  );

  // Fetch products for URL line items
  const productIds = useMemo(
    () => [...new Set(urlLineItems.map((item) => item.productId))],
    [urlLineItems],
  );

  const { data: productsData } = useQuery({
    ...api.products.getMany.queryOptions({
      productIds,
    }),
    enabled: productIds.length > 0,
    placeholderData: (previousData) => previousData,
  });

  const [placeholderRowIds, setPlaceholderRowIds] = useState<string[]>([]);
  const [productCache, setProductCache] = useState<Record<string, Product>>({});

  // Guarantee the UI always shows an editable row
  useEffect(() => {
    if (urlLineItems.length === 0 && placeholderRowIds.length === 0) {
      setPlaceholderRowIds([crypto.randomUUID()]);
    }
  }, [placeholderRowIds.length, urlLineItems.length]);

  // Derive line items from URL and products data
  const lineItems = useMemo<DerivedLineItem[]>(() => {
    const productMap = new Map<string, Product>();

    Object.values(productCache).forEach((product) => {
      productMap.set(product.id, product);
    });

    if (productsData) {
      productsData.data.forEach((product) => {
        productMap.set(product.id, product);
      });
    }

    const persistedLineItems: DerivedLineItem[] = urlLineItems.map(
      (item, index) => ({
        id: `url-${index}`,
        source: 'url',
        urlIndex: index,
        product: productMap.get(item.productId),
        productId: item.productId,
        offerId: item.offerId,
        quantity: item.quantity,
        vintage: item.vintage,
      }),
    );

    if (persistedLineItems.length === 0 && placeholderRowIds.length === 0) {
      return [
        {
          id: 'placeholder-fallback',
          source: 'placeholder',
        },
      ];
    }

    const placeholderLineItems: DerivedLineItem[] = placeholderRowIds.map(
      (id) => ({
        id,
        source: 'placeholder',
      }),
    );

    return [...persistedLineItems, ...placeholderLineItems];
  }, [placeholderRowIds, productCache, productsData, urlLineItems]);

  // Fetch quote data
  const { data: quoteData, isLoading: isQuoteLoading } = useQuery({
    ...api.quotes.get.queryOptions({
      lineItems: urlLineItems,
    }),
    enabled: urlLineItems.length > 0,
  });

  const totalLineItems = lineItems.length;
  const isAtRowLimit = totalLineItems >= MAX_LINE_ITEMS;

  const handleAddRow = () => {
    if (isAtRowLimit) {
      return;
    }
    setPlaceholderRowIds((prev) => [...prev, crypto.randomUUID()]);
  };

  const handleRemoveRow = (id: string) => {
    const item = lineItems.find((lineItem) => lineItem.id === id);
    if (!item) {
      return;
    }

    if (item.source === 'url') {
      const newItems = urlLineItems.filter((_, i) => i !== item.urlIndex);
      void setUrlLineItems(newItems);
      return;
    }

    setPlaceholderRowIds((prev) => prev.filter((rowId) => rowId !== item.id));
  };

  const handleProductChange = (id: string, product: Product) => {
    const item = lineItems.find((lineItem) => lineItem.id === id);
    if (!item) {
      return;
    }

    const quantity = Math.max(1, item.quantity ?? 1);
    const offerId = product.productOffers?.[0]?.id ?? '';

    setProductCache((prev) => ({
      ...prev,
      [product.id]: product,
    }));

    if (item.source === 'url') {
      if (!urlLineItems[item.urlIndex]) {
        return;
      }

      const newItems = [...urlLineItems];
      newItems[item.urlIndex] = {
        productId: product.id,
        offerId,
        quantity,
        vintage: item.vintage,
      };
      void setUrlLineItems(newItems);
      return;
    }

    void setUrlLineItems([
      ...urlLineItems,
      {
        productId: product.id,
        offerId,
        quantity,
        vintage: item.vintage,
      },
    ]);
    setPlaceholderRowIds((prev) => prev.filter((rowId) => rowId !== item.id));
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    const item = lineItems.find((lineItem) => lineItem.id === id);
    if (!item) {
      return;
    }

    if (item.source !== 'url' || !urlLineItems[item.urlIndex]) {
      return;
    }

    const nextQuantity = Math.max(1, quantity);
    const newItems = [...urlLineItems];
    newItems[item.urlIndex] = {
      ...newItems[item.urlIndex]!,
      quantity: nextQuantity,
    };
    void setUrlLineItems(newItems);
  };

  const handleVintageChange = (id: string, vintage: string) => {
    const item = lineItems.find((lineItem) => lineItem.id === id);
    if (!item) {
      return;
    }

    if (item.source === 'url') {
      if (!urlLineItems[item.urlIndex]) {
        return;
      }

      const newItems = [...urlLineItems];
      newItems[item.urlIndex] = {
        ...newItems[item.urlIndex]!,
        vintage,
      };
      void setUrlLineItems(newItems);
    }
  };

  const handleDownloadExcel = () => {
    if (!quoteData || lineItems.length === 0) {
      return;
    }

    // Prepare line items for export
    const exportLineItems = lineItems
      .filter((item) => item.product)
      .map((item) => {
        const quotedLineItem = quoteData.lineItems.find(
          (qli) => qli.productId === item.product?.id,
        );

        const offer = item.product?.productOffers?.[0];
        const unitCount = offer?.unitCount ?? 1;
        const totalBottles = (item.quantity ?? 1) * unitCount;
        const perBottlePrice =
          quotedLineItem?.lineItemTotalUsd && totalBottles > 0
            ? quotedLineItem.lineItemTotalUsd / totalBottles
            : 0;

        const linePrice = quotedLineItem?.lineItemTotalUsd ?? 0;
        const pricePerCase = linePrice / (item.quantity ?? 1);

        // Calculate commission per case for B2C customers
        const commissionUsd = quotedLineItem?.commissionUsd ?? 0;
        const quantity = item.quantity ?? 1;
        const commissionPerCase = commissionUsd / quantity;

        return {
          reference: item.product?.name ?? '',
          vintage: item.vintage ?? '',
          quantity: item.quantity ?? 1,
          unitSize: offer?.unitSize ?? '',
          unitsPerCase: unitCount,
          totalBottles,
          pricePerCase:
            displayCurrency === 'AED'
              ? convertUsdToAed(pricePerCase)
              : pricePerCase,
          pricePerBottle:
            displayCurrency === 'AED'
              ? convertUsdToAed(perBottlePrice)
              : perBottlePrice,
          totalPrice:
            displayCurrency === 'AED'
              ? convertUsdToAed(linePrice)
              : linePrice,
          commissionPerCase:
            displayCurrency === 'AED'
              ? convertUsdToAed(commissionPerCase)
              : commissionPerCase,
        };
      });

    const total =
      displayCurrency === 'AED'
        ? convertUsdToAed(quoteData.totalUsd)
        : quoteData.totalUsd;

    // Include commission total for B2C customers
    const commissionTotal =
      customerType === 'b2c' && quoteData.totalCommissionUsd > 0
        ? displayCurrency === 'AED'
          ? convertUsdToAed(quoteData.totalCommissionUsd)
          : quoteData.totalCommissionUsd
        : undefined;

    exportQuoteToExcel(exportLineItems, displayCurrency, total, commissionTotal);
  };

  // Fetch all products for inventory download
  const { data: allProductsData, isLoading: isLoadingInventory } = useQuery({
    ...api.products.getMany.queryOptions({
      limit: 10000, // Fetch all products
    }),
  });

  const handleDownloadInventory = () => {
    if (!allProductsData || allProductsData.data.length === 0) {
      return;
    }

    // Prepare inventory items for export with both USD and AED pricing
    const inventoryItems = allProductsData.data
      .filter((product) => product.productOffers && product.productOffers.length > 0)
      .map((product) => {
        const offer = product.productOffers![0];
        const unitCount = offer?.unitCount ?? 1;
        const pricePerCaseUsd = offer?.price ?? 0;
        const pricePerBottleUsd = pricePerCaseUsd / unitCount;

        return {
          reference: product.name ?? '',
          producer: product.producer ?? '',
          vintage: product.year?.toString() ?? '',
          region: product.region ?? '',
          lwin18: product.lwin18 ?? '',
          unitSize: offer?.unitSize ?? '',
          unitsPerCase: unitCount,
          pricePerCaseUsd,
          pricePerBottleUsd,
          pricePerCaseAed: convertUsdToAed(pricePerCaseUsd),
          pricePerBottleAed: convertUsdToAed(pricePerBottleUsd),
          availableQuantity: offer?.availableQuantity ?? 0,
        };
      });

    exportInventoryToExcel(inventoryItems);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Pricing Tool Section */}
      <section className="space-y-4 rounded-lg border border-border-muted bg-fill-secondary/30 p-4 shadow-sm md:space-y-5 md:p-6">
        {/* Section Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Typography variant="headingLg" className="font-semibold">
              Quotation Builder
            </Typography>
            <LiveStatus />
          </div>
          <Typography variant="bodySm" colorRole="muted">
            Select products and quantities to generate your custom quote
          </Typography>
        </div>

        {/* Lead Time Banner */}
        <div className="relative overflow-hidden rounded-lg border border-border-muted bg-gradient-to-r from-fill-brand/5 via-fill-brand/10 to-fill-brand/5 px-4 py-3 shadow-sm">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-full bg-fill-brand/10 p-2">
              <IconPlaneInflight className="h-4 w-4 text-text-brand sm:h-5 sm:w-5" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
              <Typography variant="bodySm" className="font-medium">
                Estimated Lead Time:
              </Typography>
              <Typography variant="bodySm" className="text-text-brand font-semibold">
                {leadTimeMin}-{leadTimeMax} days via air freight
              </Typography>
            </div>
          </div>
        </div>

        {/* Currency Toggle and Inventory Download */}
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-2">
            <Typography variant="bodyXs" className="text-text-muted font-medium">
              Currency:
            </Typography>
            <div className="flex gap-0.5 rounded-md border border-border-muted bg-fill-muted p-0.5">
              <button
                type="button"
                onClick={() => setDisplayCurrency('USD')}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  displayCurrency === 'USD'
                    ? 'bg-fill-primary text-text-primary'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => setDisplayCurrency('AED')}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  displayCurrency === 'AED'
                    ? 'bg-fill-primary text-text-primary'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                AED
              </button>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
      <div className="space-y-3">
        {/* Header Row - Hidden on mobile */}
        {lineItems.length > 0 && (
          <div className="hidden grid-cols-12 gap-3 px-2 md:grid">
            <div className="col-span-6 flex justify-start">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Reference
              </Typography>
            </div>
            <div className="col-span-1 flex justify-start">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Vintage
              </Typography>
            </div>
            <div className="col-span-2 flex justify-start">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Quantity
              </Typography>
            </div>
            <div className="col-span-1 flex items-center justify-end gap-1">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Price
              </Typography>
              <PriceInfoTooltip customerType={customerType} />
            </div>
            <div className="col-span-1 flex items-center justify-end gap-1">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Per Bottle
              </Typography>
              <PriceInfoTooltip customerType={customerType} />
            </div>
            <div className="col-span-1" />
          </div>
        )}

        {/* Line Item Rows */}
        {lineItems.map((item) => {
          const maxQuantity =
            item.product?.productOffers?.[0]?.availableQuantity ?? Infinity;

          // Get all selected product IDs except the current one
          const omitProductIds = lineItems
            .map((li) => li.product?.id)
            .filter((id) => id && id !== item.product?.id) as string[];

          // Find the corresponding quote line item by matching productId
          const quotedLineItem = quoteData?.lineItems.find(
            (qli) => qli.productId === item.product?.id,
          );

          // Calculate per bottle price
          const offer = item.product?.productOffers?.[0];
          const unitCount = offer?.unitCount ?? 1;
          const totalBottles = (item.quantity ?? 1) * unitCount;
          const perBottlePrice =
            quotedLineItem?.lineItemTotalUsd && totalBottles > 0
              ? quotedLineItem.lineItemTotalUsd / totalBottles
              : undefined;

          return (
            <LineItemRow
              key={item.id}
              vintage={item.vintage}
              product={item.product}
              quantity={item.quantity}
              onVintageChange={(vintage) =>
                handleVintageChange(item.id, vintage)
              }
              onProductChange={(selectedProduct) =>
                handleProductChange(item.id, selectedProduct)
              }
              onQuantityChange={(quantity) =>
                handleQuantityChange(item.id, quantity)
              }
              onRemove={() => handleRemoveRow(item.id)}
              isQuoteLoading={isQuoteLoading}
              quotePrice={
                quotedLineItem?.lineItemTotalUsd
                  ? displayCurrency === 'AED'
                    ? convertUsdToAed(quotedLineItem.lineItemTotalUsd)
                    : quotedLineItem.lineItemTotalUsd
                  : undefined
              }
              perBottlePrice={
                perBottlePrice
                  ? displayCurrency === 'AED'
                    ? convertUsdToAed(perBottlePrice)
                    : perBottlePrice
                  : undefined
              }
              quoteCurrency={displayCurrency}
              customerType={customerType}
              omitProductIds={omitProductIds}
              maxQuantity={maxQuantity}
            />
          );
        })}
      </div>

      {/* Add Row Button */}
      <Button
        type="button"
        variant="ghost"
        onClick={handleAddRow}
        isDisabled={isAtRowLimit}
      >
        <ButtonContent iconLeft={IconPlus}>Add Product</ButtonContent>
      </Button>

      {/* Total Section with Commission Breakdown */}
      {lineItems.length > 0 && (
        <>
          <Divider />
          <div className="flex flex-col gap-3 px-2">
            {/* Subtotal (before commission) - B2C only */}
            {customerType === 'b2c' &&
              quoteData &&
              quoteData.totalCommissionUsd > 0 && (
                <div className="flex items-center justify-between">
                  <Typography variant="bodyMd" colorRole="muted">
                    Subtotal
                  </Typography>
                  {isQuoteLoading ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    <Typography variant="bodyMd" colorRole="muted">
                      {formatPrice(
                        displayCurrency === 'AED'
                          ? convertUsdToAed(quoteData.subtotalBeforeCommissionUsd)
                          : quoteData.subtotalBeforeCommissionUsd,
                        displayCurrency,
                      )}
                    </Typography>
                  )}
                </div>
              )}

            {/* Sales Commission Breakdown - B2C Only */}
            {customerType === 'b2c' &&
              quoteData &&
              quoteData.totalCommissionUsd > 0 && (
                <CommissionBreakdown
                  lineItems={lineItems
                    .filter((item) => item.product)
                    .map((item) => {
                      const quotedLineItem = quoteData.lineItems.find(
                        (qli) => qli.productId === item.product?.id,
                      );

                      const commissionUsd = quotedLineItem?.commissionUsd ?? 0;
                      const quantity = item.quantity ?? 1;
                      const commissionPerCase = commissionUsd / quantity;

                      return {
                        productName: item.product?.name ?? '',
                        quantity,
                        commissionPerCase:
                          displayCurrency === 'AED'
                            ? convertUsdToAed(commissionPerCase)
                            : commissionPerCase,
                        lineCommission:
                          displayCurrency === 'AED'
                            ? convertUsdToAed(commissionUsd)
                            : commissionUsd,
                      };
                    })}
                  totalCommission={
                    displayCurrency === 'AED'
                      ? convertUsdToAed(quoteData.totalCommissionUsd)
                      : quoteData.totalCommissionUsd
                  }
                  currency={displayCurrency}
                />
              )}

            {/* Divider before Total - B2C only */}
            {customerType === 'b2c' &&
              quoteData &&
              quoteData.totalCommissionUsd > 0 && <Divider />}

            {/* Total (unchanged) */}
            <div className="flex items-center justify-between">
              <Typography variant="bodyLg" className="font-semibold">
                Total
              </Typography>
              {isQuoteLoading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <Typography variant="bodyLg" className="font-semibold">
                          {quoteData?.totalUsd
                            ? formatPrice(
                                displayCurrency === 'AED'
                                  ? convertUsdToAed(quoteData.totalUsd)
                                  : quoteData.totalUsd,
                                displayCurrency,
                              )
                            : '—'}
                        </Typography>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <Typography variant="bodyXs">
                        {customerType === 'b2b' ? 'In-Bond UAE' : 'Price to Client'}
                      </Typography>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Download Button */}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleDownloadExcel}
                isDisabled={!quoteData || lineItems.length === 0}
                className="w-full sm:w-auto"
              >
                <ButtonContent iconLeft={IconDownload}>
                  Download Excel Quote
                </ButtonContent>
              </Button>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex">
                      <IconInfoCircle className="h-4 w-4 text-text-muted" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <Typography variant="bodyXs">
                      Export In Bond UAE Product list
                    </Typography>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* B2B Calculator - B2B Only */}
            {customerType === 'b2b' && quoteData && (
              <>
                <Divider />
                <B2BCalculator
                  inBondPriceUsd={quoteData.totalUsd}
                  lineItems={lineItems
                    .filter((item) => item.product)
                    .map((item) => {
                      const quotedLineItem = quoteData.lineItems.find(
                        (qli) => qli.productId === item.product?.id,
                      );

                      return {
                        productName: `${item.product?.name ?? 'Unknown'}${
                          item.vintage ? ` ${item.vintage}` : ''
                        }`,
                        quantity: item.quantity ?? 1,
                        basePriceUsd: quotedLineItem?.basePriceUsd ?? 0,
                        lineItemTotalUsd: quotedLineItem?.lineItemTotalUsd ?? 0,
                        unitCount: item.product?.productOffers[0]?.unitCount ?? 12,
                      };
                    })}
                />
              </>
            )}
          </div>
        </>
      )}
      </section>

      {/* Enhanced Section Divider */}
      <div className="relative my-8 md:my-12 lg:my-16">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t-2 border-border-primary md:border-t-[3px]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-fill-primary px-3 py-1.5 md:px-6 md:py-3">
            <Typography
              variant="bodySm"
              className="text-sm font-bold uppercase tracking-wider text-text-primary md:text-base"
            >
              Product Catalogue
            </Typography>
          </span>
        </div>
      </div>

      {/* Product Catalogue Section */}
      <section className="space-y-4 rounded-lg border border-border-muted bg-fill-secondary/30 p-4 shadow-sm md:p-6">
        {/* Section Header */}
        <div className="space-y-2">
          <Typography variant="headingLg" className="font-semibold">
            Product Inventory
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            View and select from our complete wine & spirits collection
          </Typography>
        </div>

        {/* Product Filters - Duplicate for catalog browsing */}
        {filterOptions && (
          <ProductFilters
            countriesWithCounts={filterOptions.countriesWithCounts}
            regionsByCountryWithCounts={filterOptions.regionsByCountryWithCounts}
            producersByCountryWithCounts={filterOptions.producersByCountryWithCounts}
            vintagesByCountryWithCounts={filterOptions.vintagesByCountryWithCounts}
            isLoadingVintages={isLoadingFilterOptions}
          />
        )}

        {/* Catalog Browser */}
        <CatalogBrowser
        onAddProduct={(product) => {
          // Find first available placeholder or add new line item
          const firstPlaceholder = lineItems.find(
            (item) => item.source === 'placeholder',
          );

          if (firstPlaceholder && lineItems.length < MAX_LINE_ITEMS) {
            // Use the placeholder - simulate product selection
            const offer = product.productOffers?.[0];
            if (offer) {
              const newUrlItems = [
                ...urlLineItems,
                {
                  productId: product.id,
                  offerId: offer.id,
                  quantity: 1,
                },
              ];
              void setUrlLineItems(newUrlItems);
            }
          } else if (lineItems.length < MAX_LINE_ITEMS) {
            // Add new line item
            const offer = product.productOffers?.[0];
            if (offer) {
              const newUrlItems = [
                ...urlLineItems,
                {
                  productId: product.id,
                  offerId: offer.id,
                  quantity: 1,
                },
              ];
              void setUrlLineItems(newUrlItems);
            }
          }
          // Scroll to top to show the added item
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        displayCurrency={displayCurrency}
        omitProductIds={urlLineItems.map((item) => item.productId)}
        onDownloadInventory={handleDownloadInventory}
        isDownloadingInventory={isLoadingInventory}
      />
      </section>
    </div>
  );
};

export default QuotesForm;
