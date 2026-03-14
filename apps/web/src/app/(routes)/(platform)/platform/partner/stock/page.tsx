'use client';

import {
  IconArrowDown,
  IconArrowUp,
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
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import useTRPC from '@/lib/trpc/browser';

type SortField = 'productName' | 'totalCases' | 'vintage';
type SortOrder = 'asc' | 'desc';

interface MovementBadgeProps {
  type: string;
  isInbound: boolean;
  qty: number;
}

/** Badge for movement type with directional quantity */
const MovementBadge = ({ type, isInbound, qty }: MovementBadgeProps) => {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    receive: { label: 'Received', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    pick: { label: 'Picked', bg: 'bg-amber-50', text: 'text-amber-700' },
    dispatch: { label: 'Dispatched', bg: 'bg-blue-50', text: 'text-blue-700' },
    transfer: { label: 'Transferred', bg: 'bg-surface-muted', text: 'text-text-secondary' },
    adjust: { label: 'Adjusted', bg: 'bg-purple-50', text: 'text-purple-700' },
    count: { label: 'Counted', bg: 'bg-surface-muted', text: 'text-text-secondary' },
    repack_in: { label: 'Repack In', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    repack_out: { label: 'Repack Out', bg: 'bg-amber-50', text: 'text-amber-700' },
  };

  const { label, bg, text } = config[type] ?? { label: type, bg: 'bg-surface-muted', text: 'text-text-secondary' };

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${isInbound ? 'text-emerald-600' : 'text-amber-600'}`}>
        {isInbound ? '+' : '-'}{qty}
      </span>
    </div>
  );
};

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

/** Status indicator with colored dot and label */
const StatusIndicator = ({ cases }: { cases: number }) => {
  if (cases === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="h-2 w-2 rounded-full bg-border-muted" />
        <span className="text-text-muted">Out</span>
      </span>
    );
  }
  if (cases === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="text-red-600">Final</span>
      </span>
    );
  }
  if (cases <= 2) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="text-amber-600">Low</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      <span className="text-emerald-600">Good</span>
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

  const { data, isLoading, refetch } = useQuery({
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

  const getProductMovements = useCallback((lwin18: string) => {
    if (!data?.recentMovements) return [];
    return data.recentMovements.filter((m) => m.lwin18 === lwin18);
  }, [data?.recentMovements]);

  const isInbound = useCallback((movement: { toOwnerId: string | null; fromOwnerId: string | null }) => {
    return movement.toOwnerId === data?.partner.id;
  }, [data?.partner.id]);

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

    const headers = ['Product', 'Producer', 'LWIN-18', 'Vintage', 'Pack', 'Total Cases', 'Available', 'Reserved'];
    const rows = data.products.map((p) => [
      `"${(p.productName ?? '').replace(/"/g, '""')}"`,
      `"${(p.producer ?? '').replace(/"/g, '""')}"`,
      p.lwin18,
      p.vintage ?? '',
      `${p.caseConfig}x${p.bottleSize}`,
      p.totalCases,
      p.availableCases,
      p.reservedCases,
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

  const rowKey = (product: { lwin18: string; caseConfig: number | null; salesArrangement: string | null }) =>
    `${product.lwin18}-${product.caseConfig ?? ''}-${product.salesArrangement ?? ''}`;

  return (
    <div className="container mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Typography variant="headingLg">Local Stock</Typography>
            <Typography variant="bodySm" colorRole="muted" className="mt-1">
              Products stored at C&C bonded warehouse
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

        {/* KPI Cards — Stock Explorer style with colored icon circles */}
        {data?.summary && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* Products */}
            <div className="rounded-xl border border-border-muted bg-background-primary px-3 py-3 text-center">
              <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                <IconTags size={14} />
              </div>
              <div className="text-xl font-bold leading-tight">{data.summary.productCount}</div>
              <div className="text-[11px] text-text-muted">Products</div>
            </div>

            {/* Total Cases */}
            <div className="rounded-xl border border-border-muted bg-background-primary px-3 py-3 text-center">
              <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-500">
                <IconPackage size={14} />
              </div>
              <div className="text-xl font-bold leading-tight">{data.summary.totalCases.toLocaleString()}</div>
              <div className="text-[11px] text-text-muted">Total Cases</div>
            </div>

            {/* Available */}
            <div className="rounded-xl border border-border-muted bg-background-primary px-3 py-3 text-center">
              <div className={`mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg ${
                data.summary.availableCases > 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-surface-muted text-text-muted'
              }`}>
                <IconCircleCheck size={14} />
              </div>
              <div className={`text-xl font-bold leading-tight ${data.summary.availableCases > 0 ? 'text-emerald-600' : ''}`}>
                {data.summary.availableCases.toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted">Available</div>
              {data.summary.totalCases > 0 && (
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-border-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.round((data.summary.availableCases / data.summary.totalCases) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-text-muted">
                    {Math.round((data.summary.availableCases / data.summary.totalCases) * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Reserved */}
            <div className="rounded-xl border border-border-muted bg-background-primary px-3 py-3 text-center">
              <div className={`mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg ${
                data.summary.reservedCases > 0 ? 'bg-amber-50 text-amber-500' : 'bg-surface-muted text-text-muted'
              }`}>
                <IconLock size={14} />
              </div>
              <div className={`text-xl font-bold leading-tight ${data.summary.reservedCases > 0 ? 'text-amber-600' : ''}`}>
                {data.summary.reservedCases.toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted">Reserved</div>
              {data.summary.reservedCases > 0 && (
                <div className="text-[10px] text-text-muted">Allocated to orders</div>
              )}
            </div>
          </div>
        )}

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
              const productMovements = isExpanded ? getProductMovements(product.lwin18) : [];
              const availPct = product.totalCases > 0
                ? Math.round((product.availableCases / product.totalCases) * 100)
                : 0;

              return (
                <div
                  key={key}
                  className="overflow-hidden rounded-xl border border-border-muted bg-background-primary"
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
                            {product.productName}
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
                        <span>{product.locationCount} loc</span>
                      </div>

                      {/* Mini stats row */}
                      <div className="mt-2.5 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-surface-muted/60 px-2.5 py-1.5 text-center">
                          <div className="text-sm font-bold tabular-nums">{product.totalCases}</div>
                          <div className="text-[10px] text-text-muted">Total</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-center">
                          <div className="text-sm font-bold tabular-nums text-emerald-600">{product.availableCases}</div>
                          <div className="text-[10px] text-emerald-600/70">Avail</div>
                        </div>
                        <div className={`rounded-lg px-2.5 py-1.5 text-center ${product.reservedCases > 0 ? 'bg-amber-50' : 'bg-surface-muted/60'}`}>
                          <div className={`text-sm font-bold tabular-nums ${product.reservedCases > 0 ? 'text-amber-600' : 'text-text-muted'}`}>
                            {product.reservedCases}
                          </div>
                          <div className={`text-[10px] ${product.reservedCases > 0 ? 'text-amber-600/70' : 'text-text-muted'}`}>Rsrvd</div>
                        </div>
                      </div>

                      {/* Availability bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-muted/50">
                          <div
                            className={`h-full rounded-full transition-all ${
                              availPct >= 75 ? 'bg-emerald-500' : availPct >= 25 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${availPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-text-muted">{availPct}%</span>
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
                                  <span className="text-emerald-600 tabular-nums">{loc.availableCases}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Movements */}
                      {productMovements.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                            <IconClock size={13} />
                            Recent Movements
                          </div>
                          <div className="space-y-1">
                            {productMovements.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between rounded-lg bg-background-primary px-3 py-2 border border-border-muted/50"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] tabular-nums text-text-muted">
                                    {format(new Date(m.performedAt), 'dd MMM')}
                                  </span>
                                  <MovementBadge type={m.movementType} isInbound={isInbound(m)} qty={m.quantityCases} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {productMovements.length === 0 && (!product.locations || product.locations.length === 0) && (
                        <div className="py-2 text-center text-xs text-text-muted">
                          No location or movement data available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ─── Desktop Table Layout ───────────────────────────────── */}
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-xl border border-border-muted bg-background-primary">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-muted bg-surface-muted/50">
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
                    <th className="px-4 py-3 text-right">
                      <Typography variant="labelSm">Reserved</Typography>
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
                      const productMovements = isExpanded ? getProductMovements(product.lwin18) : [];
                      const availPct = product.totalCases > 0
                        ? Math.round((product.availableCases / product.totalCases) * 100)
                        : 0;

                      return (
                        <Fragment key={key}>
                          {/* Product Row */}
                          <tr
                            className="cursor-pointer border-b border-border-muted transition-colors hover:bg-surface-muted/50"
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
                                  {product.productName}
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
                              <div className="flex items-center justify-end gap-2">
                                <Typography variant="bodySm" className="font-medium tabular-nums text-emerald-600">
                                  {product.availableCases}
                                </Typography>
                                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-border-muted/50">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      availPct >= 75 ? 'bg-emerald-500' : availPct >= 25 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${availPct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {product.reservedCases > 0 ? (
                                <Typography variant="bodySm" className="font-medium tabular-nums text-amber-600">
                                  {product.reservedCases}
                                </Typography>
                              ) : (
                                <Typography variant="bodySm" colorRole="muted">
                                  —
                                </Typography>
                              )}
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
                                                <Typography variant="labelSm">Avail</Typography>
                                              </th>
                                              <th className="px-3 py-2 text-left">
                                                <Typography variant="labelSm">Lot</Typography>
                                              </th>
                                              <th className="hidden px-3 py-2 text-left lg:table-cell">
                                                <Typography variant="labelSm">Expiry</Typography>
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {product.locations.map((loc, idx) => {
                                              const locAvailPct = loc.quantityCases > 0
                                                ? Math.round((loc.availableCases / loc.quantityCases) * 100)
                                                : 0;
                                              return (
                                                <tr
                                                  key={`${loc.locationId}-${idx}`}
                                                  className="border-b border-border-muted/50 last:border-0"
                                                >
                                                  <td className="px-3 py-2">
                                                    <LocationBadge locationCode={loc.locationCode} size="sm" />
                                                  </td>
                                                  <td className="px-3 py-2 text-right">
                                                    <span className="font-medium tabular-nums text-sm">
                                                      {loc.quantityCases}
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                      <span className="text-sm tabular-nums text-emerald-600">
                                                        {loc.availableCases}
                                                      </span>
                                                      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-border-muted/50">
                                                        <div
                                                          className={`h-full rounded-full ${
                                                            locAvailPct >= 75 ? 'bg-emerald-500' : locAvailPct >= 25 ? 'bg-amber-500' : 'bg-red-500'
                                                          }`}
                                                          style={{ width: `${locAvailPct}%` }}
                                                        />
                                                      </div>
                                                    </div>
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <span className="text-xs font-mono text-text-muted">
                                                      {loc.lotNumber ?? '—'}
                                                    </span>
                                                  </td>
                                                  <td className="hidden px-3 py-2 lg:table-cell">
                                                    {loc.expiryDate ? (
                                                      <span className="text-xs text-amber-600">
                                                        {new Date(loc.expiryDate).toLocaleDateString()}
                                                      </span>
                                                    ) : (
                                                      <span className="text-xs text-text-muted">—</span>
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Product Movement History */}
                                  {productMovements.length > 0 && (
                                    <div>
                                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                                        <IconClock size={13} />
                                        Movement History
                                      </div>
                                      <div className="overflow-x-auto rounded-lg border border-border-muted bg-background-primary">
                                        <table className="w-full">
                                          <thead>
                                            <tr className="border-b border-border-muted bg-surface-muted/30">
                                              <th className="px-3 py-2 text-left">
                                                <Typography variant="labelSm">Date</Typography>
                                              </th>
                                              <th className="px-3 py-2 text-left">
                                                <Typography variant="labelSm">Type</Typography>
                                              </th>
                                              <th className="px-3 py-2 text-right">
                                                <Typography variant="labelSm">Cases</Typography>
                                              </th>
                                              <th className="hidden px-3 py-2 text-left lg:table-cell">
                                                <Typography variant="labelSm">Notes</Typography>
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {productMovements.map((m) => (
                                              <tr
                                                key={m.id}
                                                className="border-b border-border-muted/50 last:border-0"
                                              >
                                                <td className="px-3 py-2">
                                                  <span className="text-xs tabular-nums text-text-muted">
                                                    {format(new Date(m.performedAt), 'dd MMM yy')}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                  <MovementBadge
                                                    type={m.movementType}
                                                    isInbound={isInbound(m)}
                                                    qty={m.quantityCases}
                                                  />
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  <span
                                                    className={`text-sm font-semibold tabular-nums ${isInbound(m) ? 'text-emerald-600' : 'text-amber-600'}`}
                                                  >
                                                    {isInbound(m) ? '+' : '-'}{m.quantityCases}
                                                  </span>
                                                </td>
                                                <td className="hidden px-3 py-2 lg:table-cell">
                                                  {m.notes ? (
                                                    <span className="text-xs text-text-muted">{m.notes}</span>
                                                  ) : (
                                                    <span className="text-xs text-text-muted">—</span>
                                                  )}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {productMovements.length === 0 && (!product.locations || product.locations.length === 0) && (
                                    <div className="py-2 text-center text-xs text-text-muted">
                                      No location or movement data available
                                    </div>
                                  )}
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

        {/* ─── Recent Activity ────────────────────────────────────── */}
        {data?.recentMovements && data.recentMovements.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-50 text-cyan-500">
                <IconClock size={13} />
              </div>
              <Typography variant="headingSm">Recent Activity</Typography>
            </div>
            <div className="overflow-hidden rounded-xl border border-border-muted bg-background-primary">
              <div className="divide-y divide-border-muted">
                {data.recentMovements.slice(0, 10).map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isInbound(m) ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                        <Icon
                          icon={isInbound(m) ? IconArrowDown : IconArrowUp}
                          size="sm"
                          className={isInbound(m) ? 'text-emerald-600' : 'text-amber-600'}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-text-primary">
                          {m.productName}
                        </div>
                        <div className="text-xs text-text-muted">
                          {format(new Date(m.performedAt), 'dd MMM yyyy, HH:mm')}
                          {m.notes && ` — ${m.notes}`}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 pl-3">
                      <MovementBadge
                        type={m.movementType}
                        isInbound={isInbound(m)}
                        qty={m.quantityCases}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Last Updated */}
        {data?.products?.length ? (
          <div className="text-center text-xs text-text-muted">
            Last updated {formatDistanceToNow(new Date(), { addSuffix: true })}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PartnerStockPage;
