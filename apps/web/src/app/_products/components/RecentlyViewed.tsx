'use client';

import { IconClock, IconX } from '@tabler/icons-react';
import Image from 'next/image';

import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';

interface RecentlyViewedProduct {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface RecentlyViewedProps {
  products: RecentlyViewedProduct[];
  onProductClick: (productId: string) => void;
  onClear: () => void;
}

/**
 * Display recently viewed products with quick access
 *
 * @example
 *   <RecentlyViewed
 *     products={recentlyViewed}
 *     onProductClick={handleScrollToProduct}
 *     onClear={clearRecentlyViewed}
 *   />
 */
const RecentlyViewed = ({
  products,
  onProductClick,
  onClear,
}: RecentlyViewedProps) => {
  if (products.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border-muted bg-surface-muted/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconClock className="h-4 w-4 text-text-muted" />
          <Typography variant="bodyXs" className="font-medium uppercase tracking-wide text-text-muted">
            Recently Viewed
          </Typography>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-6 px-2 text-text-muted hover:text-text-primary"
        >
          <IconX className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onProductClick(product.id)}
            className="group flex shrink-0 items-center gap-2 rounded-md border border-border-muted bg-surface-primary px-2 py-1.5 transition-all duration-200 hover:border-border-brand hover:shadow-sm"
          >
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-fill-muted">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-contain p-0.5"
                  sizes="32px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
                  ?
                </div>
              )}
            </div>
            <Typography
              variant="bodyXs"
              className="max-w-[120px] truncate text-left group-hover:text-text-brand"
            >
              {product.name}
            </Typography>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RecentlyViewed;
