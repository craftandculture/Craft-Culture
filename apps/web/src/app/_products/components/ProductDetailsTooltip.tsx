'use client';

import { format } from 'date-fns';

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
        <TooltipContent className="max-w-sm space-y-3 p-4 landscape:max-w-md">
          {/* Product Name */}
          <div className="border-b border-border-muted pb-2">
            <Typography variant="bodyMd" className="font-semibold leading-tight">
              {product.name}
            </Typography>
          </div>

          <div className="space-y-2.5">
            {/* Producer */}
            {product.producer && (
              <div className="space-y-1">
                <Typography
                  variant="bodyXs"
                  className="text-text-muted text-xs font-medium uppercase tracking-wide"
                >
                  Producer
                </Typography>
                <Typography variant="bodySm" className="text-text-primary">
                  {product.producer}
                </Typography>
              </div>
            )}

            {/* Region & Vintage - Combined on one line if both exist */}
            {(product.region || product.year !== null) && (
              <div className="grid grid-cols-2 gap-3">
                {product.region && (
                  <div className="space-y-1">
                    <Typography
                      variant="bodyXs"
                      className="text-text-muted text-xs font-medium uppercase tracking-wide"
                    >
                      Region
                    </Typography>
                    <Typography variant="bodySm" className="text-text-primary">
                      {product.region}
                    </Typography>
                  </div>
                )}

                {product.year !== null && (
                  <div className="space-y-1">
                    <Typography
                      variant="bodyXs"
                      className="text-text-muted text-xs font-medium uppercase tracking-wide"
                    >
                      Vintage
                    </Typography>
                    <Typography variant="bodySm" className="text-text-primary">
                      {product.year === 0 ? 'NV' : product.year}
                    </Typography>
                  </div>
                )}
              </div>
            )}

            {/* LWIN18 */}
            {product.lwin18 && (
              <div className="space-y-1">
                <Typography
                  variant="bodyXs"
                  className="text-text-muted text-xs font-medium uppercase tracking-wide"
                >
                  LWIN18
                </Typography>
                <Typography variant="bodyXs" className="text-text-primary font-mono">
                  {product.lwin18}
                </Typography>
              </div>
            )}

            {/* Unit Details */}
            {offer && (
              <div className="space-y-1 rounded-md bg-surface-muted p-2.5">
                <Typography
                  variant="bodyXs"
                  className="text-text-muted text-xs font-medium uppercase tracking-wide"
                >
                  Unit Details
                </Typography>
                <Typography variant="bodySm" className="text-text-primary font-medium">
                  {offer.unitCount} × {offer.unitSize}
                </Typography>
                {offer.availableQuantity > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          <Typography variant="bodyXs" className="text-text-muted">
                            {offer.availableQuantity} {offer.availableQuantity === 1 ? 'case' : 'cases'} available
                          </Typography>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <Typography variant="bodyXs">
                          Last updated: {product.updatedAt ? format(new Date(product.updatedAt), 'MMM d, yyyy HH:mm') : 'Unknown'}
                        </Typography>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ProductDetailsTooltip;
