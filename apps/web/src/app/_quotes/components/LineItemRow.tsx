'use client';

import { IconTrash } from '@tabler/icons-react';
import React, { ChangeEvent, useEffect, useState } from 'react';

import ProductsCombobox from '@/app/_products/components/ProductsCombobox';
import { Product } from '@/app/_products/controller/productsGetMany';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import Typography from '@/app/_ui/components/Typography/Typography';
import useDebounce from '@/app/_ui/hooks/useDebounce';
import formatPrice from '@/utils/formatPrice';

interface LineItemRowProps {
  vintage?: string;
  product?: Product;
  quantity?: number;
  omitProductIds: string[];
  maxQuantity?: number;
  isQuoteLoading?: boolean;
  quotePrice?: number;
  perBottlePrice?: number;
  quoteCurrency?: string;
  onVintageChange: (vintage: string) => void;
  onProductChange: (product: Product) => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

const LineItemRow = ({
  vintage,
  product,
  quantity,
  omitProductIds,
  maxQuantity = Infinity,
  isQuoteLoading,
  quotePrice,
  perBottlePrice,
  quoteCurrency,
  onVintageChange,
  onProductChange,
  onQuantityChange,
  onRemove,
}: LineItemRowProps) => {
  const [localQuantity, setLocalQuantity] = useState(quantity ?? 1);
  const [debouncedQuantity] = useDebounce(localQuantity, 300);
  const [localVintage, setLocalVintage] = useState(vintage ?? '');
  const [debouncedVintage] = useDebounce(localVintage, 300);

  // Update parent when debounced quantity changes
  useEffect(() => {
    if (debouncedQuantity !== quantity) {
      onQuantityChange(debouncedQuantity);
    }
  }, [debouncedQuantity, quantity, onQuantityChange]);

  // Update parent when debounced vintage changes
  useEffect(() => {
    if (debouncedVintage !== vintage) {
      onVintageChange(debouncedVintage);
    }
  }, [debouncedVintage, vintage, onVintageChange]);

  // Sync local quantity when prop changes (e.g., when product is selected)
  useEffect(() => {
    if (quantity !== undefined) {
      setLocalQuantity(quantity);
    }
  }, [quantity]);

  // Sync local vintage when prop changes
  useEffect(() => {
    if (vintage !== undefined) {
      setLocalVintage(vintage);
    }
  }, [vintage]);

  // Auto-fill vintage from product year when product is selected
  useEffect(() => {
    if (product?.year) {
      setLocalVintage(product.year.toString());
    }
  }, [product]);

  const handleQuantityInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      const clampedValue =
        maxQuantity !== Infinity ? Math.min(value, maxQuantity) : value;
      setLocalQuantity(clampedValue);
    }
  };

  const handleVintageInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalVintage(e.target.value);
  };

  const offer = product?.productOffers?.[0];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 items-start gap-2 md:gap-3">
        {/* Product Selector */}
        <div className="col-span-12 md:col-span-6">
          <ProductsCombobox
            value={product ?? null}
            onSelect={onProductChange}
            placeholder="Select product..."
            omitProductIds={omitProductIds}
          />
        </div>

        {/* Vintage Input */}
        <div className="col-span-4 md:col-span-1">
          <Input
            type="text"
            size="md"
            placeholder="Year"
            value={localVintage}
            onChange={handleVintageInputChange}
            isDisabled={true}
          />
        </div>

        {/* Quantity Input */}
        <div className="col-span-8 flex flex-wrap items-center gap-2 md:col-span-2">
          <Input
            className="min-w-0 grow"
            type="number"
            size="md"
            min={1}
            max={maxQuantity !== Infinity ? maxQuantity : undefined}
            placeholder="Qty"
            value={localQuantity}
            onChange={handleQuantityInputChange}
            isDisabled={!product}
            contentRight={
              maxQuantity !== Infinity ? (
                <Typography
                  variant="bodyXs"
                  className="text-text-muted hidden pr-2.5 font-medium md:inline"
                >
                  {offer?.unitCount} × {offer?.unitSize} (max: {maxQuantity})
                </Typography>
              ) : undefined
            }
          />
        </div>

        {/* Line Price */}
        <div className="col-span-6 flex flex-col justify-center gap-0.5 md:col-span-1 md:h-9 md:flex-row md:items-center md:justify-end md:gap-0">
          <Typography
            variant="bodyXs"
            className="text-text-muted font-medium uppercase leading-none md:hidden"
          >
            Price
          </Typography>
          {isQuoteLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <Typography
              variant="bodySm"
              className="text-xs font-medium leading-none"
            >
              {quotePrice !== undefined
                ? formatPrice(quotePrice, quoteCurrency)
                : '—'}
            </Typography>
          )}
        </div>

        {/* Per Bottle Price */}
        <div className="col-span-6 flex flex-col justify-center gap-0.5 md:col-span-1 md:h-9 md:flex-row md:items-center md:justify-end md:gap-0">
          <Typography
            variant="bodyXs"
            className="text-text-muted font-medium uppercase leading-none md:hidden"
          >
            Per Bottle
          </Typography>
          {isQuoteLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <Typography
              variant="bodySm"
              className="text-xs font-medium leading-none"
            >
              {perBottlePrice !== undefined
                ? formatPrice(perBottlePrice, quoteCurrency)
                : '—'}
            </Typography>
          )}
        </div>

        {/* Remove Button */}
        <div className="col-span-12 flex items-center justify-center md:col-span-1 md:h-9 md:justify-end md:pt-0">
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
