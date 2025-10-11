'use client';

import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';

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
  product?: Product; // Store the full product object
}

const QuotesForm = () => {
  const api = useTRPC();

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID() },
  ]);

  // Get complete line items for quote calculation
  const completeLineItems = React.useMemo(
    () =>
      lineItems
        .filter(
          (item) =>
            item.offerId &&
            item.offerId !== '' &&
            typeof item.quantity === 'number' &&
            item.quantity > 0,
        )
        .map((item) => ({
          offerId: item.offerId!,
          quantity: item.quantity!,
        })),
    [lineItems],
  );

  // Fetch quote data
  const { data: quoteData, isLoading: isQuoteLoading } = useQuery({
    ...api.quotes.get.queryOptions({
      lineItems: completeLineItems,
    }),
    enabled: completeLineItems.length > 0,
  });

  const handleAddRow = () => {
    if (lineItems.length < 10) {
      setLineItems((prev) => [...prev, { id: crypto.randomUUID() }]);
    }
  };

  const handleRemoveRow = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleProductChange = (id: string, product: Product) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              offerId: product.productOffers?.[0]?.id,
              product: product, // Store the full product
              quantity: product.productOffers?.[0]?.availableQuantity ?? 1,
            }
          : item,
      ),
    );
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Line Items Table */}
      <div className="space-y-3">
        {/* Header Row - Hidden on mobile */}
        {lineItems.length > 0 && (
          <div className="hidden grid-cols-12 gap-3 px-2 md:grid">
            <div className="col-span-6">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Product
              </Typography>
            </div>
            <div className="col-span-2">
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
