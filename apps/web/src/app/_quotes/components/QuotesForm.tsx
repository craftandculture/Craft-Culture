'use client';

import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';

import { Product } from '@/app/_products/controller/productsGetMany';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Shimmer from '@/app/_ui/components/Shimmer/Shimmer';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

import LineItemRow from './LineItemRow';

export interface LineItem {
  id: string;
  productId?: string;
  quantity?: number;
  product?: Product; // Store the full product object
}

const QuotesForm = () => {
  const api = useTRPC();

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID() },
  ]);

  // Get complete line items for quote calculation
  const completeLineItems = lineItems
    .filter(
      (item) =>
        item.productId &&
        item.productId !== '' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0,
    )
    .map((item) => ({
      productId: item.productId!,
      quantity: item.quantity!,
    }));

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
              productId: product.id,
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
            .map((li) => li.productId)
            .filter((id) => id && id !== item.productId) as string[];

          // Find the corresponding quote line item by matching productId and quantity
          const quotedLineItem = quoteData?.lineItems.find(
            (qli) =>
              qli.productId === item.productId &&
              qli.quantity === item.quantity,
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
              quotePrice={quotedLineItem?.lineTotal}
              quoteCurrency={quoteData?.currency}
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
              <Shimmer variant="price" width="wide" />
            ) : (
              <Typography variant="bodyLg" className="font-semibold">
                {quoteData?.total
                  ? formatPrice(quoteData.total, quoteData.currency)
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
