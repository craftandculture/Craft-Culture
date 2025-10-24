'use client';

import { IconDownload, IconInfoCircle, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { parseAsArrayOf, parseAsJson, useQueryState } from 'nuqs';
import React, { useEffect, useMemo, useState } from 'react';

import { Product } from '@/app/_products/controller/productsGetMany';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

import LineItemRow from './LineItemRow';
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
        };
      });

    const total =
      displayCurrency === 'AED'
        ? convertUsdToAed(quoteData.totalUsd)
        : quoteData.totalUsd;

    exportQuoteToExcel(exportLineItems, displayCurrency, total);
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
    <div className="space-y-2">
      {/* Currency Toggle and Inventory Download */}
      <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center sm:justify-end">
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDownloadInventory}
          isDisabled={isLoadingInventory || !allProductsData || allProductsData.data.length === 0}
          className="text-text-muted hover:text-text-primary text-xs font-normal"
        >
          <ButtonContent iconLeft={IconDownload}>
            Download Full Inventory
          </ButtonContent>
        </Button>
      </div>

      {/* Line Items Table */}
      <div className="space-y-3 pt-4">
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Icon
                        icon={IconInfoCircle}
                        size="sm"
                        colorRole="muted"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {customerType === 'b2b' ? 'In-Bond UAE' : 'Client Price'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="col-span-1 flex items-center justify-end gap-1">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Per Bottle
              </Typography>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Icon
                        icon={IconInfoCircle}
                        size="sm"
                        colorRole="muted"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {customerType === 'b2b' ? 'In-Bond UAE' : 'Client Price'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

      {/* Total Section */}
      {lineItems.length > 0 && (
        <>
          <Divider />
          <div className="flex items-center justify-between px-2">
            <Typography variant="bodyLg" className="font-semibold">
              Total
            </Typography>
            {isQuoteLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
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
            )}
          </div>
          {/* Download Quote Button */}
          <div className="flex justify-center pt-3">
            <Button
              type="button"
              variant="default"
              size="md"
              onClick={handleDownloadExcel}
              isDisabled={!quoteData || lineItems.length === 0}
              className="w-full sm:w-auto bg-[#bdece3] hover:bg-[#a8ddd3] text-gray-900"
            >
              <ButtonContent iconLeft={IconDownload}>
                Download Quote as Excel
              </ButtonContent>
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default QuotesForm;
