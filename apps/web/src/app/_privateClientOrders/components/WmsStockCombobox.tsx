'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { IconBox, IconChevronDown } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
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
import useTRPC from '@/lib/trpc/browser';

export interface WmsStockItem {
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  bottleSize: string;
  caseConfig: number | null;
  availableCases: number;
  totalCases: number;
}

interface WmsStockComboboxProps {
  onSelect: (item: WmsStockItem) => void;
  value?: WmsStockItem | null;
  placeholder?: string;
  /** For admin use — specify which partner's stock to browse */
  ownerId?: string;
  omitLwin18s?: string[];
}

/**
 * Searchable combobox for browsing WMS warehouse stock.
 * Uses partner endpoint for wine partners, admin endpoint when ownerId is provided.
 */
const WmsStockCombobox = ({
  onSelect,
  value,
  placeholder = 'Search warehouse stock...',
  ownerId,
  omitLwin18s = [],
}: WmsStockComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const listRef = useRef<HTMLDivElement>(null);

  const api = useTRPC();

  const isDebouncing = search !== debouncedSearch;

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    listRef.current?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search]);

  const normalizedSearch = debouncedSearch.trim();

  // Use admin endpoint when ownerId is provided, partner endpoint otherwise
  const isAdmin = !!ownerId;

  const partnerQuery = useQuery({
    ...api.privateClientOrders.partnerWmsStock.queryOptions({
      search: normalizedSearch.length > 0 ? normalizedSearch : undefined,
      limit: 30,
      offset: 0,
    }),
    enabled: open && !isDebouncing && !isAdmin,
  });

  const adminQuery = useQuery({
    ...api.privateClientOrders.adminWmsStock.queryOptions({
      ownerId: ownerId ?? '',
      search: normalizedSearch.length > 0 ? normalizedSearch : undefined,
      limit: 30,
      offset: 0,
    }),
    enabled: open && !isDebouncing && isAdmin && !!ownerId,
  });

  const queryResult = isAdmin ? adminQuery : partnerQuery;
  const items = (queryResult.data?.data ?? []).filter(
    (item) => !omitLwin18s.includes(item.lwin18),
  ) as WmsStockItem[];

  const isLoading = queryResult.isLoading && items.length === 0;

  const handleSelect = (item: WmsStockItem) => {
    onSelect(item);
    setOpen(false);
    setSearch('');
    setDebouncedSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button type="button" className="w-full justify-between">
          {value ? (
            <div className="flex items-center gap-2 truncate">
              <Icon icon={IconBox} size="sm" colorRole="success" />
              <span className="truncate text-sm">
                {value.productName}
                {value.vintage ? ` ${value.vintage}` : ''}
              </span>
              <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                {value.availableCases} cs
              </span>
            </div>
          ) : (
            <span className="font-normal text-text-muted">{placeholder}</span>
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
            placeholder="Search by name, producer, LWIN..."
            value={search}
            onValueChange={handleSearchChange}
          />
          <CommandList ref={listRef} className="max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <div className="py-6 text-center text-sm">Loading stock...</div>
            ) : items.length === 0 ? (
              <CommandEmpty>
                {isDebouncing || queryResult.isFetching
                  ? 'Searching...'
                  : 'No stock found'}
              </CommandEmpty>
            ) : (
              items.map((item) => (
                <CommandItem
                  key={`${item.lwin18}-${item.caseConfig}`}
                  value={`${item.lwin18}-${item.caseConfig}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <Typography variant="bodySm" className="truncate">
                      {item.productName}
                      {item.vintage ? ` ${item.vintage}` : ''}
                    </Typography>
                    <Typography variant="bodyXs" className="text-text-muted truncate">
                      {item.producer && <span>{item.producer}</span>}
                      {item.producer && item.bottleSize && ' · '}
                      {item.caseConfig && `${item.caseConfig}×${item.bottleSize || '750ml'}`}
                      {' · '}
                      <span className="text-text-muted/60">{item.lwin18}</span>
                    </Typography>
                  </div>
                  <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                    {item.availableCases} cs
                  </span>
                </CommandItem>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default WmsStockCombobox;
