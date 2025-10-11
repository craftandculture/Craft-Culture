'use client';

import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { Product } from '@/app/_products/controller/productsGetMany';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import FormFieldError from '@/app/_ui/components/FormField/FormFieldError';
import Shimmer from '@/app/_ui/components/Shimmer/Shimmer';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

import LineItemRow from './LineItemRow';
import useLineItems from '../hooks/useLineItems';
import { GetQuoteSchema } from '../schemas/getQuoteSchema';

const QuotesForm = () => {
  // eslint-disable-next-line react-compiler/react-compiler
  'use no memo';

  const api = useTRPC();
  const {
    control,
    formState: { errors },
    watch,
  } = useFormContext<GetQuoteSchema>();

  const fieldArray = useFieldArray({
    control: control,
    name: 'lineItems',
  });

  const lineItems = useLineItems();

  // Watch the line items to get real-time values
  const watchedLineItems = watch('lineItems');

  console.log('QuotesForm - fieldArray.fields:', fieldArray.fields);
  console.log('QuotesForm - watchedLineItems:', watchedLineItems);

  // Get all productIds from watched values (including incomplete line items)
  const allProductIds = watchedLineItems
    .map((item) => item.productId)
    .filter(Boolean) as string[];

  const { data: productsData } = useQuery({
    ...api.products.getMany.queryOptions({
      productIds: allProductIds,
      limit: 10,
    }),
    enabled: allProductIds.length > 0,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // Maintain a stable products array - accumulate all fetched products
  const [productsCache, setProductsCache] = useState<Product[]>([]);

  React.useEffect(() => {
    if (productsData?.data) {
      setProductsCache((prev) => {
        const newProducts = productsData.data;
        const existingIds = new Set(prev.map((p) => p.id));
        const productsToAdd = newProducts.filter((p) => !existingIds.has(p.id));
        return [...prev, ...productsToAdd];
      });
    }
  }, [productsData?.data]);

  // Callback to add product to cache when selected from combobox
  const handleProductSelect = React.useCallback((product: Product) => {
    setProductsCache((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      if (existingIds.has(product.id)) {
        return prev;
      }
      return [...prev, product];
    });
  }, []);

  const products = productsCache;

  console.log('QuotesForm - allProductIds:', allProductIds);
  console.log('QuotesForm - products:', products);

  const { data: quoteData, isLoading: isQuoteLoading } = useQuery({
    ...api.quotes.get.queryOptions({
      lineItems,
    }),
    enabled: lineItems.length > 0,
  });

  const handleAddRow = () => {
    if (fieldArray.fields.length < 10) {
      fieldArray.append({});
    }
  };

  return (
    <div className="space-y-6">
      {/* Line Items Table */}
      <div className="space-y-3">
        {/* Header Row - Hidden on mobile */}
        {fieldArray.fields.length > 0 && (
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
        {fieldArray.fields.map((field, index) => {
          const watchedProductId = watchedLineItems[index]?.productId;
          const product = products.find((p) => p.id === watchedProductId);
          const maxQuantity =
            product?.productOffers?.[0]?.availableQuantity ?? Infinity;

          console.log(
            `QuotesForm - Row ${index} - watchedProductId:`,
            watchedProductId,
          );
          console.log(`QuotesForm - Row ${index} - product:`, product);

          return (
            <LineItemRow
              key={field.id}
              index={index}
              product={product}
              onRemove={() => fieldArray.remove(index)}
              onProductSelect={handleProductSelect}
              isQuoteLoading={isQuoteLoading}
              quotePrice={quoteData?.lineItems[index]?.unitPrice}
              quoteCurrency={quoteData?.currency}
              omitProductIds={products
                .map((p) => p.id)
                .filter((id) => id !== watchedProductId)}
              maxQuantity={maxQuantity}
            />
          );
        })}

        {/* Array-level errors */}
        {errors.lineItems && !Array.isArray(errors.lineItems) && (
          <FormFieldError>{errors.lineItems.message}</FormFieldError>
        )}
      </div>

      {/* Add Row Button */}
      <Button
        type="button"
        variant="ghost"
        onClick={handleAddRow}
        isDisabled={fieldArray.fields.length >= 10}
      >
        <ButtonContent iconLeft={IconPlus}>Add Product</ButtonContent>
      </Button>

      {/* Total Section */}
      {fieldArray.fields.length > 0 && (
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
