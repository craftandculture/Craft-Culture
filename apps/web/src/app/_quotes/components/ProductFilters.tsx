'use client';

import { IconFilter, IconX } from '@tabler/icons-react';
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
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-text-primary transition-colors hover:text-text-muted"
        >
          <Icon icon={IconFilter} size="sm" colorRole="muted" />
          <Typography variant="bodyMd" className="font-medium">
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fill-accent px-1.5 text-xs font-semibold text-text-primary">
                {activeFilterCount}
              </span>
            )}
          </Typography>
        </button>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-xs"
          >
            <ButtonContent iconLeft={IconX}>Clear All</ButtonContent>
          </Button>
        )}
      </div>

      {/* Filter Options */}
      {isExpanded && (
        <div className="grid gap-4 rounded-lg border border-border-muted bg-surface-muted p-4 md:grid-cols-3">
          {/* Region Filter */}
          <div className="space-y-2">
            <Typography
              variant="bodyXs"
              className="font-medium uppercase text-text-muted"
            >
              Region
            </Typography>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {availableRegions.length === 0 ? (
                <Typography variant="bodySm" className="text-text-muted">
                  No regions available
                </Typography>
              ) : (
                availableRegions.map((region) => (
                  <label
                    key={region}
                    className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors hover:bg-fill-muted"
                  >
                    <input
                      type="checkbox"
                      checked={filters.regions.includes(region)}
                      onChange={() => handleRegionToggle(region)}
                      className="h-4 w-4 rounded border-border-muted text-fill-accent focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
                    />
                    <Typography variant="bodySm">{region}</Typography>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Producer Filter */}
          <div className="space-y-2">
            <Typography
              variant="bodyXs"
              className="font-medium uppercase text-text-muted"
            >
              Producer
            </Typography>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {availableProducers.length === 0 ? (
                <Typography variant="bodySm" className="text-text-muted">
                  No producers available
                </Typography>
              ) : (
                availableProducers.map((producer) => (
                  <label
                    key={producer}
                    className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors hover:bg-fill-muted"
                  >
                    <input
                      type="checkbox"
                      checked={filters.producers.includes(producer)}
                      onChange={() => handleProducerToggle(producer)}
                      className="h-4 w-4 rounded border-border-muted text-fill-accent focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
                    />
                    <Typography variant="bodySm">{producer}</Typography>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Vintage Filter */}
          <div className="space-y-2">
            <Typography
              variant="bodyXs"
              className="font-medium uppercase text-text-muted"
            >
              Vintage
            </Typography>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {availableVintages.length === 0 ? (
                <Typography variant="bodySm" className="text-text-muted">
                  No vintages available
                </Typography>
              ) : (
                availableVintages.map((vintage) => (
                  <label
                    key={vintage}
                    className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors hover:bg-fill-muted"
                  >
                    <input
                      type="checkbox"
                      checked={filters.vintages.includes(vintage)}
                      onChange={() => handleVintageToggle(vintage)}
                      className="h-4 w-4 rounded border-border-muted text-fill-accent focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
                    />
                    <Typography variant="bodySm">
                      {vintage === 0 ? 'NV' : vintage}
                    </Typography>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductFilters;
