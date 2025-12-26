'use client';

import { IconGripVertical, IconInfoCircle, IconTrash } from '@tabler/icons-react';
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
  maxQuantity?: number;
  isQuoteLoading?: boolean;
  quotePrice?: number;
  perBottlePrice?: number;
  quoteCurrency?: string;
  customerType?: 'b2b' | 'b2c';
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
  maxQuantity = Infinity,
  isQuoteLoading,
  quotePrice,
  perBottlePrice,
  quoteCurrency,
  customerType,
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
    <div
      className={`space-y-2 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-wrap items-start gap-2 lg:grid lg:grid-cols-12 lg:gap-2">
        {/* Drag Handle - Hidden on mobile/tablet */}
        <div
          {...dragHandleProps}
          className="hidden cursor-grab items-center justify-center active:cursor-grabbing lg:col-span-1 lg:flex"
        >
          <Icon icon={IconGripVertical} size="sm" colorRole="muted" />
        </div>

        {/* Product Selector */}
        <div className="min-w-0 w-full lg:col-span-4 lg:w-auto">
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

        {/* Vintage Input - Hidden for placeholder */}
        {!isPlaceholder && (
          <div className="w-20 shrink-0 lg:col-span-1 lg:w-auto">
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

        {/* Quantity Input - Hidden for placeholder */}
        {!isPlaceholder && (
          <div className="flex w-20 shrink-0 flex-col gap-1 lg:col-span-1 lg:w-auto">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Input
                      className="min-w-0 flex-1"
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
            {offer?.availableQuantity !== null && offer?.availableQuantity !== undefined && (
              <Typography
                variant="bodyXs"
                className={`lg:hidden ${
                  localQuantity > offer.availableQuantity
                    ? 'text-text-warning font-medium'
                    : 'text-text-muted'
                }`}
              >
                {offer.availableQuantity === 0
                  ? 'Out of stock'
                  : `${offer.availableQuantity} available`}
              </Typography>
            )}
            {maxQuantity !== Infinity && localQuantity > maxQuantity && offer?.availableQuantity === null && (
              <Typography
                variant="bodyXs"
                className="text-text-warning font-medium lg:hidden"
              >
                {localQuantity} requested, {maxQuantity} available
              </Typography>
            )}
          </div>
        )}

        {/* Pack Size - Hidden for placeholder and on mobile/tablet */}
        {!isPlaceholder && (
          <div className="hidden lg:col-span-1 lg:flex lg:items-center lg:justify-center">
            {offer && (
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium whitespace-nowrap"
              >
                {offer.unitCount}×{offer.unitSize}
              </Typography>
            )}
          </div>
        )}

        {/* Line Price - Hidden for placeholder */}
        {!isPlaceholder && (
          <div className="flex shrink-0 flex-col gap-0.5 lg:col-span-2 lg:w-auto lg:flex-row lg:items-center lg:justify-end lg:gap-0">
            <div className="flex items-center gap-1 lg:hidden">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase leading-none"
              >
                Price
              </Typography>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Icon icon={IconInfoCircle} size="xs" colorRole="muted" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {customerType === 'b2b' ? 'In-Bond UAE' : 'Client Price'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {isQuoteLoading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <Typography variant="bodySm" className="font-medium leading-none">
                {quotePrice !== undefined ? formatPrice(quotePrice, quoteCurrency) : '—'}
              </Typography>
            )}
          </div>
        )}

        {/* Per Bottle Price - Hidden for placeholder */}
        {!isPlaceholder && (
          <div className="flex shrink-0 flex-col gap-0.5 lg:col-span-1 lg:w-auto lg:flex-row lg:items-center lg:justify-end lg:gap-0">
            <div className="flex items-center gap-1 lg:hidden">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase leading-none"
              >
                /Bottle
              </Typography>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Icon icon={IconInfoCircle} size="xs" colorRole="muted" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {customerType === 'b2b' ? 'In-Bond UAE' : 'Client Price'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {isQuoteLoading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <Typography variant="bodySm" className="font-medium leading-none">
                {perBottlePrice !== undefined ? formatPrice(perBottlePrice, quoteCurrency) : '—'}
              </Typography>
            )}
          </div>
        )}

        {/* Remove Button */}
        <div className="flex h-9 shrink-0 items-center justify-end lg:col-span-1 lg:w-auto lg:justify-center">
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

      {/* Alternative Vintages - Hidden for placeholder */}
      {!isPlaceholder && product && (
        <div className="flex items-center gap-2 pl-0 lg:pl-8">
          <AlternativeVintagesPicker
            productId={product.id}
            selectedVintages={alternativeVintages}
            onChange={onAlternativeVintagesChange}
          />
          {alternativeVintages.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {alternativeVintages.map((vintage) => (
                <span
                  key={vintage}
                  className="bg-fill-secondary text-text-secondary rounded-md px-2 py-0.5 text-xs font-medium"
                >
                  {vintage}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LineItemRow;
