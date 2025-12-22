'use client';

import Card from '@/app/_ui/components/Card/Card';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

/**
 * Skeleton loading state for ProductCard
 * Matches the layout and dimensions of the actual ProductCard
 *
 * @example
 *   <ProductCardSkeleton />
 */
const ProductCardSkeleton = () => {
  return (
    <Card className="flex h-full min-h-[320px] flex-col overflow-hidden shadow-sm sm:min-h-[360px]">
      {/* Product Image Skeleton */}
      <div className="bg-surface-muted relative aspect-square w-full overflow-hidden">
        <Skeleton className="h-full w-full rounded-none" />
      </div>

      {/* Product Details Skeleton */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Name */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />

        {/* Producer & Region */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>

        {/* Unit Info */}
        <Skeleton className="h-3 w-20" />

        {/* Lead Time Badge */}
        <Skeleton className="mt-1 h-5 w-16 rounded-md" />

        {/* Price */}
        <div className="mt-auto pt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="mt-1 h-3 w-12" />
        </div>

        {/* Add Button */}
        <Skeleton className="mt-2 h-10 w-full rounded-md" />
      </div>
    </Card>
  );
};

export default ProductCardSkeleton;
