'use client';

import { IconCameraOff, IconCheck, IconPlus } from '@tabler/icons-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import formatPrice from '@/utils/formatPrice';

import LeadTimeBadge from './LeadTimeBadge';
import ProductDetailsPopover from './ProductDetailsPopover';
import type { Product } from '../controller/productsGetMany';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  displayCurrency?: 'USD' | 'AED';
  isAdding?: boolean;
  showSuccess?: boolean;
}

/**
 * Product card component for catalogue browsing
 *
 * @example
 *   <ProductCard product={product} onAdd={handleAdd} displayCurrency="AED" />
 */
const ProductCard = ({
  product,
  onAdd,
  displayCurrency = 'AED',
  isAdding = false,
  showSuccess: externalShowSuccess = false,
}: ProductCardProps) => {
  const [showSuccess, setShowSuccess] = useState(false);

  // Find offers by source, filtering out $0 prices
  const localOffer = product.productOffers?.find(
    (o) =>
      o.source === 'local_inventory' &&
      (o.inBondPriceUsd ?? o.price ?? 0) > 0,
  );
  const cultxOffer = product.productOffers?.find(
    (o) =>
      o.source === 'cultx' && (o.inBondPriceUsd ?? o.price ?? 0) > 0,
  );

  // Primary offer: prefer local inventory, fall back to cultx
  const offer = localOffer ?? cultxOffer ?? product.productOffers?.[0];

  // Calculate prices for both sources (only if > 0)
  const localPrice = localOffer
    ? (localOffer.inBondPriceUsd ?? localOffer.price ?? 0)
    : 0;
  const cultxPrice = cultxOffer
    ? (cultxOffer.inBondPriceUsd ?? cultxOffer.price ?? 0)
    : 0;

  // Use In-Bond UAE price from pricing model (falls back to raw price if not available)
  const price = offer?.inBondPriceUsd ?? offer?.price ?? 0;
  const displayPrice = displayCurrency === 'AED' ? price * 3.67 : price;
  const displayLocalPrice =
    displayCurrency === 'AED' ? localPrice * 3.67 : localPrice;
  const displayCultxPrice =
    displayCurrency === 'AED' ? cultxPrice * 3.67 : cultxPrice;

  // Handle external success state
  useEffect(() => {
    if (externalShowSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [externalShowSuccess]);

  const handleAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent default behavior and stop propagation to avoid scroll jump
    e.preventDefault();
    e.stopPropagation();
    onAdd(product);
  };

  return (
    <ProductDetailsPopover product={product}>
      <Card className={`group relative flex h-full flex-col overflow-hidden shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-lg hover:-translate-y-0.5 ${
        offer?.source === 'local_inventory' ? 'min-h-[240px]' : 'min-h-[320px] sm:min-h-[360px]'
      }`}>
        {/* Product Image - hide for local inventory */}
        {offer?.source !== 'local_inventory' && (
          <div className="bg-surface-muted relative aspect-square w-full overflow-hidden">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-contain p-3 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 sm:p-4 md:p-5"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Icon icon={IconCameraOff} size="lg" colorRole="muted" />
              </div>
            )}
          </div>
        )}

      {/* Product Details */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Name */}
        <Typography
          variant="bodySm"
          className="line-clamp-3 font-semibold leading-tight"
        >
          {product.name}
        </Typography>

        {/* Producer & Region & Vintage */}
        <div className="flex flex-col gap-0.5">
          {product.producer && (
            <Typography variant="bodyXs" className="text-text-muted line-clamp-1">
              {product.producer}
            </Typography>
          )}
          <div className="flex items-center gap-1 text-xs text-text-muted">
            {product.region && (
              <Typography variant="bodyXs" className="text-text-muted line-clamp-1">
                {product.region}
              </Typography>
            )}
            {product.region && product.year !== null && (
              <span className="shrink-0">·</span>
            )}
            {product.year !== null && (
              <Typography variant="bodyXs" className="text-text-muted shrink-0">
                {product.year === 0 ? 'NV' : product.year}
              </Typography>
            )}
          </div>
        </div>

        {/* Unit Info */}
        {offer && (
          <Typography variant="bodyXs" className="text-text-muted">
            {offer.unitCount} × {offer.unitSize}
          </Typography>
        )}

        {/* Lead Time Badge */}
        {offer && (
          <div className="mt-1">
            <LeadTimeBadge source={offer.source} />
          </div>
        )}

        {/* Available Stock */}
        {offer?.availableQuantity !== null && offer?.availableQuantity !== undefined && (
          <Typography variant="bodyXs" className="text-text-muted mt-1">
            {offer.availableQuantity === 0
              ? 'Out of stock'
              : `${offer.availableQuantity} ${offer.availableQuantity === 1 ? 'case' : 'cases'} available`}
          </Typography>
        )}

        {/* Price */}
        <div className="mt-auto pt-2">
          {/* Show both prices if available */}
          {displayLocalPrice > 0 && displayCultxPrice > 0 ? (
            <div className="flex flex-col gap-1">
              {/* Local Stock Price - Primary */}
              <div className="flex items-baseline gap-1.5">
                <Typography variant="bodyMd" className="font-semibold text-green-700">
                  {formatPrice(displayLocalPrice, displayCurrency)}
                </Typography>
                <span className="inline-flex items-center gap-0.5 rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-700">
                  <span className="h-1 w-1 rounded-full bg-green-500" />
                  Local
                </span>
              </div>
              {/* Pre-Order Price - Secondary */}
              <div className="flex items-baseline gap-1.5">
                <Typography variant="bodySm" className="text-text-muted">
                  {formatPrice(displayCultxPrice, displayCurrency)}
                </Typography>
                <span className="text-[10px] text-text-muted">Pre-Order</span>
              </div>
              <Typography variant="bodyXs" className="text-text-muted">
                per case
              </Typography>
            </div>
          ) : (
            <>
              <Typography variant="bodyMd" className="font-semibold">
                {displayPrice > 0
                  ? formatPrice(displayPrice, displayCurrency)
                  : 'Price on request'}
              </Typography>
              {offer && displayPrice > 0 && (
                <Typography variant="bodyXs" className="text-text-muted">
                  per case
                </Typography>
              )}
            </>
          )}
        </div>

        {/* Add Button */}
        <Button
          type="button"
          size="sm"
          onClick={handleAdd}
          isDisabled={isAdding || showSuccess}
          colorRole="primary"
          className="mt-2 h-10 w-full transition-all duration-300 sm:h-auto"
        >
          <ButtonContent iconLeft={showSuccess ? IconCheck : IconPlus}>
            <span className="hidden sm:inline">{showSuccess ? 'Added!' : 'Add to Quote'}</span>
            <span className="sm:hidden">{showSuccess ? 'Added!' : 'Add'}</span>
          </ButtonContent>
        </Button>
      </div>
    </Card>
    </ProductDetailsPopover>
  );
};

export default ProductCard;
