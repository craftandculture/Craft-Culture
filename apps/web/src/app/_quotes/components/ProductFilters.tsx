'use client';

import { IconChevronDown, IconFilter, IconInfoCircle, IconSearch, IconX } from '@tabler/icons-react';
import { useQueryStates } from 'nuqs';
import { useMemo, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';

import quotesSearchParams from '../search-params/filtersSearchParams';

interface ProductFiltersProps {
  availableCountries: string[];
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
  availableCountries,
  availableRegions,
  availableProducers,
  availableVintages,
}: ProductFiltersProps) => {
  const [filters, setFilters] = useQueryStates(quotesSearchParams, {
    shallow: false,
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
    filters.vintages.length;

  const handleCountryToggle = (country: string) => {
    const newCountries = filters.countries.includes(country)
      ? filters.countries.filter((c) => c !== country)
      : [...filters.countries, country];

    void setFilters({ countries: newCountries });
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

  // Filtered lists based on search
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return availableCountries;
    const search = countrySearch.toLowerCase();
    return availableCountries.filter((country) =>
      country.toLowerCase().includes(search),
    );
  }, [availableCountries, countrySearch]);

  const filteredRegions = useMemo(() => {
    if (!regionSearch.trim()) return availableRegions;
    const search = regionSearch.toLowerCase();
    return availableRegions.filter((region) =>
      region.toLowerCase().includes(search),
    );
  }, [availableRegions, regionSearch]);

  const filteredProducers = useMemo(() => {
    if (!producerSearch.trim()) return availableProducers;
    const search = producerSearch.toLowerCase();
    return availableProducers.filter((producer) =>
      producer.toLowerCase().includes(search),
    );
  }, [availableProducers, producerSearch]);

  const filteredVintages = useMemo(() => {
    if (!vintageSearch.trim()) return availableVintages;
    const search = vintageSearch.toLowerCase();
    return availableVintages.filter((vintage) =>
      (vintage === 0 ? 'nv' : vintage.toString()).includes(search),
    );
  }, [availableVintages, vintageSearch]);

  return (
    <div className="space-y-3">
      {/* Filter Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full justify-between sm:w-auto"
          >
            <ButtonContent iconLeft={IconFilter}>
              <span className="flex items-center gap-1.5">
                <span className="text-xs">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-fill-accent px-1 text-xs font-semibold text-text-primary">
                    {activeFilterCount}
                  </span>
                )}
              </span>
            </ButtonContent>
            <Icon
              icon={IconChevronDown}
              size="sm"
              className={`ml-1.5 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </Button>
          <div className="flex items-center gap-1.5">
            <Typography variant="bodyXs" className="text-text-muted text-xs">
              Use filters to refine selection
            </Typography>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex cursor-help">
                    <Icon
                      icon={IconInfoCircle}
                      size="sm"
                      colorRole="muted"
                      className="h-3.5 w-3.5"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <Typography variant="bodyXs">
                    Filters apply to Quote Tool & Full catalogue
                  </Typography>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="w-full sm:w-auto"
          >
            <ButtonContent iconLeft={IconX}>
              <span className="text-xs">Clear All</span>
            </ButtonContent>
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
        <div className="grid gap-4 rounded-lg border border-border-muted bg-surface-muted p-3 sm:p-4 md:grid-cols-2 md:p-6 lg:grid-cols-4">
          {/* Country Filter */}
          <div className="space-y-3">
            <Typography
              variant="bodyXs"
              className="font-semibold uppercase tracking-wide text-text-muted"
            >
              Country
            </Typography>
            {availableCountries.length > 5 && (
              <div className="relative">
                <Icon
                  icon={IconSearch}
                  size="sm"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  colorRole="muted"
                />
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search countries..."
                  className="h-9 w-full rounded-md border border-border-muted bg-background-primary pl-9 pr-3 text-sm transition-colors placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
                />
              </div>
            )}
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md">
              {filteredCountries.length === 0 ? (
                <Typography variant="bodySm" className="px-2 py-4 text-center text-text-muted">
                  {countrySearch.trim()
                    ? 'No matching countries'
                    : 'No countries available'}
                </Typography>
              ) : (
                filteredCountries.map((country) => (
                  <label
                    key={country}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-fill-muted"
                  >
                    <input
                      type="checkbox"
                      checked={filters.countries.includes(country)}
                      onChange={() => handleCountryToggle(country)}
                      className="size-4 rounded border-border-muted text-fill-accent transition-colors focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
                    />
                    <Typography variant="bodySm" className="flex-1">
                      {country}
                    </Typography>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Region Filter */}
          <div className="space-y-3">
            <Typography
              variant="bodyXs"
              className="font-semibold uppercase tracking-wide text-text-muted"
            >
              Region
            </Typography>
            {availableRegions.length > 5 && (
              <div className="relative">
                <Icon
                  icon={IconSearch}
                  size="sm"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  colorRole="muted"
                />
                <input
                  type="text"
                  value={regionSearch}
                  onChange={(e) => setRegionSearch(e.target.value)}
                  placeholder="Search regions..."
                  className="h-9 w-full rounded-md border border-border-muted bg-background-primary pl-9 pr-3 text-sm transition-colors placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
                />
              </div>
            )}
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md">
              {filteredRegions.length === 0 ? (
                <Typography variant="bodySm" className="px-2 py-4 text-center text-text-muted">
                  {regionSearch.trim()
                    ? 'No matching regions'
                    : 'No regions available'}
                </Typography>
              ) : (
                filteredRegions.map((region) => (
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
            {availableProducers.length > 5 && (
              <div className="relative">
                <Icon
                  icon={IconSearch}
                  size="sm"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  colorRole="muted"
                />
                <input
                  type="text"
                  value={producerSearch}
                  onChange={(e) => setProducerSearch(e.target.value)}
                  placeholder="Search producers..."
                  className="h-9 w-full rounded-md border border-border-muted bg-background-primary pl-9 pr-3 text-sm transition-colors placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
                />
              </div>
            )}
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md">
              {filteredProducers.length === 0 ? (
                <Typography variant="bodySm" className="px-2 py-4 text-center text-text-muted">
                  {producerSearch.trim()
                    ? 'No matching producers'
                    : 'No producers available'}
                </Typography>
              ) : (
                filteredProducers.map((producer) => (
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
            {availableVintages.length > 5 && (
              <div className="relative">
                <Icon
                  icon={IconSearch}
                  size="sm"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  colorRole="muted"
                />
                <input
                  type="text"
                  value={vintageSearch}
                  onChange={(e) => setVintageSearch(e.target.value)}
                  placeholder="Search vintages..."
                  className="h-9 w-full rounded-md border border-border-muted bg-background-primary pl-9 pr-3 text-sm transition-colors placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-2 focus:ring-fill-accent focus:ring-offset-2"
                />
              </div>
            )}
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md">
              {filteredVintages.length === 0 ? (
                <Typography variant="bodySm" className="px-2 py-4 text-center text-text-muted">
                  {vintageSearch.trim()
                    ? 'No matching vintages'
                    : 'No vintages available'}
                </Typography>
              ) : (
                filteredVintages.map((vintage) => (
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
                    <Typography variant="bodyXs" className="flex-1">
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
