'use client';

import type { Product } from '@/app/_products/controller/productsGetMany';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';

interface ProductDetailsTooltipProps {
  product: Product;
  children: React.ReactNode;
}

/**
 * Tooltip component that displays detailed product information on hover
 *
 * @example
 *   <ProductDetailsTooltip product={product}>
 *     <div>Product Name</div>
 *   </ProductDetailsTooltip>
 */
const ProductDetailsTooltip = ({
  product,
  children,
}: ProductDetailsTooltipProps) => {
  const offer = product.productOffers?.[0];

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-2 p-3">
          {/* Product Name */}
          <div>
            <Typography variant="bodySm" className="font-semibold">
              {product.name}
            </Typography>
          </div>

          {/* Producer */}
          {product.producer && (
            <div className="space-y-0.5">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Producer
              </Typography>
              <Typography variant="bodySm">{product.producer}</Typography>
            </div>
          )}

          {/* Region */}
          {product.region && (
            <div className="space-y-0.5">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Region
              </Typography>
              <Typography variant="bodySm">{product.region}</Typography>
            </div>
          )}

          {/* Vintage */}
          {product.year !== null && (
            <div className="space-y-0.5">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Vintage
              </Typography>
              <Typography variant="bodySm">
                {product.year === 0 ? 'NV (Non-Vintage)' : product.year}
              </Typography>
            </div>
          )}

          {/* LWIN18 */}
          {product.lwin18 && (
            <div className="space-y-0.5">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                LWIN18
              </Typography>
              <Typography variant="bodySm" className="font-mono text-xs">
                {product.lwin18}
              </Typography>
            </div>
          )}

          {/* Unit Details */}
          {offer && (
            <div className="space-y-0.5">
              <Typography
                variant="bodyXs"
                className="text-text-muted font-medium uppercase"
              >
                Unit Details
              </Typography>
              <Typography variant="bodySm">
                {offer.unitCount} × {offer.unitSize}
              </Typography>
              {offer.availableQuantity > 0 && (
                <Typography variant="bodyXs" className="text-text-muted">
                  Available: {offer.availableQuantity} cases
                </Typography>
              )}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ProductDetailsTooltip;
