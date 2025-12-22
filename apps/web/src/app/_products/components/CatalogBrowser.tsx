'use client';

import { IconBottle, IconCheck, IconDownload, IconLayoutGrid, IconLayoutList, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import quotesSearchParams from '@/app/_quotes/search-params/filtersSearchParams';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

import LeadTimeBadge from './LeadTimeBadge';
import ProductCard from './ProductCard';
import ProductCardSkeleton from './ProductCardSkeleton';
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
  const [successProductId, setSuccessProductId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const gridRef = useRef<HTMLDivElement>(null);

  // Get active filters from URL
  const [filters, setFilters] = useQueryStates(quotesSearchParams);

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
      source:
        filters.source && filters.source !== ''
          ? (filters.source as 'cultx' | 'local_inventory')
          : undefined,
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

      // Show success state on card
      setSuccessProductId(product.id);
      setTimeout(() => {
        setSuccessProductId(null);
      }, 2000);

      // Show toast with green checkmark
      toast(`${product.name} added to quote`, {
        duration: 3000,
        position: 'bottom-center',
        icon: <IconCheck className="h-5 w-5 text-green-600" />,
      });
    } catch {
      // Show error toast if add fails
      toast.error('Failed to add product', {
        duration: 3000,
        position: 'bottom-center',
      });
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
          <div className="flex items-center gap-2">
            <Typography variant="bodyLg" className="font-semibold">
              Browse Inventory
            </Typography>
            {filters.source === 'local_inventory' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Local Stock
              </span>
            )}
            {filters.source === 'cultx' && (
              <span className="inline-flex items-center rounded-full bg-fill-muted px-2 py-0.5 text-xs font-medium text-text-muted">
                Pre-Order
              </span>
            )}
          </div>
          <Typography variant="bodyXs" className="text-text-muted">
            {isLoading ? (
              'Loading...'
            ) : (
              <>
                {totalCount} product{totalCount !== 1 ? 's' : ''}{' '}
                {filters.source === 'local_inventory'
                  ? 'in stock · Ships 24-48 hrs'
                  : filters.source === 'cultx'
                    ? 'available for pre-order'
                    : 'available'}
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

      {/* Search and Sort Toolbar - Sticky on scroll */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-surface-primary/95 px-4 py-2 backdrop-blur-sm sm:flex-row sm:items-center md:-mx-6 md:px-6">
        {/* Search Input */}
        <div className="relative flex-1">
          <Icon
            icon={IconSearch}
            size="sm"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
            colorRole="muted"
          />
          <input
            type="text"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            placeholder="Search catalogue..."
            className="h-10 w-full rounded-lg border border-border-muted bg-background-primary pl-9 pr-3 text-sm transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-text-muted/60 hover:border-border-primary focus:border-border-brand focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-border-brand/20"
          />
        </div>

        {/* Source Filter Toggle - Prominent button style */}
        <div className="flex items-center gap-1 rounded-lg border border-border-muted bg-fill-muted p-1">
          <button
            type="button"
            onClick={() => void setFilters({ source: 'local_inventory' })}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              filters.source === 'local_inventory'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-text-muted hover:bg-fill-primary/50 hover:text-text-primary'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${filters.source === 'local_inventory' ? 'bg-green-300' : 'bg-green-500'}`} />
            Local Stock
          </button>
          <button
            type="button"
            onClick={() => void setFilters({ source: '' })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              filters.source === '' || !filters.source
                ? 'bg-fill-primary text-text-primary shadow-sm'
                : 'text-text-muted hover:bg-fill-primary/50 hover:text-text-primary'
            }`}
          >
            All Products
          </button>
          <button
            type="button"
            onClick={() => void setFilters({ source: 'cultx' })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              filters.source === 'cultx'
                ? 'bg-fill-primary text-text-primary shadow-sm'
                : 'text-text-muted hover:bg-fill-primary/50 hover:text-text-primary'
            }`}
          >
            Pre-Order
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <Typography variant="bodyXs" className="text-text-muted shrink-0">
            Sort by:
          </Typography>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-10 rounded-lg border border-border-muted bg-background-primary px-3 text-sm transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border-primary focus:border-border-brand focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-border-brand/20"
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="price-asc">Price (Low to High)</option>
            <option value="price-desc">Price (High to Low)</option>
            <option value="vintage-asc">Vintage (Oldest)</option>
            <option value="vintage-desc">Vintage (Newest)</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border-muted bg-fill-muted p-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              viewMode === 'grid'
                ? 'bg-fill-primary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            title="Grid view"
          >
            <IconLayoutGrid size={18} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              viewMode === 'list'
                ? 'bg-fill-primary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            title="List view"
          >
            <IconLayoutList size={18} />
          </button>
        </div>
      </div>

      {/* Product Grid/List */}
      <div
        ref={gridRef}
        className="max-h-[70vh] overflow-y-auto rounded-xl border border-border-muted bg-surface-primary p-3 shadow-sm transition-shadow duration-300 hover:shadow-md md:max-h-[700px] md:p-4 lg:max-h-[900px]"
      >
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-fill-muted p-4">
              {catalogSearch.trim() || filters.countries.length > 0 || filters.regions.length > 0 ? (
                <IconSearch className="h-8 w-8 text-text-muted" />
              ) : (
                <IconBottle className="h-8 w-8 text-text-muted" />
              )}
            </div>
            <div className="space-y-2">
              <Typography variant="bodyMd" className="font-medium">
                {catalogSearch.trim()
                  ? 'No products found'
                  : filters.countries.length > 0 || filters.regions.length > 0
                    ? 'No products match your filters'
                    : 'No products available'}
              </Typography>
              <Typography variant="bodySm" className="text-text-muted max-w-sm">
                {catalogSearch.trim()
                  ? 'Try adjusting your search terms or clearing some filters'
                  : filters.countries.length > 0 || filters.regions.length > 0
                    ? 'Try removing some filters to see more products'
                    : 'Check back soon for new arrivals'}
              </Typography>
            </div>
            {(catalogSearch.trim() || filters.countries.length > 0 || filters.regions.length > 0) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCatalogSearch('');
                  void setFilters({
                    countries: [],
                    regions: [],
                    producers: [],
                    vintages: [],
                    source: '',
                  });
                }}
              >
                <ButtonContent iconLeft={IconX}>
                  Clear all filters
                </ButtonContent>
              </Button>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={handleAddProduct}
                    displayCurrency={displayCurrency}
                    isAdding={addingProductId === product.id}
                    showSuccess={successProductId === product.id}
                  />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border-muted">
                {products.map((product) => {
                  // Find offers by source, filtering out $0 prices
                  const localOffer = product.productOffers?.find(
                    (o) =>
                      o.source === 'local_inventory' &&
                      (o.inBondPriceUsd ?? o.price ?? 0) > 0,
                  );
                  const cultxOffer = product.productOffers?.find(
                    (o) =>
                      o.source === 'cultx' &&
                      (o.inBondPriceUsd ?? o.price ?? 0) > 0,
                  );

                  // Primary offer: prefer local inventory, fall back to cultx
                  const offer =
                    localOffer ?? cultxOffer ?? product.productOffers?.[0];

                  // Calculate prices for both sources
                  const localPrice = localOffer
                    ? (localOffer.inBondPriceUsd ?? localOffer.price ?? 0)
                    : 0;
                  const cultxPrice = cultxOffer
                    ? (cultxOffer.inBondPriceUsd ?? cultxOffer.price ?? 0)
                    : 0;

                  const price = offer?.inBondPriceUsd ?? offer?.price ?? 0;
                  const displayPrice =
                    displayCurrency === 'AED' ? price * 3.67 : price;
                  const displayLocalPrice =
                    displayCurrency === 'AED' ? localPrice * 3.67 : localPrice;
                  const displayCultxPrice =
                    displayCurrency === 'AED' ? cultxPrice * 3.67 : cultxPrice;
                  const hasBothPrices =
                    displayLocalPrice > 0 && displayCultxPrice > 0;

                  return (
                    <div
                      key={product.id}
                      className="bg-surface-primary px-3 py-3 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-surface-muted md:px-4"
                    >
                      {/* Mobile: Stack vertically */}
                      <div className="flex flex-col gap-2 md:hidden">
                        {/* Top row: Name and Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Typography variant="bodySm" className="font-medium leading-tight break-words">
                              {product.name}
                            </Typography>
                          </div>
                          {offer && (
                            <div className="shrink-0">
                              <LeadTimeBadge source={offer.source} />
                            </div>
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                          {product.region && <span>{product.region}</span>}
                          {product.year !== null && (
                            <span>{product.year === 0 ? 'NV' : product.year}</span>
                          )}
                          {offer && (
                            <span>
                              {offer.unitCount} × {offer.unitSize}
                            </span>
                          )}
                          {offer?.availableQuantity !== null && offer?.availableQuantity !== undefined && (
                            <span className="font-medium">
                              • {offer.availableQuantity === 0
                                ? 'Out of stock'
                                : `${offer.availableQuantity} available`}
                            </span>
                          )}
                        </div>

                        {/* Bottom row: Price and Button */}
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            {hasBothPrices ? (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-baseline gap-1">
                                  <span className="font-semibold text-sm text-green-700">
                                    {formatPrice(displayLocalPrice, displayCurrency)}
                                  </span>
                                  <span className="text-[9px] font-medium text-green-700">Local</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-xs text-text-muted">
                                    {formatPrice(displayCultxPrice, displayCurrency)}
                                  </span>
                                  <span className="text-[9px] text-text-muted">Pre-Order</span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="font-semibold text-sm">
                                  {displayPrice > 0
                                    ? formatPrice(displayPrice, displayCurrency)
                                    : 'Price on request'}
                                </div>
                                {displayPrice > 0 && (
                                  <div className="text-xs text-text-muted">per case</div>
                                )}
                              </>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleAddProduct(product)}
                            isDisabled={addingProductId === product.id || successProductId === product.id}
                            colorRole="primary"
                            className="shrink-0 h-8 min-w-[70px]"
                          >
                            <ButtonContent iconLeft={successProductId === product.id ? IconCheck : IconPlus}>
                              <span className="text-xs">{successProductId === product.id ? 'Added!' : 'Add'}</span>
                            </ButtonContent>
                          </Button>
                        </div>
                      </div>

                      {/* Desktop/Tablet: Horizontal layout */}
                      <div className="hidden md:flex md:items-start md:gap-4">
                        {/* Product Info */}
                        <div className="flex-1">
                          <Typography variant="bodySm" className="font-medium leading-tight break-words">
                            {product.name}
                          </Typography>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-text-muted">
                            {product.region && <span>{product.region}</span>}
                            {product.year !== null && (
                              <span>{product.year === 0 ? 'NV' : product.year}</span>
                            )}
                            {offer && (
                              <span>
                                {offer.unitCount} × {offer.unitSize}
                              </span>
                            )}
                            {offer?.availableQuantity !== null && offer?.availableQuantity !== undefined && (
                              <span className="font-medium">
                                • {offer.availableQuantity === 0
                                  ? 'Out of stock'
                                  : `${offer.availableQuantity} available`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stock Badge */}
                        {offer && (
                          <div className="shrink-0">
                            <LeadTimeBadge source={offer.source} />
                          </div>
                        )}

                        {/* Price */}
                        <div className="shrink-0 text-right min-w-[120px]">
                          {hasBothPrices ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-baseline justify-end gap-1">
                                <span className="font-semibold text-sm text-green-700">
                                  {formatPrice(displayLocalPrice, displayCurrency)}
                                </span>
                                <span className="text-[9px] font-medium text-green-700">Local</span>
                              </div>
                              <div className="flex items-baseline justify-end gap-1">
                                <span className="text-xs text-text-muted">
                                  {formatPrice(displayCultxPrice, displayCurrency)}
                                </span>
                                <span className="text-[9px] text-text-muted">Pre-Order</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="font-semibold text-sm leading-tight">
                                {displayPrice > 0
                                  ? formatPrice(displayPrice, displayCurrency)
                                  : 'Price on request'}
                              </div>
                              {displayPrice > 0 && (
                                <div className="text-xs text-text-muted">per case</div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Add Button */}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAddProduct(product)}
                          isDisabled={addingProductId === product.id || successProductId === product.id}
                          colorRole="primary"
                          className="shrink-0 h-8 min-w-[70px]"
                        >
                          <ButtonContent iconLeft={successProductId === product.id ? IconCheck : IconPlus}>
                            <span className="text-xs">{successProductId === product.id ? 'Added!' : 'Add'}</span>
                          </ButtonContent>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Loading More Indicator */}
            {isFetchingNextPage && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:mt-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
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
