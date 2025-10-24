'use client';

import { IconChevronDown, IconFilter, IconX } from '@tabler/icons-react';
import { useQueryStates } from 'nuqs';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

import quotesSearchParams from '../search-params/filtersSearchParams';

interface ProductFiltersProps {
  availableRegions: string[];
  availableProducers: string[];
  availableVintages: number[];
}

/**
 * Product filtering component for quotes page
 *
 * @example
 *   <ProductFilters
 *     availableRegions={['Bordeaux', 'Champagne']}
 *     availableProducers={['Dom Perignon']}
 *     availableVintages={[2015, 2016]}
 *   />
 */
const ProductFilters = ({
  availableRegions,
  availableProducers,
  availableVintages,
}: ProductFiltersProps) => {
  const [filters, setFilters] = useQueryStates(quotesSearchParams, {
    shallow: false,
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.regions.length > 0 ||
    filters.producers.length > 0 ||
    filters.vintages.length > 0;

  const activeFilterCount =
    filters.regions.length + filters.producers.length + filters.vintages.length;

  const handleRegionToggle = (region: string) => {
    const newRegions = filters.regions.includes(region)
      ? filters.regions.filter((r) => r !== region)
      : [...filters.regions, region];

    void setFilters({ regions: newRegions });
  };

  const handleProducerToggle = (producer: string) => {
    const newProducers = filters.producers.includes(producer)
      ? filters.producers.filter((p) => p !== producer)
      : [...filters.producers, producer];

    void setFilters({ producers: newProducers });
  };

  const handleVintageToggle = (vintage: number) => {
    const newVintages = filters.vintages.includes(vintage)
      ? filters.vintages.filter((v) => v !== vintage)
      : [...filters.vintages, vintage];

    void setFilters({ vintages: newVintages });
  };

  const handleClearAll = () => {
    void setFilters({
      regions: [],
      producers: [],
      vintages: [],
    });
  };

  return (
    <div className="space-y-3">
      {/* Filter Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between sm:w-auto"
        >
          <ButtonContent iconLeft={IconFilter}>
            <span className="flex items-center gap-2">
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fill-accent px-1.5 text-xs font-semibold text-text-primary">
                  {activeFilterCount}
                </span>
              )}
            </span>
          </ButtonContent>
          <Icon
            icon={IconChevronDown}
            size="sm"
            className={`ml-2 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </Button>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleClearAll}
            className="w-full sm:w-auto"
          >
            <ButtonContent iconLeft={IconX}>Clear All</ButtonContent>
          </Button>
        )}
      </div>

      {/* Filter Options */}
      <div
        className={`grid gap-4 overflow-hidden transition-all duration-300 ${
          isExpanded
            ? 'max-h-[800px] opacity-100'
            : 'max-h-0 opacity-0'
        }`}
      >
        <div className="grid gap-4 rounded-lg border border-border-muted bg-surface-muted p-4 sm:p-6 md:grid-cols-3">
          {/* Region Filter */}
          <div className="space-y-3">
            <Typography
              variant="bodyXs"
              className="font-semibold uppercase tracking-wide text-text-muted"
            >
              Region
            </Typography>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md">
              {availableRegions.length === 0 ? (
                <Typography variant="bodySm" className="px-2 py-4 text-center text-text-muted">
                  No regions available
                </Typography>
              ) : (
                availableRegions.map((region) => (
                  <label
                    key={region}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-fill-muted"
                  >
                    <input
                      type="checkbox"
                      checked={filters.regions.includes(region)}
                      onChange={() => handleRegionToggle(region)}
                      className="size-4 rounded border-border-muted text-fill-accent transition-colors focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
                    />
                    <Typography variant="bodySm" className="flex-1">
                      {region}
                    </Typography>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Producer Filter */}
          <div className="space-y-3">
            <Typography
              variant="bodyXs"
              className="font-semibold uppercase tracking-wide text-text-muted"
            >
              Producer
            </Typography>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md">
              {availableProducers.length === 0 ? (
                <Typography variant="bodySm" className="px-2 py-4 text-center text-text-muted">
                  No producers available
                </Typography>
              ) : (
                availableProducers.map((producer) => (
                  <label
                    key={producer}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-fill-muted"
                  >
                    <input
                      type="checkbox"
                      checked={filters.producers.includes(producer)}
                      onChange={() => handleProducerToggle(producer)}
                      className="size-4 rounded border-border-muted text-fill-accent transition-colors focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
                    />
                    <Typography variant="bodySm" className="flex-1">
                      {producer}
                    </Typography>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Vintage Filter */}
          <div className="space-y-3">
            <Typography
              variant="bodyXs"
              className="font-semibold uppercase tracking-wide text-text-muted"
            >
              Vintage
            </Typography>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md">
              {availableVintages.length === 0 ? (
                <Typography variant="bodySm" className="px-2 py-4 text-center text-text-muted">
                  No vintages available
                </Typography>
              ) : (
                availableVintages.map((vintage) => (
                  <label
                    key={vintage}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-fill-muted"
                  >
                    <input
                      type="checkbox"
                      checked={filters.vintages.includes(vintage)}
                      onChange={() => handleVintageToggle(vintage)}
                      className="size-4 rounded border-border-muted text-fill-accent transition-colors focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
                    />
                    <Typography variant="bodySm" className="flex-1">
                      {vintage === 0 ? 'NV' : vintage}
                    </Typography>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductFilters;
