'use client';

import { IconTrash } from '@tabler/icons-react';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import ProductsCombobox from '@/app/_products/components/ProductsCombobox';
import { Product } from '@/app/_products/controller/productsGetMany';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import FormField from '@/app/_ui/components/FormField/FormField';
import FormFieldError from '@/app/_ui/components/FormField/FormFieldError';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Shimmer from '@/app/_ui/components/Shimmer/Shimmer';
import Typography from '@/app/_ui/components/Typography/Typography';

import { GetQuoteSchema } from '../schemas/getQuoteSchema';

interface LineItemRowProps {
  index: number;
  omitProductIds: string[];
  product?: Product;
  maxQuantity?: number;
  isQuoteLoading?: boolean;
  quotePrice?: number;
  quoteCurrency?: string;
  onRemove: () => void;
  onProductSelect?: (product: Product) => void;
}

const LineItemRow = ({
  index,
  omitProductIds,
  product,
  maxQuantity = Infinity,
  isQuoteLoading,
  quotePrice,
  quoteCurrency,
  onRemove,
  onProductSelect,
}: LineItemRowProps) => {
  // eslint-disable-next-line react-compiler/react-compiler
  'use no memo';

  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<GetQuoteSchema>();

  console.log(`LineItemRow ${index} - product prop:`, product);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 items-start gap-3">
        {/* Product Selector */}
        <div className="col-span-12 sm:col-span-8 md:col-span-6">
          <FormField>
            <Controller
              name={`lineItems.${index}.productId`}
              control={control}
              render={({ field }) => {
                console.log(`LineItemRow ${index} - Controller field.value:`, field.value);
                return (
                  <ProductsCombobox
                    value={product ?? null}
                    onSelect={(selectedProduct) => {
                      console.log(`LineItemRow ${index} - onSelect called with:`, selectedProduct);
                      console.log(`LineItemRow ${index} - selectedProduct.id:`, selectedProduct.id);

                      // Store the product ID in form state
                      field.onChange(selectedProduct.id);

                      // Set quantity to max available quantity
                      const maxQty = selectedProduct.productOffers?.[0]?.availableQuantity;
                      if (maxQty !== undefined && maxQty !== null) {
                        setValue(`lineItems.${index}.quantity`, maxQty);
                      }

                      // Also store the full product in the parent's cache
                      onProductSelect?.(selectedProduct);

                      console.log(`LineItemRow ${index} - field.onChange called`);
                      console.log(`LineItemRow ${index} - field.value after onChange:`, field.value);
                    }}
                    placeholder="Select product..."
                    omitProductIds={omitProductIds}
                  />
                );
              }}
            />
            {errors?.lineItems?.[index]?.productId && (
              <FormFieldError className="mt-1">
                {errors.lineItems[index].productId.message}
              </FormFieldError>
            )}
          </FormField>
        </div>

        {/* Quantity Input */}
        <div className="col-span-12 sm:col-span-4 md:col-span-2">
          <FormField>
            <div className="flex w-full items-center gap-2">
              <Input
                {...register(`lineItems.${index}.quantity`, {
                  valueAsNumber: true,
                  onChange: (e) => {
                    const value = parseInt(e.target.value);
                    if (maxQuantity !== Infinity && value > maxQuantity) {
                      setValue(`lineItems.${index}.quantity`, maxQuantity);
                    }
                  },
                })}
                type="number"
                size="md"
                min={1}
                max={maxQuantity !== Infinity ? maxQuantity : undefined}
                placeholder="Qty"
                className="min-w-0 flex-1"
                isDisabled={!product}
              />
              {maxQuantity !== Infinity && (
                <Typography
                  variant="bodyXs"
                  className="text-text-muted shrink-0 font-medium"
                >
                  / {maxQuantity}
                </Typography>
              )}
            </div>
            {errors?.lineItems?.[index]?.quantity && (
              <FormFieldError className="mt-1">
                {errors.lineItems[index].quantity.message}
              </FormFieldError>
            )}
          </FormField>
        </div>

        {/* Line Price */}
        <div className="col-span-10 flex h-9 items-center justify-start sm:col-span-10 md:col-span-3 md:justify-end">
          {isQuoteLoading ? (
            <Shimmer variant="price" width="default" />
          ) : (
            <Typography variant="bodySm" className="font-medium">
              {quotePrice !== undefined
                ? Intl.NumberFormat('en-GB', {
                    style: 'currency',
                    currency: quoteCurrency,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  }).format(quotePrice ?? 0)
                : '—'}
            </Typography>
          )}
        </div>

        {/* Remove Button */}
        <div className="col-span-2 flex h-9 items-center justify-end sm:col-span-2 md:col-span-1">
          <Button
            type="button"
            size="sm"
            shape="circle"
            variant="ghost"
            onClick={onRemove}
          >
            <ButtonContent>
              <Icon icon={IconTrash} colorRole="muted" />
            </ButtonContent>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LineItemRow;
