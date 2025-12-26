'use client';

import { IconGripVertical, IconTrash } from '@tabler/icons-react';
import React, { ChangeEvent, useEffect, useState } from 'react';

import ProductDetailsTooltip from '@/app/_products/components/ProductDetailsTooltip';
import ProductsCombobox from '@/app/_products/components/ProductsCombobox';
import { Product } from '@/app/_products/controller/productsGetMany';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import useDebounce from '@/app/_ui/hooks/useDebounce';
import formatPrice from '@/utils/formatPrice';

import AlternativeVintagesPicker from './AlternativeVintagesPicker';

interface LineItemRowProps {
  vintage?: string;
  product?: Product;
  quantity?: number;
  alternativeVintages?: string[];
  omitProductIds: string[];
  isQuoteLoading?: boolean;
  quotePrice?: number;
  perBottlePrice?: number;
  quoteCurrency?: string;
  onVintageChange: (vintage: string) => void;
  onProductChange: (product: Product) => void;
  onQuantityChange: (quantity: number) => void;
  onAlternativeVintagesChange: (vintages: string[]) => void;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}

const LineItemRow = ({
  vintage,
  product,
  quantity,
  alternativeVintages = [],
  omitProductIds,
  isQuoteLoading,
  quotePrice,
  perBottlePrice,
  quoteCurrency,
  onVintageChange,
  onProductChange,
  onQuantityChange,
  onAlternativeVintagesChange,
  onRemove,
  dragHandleProps,
  isDragging = false,
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
    if (!isNaN(value) && value > 0) {
      setLocalQuantity(value);
    }
  };

  const handleVintageInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalVintage(e.target.value);
  };

  const offer = product?.productOffers?.[0];

  const isPlaceholder = !product;

  return (
    <div className={`${isDragging ? 'opacity-50' : ''}`}>
      {/* Mobile/Tablet Layout */}
      <div className="flex flex-wrap items-start gap-2 lg:hidden">
        {/* Product Selector - Full width */}
        <div className="min-w-0 w-full">
          {product ? (
            <ProductDetailsTooltip product={product}>
              <div>
                <ProductsCombobox
                  value={product}
                  onSelect={onProductChange}
                  placeholder="Select product..."
                  omitProductIds={omitProductIds}
                />
              </div>
            </ProductDetailsTooltip>
          ) : (
            <ProductsCombobox
              value={null}
              onSelect={onProductChange}
              placeholder="Select product..."
              omitProductIds={omitProductIds}
            />
          )}
        </div>

        {/* Row 2: Year, Qty, Prices, Delete */}
        {!isPlaceholder && (
          <div className="flex w-full items-center gap-2">
            {/* Year */}
            <div className="w-16 shrink-0">
              <Input
                type="text"
                size="md"
                placeholder="Year"
                value={localVintage}
                onChange={handleVintageInputChange}
                isDisabled={false}
              />
            </div>
            {/* Qty */}
            <div className="w-16 shrink-0">
              <Input
                type="number"
                size="md"
                min={1}
                placeholder="Qty"
                value={localQuantity}
                onChange={handleQuantityInputChange}
                isDisabled={!product}
              />
            </div>
            {/* Price */}
            <div className="flex flex-col items-end">
              <Typography variant="bodyXs" className="text-text-muted uppercase">
                Price
              </Typography>
              {isQuoteLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                <Typography variant="bodySm" className="font-medium">
                  {quotePrice !== undefined ? formatPrice(quotePrice, quoteCurrency) : '—'}
                </Typography>
              )}
            </div>
            {/* Spacer */}
            <div className="flex-1" />
            {/* Alternatives + Delete */}
            {product && (
              <AlternativeVintagesPicker
                productId={product.id}
                selectedVintages={alternativeVintages}
                onChange={onAlternativeVintagesChange}
              />
            )}
            <Button
              type="button"
              size="sm"
              shape="circle"
              variant="ghost"
              onClick={onRemove}
            >
              <ButtonContent>
                <Icon icon={IconTrash} colorRole="muted" size="sm" />
              </ButtonContent>
            </Button>
          </div>
        )}

        {/* Delete for placeholder */}
        {isPlaceholder && (
          <div className="flex w-full justify-end">
            <Button
              type="button"
              size="sm"
              shape="circle"
              variant="ghost"
              onClick={onRemove}
            >
              <ButtonContent>
                <Icon icon={IconTrash} colorRole="muted" size="sm" />
              </ButtonContent>
            </Button>
          </div>
        )}
      </div>

      {/* Desktop Layout - Flex row matching header */}
      <div className="hidden gap-2 lg:flex lg:items-center">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="flex w-6 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
        >
          <Icon icon={IconGripVertical} size="sm" colorRole="muted" />
        </div>

        {/* Product Selector - Takes all available space */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {product ? (
              <ProductDetailsTooltip product={product}>
                <div className="min-w-0 flex-1">
                  <ProductsCombobox
                    value={product}
                    onSelect={onProductChange}
                    placeholder="Select product..."
                    omitProductIds={omitProductIds}
                  />
                </div>
              </ProductDetailsTooltip>
            ) : (
              <div className="min-w-0 flex-1">
                <ProductsCombobox
                  value={null}
                  onSelect={onProductChange}
                  placeholder="Select product..."
                  omitProductIds={omitProductIds}
                />
              </div>
            )}
            {/* Alternatives Icon - Next to reference */}
            {product && (
              <AlternativeVintagesPicker
                productId={product.id}
                selectedVintages={alternativeVintages}
                onChange={onAlternativeVintagesChange}
              />
            )}
          </div>
        </div>

        {/* Vintage Input */}
        {!isPlaceholder && (
          <div className="w-14 shrink-0">
            <Input
              type="text"
              size="md"
              placeholder="Year"
              value={localVintage}
              onChange={handleVintageInputChange}
              isDisabled={false}
            />
          </div>
        )}

        {/* Quantity Input */}
        {!isPlaceholder && (
          <div className="w-14 shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Input
                      type="number"
                      size="md"
                      min={1}
                      placeholder="Qty"
                      value={localQuantity}
                      onChange={handleQuantityInputChange}
                      isDisabled={!product}
                    />
                  </div>
                </TooltipTrigger>
                {offer?.availableQuantity !== null && offer?.availableQuantity !== undefined && (
                  <TooltipContent>
                    {offer.availableQuantity === 0
                      ? 'Out of stock'
                      : `${offer.availableQuantity} ${offer.availableQuantity === 1 ? 'case' : 'cases'} in stock`}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Pack Size */}
        {!isPlaceholder && (
          <div className="flex w-14 shrink-0 items-center justify-center">
            {offer && (
              <Typography
                variant="bodyXs"
                className="text-text-muted/70 whitespace-nowrap"
              >
                {offer.unitCount}×{offer.unitSize}
              </Typography>
            )}
          </div>
        )}

        {/* Line Price */}
        {!isPlaceholder && (
          <div className="flex w-20 shrink-0 items-center justify-end">
            {isQuoteLoading ? (
              <Skeleton className="h-4 w-14" />
            ) : (
              <Typography variant="bodySm" className="font-semibold tabular-nums">
                {quotePrice !== undefined ? formatPrice(quotePrice, quoteCurrency) : '—'}
              </Typography>
            )}
          </div>
        )}

        {/* Per Bottle Price */}
        {!isPlaceholder && (
          <div className="flex w-16 shrink-0 items-center justify-end">
            {isQuoteLoading ? (
              <Skeleton className="h-4 w-12" />
            ) : (
              <Typography variant="bodyXs" className="text-text-muted tabular-nums">
                {perBottlePrice !== undefined ? formatPrice(perBottlePrice, quoteCurrency) : '—'}
              </Typography>
            )}
          </div>
        )}

        {/* Remove Button */}
        <div className="flex w-7 shrink-0 items-center justify-center">
          <Button
            type="button"
            size="sm"
            shape="circle"
            variant="ghost"
            onClick={onRemove}
          >
            <ButtonContent>
              <Icon icon={IconTrash} colorRole="muted" size="sm" />
            </ButtonContent>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LineItemRow;
