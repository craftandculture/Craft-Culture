'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { IconCameraOff, IconChevronDown } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Command from '@/app/_ui/components/Command/Command';
import CommandEmpty from '@/app/_ui/components/Command/CommandEmpty';
import CommandInput from '@/app/_ui/components/Command/CommandInput';
import CommandItem from '@/app/_ui/components/Command/CommandItem';
import CommandList from '@/app/_ui/components/Command/CommandList';
import Icon from '@/app/_ui/components/Icon/Icon';
import Popover from '@/app/_ui/components/Popover/Popover';
import PopoverContent from '@/app/_ui/components/Popover/PopoverContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useDebounce from '@/app/_ui/hooks/useDebounce';
import useTRPC from '@/lib/trpc/browser';

import ProductPreview from './ProductPreview';
import { Product } from '../controller/productsGetMany';

interface ProductsComboboxProps {
  onSelect: (product: Product) => void;
  value?: Product | null;
  placeholder?: string;
  omitProductIds?: string[];
}

const highlightText = (text: string | number | null, search: string) => {
  if (!text || !search) return text?.toString() || '';

  const textStr = text.toString();
  const searchTerms = search.trim().toLowerCase().split(/\s+/);

  // Create a regex that matches any of the search terms
  const regex = new RegExp(
    `(${searchTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi',
  );

  const parts = textStr.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = searchTerms.some(
          (term) => part.toLowerCase() === term.toLowerCase(),
        );
        return isMatch ? (
          <mark
            key={index}
            className="bg-fill-brand/10 text-text-brand font-semibold"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
};

const ProductsCombobox = ({
  onSelect,
  value,
  placeholder = 'Search products...',
  omitProductIds = [],
}: ProductsComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const listRef = useRef<HTMLDivElement>(null);

  const api = useTRPC();

  // Infinite query with pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
  } = useInfiniteQuery({
    ...api.products.getMany.infiniteQueryOptions({
      limit: 20,
      search: debouncedSearch,
      omitProductIds,
    }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
    initialPageParam: 0,
    // Keep previous data while fetching new results
    placeholderData: (previousData) => previousData,
  });

  const products = data?.pages.flatMap((page) => page.data) ?? [];

  // Only show loading state on initial load (no previous data)
  const isInitialLoading = isLoading && products.length === 0;

  // Use the value directly as it's already the full product
  const selectedProduct = value;

  // Infinite scroll
  const handleScroll = useCallback(() => {
    if (!listRef.current || !hasNextPage || isFetchingNextPage) return;

    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Attach scroll listener
  useEffect(() => {
    const listElement = listRef.current;
    if (listElement) {
      listElement.addEventListener('scroll', handleScroll);
      return () => listElement.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleSelect = (product: Product) => {
    onSelect(product);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button type="button" className="w-full justify-between">
          {selectedProduct ? (
            <ProductPreview
              imageUrl={selectedProduct.imageUrl}
              name={selectedProduct.name}
              unitCount={selectedProduct.productOffers?.[0]?.unitCount}
              unitSize={selectedProduct.productOffers?.[0]?.unitSize}
              className="flex-1"
            />
          ) : (
            <span className="text-text-muted font-normal">{placeholder}</span>
          )}
          <IconChevronDown size={16} className="shrink-0 opacity-50" />
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverContent
        className="min-w-(--radix-popover-trigger-width) max-w-(--radix-popover-content-available-width) p-0"
        sideOffset={8}
        collisionPadding={24}
        align="start"
      >
        <Command
          shouldFilter={false}
          className="max-w-(--radix-popper-trigger-width)"
        >
          <CommandInput
            placeholder="Search by name, producer, region..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList ref={listRef} className="max-h-[300px] overflow-y-auto">
            {isInitialLoading ? (
              <div className="py-6 text-center text-sm">Loading...</div>
            ) : products.length === 0 ? (
              <CommandEmpty>
                {isFetching ? 'Searching...' : 'No products found'}
              </CommandEmpty>
            ) : (
              <>
                {products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => handleSelect(product)}
                    className="flex items-start justify-between gap-2"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-surface-muted relative flex size-12 shrink-0 items-center justify-center rounded-sm">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="size-11 object-contain"
                          />
                        ) : (
                          <Icon icon={IconCameraOff} colorRole="muted" />
                        )}
                      </div>
                      <div className="flex h-full flex-col items-start gap-0.5">
                        <Typography variant="bodySm" className="max-w-md">
                          {highlightText(product.name, debouncedSearch)}
                        </Typography>
                        {(product.producer ||
                          product.region ||
                          product.year) && (
                          <Typography
                            variant="bodyXs"
                            className="text-text-muted"
                          >
                            {product.productOffers?.[0] && (
                              <>
                                {product.productOffers[0].unitCount} ×{' '}
                                {product.productOffers[0].unitSize}
                              </>
                            )}
                            {product.producer && ' · '}
                            {highlightText(product.producer, debouncedSearch)}
                            {product.producer &&
                              (product.region || product.year) &&
                              ' · '}
                            {highlightText(product.region, debouncedSearch)}
                            {product.region && product.year && ' · '}
                            {highlightText(product.year, debouncedSearch)}{' '}
                          </Typography>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
                {isFetchingNextPage && products.length === 0 && (
                  <div className="text-text-muted py-2 text-center text-sm">
                    Loading more...
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ProductsCombobox;
