'use client';

import {
  IconAlertCircle,
  IconArrowRight,
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconDownload,
  IconLock,
  IconMapPin,
  IconPackage,
  IconRefresh,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTags,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveAccessProfile } from '@/app/_auth/constants/accessProfiles';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import PartnerMovementsPanel from '@/app/_wms/components/PartnerMovementsPanel';
import displayWineName from '@/app/_wms/utils/displayWineName';
import useTRPC from '@/lib/trpc/browser';

type SortField = 'productName' | 'totalCases' | 'vintage';
type SortOrder = 'asc' | 'desc';

/** Skeleton loading row */
const SkeletonRow = () => (
  <tr className="border-b border-border-muted">
    {Array.from({ length: 8 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
      </td>
    ))}
  </tr>
);

/** Mobile skeleton card */
const SkeletonCard = () => (
  <div className="rounded-xl border border-border-muted bg-background-primary p-4">
    <div className="mb-3 h-5 w-3/4 animate-pulse rounded bg-surface-muted" />
    <div className="mb-2 h-4 w-1/2 animate-pulse rounded bg-surface-muted" />
    <div className="flex gap-4">
      <div className="h-10 flex-1 animate-pulse rounded-lg bg-surface-muted" />
      <div className="h-10 flex-1 animate-pulse rounded-lg bg-surface-muted" />
      <div className="h-10 flex-1 animate-pulse rounded-lg bg-surface-muted" />
    </div>
  </div>
);

