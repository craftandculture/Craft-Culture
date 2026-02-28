'use client';

/**
 * LWIN Lookup Component
 *
 * Search the Liv-ex LWIN database and build LWIN18 codes.
 * Used when receiving stock without a known LWIN.
 */

import { IconBottle, IconCheck, IconLoader2, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import buildLwin18, { BOTTLE_SIZES, CASE_SIZES } from '../utils/buildLwin18';

export interface LwinLookupResult {
  lwin18: string;
  compact: string;
  displayName: string;
  lwin7: string;
  vintage: number | null;
  caseSize: number;
  bottleSizeMl: number;
  producer: string | null;
  country: string | null;
  region: string | null;
  colour: string | null;
  type: string | null;
  classification: string | null;
}

interface LwinLookupProps {
  onSelect: (result: LwinLookupResult) => void;
  productName?: string;
  defaultVintage?: number;
  defaultCaseSize?: number;
  defaultBottleSize?: number;
  disabled?: boolean;
}

const LwinLookup = ({
  onSelect,
  productName,
  defaultVintage,
  defaultCaseSize = 6,
  defaultBottleSize = 750,
}: LwinLookupProps) => {
  const api = useTRPC();

  const [searchQuery, setSearchQuery] = useState(productName ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(productName ?? '');
  const [selectedLwin, setSelectedLwin] = useState<{
    lwin: string;
    displayName: string;
    producerName: string | null;
    country: string | null;
    region: string | null;
    colour: string | null;
    type: string | null;
    classification: string | null;
  } | null>(null);

  // Configuration for LWIN18
  const [vintage, setVintage] = useState<number | null>(defaultVintage ?? null);
  const [caseSize, setCaseSize] = useState(defaultCaseSize);
  const [bottleSizeMl, setBottleSizeMl] = useState(defaultBottleSize);

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Simple debounce
    setTimeout(() => {
      if (value.length >= 2) {
        setDebouncedQuery(value);
      }
    }, 300);
  };

  // Search query
  const { data: searchResults, isLoading } = useQuery({
    ...api.lwin.search.queryOptions({
      query: debouncedQuery,
      limit: 20,
    }),
    enabled: debouncedQuery.length >= 2,
  });

  // Build LWIN18 preview
  const lwin18Preview = selectedLwin
    ? (() => {
        try {
          return buildLwin18({
            lwin7: selectedLwin.lwin,
            vintage,
            caseSize,
            bottleSizeMl,
          });
        } catch {
          return null;
        }
      })()
    : null;

  const handleConfirm = () => {
    if (selectedLwin && lwin18Preview) {
      onSelect({
        lwin18: lwin18Preview.lwin18,
        compact: lwin18Preview.compact,
        displayName: selectedLwin.displayName,
        lwin7: selectedLwin.lwin,
        vintage,
        caseSize,
        bottleSizeMl,
        producer: selectedLwin.producerName,
        country: selectedLwin.country,
        region: selectedLwin.region,
        colour: selectedLwin.colour,
        type: selectedLwin.type,
        classification: selectedLwin.classification,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          Search Wine Database
        </label>
        <div className="relative">
          <Icon
            icon={IconSearch}
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by producer, wine name, region..."
            className="w-full rounded-lg border border-border-primary bg-fill-primary py-2 pl-10 pr-4 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          {isLoading && (
            <Icon
              icon={IconLoader2}
              size="sm"
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-text-muted"
            />
          )}
        </div>
      </div>

      {/* Search Results */}
      {searchResults && searchResults.results.length > 0 && !selectedLwin && (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border-primary bg-fill-secondary p-2">
          {searchResults.results.map((wine) => (
            <button
              key={wine.lwin}
              type="button"
              onClick={() =>
                setSelectedLwin({
                  lwin: wine.lwin,
                  displayName: wine.displayName,
                  producerName: wine.producerName,
                  country: wine.country,
                  region: wine.region,
                  colour: wine.colour ?? null,
                  type: wine.type ?? null,
                  classification: wine.classification ?? null,
                })
              }
              className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-fill-primary"
            >
              <Icon icon={IconBottle} size="sm" className="mt-0.5 text-brand-500" />
              <div className="flex-1">
                <Typography variant="bodySm" className="font-medium">
                  {wine.displayName}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {wine.producerName} · {wine.region}, {wine.country}
                  {wine.classification && ` · ${wine.classification}`}
                </Typography>
                <Typography variant="bodyXs" className="font-mono text-brand-600">
                  LWIN: {wine.lwin}
                </Typography>
              </div>
            </button>
          ))}
        </div>
      )}

      {searchResults && searchResults.results.length === 0 && debouncedQuery && (
        <Typography variant="bodySm" colorRole="muted" className="text-center py-4">
          No wines found for &ldquo;{debouncedQuery}&rdquo;
        </Typography>
      )}

      {/* Selected Wine */}
      {selectedLwin && (
        <Card className="border-brand-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Icon icon={IconCheck} size="sm" className="mt-0.5 text-emerald-600" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    {selectedLwin.displayName}
                  </Typography>
                  <Typography variant="bodyXs" className="font-mono text-brand-600">
                    LWIN7: {selectedLwin.lwin}
                  </Typography>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLwin(null)}
              >
                Change
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration */}
      {selectedLwin && (
        <div className="grid grid-cols-3 gap-4">
          {/* Vintage */}
          <div>
            <label className="mb-1 block text-sm font-medium">Vintage</label>
            <input
              type="number"
              value={vintage ?? ''}
              onChange={(e) =>
                setVintage(e.target.value ? parseInt(e.target.value, 10) : null)
              }
              placeholder="NV"
              min={1900}
              max={2030}
              className="w-full rounded-lg border border-border-primary bg-fill-primary p-2 text-center focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <Typography variant="bodyXs" colorRole="muted" className="mt-1">
              Leave empty for NV
            </Typography>
          </div>

          {/* Case Size */}
          <div>
            <label className="mb-1 block text-sm font-medium">Case Size</label>
            <select
              value={caseSize}
              onChange={(e) => setCaseSize(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-border-primary bg-fill-primary p-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {CASE_SIZES.map((size) => (
                <option key={size.size} value={size.size}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bottle Size */}
          <div>
            <label className="mb-1 block text-sm font-medium">Bottle Size</label>
            <select
              value={bottleSizeMl}
              onChange={(e) => setBottleSizeMl(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-border-primary bg-fill-primary p-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {BOTTLE_SIZES.map((size) => (
                <option key={size.ml} value={size.ml}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* LWIN18 Preview */}
      {lwin18Preview && (
        <Card className="bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="p-4">
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Generated LWIN18
            </Typography>
            <Typography variant="headingSm" className="font-mono text-emerald-700 dark:text-emerald-400">
              {lwin18Preview.lwin18}
            </Typography>
            <Typography variant="bodyXs" className="mt-1 font-mono text-text-muted">
              SKU: {lwin18Preview.compact}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Confirm Button */}
      {selectedLwin && lwin18Preview && (
        <Button variant="primary" className="w-full" onClick={handleConfirm}>
          Use This LWIN
        </Button>
      )}
    </div>
  );
};

export default LwinLookup;
