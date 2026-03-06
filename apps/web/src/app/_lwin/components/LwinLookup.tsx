'use client';

/**
 * LWIN Lookup Component
 *
 * Search the Liv-ex LWIN database and build LWIN18 codes.
 * Used when receiving stock without a known LWIN.
 */

import { IconBottle, IconCheck, IconKeyboard, IconLoader2, IconSearch } from '@tabler/icons-react';
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
  const [manualMode, setManualMode] = useState(false);
  const [manualLwin7, setManualLwin7] = useState('');
  const [manualDisplayName, setManualDisplayName] = useState(productName ?? '');
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

  // Build SKU preview for manual mode (supports alphanumeric supplier codes)
  const manualSkuPreview =
    manualMode && manualLwin7.length >= 2
      ? (() => {
          const vintageStr = vintage
            ? String(vintage).padStart(4, '0')
            : '0000';
          const caseSizeStr = String(caseSize).padStart(2, '0');
          const bottleSizeStr = String(bottleSizeMl).padStart(5, '0');
          const lwin18 = `${manualLwin7}-${vintageStr}-${caseSizeStr}-${bottleSizeStr}`;
          const compact = `${manualLwin7}${vintageStr}${caseSizeStr}${bottleSizeStr}`;
          return { lwin18, compact };
        })()
      : null;

  const handleConfirm = () => {
    if (manualMode && manualSkuPreview) {
      onSelect({
        lwin18: manualSkuPreview.lwin18,
        compact: manualSkuPreview.compact,
        displayName: manualDisplayName || 'Custom Product',
        lwin7: manualLwin7,
        vintage,
        caseSize,
        bottleSizeMl,
        producer: null,
        country: null,
        region: null,
        colour: null,
        type: null,
        classification: null,
      });
    } else if (selectedLwin && lwin18Preview) {
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
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setManualMode(false);
            setSelectedLwin(null);
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            !manualMode
              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
              : 'border-border-primary text-text-muted hover:bg-fill-secondary'
          }`}
        >
          <Icon icon={IconSearch} size="sm" />
          Database Search
        </button>
        <button
          type="button"
          onClick={() => {
            setManualMode(true);
            setSelectedLwin(null);
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            manualMode
              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
              : 'border-border-primary text-text-muted hover:bg-fill-secondary'
          }`}
        >
          <Icon icon={IconKeyboard} size="sm" />
          Manual Entry
        </button>
      </div>

      {/* Manual Entry Mode */}
      {manualMode && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Product Code
            </label>
            <input
              type="text"
              value={manualLwin7}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                setManualLwin7(val);
              }}
              placeholder="LWIN or supplier code (e.g. 1831498, W12008024)"
              className="w-full rounded-lg border border-border-primary bg-fill-primary p-2 font-mono uppercase focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <Typography variant="bodyXs" colorRole="muted" className="mt-1">
              Standard LWIN (7 digits) or supplier code (alphanumeric)
            </Typography>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Display Name
            </label>
            <input
              type="text"
              value={manualDisplayName}
              onChange={(e) => setManualDisplayName(e.target.value)}
              placeholder="Product name for this SKU"
              className="w-full rounded-lg border border-border-primary bg-fill-primary p-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>
      )}

      {/* Search Input (database mode only) */}
      {!manualMode && (
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
      )}

      {/* Search Results */}
      {!manualMode &&
        searchResults &&
        searchResults.results.length > 0 &&
        !selectedLwin && (
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

      {!manualMode &&
        searchResults &&
        searchResults.results.length === 0 &&
        debouncedQuery && (
          <div className="space-y-2 py-4 text-center">
            <Typography variant="bodySm" colorRole="muted">
              No wines found for &ldquo;{debouncedQuery}&rdquo;
            </Typography>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setManualMode(true);
                setManualDisplayName(searchQuery);
              }}
            >
              <Icon icon={IconKeyboard} size="sm" />
              Enter LWIN Manually
            </Button>
          </div>
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
      {(selectedLwin || (manualMode && manualLwin7.length >= 2)) && (
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

      {/* LWIN18 Preview (database mode) */}
      {lwin18Preview && !manualMode && (
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

      {/* SKU Preview (manual mode) */}
      {manualSkuPreview && manualMode && (
        <Card className="bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <Typography variant="bodyXs" colorRole="muted">
                Generated SKU
              </Typography>
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                Custom
              </span>
            </div>
            <Typography variant="headingSm" className="font-mono text-amber-700 dark:text-amber-400">
              {manualSkuPreview.lwin18}
            </Typography>
            <Typography variant="bodyXs" className="mt-1 font-mono text-text-muted">
              SKU: {manualSkuPreview.compact}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Confirm Button (database mode) */}
      {selectedLwin && lwin18Preview && !manualMode && (
        <Button variant="primary" className="w-full" onClick={handleConfirm}>
          Use This LWIN
        </Button>
      )}

      {/* Confirm Button (manual mode) */}
      {manualMode && manualSkuPreview && (
        <Button variant="primary" className="w-full" onClick={handleConfirm}>
          Use Custom LWIN
        </Button>
      )}
    </div>
  );
};

export default LwinLookup;