/** Status pill for how many cases are left */
const StatusIndicator = ({ cases }: { cases: number }) => {
  const config =
    cases === 0
      ? { label: 'None left', pill: 'bg-surface-muted text-text-muted ring-border-muted', dot: 'bg-border-muted' }
      : cases === 1
        ? { label: 'Last case', pill: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/60', dot: 'bg-red-500' }
        : cases <= 2
          ? { label: 'Low', pill: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60', dot: 'bg-amber-500' }
          : { label: 'Good', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60', dot: 'bg-emerald-500' };

  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${config.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

/**
 * Partner stock view - shows stock owned by the logged-in partner
 * Matches the Stock Explorer UX with table layout and expandable rows
 */
const PartnerStockPage = () => {
  const api = useTRPC();
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('productName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    ...api.wms.partner.getStock.queryOptions(),
  });

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    let results = data.products;

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      results = results.filter(
        (p) =>
          (p.productName ?? '').toLowerCase().includes(q) ||
          (p.lwin18 ?? '').toLowerCase().includes(q) ||
          String(p.vintage ?? '').includes(q) ||
          (p.producer ?? '').toLowerCase().includes(q),
      );
    }

    return [...results].sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortField === 'productName') {
        return dir * (a.productName ?? '').localeCompare(b.productName ?? '');
      }
      if (sortField === 'totalCases') {
        return dir * (a.totalCases - b.totalCases);
      }
      if (sortField === 'vintage') {
        return dir * ((a.vintage ?? 0) - (b.vintage ?? 0));
      }
      return 0;
    });
  }, [data?.products, debouncedSearch, sortField, sortOrder]);

  const toggleProduct = useCallback((key: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return (
      <Icon
        icon={sortOrder === 'asc' ? IconSortAscending : IconSortDescending}
        size="xs"
        className="ml-1 inline"
      />
    );
  };

  const handleExportCSV = () => {
    if (!data?.products) return;

    const headers = ['Product', 'Producer', 'LWIN-18', 'Vintage', 'Pack', 'Total Cases', 'Available'];
    const rows = data.products.map((p) => [
      `"${(p.productName ?? '').replace(/"/g, '""')}"`,
      `"${(p.producer ?? '').replace(/"/g, '""')}"`,
      p.lwin18,
      p.vintage ?? '',
      `${p.caseConfig}x${p.bottleSize}`,
      p.totalCases,
      p.availableCases,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const access = resolveAccessProfile({ partnerType: data?.partner?.type });
  const isCollector = access.kind === 'collector';

  const rowKey = (product: { lwin18: string; caseConfig: number | null; salesArrangement: string | null }) =>
    `${product.lwin18}-${product.caseConfig ?? ''}-${product.salesArrangement ?? ''}`;

  return (
    <div className="container mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Typography variant="headingLg">
              {isCollector ? 'Your Cellar' : 'Local Stock'}
            </Typography>
            <Typography variant="bodySm" colorRole="muted" className="mt-1">
              {data?.partner?.name ? `${data.partner.name} — ` : ''}
              {isCollector
                ? 'Held in bond at the C&C warehouse'
                : 'Products stored at C&C bonded warehouse'}
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <ButtonContent iconLeft={IconRefresh}>Refresh</ButtonContent>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data?.products?.length}>
              <ButtonContent iconLeft={IconDownload}>Export</ButtonContent>
            </Button>
          </div>
        </div>

        {/*
          Figures a partner can act on.

          "Available" with a 100% bar restated the case count whenever nothing
          was reserved — which is nearly always — and "0 Reserved" spent a
          quarter of the row reporting that nothing had happened. These say how
          much wine there is, which way it is going, and what needs attention.
        */}
        {data?.summary && (
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
            {/* What you hold */}
            <div className="rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/40 to-background-primary dark:border-blue-900/40 dark:from-blue-950/30 px-3 py-3 text-center shadow-sm">
              <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100/70 text-blue-500 dark:bg-blue-900/40 dark:text-blue-300">
                <IconTags size={14} />
              </div>
              <div className="text-xl font-bold leading-tight">
                {data.summary.totalCases.toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted">cases in bond</div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                {data.summary.totalBottles.toLocaleString()} bottles ·{' '}
                {data.summary.productCount} wines
              </div>
            </div>

            {/* Which way it is going */}
            <div className="rounded-xl border border-amber-100 bg-gradient-to-b from-amber-50/40 to-background-primary dark:border-amber-900/40 dark:from-amber-950/30 px-3 py-3 text-center shadow-sm">
              <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100/70 text-amber-500 dark:bg-amber-900/40 dark:text-amber-300">
                <IconPackage size={14} />
              </div>
              <div className="text-xl font-bold leading-tight text-amber-600 dark:text-amber-400">
                {data.summary.casesPickedLast30.toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted">picked, 30 days</div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                {data.summary.bottlesPickedLast30 > 0
                  ? `${data.summary.bottlesPickedLast30.toLocaleString()} bottles`
                  : 'nothing shipped out'}
              </div>
            </div>

            {/* What needs attention — same thresholds as the row badges */}
            <div className="rounded-xl border border-red-100 bg-gradient-to-b from-red-50/40 to-background-primary dark:border-red-900/40 dark:from-red-950/30 px-3 py-3 text-center shadow-sm">
              <div className={`mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg ${
                data.summary.runningLow > 0 ? 'bg-red-100/70 text-red-500 dark:bg-red-900/40 dark:text-red-300' : 'bg-surface-muted text-text-muted'
              }`}>
                <IconCircleCheck size={14} />
              </div>
              <div className={`text-xl font-bold leading-tight ${data.summary.runningLow > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                {data.summary.runningLow}
              </div>
              <div className="text-[11px] text-text-muted">running low</div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                {data.summary.runningLow > 0 ? '2 cases or fewer' : 'all healthy'}
              </div>
            </div>

            {/* What is coming */}
            <div className="rounded-xl border border-violet-100 bg-gradient-to-b from-violet-50/40 to-background-primary dark:border-violet-900/40 dark:from-violet-950/30 px-3 py-3 text-center shadow-sm">
              <div className={`mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg ${
                data.summary.inboundCases > 0 ? 'bg-violet-100/70 text-violet-500 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-surface-muted text-text-muted'
              }`}>
                <IconTruck size={14} />
              </div>
              <div className={`text-xl font-bold leading-tight ${data.summary.inboundCases > 0 ? 'text-violet-600 dark:text-violet-400' : ''}`}>
                {data.summary.inboundCases.toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted">arriving</div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                {data.summary.nextEta
                  ? `next ${format(new Date(data.summary.nextEta), 'd MMM')}`
                  : 'nothing in transit'}
              </div>
            </div>

            {/* What it cost — not what it is worth */}
            <div className="col-span-2 rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 to-background-primary dark:border-emerald-900/40 dark:from-emerald-950/30 px-3 py-3 text-center shadow-sm lg:col-span-1">
              <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100/70 text-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-300">
                <IconLock size={14} />
              </div>
              <div className="text-xl font-bold leading-tight">
                ${Math.round(data.summary.importValueUsd).toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted">at import cost</div>
              <div className="mt-0.5 text-[10px] text-text-muted">
                {data.summary.productsWithoutCost > 0
                  ? `${data.summary.productsWithoutCost} without a cost on file`
                  : 'not a valuation'}
              </div>
            </div>
          </div>
        )}

        {isError && !data && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border-muted bg-surface-primary px-4 py-12 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
              <IconAlertCircle size={22} />
            </div>
            <Typography variant="bodySm" className="font-medium">
              Your stock could not be loaded
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Please try again. If it keeps failing, contact C&C.
            </Typography>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <IconRefresh size={14} />
              {isFetching ? 'Loading…' : 'Try again'}
            </button>
          </div>
        )}

        {!(isError && !data) && (
        <>
        {/* Search */}
        <Input
          placeholder="Search by product name, producer, LWIN, or vintage..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          iconLeft={IconSearch}
        />

        {/* Results count */}
        <div className="flex items-center justify-between">
          <Typography variant="bodyXs" colorRole="muted">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            {debouncedSearch && ` matching "${debouncedSearch}"`}
          </Typography>
        </div>

        {/* ─── Mobile Card Layout ─────────────────────────────────── */}
        <div className="space-y-2 md:hidden">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
                <IconPackage className="h-6 w-6 text-text-muted" />
              </div>
              <Typography variant="bodySm" colorRole="muted">
                {debouncedSearch ? 'No products match your search' : 'No stock yet'}
              </Typography>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const key = rowKey(product);
              const isExpanded = expandedProducts.has(key);

              return (
                <div
                  key={key}
                  className="overflow-hidden rounded-xl border border-border-muted bg-background-primary shadow-sm"
                >
                  {/* Card header — tappable */}
                  <button
                    className="flex w-full items-start gap-3 p-4 text-left transition-colors active:bg-surface-muted/50"
                    onClick={() => toggleProduct(key)}
                  >
                    <div className="mt-0.5 shrink-0">
                      <Icon
                        icon={isExpanded ? IconChevronDown : IconChevronRight}
                        size="sm"
                        colorRole="muted"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-text-primary leading-tight">
                            {displayWineName(product.productName ?? '', { keepVintage: true })}
                          </div>
                          {product.producer && (
                            <div className="mt-0.5 text-xs text-text-muted">{product.producer}</div>
                          )}
                        </div>
                        <StatusIndicator cases={product.availableCases} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-muted">
                        <span>{product.vintage ?? 'NV'}</span>
                        <span className="text-border-muted">|</span>
                        <span>{product.caseConfig}x{product.bottleSize}</span>
                        <span className="text-border-muted">|</span>
                        <span>{product.locationCount} {product.locationCount === 1 ? 'location' : 'locations'}</span>
                      </div>

                      {/* Mini stats row */}
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-surface-muted/60 px-2.5 py-1.5 text-center">
                          <div className="text-sm font-bold tabular-nums">{product.totalCases}</div>
                          <div className="text-[10px] text-text-muted">Cases</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-center dark:bg-emerald-950/30">
                          <div className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{product.availableCases}</div>
                          <div className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">Available</div>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-border-muted bg-surface-muted/30 px-4 py-3 space-y-3">
                      {/* Locations */}
                      {product.locations && product.locations.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                            <IconMapPin size={13} />
                            Locations
                          </div>
                          <div className="space-y-1.5">
                            {product.locations.map((loc, idx) => (
                              <div
                                key={`${loc.locationId}-${idx}`}
                                className="flex items-center justify-between rounded-lg bg-background-primary px-3 py-2 border border-border-muted/50"
                              >
                                <div className="flex items-center gap-2">
                                  <LocationBadge locationCode={loc.locationCode} size="sm" />
                                  {loc.lotNumber && (
                                    <span className="text-[11px] font-mono text-text-muted">{loc.lotNumber}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="font-semibold tabular-nums">{loc.quantityCases}</span>
                                  <span className="tabular-nums text-emerald-700 dark:text-emerald-300">{loc.availableCases}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/*
                        History, fetched per wine.

                        This used to filter the order's `recentMovements`, which
                        is scoped on the movement's owner columns — and only an
                        ownership transfer ever sets those, so a pick or a
                        receipt never appeared and the panel read as empty.
                      */}
                      <div>
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                          <IconClock size={13} />
                          History
                        </div>
                        <PartnerMovementsPanel
                          lwin18={product.lwin18}
                          variant="compact"
                          limit={25}
                          currentCases={product.totalCases}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ─── Desktop Table Layout ───────────────────────────────── */}
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-xl border border-border-muted bg-background-primary shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-muted bg-surface-muted/60">
                    <th className="w-10 px-2 py-3" />
                    <th
                      className="cursor-pointer px-4 py-3 text-left transition-colors hover:bg-surface-muted"
                      onClick={() => handleSort('productName')}
                    >
                      <Typography variant="labelSm">
                        Product {renderSortIcon('productName')}
                      </Typography>
                    </th>
                    <th className="hidden px-4 py-3 text-left xl:table-cell">
                      <Typography variant="labelSm">LWIN-18</Typography>
                    </th>
                    <th
                      className="cursor-pointer px-4 py-3 text-center transition-colors hover:bg-surface-muted"
                      onClick={() => handleSort('vintage')}
                    >
                      <Typography variant="labelSm">
                        Vintage {renderSortIcon('vintage')}
                      </Typography>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <Typography variant="labelSm">Pack</Typography>
                    </th>
                    <th
                      className="cursor-pointer px-4 py-3 text-right transition-colors hover:bg-surface-muted"
                      onClick={() => handleSort('totalCases')}
                    >
                      <Typography variant="labelSm">
                        Cases {renderSortIcon('totalCases')}
                      </Typography>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <Typography variant="labelSm">Available</Typography>
                    </th>
                    <th className="hidden px-4 py-3 text-center lg:table-cell">
                      <Typography variant="labelSm">Locations</Typography>
                    </th>
                    <th className="hidden px-4 py-3 text-center lg:table-cell">
                      <Typography variant="labelSm">Status</Typography>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
                          <IconPackage className="h-6 w-6 text-text-muted" />
                        </div>
                        <Typography variant="bodySm" colorRole="muted">
                          {debouncedSearch ? 'No products match your search' : 'No stock yet'}
                        </Typography>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => {
                      const key = rowKey(product);
                      const isExpanded = expandedProducts.has(key);

                      return (
                        <Fragment key={key}>
                          {/* Product Row */}
                          <tr
                            className="cursor-pointer border-b border-border-muted transition-colors hover:bg-surface-secondary/50"
                            onClick={() => toggleProduct(key)}
                          >
                            <td className="px-2 py-3 text-center">
                              <Icon
                                icon={isExpanded ? IconChevronDown : IconChevronRight}
                                size="sm"
                                colorRole="muted"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <Typography variant="bodySm" className="font-medium">
                                  {displayWineName(product.productName ?? '', { keepVintage: true })}
                                </Typography>
                                {product.producer && (
                                  <Typography variant="bodyXs" colorRole="muted">
                                    {product.producer}
                                  </Typography>
                                )}
                              </div>
                            </td>
                            <td className="hidden px-4 py-3 xl:table-cell">
                              <Typography variant="bodyXs" colorRole="muted" className="font-mono">
                                {product.lwin18}
                              </Typography>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Typography variant="bodySm">
                                {product.vintage ?? 'NV'}
                              </Typography>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Typography variant="bodySm" colorRole="muted">
                                {product.caseConfig}x{product.bottleSize}
                              </Typography>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Typography variant="bodySm" className="font-semibold tabular-nums">
                                {product.totalCases}
                              </Typography>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Typography variant="bodySm" className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                                {product.availableCases}
                              </Typography>
                            </td>
                            <td className="hidden px-4 py-3 text-center lg:table-cell">
                              <Typography variant="bodySm" colorRole="muted">
                                {product.locationCount}
                              </Typography>
                            </td>
                            <td className="hidden px-4 py-3 text-center lg:table-cell">
                              <StatusIndicator cases={product.availableCases} />
                            </td>
                          </tr>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={10} className="bg-surface-muted/30 p-0">
                                <div className="px-6 py-4 space-y-4">
                                  {/* Location Breakdown */}
                                  {product.locations && product.locations.length > 0 && (
                                    <div>
                                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                                        <IconMapPin size={13} />
                                        Location Breakdown
                                      </div>
                                      <div className="overflow-x-auto rounded-lg border border-border-muted bg-background-primary">
                                        <table className="w-full">
                                          <thead>
                                            <tr className="border-b border-border-muted bg-surface-muted/30">
                                              <th className="px-3 py-2 text-left">
                                                <Typography variant="labelSm">Location</Typography>
                                              </th>
                                              <th className="px-3 py-2 text-right">
                                                <Typography variant="labelSm">Qty</Typography>
                                              </th>
                                              <th className="px-3 py-2 text-right">
                                                <Typography variant="labelSm">Available</Typography>
                                              </th>
                                              <th className="px-3 py-2 text-left">
                                                <Typography variant="labelSm">Lot</Typography>
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {product.locations.map((loc, idx) => (
                                              <tr
                                                key={`${loc.locationId}-${idx}`}
                                                className="border-b border-border-muted/50 last:border-0"
                                              >
                                                <td className="px-3 py-2">
                                                  <LocationBadge locationCode={loc.locationCode} size="sm" />
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  <span className="text-sm font-medium tabular-nums">
                                                    {loc.quantityCases}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  <span className="text-sm tabular-nums text-emerald-700 dark:text-emerald-300">
                                                    {loc.availableCases}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                  <span className="font-mono text-xs text-text-muted">
                                                    {loc.lotNumber ?? '—'}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                                      <IconClock size={13} />
                                      Movement History
                                    </div>
                                    <PartnerMovementsPanel
                                      lwin18={product.lwin18}
                                      variant="compact"
                                      limit={25}
                                      currentCases={product.totalCases}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        </>
        )}

        {/* Full history lives on the Activity page */}
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <Link
            href="/platform/partner/activity"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary hover:underline"
          >
            View all activity
            <IconArrowRight size={14} />
          </Link>
          {data?.products?.length && dataUpdatedAt ? (
            <span className="text-xs text-text-muted">
              Last updated {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PartnerStockPage;
