'use client';

import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconPackage,
  IconRefresh,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
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
  const config: Record<string, { label: string; color: string }> = {
    receive: { label: 'Received', color: 'bg-emerald-100 text-emerald-700' },
    pick: { label: 'Picked', color: 'bg-amber-100 text-amber-700' },
    dispatch: { label: 'Dispatched', color: 'bg-blue-100 text-blue-700' },
    transfer: { label: 'Transferred', color: 'bg-gray-100 text-gray-600' },
    adjust: { label: 'Adjusted', color: 'bg-purple-100 text-purple-700' },
    count: { label: 'Counted', color: 'bg-gray-100 text-gray-600' },
    repack_in: { label: 'Repack In', color: 'bg-emerald-100 text-emerald-700' },
    repack_out: { label: 'Repack Out', color: 'bg-amber-100 text-amber-700' },
  };

  const { label, color } = config[type] ?? { label: type, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
        {label}
      </span>
      <span className={`text-sm font-medium ${isInbound ? 'text-emerald-600' : 'text-amber-600'}`}>
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
        <div className="h-4 w-full animate-pulse rounded bg-fill-secondary" />
      </td>
    ))}
  </tr>
);

/** Status dot indicator */
const StatusIndicator = ({ cases }: { cases: number }) => {
  if (cases === 0) return <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><span className="h-2 w-2 rounded-full bg-gray-400" />Out</span>;
  if (cases === 1) return <span className="inline-flex items-center gap-1.5 text-xs text-red-600"><span className="h-2 w-2 rounded-full bg-red-500" />Final</span>;
  if (cases <= 2) return <span className="inline-flex items-center gap-1.5 text-xs text-amber-600"><span className="h-2 w-2 rounded-full bg-amber-500" />Low</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" />Good</span>;
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

    // Search filter
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      results = results.filter(
        (p) =>
          (p.productName ?? '').toLowerCase().includes(q) ||
          (p.lwin18 ?? '').toLowerCase().includes(q) ||
          (p.vintage ?? '').toLowerCase().includes(q) ||
          (p.producer ?? '').toLowerCase().includes(q),
      );
    }

    // Sort
    return [...results].sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortField === 'productName') {
        return dir * (a.productName ?? '').localeCompare(b.productName ?? '');
      }
      if (sortField === 'totalCases') {
        return dir * (a.totalCases - b.totalCases);
      }
      if (sortField === 'vintage') {
        return dir * (a.vintage ?? '').localeCompare(b.vintage ?? '');
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

  /** Get movements for a specific product */
  const getProductMovements = useCallback((lwin18: string) => {
    if (!data?.recentMovements) return [];
    return data.recentMovements.filter((m) => m.lwin18 === lwin18);
  }, [data?.recentMovements]);

  /** Check if a movement is inbound to this partner */
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

  /** Composite row key to handle duplicate lwin18 with different salesArrangement */
  const rowKey = (product: { lwin18: string; caseConfig: number | null; salesArrangement: string | null }) =>
    `${product.lwin18}-${product.caseConfig ?? ''}-${product.salesArrangement ?? ''}`;

  return (
    <div className="container mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
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

        {/* Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  Products
                </Typography>
                <Typography variant="headingLg">{data.summary.productCount}</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  Total Cases
                </Typography>
                <Typography variant="headingLg">{data.summary.totalCases}</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  Available
                </Typography>
                <Typography variant="headingLg" className="text-emerald-600">
                  {data.summary.availableCases}
                </Typography>
                {data.summary.totalCases > 0 && (
                  <Typography variant="bodyXs" colorRole="muted">
                    {Math.round((data.summary.availableCases / data.summary.totalCases) * 100)}%
                  </Typography>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                  Reserved
                </Typography>
                <Typography variant="headingLg" className="text-amber-600">
                  {data.summary.reservedCases}
                </Typography>
                {data.summary.totalCases > 0 && (
                  <Typography variant="bodyXs" colorRole="muted">
                    {Math.round((data.summary.reservedCases / data.summary.totalCases) * 100)}%
                  </Typography>
                )}
              </CardContent>
            </Card>
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

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-muted bg-surface-secondary/50">
                    <th className="w-10 px-2 py-3" />
                    <th
                      className="cursor-pointer px-4 py-3 text-left transition-colors hover:bg-fill-secondary/50"
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
                      className="cursor-pointer px-4 py-3 text-center transition-colors hover:bg-fill-secondary/50"
                      onClick={() => handleSort('vintage')}
                    >
                      <Typography variant="labelSm">
                        Vintage {renderSortIcon('vintage')}
                      </Typography>
                    </th>
                    <th className="hidden px-4 py-3 text-center md:table-cell">
                      <Typography variant="labelSm">Pack</Typography>
                    </th>
                    <th
                      className="cursor-pointer px-4 py-3 text-right transition-colors hover:bg-fill-secondary/50"
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
                        <Icon icon={IconPackage} size="xl" className="mx-auto mb-3 text-text-muted" />
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
                            className="cursor-pointer border-b border-border-muted transition-colors hover:bg-fill-secondary/30"
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
                            <td className="hidden px-4 py-3 text-center md:table-cell">
                              <Typography variant="bodySm" colorRole="muted">
                                {product.caseConfig}x{product.bottleSize}
                              </Typography>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Typography variant="bodySm" className="font-semibold">
                                {product.totalCases}
                              </Typography>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Typography variant="bodySm" className="font-medium text-emerald-600">
                                  {product.availableCases}
                                </Typography>
                                {/* Availability bar */}
                                <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-gray-200 sm:block">
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
                                <Typography variant="bodySm" className="font-medium text-amber-600">
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
                              <td colSpan={10} className="bg-surface-secondary/40 p-0">
                                <div className="px-6 py-4">
                                  {/* Location Breakdown */}
                                  {product.locations && product.locations.length > 0 && (
                                    <div className="mb-4">
                                      <Typography variant="labelSm" className="mb-2">
                                        Location Breakdown
                                      </Typography>
                                      <div className="overflow-x-auto rounded-lg border border-border-muted bg-fill-primary">
                                        <table className="w-full">
                                          <thead>
                                            <tr className="border-b border-border-muted bg-surface-secondary/30">
                                              <th className="px-3 py-2 text-left">
                                                <Typography variant="labelSm">Location</Typography>
                                              </th>
                                              <th className="px-3 py-2 text-right">
                                                <Typography variant="labelSm">Qty</Typography>
                                              </th>
                                              <th className="px-3 py-2 text-right">
                                                <Typography variant="labelSm">Avail</Typography>
                                              </th>
                                              <th className="hidden px-3 py-2 text-left sm:table-cell">
                                                <Typography variant="labelSm">Lot</Typography>
                                              </th>
                                              <th className="hidden px-3 py-2 text-left md:table-cell">
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
                                                    <Typography variant="bodySm" className="font-medium">
                                                      {loc.quantityCases}
                                                    </Typography>
                                                  </td>
                                                  <td className="px-3 py-2 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                      <Typography variant="bodySm" className="text-emerald-600">
                                                        {loc.availableCases}
                                                      </Typography>
                                                      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-gray-200">
                                                        <div
                                                          className={`h-full rounded-full ${
                                                            locAvailPct >= 75 ? 'bg-emerald-500' : locAvailPct >= 25 ? 'bg-amber-500' : 'bg-red-500'
                                                          }`}
                                                          style={{ width: `${locAvailPct}%` }}
                                                        />
                                                      </div>
                                                    </div>
                                                  </td>
                                                  <td className="hidden px-3 py-2 sm:table-cell">
                                                    <Typography variant="bodyXs" colorRole="muted" className="font-mono">
                                                      {loc.lotNumber ?? '—'}
                                                    </Typography>
                                                  </td>
                                                  <td className="hidden px-3 py-2 md:table-cell">
                                                    {loc.expiryDate ? (
                                                      <Typography variant="bodyXs" className="text-amber-600">
                                                        {new Date(loc.expiryDate).toLocaleDateString()}
                                                      </Typography>
                                                    ) : (
                                                      <Typography variant="bodyXs" colorRole="muted">—</Typography>
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
                                      <Typography variant="labelSm" className="mb-2">
                                        Movement History
                                      </Typography>
                                      <div className="overflow-x-auto rounded-lg border border-border-muted bg-fill-primary">
                                        <table className="w-full">
                                          <thead>
                                            <tr className="border-b border-border-muted bg-surface-secondary/30">
                                              <th className="px-3 py-2 text-left">
                                                <Typography variant="labelSm">Date</Typography>
                                              </th>
                                              <th className="px-3 py-2 text-left">
                                                <Typography variant="labelSm">Type</Typography>
                                              </th>
                                              <th className="px-3 py-2 text-right">
                                                <Typography variant="labelSm">Cases</Typography>
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
                                                  <Typography variant="bodyXs" colorRole="muted">
                                                    {format(new Date(m.performedAt), 'dd MMM yy')}
                                                  </Typography>
                                                </td>
                                                <td className="px-3 py-2">
                                                  <MovementBadge
                                                    type={m.movementType}
                                                    isInbound={isInbound(m)}
                                                    qty={m.quantityCases}
                                                  />
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  <Typography
                                                    variant="bodySm"
                                                    className={`font-medium ${isInbound(m) ? 'text-emerald-600' : 'text-amber-600'}`}
                                                  >
                                                    {isInbound(m) ? '+' : '-'}{m.quantityCases}
                                                  </Typography>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Empty expanded state */}
                                  {productMovements.length === 0 && (!product.locations || product.locations.length === 0) && (
                                    <Typography variant="bodyXs" colorRole="muted">
                                      No location or movement data available
                                    </Typography>
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
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {data?.recentMovements && data.recentMovements.length > 0 && (
          <div>
            <Typography variant="headingSm" className="mb-3">
              Recent Activity
            </Typography>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border-primary">
                  {data.recentMovements.slice(0, 10).map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isInbound(m) ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                          <Icon
                            icon={isInbound(m) ? IconArrowDown : IconArrowUp}
                            size="sm"
                            className={isInbound(m) ? 'text-emerald-600' : 'text-amber-600'}
                          />
                        </div>
                        <div className="min-w-0">
                          <Typography variant="bodySm" className="truncate font-medium">
                            {m.productName}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            {format(new Date(m.performedAt), 'dd MMM yyyy, HH:mm')}
                            {m.notes && ` — ${m.notes}`}
                          </Typography>
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* Last Updated */}
        {data?.products?.length ? (
          <Typography variant="bodyXs" colorRole="muted" className="text-center">
            Last updated {formatDistanceToNow(new Date(), { addSuffix: true })}
          </Typography>
        ) : null}
      </div>
    </div>
  );
};

export default PartnerStockPage;
