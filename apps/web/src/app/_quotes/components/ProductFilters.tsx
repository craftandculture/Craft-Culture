'use client';

import { IconChevronDown, IconFilter, IconInfoCircle, IconSearch, IconX } from '@tabler/icons-react';
import { useQueryStates } from 'nuqs';
import { useMemo, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';

import quotesSearchParams from '../search-params/filtersSearchParams';

interface ProductFiltersProps {
  countriesWithCounts: Array<{ value: string; count: number }>;
  regionsByCountryWithCounts: Record<
    string,
    Array<{ value: string; count: number }>
  >;
  producersByCountryWithCounts: Record<
    string,
    Array<{ value: string; count: number; regions: string[] }>
  >;
  vintagesByCountryWithCounts: Record<
    string,
    Array<{ value: number; count: number }>
  >;
  isLoadingVintages?: boolean;
}

/**
 * Product filtering component for quotes page with cascading filters and item counts
 *
 * @example
 *   <ProductFilters
 *     countriesWithCounts={[{ value: 'France', count: 100 }]}
 *     regionsByCountryWithCounts={{ France: [{ value: 'Bordeaux', count: 50 }] }}
 *     producersByCountryWithCounts={{ France: [{ value: 'Château', count: 25 }] }}
 *     vintagesByCountryWithCounts={{ France: [{ value: 2015, count: 10 }] }}
 *   />
 */
const ProductFilters = ({
  countriesWithCounts,
  regionsByCountryWithCounts,
  producersByCountryWithCounts,
  vintagesByCountryWithCounts,
  isLoadingVintages = false,
}: ProductFiltersProps) => {
  const [filters, setFilters] = useQueryStates(quotesSearchParams, {
    shallow: true,
    scroll: false,
    history: 'replace',
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [regionSearch, setRegionSearch] = useState('');
  const [producerSearch, setProducerSearch] = useState('');
  const [vintageSearch, setVintageSearch] = useState('');

  const hasActiveFilters =
    filters.countries.length > 0 ||
    filters.regions.length > 0 ||
    filters.producers.length > 0 ||
    filters.vintages.length > 0;

  const activeFilterCount =
    filters.countries.length +
    filters.regions.length +
    filters.producers.length +
    filters.producers.length +
    filters.vintages.length;

  const handleCountryToggle = (country: string) => {
    const isRemoving = filters.countries.includes(country);
    const newCountries = isRemoving
      ? filters.countries.filter((c) => c !== country)
      : [...filters.countries, country];

    // When removing a country, also remove regions/producers/vintages from that country
    if (isRemoving) {
      const countryRegions = (regionsByCountryWithCounts[country] ?? []).map((r) => r.value);
      const countryProducers = (producersByCountryWithCounts[country] ?? []).map((p) => p.value);
      const countryVintages = (vintagesByCountryWithCounts[country] ?? []).map((v) => v.value);

      void setFilters({
        countries: newCountries,
        regions: filters.regions.filter((r) => !countryRegions.includes(r)),
        producers: filters.producers.filter((p) => !countryProducers.includes(p)),
        vintages: filters.vintages.filter((v) => !countryVintages.includes(v)),
      });
    } else {
      void setFilters({ countries: newCountries });
    }
  };

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
      countries: [],
      regions: [],
      producers: [],
      vintages: [],
    });
  };

  // Filtered lists based on search with counts
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countriesWithCounts;
    const search = countrySearch.toLowerCase();
    return countriesWithCounts.filter(({ value }) =>
      value.toLowerCase().includes(search),
    );
  }, [countriesWithCounts, countrySearch]);

  // Get available regions based on selected countries (cascading filter) with counts
  const availableRegions = useMemo(() => {
    if (filters.countries.length === 0) {
      // No countries selected - show all regions
      return Object.values(regionsByCountryWithCounts).flat();
    }
    // Show only regions from selected countries
    return filters.countries.flatMap((country) => regionsByCountryWithCounts[country] ?? []);
  }, [filters.countries, regionsByCountryWithCounts]);

  const filteredRegions = useMemo(() => {
    if (!regionSearch.trim()) return availableRegions;
    const search = regionSearch.toLowerCase();
    return availableRegions.filter(({ value }) =>
      value.toLowerCase().includes(search),
    );
  }, [availableRegions, regionSearch]);

  // Get available producers based on selected countries and regions (cascading filter) with counts
  const availableProducers = useMemo(() => {
    let producers: Array<{ value: string; count: number; regions: string[] }> =
      [];

    if (filters.countries.length === 0) {
      // No countries selected - show all producers
      producers = Object.values(producersByCountryWithCounts).flat();
    } else {
      // Show only producers from selected countries
      producers = filters.countries.flatMap(
        (country) => producersByCountryWithCounts[country] ?? [],
      );
    }

    // Further filter by selected regions if any
    if (filters.regions.length > 0) {
      producers = producers.filter((producer) =>
        producer.regions.some((region) => filters.regions.includes(region)),
      );
    }

    return producers;
  }, [filters.countries, filters.regions, producersByCountryWithCounts]);

  const filteredProducers = useMemo(() => {
    if (!producerSearch.trim()) return availableProducers;
    const search = producerSearch.toLowerCase();
    return availableProducers.filter(({ value }) =>
      value.toLowerCase().includes(search),
    );
  }, [availableProducers, producerSearch]);

  // Get available vintages - server already filters based on all selected filters
  const availableVintages = useMemo(() => {
    // Server-side filtering handles countries, regions, and producers
    // Just flatten all vintages returned from the server
    return Object.values(vintagesByCountryWithCounts).flat();
  }, [vintagesByCountryWithCounts]);

  const filteredVintages = useMemo(() => {
    if (!vintageSearch.trim()) return availableVintages;
    const search = vintageSearch.toLowerCase();
    return availableVintages.filter(({ value }) =>
      (value === 0 ? 'nv' : value.toString()).includes(search),
    );
  }, [availableVintages, vintageSearch]);

  return (
    <div className="space-y-2">
      {/* Filter Header */}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="gap-2"
            >
              <Icon icon={IconFilter} size="sm" />
              <span className="text-xs font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fill-accent px-1.5 text-xs font-semibold text-text-primary">
                  {activeFilterCount}
                </span>
              )}
              <Icon
                icon={IconChevronDown}
                size="sm"
                className={`transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex cursor-help">
                    <Icon
                      icon={IconInfoCircle}
                      size="sm"
                      colorRole="muted"
                      className="h-4 w-4"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <Typography variant="bodyXs">
                    Cascading filters: Select countries first to filter regions, producers & vintages
                  </Typography>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="sm:hidden"
            >
              <Icon icon={IconX} size="sm" />
              <span className="text-xs">Clear</span>
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="hidden sm:flex"
          >
            <Icon icon={IconX} size="sm" />
            <span className="text-xs">Clear</span>
          </Button>
        )}
      </div>

      {/* Filter Options */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded
            ? 'max-h-[800px] opacity-100 md:max-h-[600px]'
            : 'max-h-0 opacity-0'
        }`}
      >
        <div className="grid gap-3 rounded-lg border border-border-muted bg-background-primary p-3 shadow-sm md:grid-cols-2 md:gap-2.5 md:p-2.5 xl:grid-cols-4">
          {/* Country Filter */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Typography
                variant="bodyXs"
                className="font-semibold uppercase tracking-wide text-text-muted"
              >
                Country
              </Typography>
              <Typography
                variant="bodyXs"
                className="text-text-muted"
              >
                ({filteredCountries.length})
              </Typography>
            </div>
            {countriesWithCounts.length > 5 && (
              <div className="relative">
                <Icon
                  icon={IconSearch}
                  size="sm"
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                  colorRole="muted"
                />
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search..."
                  className="h-10 w-full rounded-md border border-border-muted bg-background-primary pl-8 pr-2.5 text-xs transition-colors placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-fill-accent md:h-8"
                />
              </div>
            )}
            <div className="max-h-[280px] space-y-0.5 overflow-y-auto rounded-md md:max-h-[240px]">
              {filteredCountries.length === 0 ? (
                <Typography variant="bodyXs" className="px-2 py-3 text-center text-text-muted">
                  {countrySearch.trim()
                    ? 'No matches'
                    : 'None available'}
                </Typography>
              ) : (
                filteredCountries.map(({ value: country, count }) => (
                  <label
                    key={country}
                    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-2 transition-colors hover:bg-fill-muted active:bg-fill-muted md:gap-2 md:py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={filters.countries.includes(country)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleCountryToggle(country);
                      }}
                      className="size-4 rounded border-border-muted text-fill-accent transition-colors focus:ring-1 focus:ring-fill-accent focus:ring-offset-1 md:size-3.5"
                    />
                    <Typography variant="bodyXs" className="flex-1">
                      {country}
                    </Typography>
                    <Typography variant="bodyXs" className="text-text-muted">
                      ({count})
                    </Typography>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Region Filter */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Typography
                variant="bodyXs"
                className="font-semibold uppercase tracking-wide text-text-muted"
              >
                Region
              </Typography>
              <Typography
                variant="bodyXs"
                className="text-text-muted"
              >
                ({filteredRegions.length})
              </Typography>
            </div>
            {Object.values(regionsByCountryWithCounts).flat().length > 5 && (
              <div className="relative">
                <Icon
                  icon={IconSearch}
                  size="sm"
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                  colorRole="muted"
                />
                <input
                  type="text"
                  value={regionSearch}
                  onChange={(e) => setRegionSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-10 w-full rounded-md border border-border-muted bg-background-primary pl-8 pr-2.5 text-xs transition-colors placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-fill-accent md:h-8"
                />
              </div>
            )}
            <div className="max-h-[280px] space-y-0.5 overflow-y-auto rounded-md md:max-h-[240px]">
              {filteredRegions.length === 0 ? (
                <Typography variant="bodyXs" className="px-2 py-3 text-center text-text-muted">
                  {regionSearch.trim()
                    ? 'No matches'
                    : 'None available'}
                </Typography>
              ) : (
                filteredRegions.map(({ value: region, count }) => (
                  <label
                    key={region}
                    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-2 transition-colors hover:bg-fill-muted active:bg-fill-muted md:gap-2 md:py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={filters.regions.includes(region)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleRegionToggle(region);
                      }}
                      className="size-4 rounded border-border-muted text-fill-accent transition-colors focus:ring-1 focus:ring-fill-accent focus:ring-offset-1 md:size-3.5"
                    />
                    <Typography variant="bodyXs" className="flex-1">
                      {region}
                    </Typography>
                    <Typography variant="bodyXs" className="text-text-muted">
                      ({count})
                    </Typography>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Producer Filter */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Typography
                variant="bodyXs"
                className="font-semibold uppercase tracking-wide text-text-muted"
              >
                Producer
              </Typography>
              <Typography
                variant="bodyXs"
                className="text-text-muted"
              >
                ({filteredProducers.length})
              </Typography>
            </div>
            {Object.values(producersByCountryWithCounts).flat().length > 5 && (
              <div className="relative">
                <Icon
                  icon={IconSearch}
                  size="sm"
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                  colorRole="muted"
                />
                <input
                  type="text"
                  value={producerSearch}
                  onChange={(e) => setProducerSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-10 w-full rounded-md border border-border-muted bg-background-primary pl-8 pr-2.5 text-xs transition-colors placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-fill-accent md:h-8"
                />
              </div>
            )}
            <div className="max-h-[280px] space-y-0.5 overflow-y-auto rounded-md md:max-h-[240px]">
              {filteredProducers.length === 0 ? (
                <Typography variant="bodyXs" className="px-2 py-3 text-center text-text-muted">
                  {producerSearch.trim()
                    ? 'No matches'
                    : 'None available'}
                </Typography>
              ) : (
                filteredProducers.map(({ value: producer, count }) => (
                  <label
                    key={producer}
                    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-2 transition-colors hover:bg-fill-muted active:bg-fill-muted md:gap-2 md:py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={filters.producers.includes(producer)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleProducerToggle(producer);
                      }}
                      className="size-4 rounded border-border-muted text-fill-accent transition-colors focus:ring-1 focus:ring-fill-accent focus:ring-offset-1 md:size-3.5"
                    />
                    <Typography variant="bodyXs" className="flex-1">
                      {producer}
                    </Typography>
                    <Typography variant="bodyXs" className="text-text-muted">
                      ({count})
                    </Typography>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Vintage Filter */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Typography
                variant="bodyXs"
                className="font-semibold uppercase tracking-wide text-text-muted"
              >
                Vintage
              </Typography>
              <Typography
                variant="bodyXs"
                className="text-text-muted"
              >
                ({filteredVintages.length})
              </Typography>
            </div>
            {Object.values(vintagesByCountryWithCounts).flat().length > 5 && (
              <div className="relative">
                <Icon
                  icon={IconSearch}
                  size="sm"
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                  colorRole="muted"
                />
                <input
                  type="text"
                  value={vintageSearch}
                  onChange={(e) => setVintageSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-10 w-full rounded-md border border-border-muted bg-background-primary pl-8 pr-2.5 text-xs transition-colors placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-fill-accent md:h-8"
                />
              </div>
            )}
            <div className="max-h-[280px] space-y-0.5 overflow-y-auto rounded-md md:max-h-[240px]">
              {filteredVintages.length === 0 ? (
                <Typography variant="bodyXs" className="px-2 py-3 text-center text-text-muted">
                  {vintageSearch.trim()
                    ? 'No matches'
                    : 'None available'}
                </Typography>
              ) : (
                filteredVintages.map(({ value: vintage, count }) => (
                  <label
                    key={vintage}
                    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-2 transition-colors hover:bg-fill-muted active:bg-fill-muted md:gap-2 md:py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={filters.vintages.includes(vintage)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleVintageToggle(vintage);
                      }}
                      disabled={isLoadingVintages}
                      className="size-4 rounded border-border-muted text-fill-accent transition-colors focus:ring-1 focus:ring-fill-accent focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:size-3.5"
                    />
                    <Typography variant="bodyXs" className="flex-1">
                      {vintage === 0 ? 'NV' : vintage}
                    </Typography>
                    <Typography variant="bodyXs" className="text-text-muted">
                      ({count})
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
