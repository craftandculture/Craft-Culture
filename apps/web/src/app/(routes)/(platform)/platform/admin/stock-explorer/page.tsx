'use client';

import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconDownload,
  IconLoader2,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

type SortField = 'productName' | 'totalCases' | 'vintage' | 'receivedAt';
type SortOrder = 'asc' | 'desc';

/** Pagination button */
const PaginationButton = ({
  onClick,
  disabled,
  icon,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="rounded-md p-2 text-[#a1a1a1] transition-colors hover:bg-white/[0.06] hover:text-[#fafafa] disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {icon}
  </button>
);

/** Single product row with expandable location breakdown */
interface ProductRowProps {
  product: {
    lwin18: string;
    productName: string;
    producer: string | null;
    vintage: string | null;
    bottleSize: string | null;
    caseConfig: number | null;
    totalCases: number;
    availableCases: number;
    reservedCases: number;
    locationCount: number;
    ownerCount: number;
    expiryStatus: string;
    locations: {
      stockId: string;
      locationCode: string;
      locationType: string;
      quantityCases: number;
      availableCases: number;
      ownerId: string;
      ownerName: string;
      lotNumber: string | null;
      expiryDate: Date | null;
    }[];
  };
  isExpanded: boolean;
  onToggle: () => void;
}

const ProductRow = ({ product, isExpanded, onToggle }: ProductRowProps) => {
  const tdClass = 'px-3 py-2.5';
  const tdClassRight = 'px-3 py-2.5 text-right tabular-nums';

  const expiryBadge = () => {
    switch (product.expiryStatus) {
      case 'expired':
        return <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[11px] text-red-400">Expired</span>;
      case 'critical':
        return <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[11px] text-orange-400">Critical</span>;
      case 'warning':
        return <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[11px] text-yellow-400">Warning</span>;
      case 'ok':
        return <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[11px] text-green-400">OK</span>;
      default:
        return <span className="text-[#555]">—</span>;
    }
  };

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
      >
        <td className="px-3 py-2.5 text-[#666]">
          {isExpanded ? (
            <IconChevronDown className="h-4 w-4 text-[#3DB3AA]" />
          ) : (
            <IconChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className={`${tdClass} max-w-[300px] truncate font-medium`}>{product.productName}</td>
        <td className={`${tdClass} hidden max-w-[180px] truncate text-[#a1a1a1] lg:table-cell`}>
          {product.producer ?? '—'}
        </td>
        <td className={`${tdClass} font-mono text-[12px] text-[#888]`}>{product.lwin18}</td>
        <td className={tdClass}>{product.vintage ?? '—'}</td>
        <td className={`${tdClass} hidden text-[#a1a1a1] xl:table-cell`}>{product.bottleSize ?? '750ml'}</td>
        <td className={`${tdClass} hidden text-[#a1a1a1] xl:table-cell`}>{product.caseConfig ?? 12}</td>
        <td className={`${tdClassRight} font-semibold`}>{product.totalCases}</td>
        <td className={`${tdClassRight} text-[#3DB3AA]`}>{product.availableCases}</td>
        <td className={tdClassRight}>
          {product.reservedCases > 0 ? (
            <span className="text-orange-400">{product.reservedCases}</span>
          ) : (
            <span className="text-[#555]">0</span>
          )}
        </td>
        <td className={`${tdClassRight} hidden md:table-cell`}>{product.locationCount}</td>
        <td className={`${tdClassRight} hidden md:table-cell`}>{product.ownerCount}</td>
        <td className={`${tdClass} hidden lg:table-cell`}>{expiryBadge()}</td>
      </tr>

      {/* Expanded location breakdown */}
      {isExpanded && product.locations.length > 0 && (
        <tr>
          <td colSpan={13} className="bg-[#111] px-0 py-0">
            <div className="border-b border-white/[0.06] px-8 py-3">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-[#666]">
                    <th className="px-3 py-1.5 text-left">Location</th>
                    <th className="px-3 py-1.5 text-left">Type</th>
                    <th className="px-3 py-1.5 text-right">Qty</th>
                    <th className="px-3 py-1.5 text-right">Avail</th>
                    <th className="px-3 py-1.5 text-left">Owner</th>
                    <th className="px-3 py-1.5 text-left">Lot</th>
                    <th className="px-3 py-1.5 text-left">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {product.locations.map((loc) => (
                    <tr key={loc.stockId} className="border-t border-white/[0.04] text-[#ccc]">
                      <td className="px-3 py-1.5 font-mono text-[12px] text-[#3DB3AA]">
                        {loc.locationCode}
                      </td>
                      <td className="px-3 py-1.5 text-[#888]">{loc.locationType}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{loc.quantityCases}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{loc.availableCases}</td>
                      <td className="px-3 py-1.5">{loc.ownerName}</td>
                      <td className="px-3 py-1.5 font-mono text-[12px] text-[#888]">
                        {loc.lotNumber ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-[#888]">
                        {loc.expiryDate
                          ? new Date(loc.expiryDate).toLocaleDateString('en-GB')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

/**
 * Stock Explorer — dark-themed, desktop-optimized stock search
 * Full granularity view of all warehouse stock with filters and CSV export
 */
const StockExplorerPage = () => {
  const api = useTRPC();

  // Search & filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [vintageFrom, setVintageFrom] = useState('');
  const [vintageTo, setVintageTo] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('productName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const limit = 50;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [ownerId, vintageFrom, vintageTo, sortBy, sortOrder]);

  // Fetch stock data
  const { data: stockData, isLoading } = useQuery({
    ...api.wms.admin.stock.getByProduct.queryOptions({
      search: debouncedSearch || undefined,
      ownerId: ownerId || undefined,
      vintageFrom: vintageFrom ? Number(vintageFrom) : undefined,
      vintageTo: vintageTo ? Number(vintageTo) : undefined,
      sortBy,
      sortOrder,
      limit,
      offset: page * limit,
    }),
  });

  // Fetch overview for stats
  const { data: overview } = useQuery({
    ...api.wms.admin.stock.getOverview.queryOptions({}),
  });

  // Fetch owners for filter dropdown
  const { data: ownerData } = useQuery({
    ...api.wms.admin.stock.getByOwner.queryOptions({}),
  });

  const owners = useMemo(() => {
    if (!ownerData || !('owners' in ownerData)) return [];
    return ownerData.owners;
  }, [ownerData]);

  const products = useMemo(() => stockData?.products ?? [], [stockData]);
  const totalCount = stockData?.pagination?.total ?? 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Toggle row expansion
  const toggleRow = useCallback((lwin18: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(lwin18)) {
        next.delete(lwin18);
      } else {
        next.add(lwin18);
      }
      return next;
    });
  }, []);

  // Sort handler
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortOrder(field === 'productName' ? 'asc' : 'desc');
      }
    },
    [sortBy],
  );

  // CSV export
  const handleExport = useCallback(() => {
    if (!products.length) return;
    const headers = [
      'Product Name',
      'Producer',
      'LWIN18',
      'Vintage',
      'Size',
      'Pack',
      'Total Cases',
      'Available',
      'Reserved',
      'Locations',
      'Owners',
    ];
    const rows = products.map((p) => [
      `"${(p.productName ?? '').replace(/"/g, '""')}"`,
      `"${(p.producer ?? '').replace(/"/g, '""')}"`,
      p.lwin18,
      p.vintage ?? '',
      p.bottleSize ?? '',
      p.caseConfig ?? '',
      p.totalCases,
      p.availableCases,
      p.reservedCases,
      p.locationCount,
      p.ownerCount,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [products]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setOwnerId('');
    setVintageFrom('');
    setVintageTo('');
    setSortBy('productName');
    setSortOrder('asc');
    setPage(0);
  }, []);

  const hasActiveFilters = debouncedSearch || ownerId || vintageFrom || vintageTo;

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? (
      <IconSortAscending className="h-3.5 w-3.5" />
    ) : (
      <IconSortDescending className="h-3.5 w-3.5" />
    );
  };

  const thClass =
    'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors hover:text-[#3DB3AA]';
  const thClassRight =
    'px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors hover:text-[#3DB3AA]';

  return (
    <div className="-m-4 min-h-screen bg-[#0a0a0a] p-6 font-sans text-[#fafafa] md:-m-6 lg:-m-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Explorer</h1>
          <p className="mt-1 text-sm text-[#666]">
            Full warehouse inventory — search, filter, and export
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={!products.length}
          className="flex items-center gap-2 rounded-lg bg-[#3DB3AA]/10 px-4 py-2 text-sm font-medium text-[#3DB3AA] transition-colors hover:bg-[#3DB3AA]/20 disabled:opacity-40"
        >
          <IconDownload className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Stats Bar */}
      {overview && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'Products', value: overview.summary.uniqueProducts },
            { label: 'Total Cases', value: overview.summary.totalCases },
            { label: 'Available', value: overview.summary.availableCases },
            { label: 'Reserved', value: overview.summary.reservedCases },
            { label: 'Owners', value: overview.summary.uniqueOwners },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3"
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-[#666]">
                {stat.label}
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums">{stat.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[280px] flex-1">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product, producer, LWIN18..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-[#fafafa] placeholder:text-[#555] focus:border-[#3DB3AA]/50 focus:outline-none focus:ring-1 focus:ring-[#3DB3AA]/30"
          />
        </div>

        {/* Owner filter */}
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-[#fafafa] focus:border-[#3DB3AA]/50 focus:outline-none"
        >
          <option value="" className="bg-[#1a1a1a]">
            All Owners
          </option>
          {owners.map((o) => (
            <option key={o.ownerId} value={o.ownerId} className="bg-[#1a1a1a]">
              {o.ownerName} ({o.totalCases})
            </option>
          ))}
        </select>

        {/* Vintage range */}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={vintageFrom}
            onChange={(e) => setVintageFrom(e.target.value)}
            placeholder="From"
            min={1900}
            max={2100}
            className="w-20 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-[#fafafa] placeholder:text-[#555] focus:border-[#3DB3AA]/50 focus:outline-none"
          />
          <span className="text-[#555]">—</span>
          <input
            type="number"
            value={vintageTo}
            onChange={(e) => setVintageTo(e.target.value)}
            placeholder="To"
            min={1900}
            max={2100}
            className="w-20 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-[#fafafa] placeholder:text-[#555] focus:border-[#3DB3AA]/50 focus:outline-none"
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-[#a1a1a1] transition-colors hover:text-[#fafafa]"
          >
            <IconX className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="mb-3 flex items-center justify-between text-[12px] text-[#666]">
        <span>
          {isLoading ? (
            'Loading...'
          ) : (
            <>
              {totalCount.toLocaleString()} product{totalCount !== 1 ? 's' : ''}
              {debouncedSearch && ` matching "${debouncedSearch}"`}
            </>
          )}
        </span>
        {totalPages > 1 && (
          <span>
            Page {page + 1} of {totalPages}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[#a1a1a1]">
              <th className="w-8 px-3 py-2.5" />
              <th className={thClass} onClick={() => handleSort('productName')}>
                <span className="flex items-center gap-1">
                  Product {renderSortIcon('productName')}
                </span>
              </th>
              <th className={`${thClass} hidden lg:table-cell`}>Producer</th>
              <th className={thClass}>LWIN18</th>
              <th className={thClass} onClick={() => handleSort('vintage')}>
                <span className="flex items-center gap-1">
                  Vintage {renderSortIcon('vintage')}
                </span>
              </th>
              <th className={`${thClass} hidden xl:table-cell`}>Size</th>
              <th className={`${thClass} hidden xl:table-cell`}>Pack</th>
              <th className={thClassRight} onClick={() => handleSort('totalCases')}>
                <span className="flex items-center justify-end gap-1">
                  Cases {renderSortIcon('totalCases')}
                </span>
              </th>
              <th className={thClassRight}>Avail</th>
              <th className={thClassRight}>Rsvd</th>
              <th className={`${thClassRight} hidden md:table-cell`}>Locs</th>
              <th className={`${thClassRight} hidden md:table-cell`}>Owners</th>
              <th className={`${thClass} hidden lg:table-cell`}>Expiry</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={13} className="py-20 text-center">
                  <IconLoader2 className="mx-auto h-6 w-6 animate-spin text-[#3DB3AA]" />
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-20 text-center text-[#666]">
                  No stock found
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const isExpanded = expandedRows.has(product.lwin18);
                return (
                  <ProductRow
                    key={product.lwin18}
                    product={product}
                    isExpanded={isExpanded}
                    onToggle={() => toggleRow(product.lwin18)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1">
          <PaginationButton
            onClick={() => setPage(0)}
            disabled={page === 0}
            icon={<IconChevronsLeft className="h-4 w-4" />}
          />
          <PaginationButton
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            icon={<IconChevronLeft className="h-4 w-4" />}
          />
          <span className="px-4 text-sm tabular-nums text-[#a1a1a1]">
            {page + 1} / {totalPages}
          </span>
          <PaginationButton
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            icon={<IconChevronRight className="h-4 w-4" />}
          />
          <PaginationButton
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
            icon={<IconChevronsRight className="h-4 w-4" />}
          />
        </div>
      )}
    </div>
  );
};

export default StockExplorerPage;
