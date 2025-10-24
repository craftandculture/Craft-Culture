'use client';

import { IconCameraOff, IconPlus } from '@tabler/icons-react';
import Image from 'next/image';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import formatPrice from '@/utils/formatPrice';

import type { Product } from '../controller/productsGetMany';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  displayCurrency?: 'USD' | 'AED';
  isAdding?: boolean;
}

/**
 * Product card component for catalog browsing
 *
 * @example
 *   <ProductCard product={product} onAdd={handleAdd} displayCurrency="AED" />
 */
const ProductCard = ({
  product,
  onAdd,
  displayCurrency = 'AED',
  isAdding = false,
}: ProductCardProps) => {
  const offer = product.productOffers?.[0];
  const price = offer?.price ?? 0;
  const displayPrice =
    displayCurrency === 'AED' ? price * 3.67 : price;

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      {/* Product Image */}
      <div className="bg-surface-muted relative aspect-square w-full overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-contain p-4 transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Icon icon={IconCameraOff} size="lg" colorRole="muted" />
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Name */}
        <Typography
          variant="bodySm"
          className="line-clamp-2 font-semibold leading-tight"
        >
          {product.name}
        </Typography>

        {/* Producer & Region & Vintage */}
        <div className="flex flex-col gap-0.5">
          {product.producer && (
            <Typography variant="bodyXs" className="text-text-muted truncate">
              {product.producer}
            </Typography>
          )}
          <div className="flex items-center gap-1 text-xs text-text-muted">
            {product.region && (
              <Typography variant="bodyXs" className="text-text-muted truncate">
                {product.region}
              </Typography>
            )}
            {product.region && product.year !== null && (
              <span>·</span>
            )}
            {product.year !== null && (
              <Typography variant="bodyXs" className="text-text-muted">
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

        {/* Price */}
        <div className="mt-auto pt-2">
          <Typography variant="bodyMd" className="font-semibold">
            {formatPrice(displayPrice, displayCurrency)}
          </Typography>
          {offer && (
            <Typography variant="bodyXs" className="text-text-muted">
              per case
            </Typography>
          )}
        </div>

        {/* Add Button */}
        <Button
          type="button"
          size="sm"
          onClick={() => onAdd(product)}
          isDisabled={isAdding}
          className="mt-2 w-full"
        >
          <ButtonContent iconLeft={IconPlus}>Add to Quote</ButtonContent>
        </Button>
      </div>
    </Card>
  );
};

export default ProductCard;
