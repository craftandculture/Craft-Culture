'use client';

import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { parseAsArrayOf, parseAsJson, useQueryState } from 'nuqs';
import React, { useMemo } from 'react';

import { Product } from '@/app/_products/controller/productsGetMany';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

import LineItemRow from './LineItemRow';

export interface LineItem {
  id: string;
  offerId?: string;
  quantity?: number;
  product?: Product;
}

interface URLLineItem {
  productId: string;
  offerId: string;
  quantity: number;
}

const QuotesForm = () => {
  const api = useTRPC();

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
  });

  // Derive line items from URL and products data
  const lineItems = useMemo<LineItem[]>(() => {
    if (urlLineItems.length === 0) {
      return [{ id: crypto.randomUUID() }];
    }

    const productMap = productsData
      ? new Map(productsData.data.map((p) => [p.id, p]))
      : new Map();

    return urlLineItems.map((item) => ({
      id: `${item.productId}-${item.offerId}`,
      offerId: item.offerId,
      quantity: item.quantity,
      product: productMap.get(item.productId),
    }));
  }, [urlLineItems, productsData]);

  // Fetch quote data
  const { data: quoteData, isLoading: isQuoteLoading } = useQuery({
    ...api.quotes.get.queryOptions({
      lineItems: urlLineItems,
    }),
    enabled: urlLineItems.length > 0,
  });

  const handleAddRow = () => {
    if (urlLineItems.length < 10) {
      void setUrlLineItems([...urlLineItems, {} as URLLineItem]);
    }
  };

  const handleRemoveRow = (id: string) => {
    const index = lineItems.findIndex((item) => item.id === id);
    if (index !== -1) {
      const newItems = urlLineItems.filter((_, i) => i !== index);
      void setUrlLineItems(newItems.length > 0 ? newItems : []);
    }
  };

  const handleProductChange = (id: string, product: Product) => {
    const index = lineItems.findIndex((item) => item.id === id);
    if (index !== -1) {
      const newItems = [...urlLineItems];
      newItems[index] = {
        productId: product.id,
        offerId: product.productOffers?.[0]?.id || '',
        quantity: 1,
      };
      void setUrlLineItems(newItems);
    }
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    const index = lineItems.findIndex((item) => item.id === id);
    if (index !== -1 && urlLineItems[index]) {
      const newItems = [...urlLineItems];
      newItems[index] = { ...newItems[index]!, quantity };
      void setUrlLineItems(newItems);
    }
  };

  return (
    <div className="space-y-6">
      {/* Line Items Table */}
      <div className="space-y-3">
        {/* Header Row - Hidden on mobile */}
        {lineItems.length > 0 && (
          <div className="hidden grid-cols-12 gap-3 px-2 md:grid">
            <div className="col-span-5">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Product
              </Typography>
            </div>
            <div className="col-span-3">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Quantity
              </Typography>
            </div>
            <div className="col-span-3 text-right">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Price
              </Typography>
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

          return (
            <LineItemRow
              key={item.id}
              product={item.product}
              quantity={item.quantity}
              onProductChange={(selectedProduct) =>
                handleProductChange(item.id, selectedProduct)
              }
              onQuantityChange={(quantity) =>
                handleQuantityChange(item.id, quantity)
              }
              onRemove={() => handleRemoveRow(item.id)}
              isQuoteLoading={isQuoteLoading}
              quotePrice={quotedLineItem?.lineItemTotalUsd}
              quoteCurrency="USD"
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
        isDisabled={lineItems.length >= 10}
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
                  ? formatPrice(quoteData.totalUsd, 'USD')
                  : '—'}
              </Typography>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default QuotesForm;
