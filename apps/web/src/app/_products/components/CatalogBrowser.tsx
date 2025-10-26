'use client';

import { IconDownload, IconSearch } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import quotesSearchParams from '@/app/_quotes/search-params/filtersSearchParams';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import ProductCard from './ProductCard';
import type { Product } from '../controller/productsGetMany';

interface CatalogBrowserProps {
  onAddProduct: (product: Product) => void;
  displayCurrency: 'USD' | 'AED';
  omitProductIds?: string[];
  onDownloadInventory?: () => void;
  isDownloadingInventory?: boolean;
}

type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'vintage-asc' | 'vintage-desc';

/**
 * Catalogue browser component with infinite scroll
 *
 * @example
 *   <CatalogBrowser onAddProduct={handleAdd} displayCurrency="AED" />
 */
const CatalogBrowser = ({
  onAddProduct,
  displayCurrency,
  omitProductIds = [],
  onDownloadInventory,
  isDownloadingInventory = false,
}: CatalogBrowserProps) => {
  const api = useTRPC();
  const [catalogSearch, setCatalogSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Get active filters from URL
  const [filters] = useQueryStates(quotesSearchParams);

  // Debounce search
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(catalogSearch);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [catalogSearch]);

  const normalizedSearch = debouncedSearch.trim();

  // Infinite query for products
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    ...api.products.getMany.infiniteQueryOptions({
      limit: 24,
      search: normalizedSearch.length > 0 ? normalizedSearch : undefined,
      omitProductIds,
      countries: filters.countries.length > 0 ? filters.countries : undefined,
      regions: filters.regions.length > 0 ? filters.regions : undefined,
      producers: filters.producers.length > 0 ? filters.producers : undefined,
      vintages: filters.vintages.length > 0 ? filters.vintages : undefined,
      sortBy,
    }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
    initialPageParam: 0,
    placeholderData: (previousData) => previousData,
  });

  const products = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data?.pages],
  );

  const totalCount = data?.pages[0]?.meta.totalCount ?? 0;

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!gridRef.current || !hasNextPage || isFetchingNextPage) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = gridRef.current;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Attach scroll listener
  useEffect(() => {
    const gridElement = gridRef.current;
    if (gridElement) {
      gridElement.addEventListener('scroll', handleScroll);
      return () => gridElement.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleAddProduct = async (product: Product) => {
    setAddingProductId(product.id);
    try {
      await onAddProduct(product);
    } finally {
      setAddingProductId(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <Divider />

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <Typography variant="bodyLg" className="font-semibold">
            Browse Full Inventory
          </Typography>
          <Typography variant="bodyXs" className="text-text-muted">
            {isLoading ? (
              'Loading...'
            ) : (
              <>
                {totalCount} product{totalCount !== 1 ? 's' : ''} available
              </>
            )}
          </Typography>
        </div>
        {onDownloadInventory && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDownloadInventory}
            isDisabled={isDownloadingInventory || totalCount === 0}
            className="w-full sm:w-auto"
          >
            <ButtonContent iconLeft={IconDownload}>
              <span className="text-xs">Download Full Inventory</span>
            </ButtonContent>
          </Button>
        )}
      </div>

      {/* Search and Sort Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1">
          <Icon
            icon={IconSearch}
            size="sm"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            colorRole="muted"
          />
          <input
            type="text"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            placeholder="Search catalogue..."
            className="h-10 w-full rounded-md border border-border-muted bg-background-primary pl-9 pr-3 text-sm transition-colors placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <Typography variant="bodyXs" className="text-text-muted shrink-0">
            Sort by:
          </Typography>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-10 rounded-md border border-border-muted bg-background-primary px-3 text-sm transition-colors focus:border-border-brand focus:outline-none focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="price-asc">Price (Low to High)</option>
            <option value="price-desc">Price (High to Low)</option>
            <option value="vintage-asc">Vintage (Oldest)</option>
            <option value="vintage-desc">Vintage (Newest)</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      <div
        ref={gridRef}
        className="max-h-[600px] overflow-y-auto rounded-lg border border-border-muted bg-background-primary p-3 shadow-sm md:max-h-[800px] md:p-4"
      >
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <Typography variant="bodySm" className="text-text-muted">
              {catalogSearch.trim()
                ? 'No products found matching your search'
                : 'No products available'}
            </Typography>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={handleAddProduct}
                  displayCurrency={displayCurrency}
                  isAdding={addingProductId === product.id}
                />
              ))}
            </div>

            {/* Loading More Indicator */}
            {isFetchingNextPage && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:mt-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-square w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </div>
            )}

            {/* End of results */}
            {!hasNextPage && products.length > 0 && (
              <div className="mt-6 text-center">
                <Typography variant="bodySm" className="text-text-muted">
                  You&apos;ve reached the end of the catalogue
                </Typography>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CatalogBrowser;
