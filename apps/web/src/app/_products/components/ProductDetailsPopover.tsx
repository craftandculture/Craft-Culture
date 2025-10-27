'use client';

import { IconBottle, IconCamera } from '@tabler/icons-react';
import Image from 'next/image';
import { useState } from 'react';

import type { Product } from '@/app/_products/controller/productsGetMany';
import calculatePricePerBottle from '@/app/_products/utils/formatProductInfo';
import formatVintage from '@/app/_products/utils/formatVintage';
import getStockLevel from '@/app/_products/utils/getStockLevel';
import Popover from '@/app/_ui/components/Popover/Popover';
import PopoverContent from '@/app/_ui/components/Popover/PopoverContent';
import PopoverTrigger from '@/app/_ui/components/Popover/PopoverTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import formatPrice from '@/utils/formatPrice';

interface ProductDetailsPopoverProps {
  product: Product;
  children: React.ReactNode;
}

/**
 * Enhanced popover component that displays detailed product information on hover/tap
 *
 * Features:
 * - Larger format with product image
 * - Country information
 * - Price per bottle calculation
 * - Stock level indicator
 * - Responsive design (mobile-friendly)
 *
 * @example
 *   <ProductDetailsPopover product={product}>
 *     <div>Product Card</div>
 *   </ProductDetailsPopover>
 */
const ProductDetailsPopover = ({
  product,
  children,
}: ProductDetailsPopoverProps) => {
  const offer = product.productOffers?.[0];
  const [isOpen, setIsOpen] = useState(false);

  if (!offer) {
    return <>{children}</>;
  }

  const pricePerBottle = calculatePricePerBottle(offer.price, offer.unitCount);
  const stockInfo = getStockLevel(offer.availableQuantity);
  const vintageDisplay = formatVintage(product.year);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        asChild
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-[90vw] max-w-2xl p-0 sm:w-auto"
        align="start"
        side="right"
        sideOffset={8}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-6">
          {/* Left Column - Product Image (hidden on mobile) */}
          <div className="bg-surface-muted hidden shrink-0 overflow-hidden rounded-lg sm:block sm:h-64 sm:w-48">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={192}
                height={256}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="from-surface-secondary to-surface-tertiary flex h-full w-full items-center justify-center bg-gradient-to-br">
                <IconCamera className="text-text-muted h-16 w-16" strokeWidth={1.5} />
              </div>
            )}
          </div>

          {/* Right Column - Product Details */}
          <div className="flex flex-1 flex-col gap-4">
            {/* Product Name & Producer */}
            <div className="space-y-1">
              <Typography
                variant="bodyLg"
                className="text-text-primary font-semibold leading-tight"
              >
                {product.name}
              </Typography>
              {product.producer && (
                <Typography variant="bodySm" className="text-text-secondary">
                  {product.producer}
                </Typography>
              )}
            </div>

            {/* Badges Row - Country, Vintage, Region */}
            <div className="flex flex-wrap gap-2">
              {product.country && (
                <span className="bg-surface-secondary text-text-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
                  {product.country}
                </span>
              )}
              <span className="bg-surface-secondary text-text-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
                {vintageDisplay}
              </span>
              {product.region && (
                <span className="bg-surface-secondary text-text-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
                  {product.region}
                </span>
              )}
            </div>

            {/* Divider */}
            <div className="border-border-muted border-t" />

            {/* Unit Info & Stock */}
            <div className="space-y-3">
              {/* Unit Details */}
              <div className="flex items-center gap-2">
                <IconBottle className="text-text-muted h-4 w-4" />
                <Typography variant="bodySm" className="text-text-primary font-medium">
                  {offer.unitCount} × {offer.unitSize}
                </Typography>
              </div>

              {/* Stock Availability */}
              {offer.availableQuantity > 0 && (
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      stockInfo.level === 'high'
                        ? 'bg-green-500'
                        : stockInfo.level === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                  />
                  <Typography variant="bodySm" className={stockInfo.colorClass}>
                    {stockInfo.label}
                  </Typography>
                </div>
              )}
            </div>

            {/* Price Section */}
            <div className="bg-surface-muted space-y-1.5 rounded-lg p-3">
              <div className="flex items-baseline justify-between">
                <Typography
                  variant="bodyXs"
                  className="text-text-muted font-medium uppercase tracking-wide"
                >
                  Price per case
                </Typography>
                <Typography
                  variant="bodyLg"
                  className="text-text-primary font-semibold"
                >
                  {formatPrice(offer.price)}
                </Typography>
              </div>
              <div className="flex items-baseline justify-between">
                <Typography variant="bodyXs" className="text-text-muted">
                  Price per bottle
                </Typography>
                <Typography variant="bodySm" className="text-text-secondary">
                  {formatPrice(pricePerBottle)}
                </Typography>
              </div>
            </div>

            {/* LWIN18 Footer */}
            {product.lwin18 && (
              <div className="border-border-muted border-t pt-3">
                <Typography
                  variant="bodyXs"
                  className="text-text-tertiary font-mono"
                >
                  LWIN18: {product.lwin18}
                </Typography>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ProductDetailsPopover;
