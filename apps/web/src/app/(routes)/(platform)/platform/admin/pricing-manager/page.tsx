'use client';

import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconDownload,
  IconLoader2,
  IconPercentage,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

// ─── Constants ────────────────────────────────────────────────────────────────

const IN_BOND_MARKUP = 0.10; // 10% on top of import price
const PAGE_SIZES = [50, 100, 200] as const;

type CategoryFilter = 'Wine' | 'Spirits' | 'RTD';
type SortField = 'productName' | 'totalCases' | 'importPrice' | 'sellingPrice' | 'margin';
type SortOrder = 'asc' | 'desc';

// ─── PriceCell (click-to-edit) ────────────────────────────────────────────────

const PriceCell = ({
  value,
  onSave,
  highlight,
}: {
  value: number | null;
  onSave: (v: number) => void;
  highlight?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toFixed(2) ?? '');

  if (!editing) {
    return (
      <td className="px-3 py-3 text-right tabular-nums">
        <button
          type="button"
          className={`cursor-pointer hover:text-text-primary hover:underline ${highlight ? 'font-medium text-violet-600' : 'text-text-muted'}`}
          onClick={() => {
            setDraft(value?.toFixed(2) ?? '');
            setEditing(true);
          }}
        >
          {value != null && value > 0 ? `$${value.toFixed(2)}` : (
            <span className="tracking-widest text-text-muted/50">- -</span>
          )}
        </button>
      </td>
    );
  }

  return (
    <td className="px-3 py-3">
      <form
        className="flex items-center justify-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const num = parseFloat(draft);
          if (!isNaN(num) && num > 0 && num !== value) {
            onSave(num);
          }
          setEditing(false);
        }}
      >
        <span className="text-xs text-text-muted">$</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-20 rounded border border-border-primary bg-background-primary px-1.5 py-0.5 text-right font-mono text-xs tabular-nums focus:border-border-brand focus:outline-none"
          placeholder="0.00"
          type="number"
          step="0.01"
          min="0"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditing(false);
              setDraft(value?.toFixed(2) ?? '');
            }
          }}
        />
        <button
          type="submit"
          className="rounded bg-fill-brand px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-fill-brand/90"
        >
          Save
        </button>
      </form>
    </td>
  );
};

// ─── Pagination Button ────────────────────────────────────────────────────────

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
    className="rounded-md p-2.5 text-text-muted transition-colors hover:bg-fill-primary-hover hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {icon}
  </button>
);

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard = ({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  color?: 'green' | 'amber' | 'red' | 'default';
}) => {
  const valueColor =
    color === 'green'
      ? 'text-emerald-600'
      : color === 'amber'
        ? 'text-amber-600'
        : color === 'red'
          ? 'text-red-600'
          : 'text-text-primary';

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
      </CardContent>
    </Card>
  );
};

// ─── Margin Dot ───────────────────────────────────────────────────────────────

const MarginDot = ({ margin }: { margin: number | null }) => {
  if (margin == null)
    return <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />;
  if (margin >= 20) return <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />;
  if (margin >= 10) return <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-red-500" />;
};

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr>
    <td className="px-3 py-3">
      <div className="h-4 w-40 animate-pulse rounded bg-surface-muted" />
      <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-surface-muted" />
    </td>
    <td className="px-3 py-3">
      <div className="h-4 w-16 animate-pulse rounded bg-surface-muted" />
    </td>
    <td className="px-3 py-3">
      <div className="ml-auto h-4 w-10 animate-pulse rounded bg-surface-muted" />
    </td>
    <td className="px-3 py-3">
      <div className="ml-auto h-4 w-14 animate-pulse rounded bg-surface-muted" />
    </td>
    <td className="hidden px-3 py-3 lg:table-cell">
      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-surface-muted" />
    </td>
    <td className="px-3 py-3">
      <div className="ml-auto h-4 w-14 animate-pulse rounded bg-surface-muted" />
    </td>
    <td className="hidden px-3 py-3 lg:table-cell">
      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-surface-muted" />
    </td>
    <td className="px-3 py-3">
      <div className="ml-auto h-4 w-14 animate-pulse rounded bg-surface-muted" />
    </td>
    <td className="hidden px-3 py-3 lg:table-cell">
      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-surface-muted" />
    </td>
    <td className="px-3 py-3">
      <div className="ml-auto h-4 w-14 animate-pulse rounded bg-surface-muted" />
    </td>
    <td className="hidden px-3 py-3 xl:table-cell">
      <div className="ml-auto h-4 w-14 animate-pulse rounded bg-surface-muted" />
    </td>
  </tr>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const PricingManagerPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  // State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter | undefined>('Wine');
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortField>('productName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState<number>(50);

  // Apply Margin popover
  const [showMarginPopover, setShowMarginPopover] = useState(false);
  const [marginPercent, setMarginPercent] = useState('20');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const marginPopoverRef = useRef<HTMLDivElement>(null);

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
  }, [sortBy, sortOrder, category, ownerId, limit]);

  // Close margin popover on outside click
  useEffect(() => {
    if (!showMarginPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (marginPopoverRef.current && !marginPopoverRef.current.contains(e.target as Node)) {
        setShowMarginPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMarginPopover]);

  // Fetch owners for filter dropdown
  const { data: ownerData } = useQuery({
    ...api.wms.admin.stock.getByOwner.queryOptions({}),
  });

  const owners = 'owners' in (ownerData ?? {})
    ? (ownerData as { owners: Array<{ ownerId: string; ownerName: string | null; totalCases: number }> }).owners
    : [];

  // Query
  const queryInput = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      category,
      ownerId,
      sortBy,
      sortOrder,
      limit,
      offset: page * limit,
    }),
    [debouncedSearch, category, ownerId, sortBy, sortOrder, limit, page],
  );

  const { data, isLoading } = useQuery(
    api.wms.admin.stock.pricing.getProducts.queryOptions(queryInput),
  );

  const products = data?.products ?? [];
  const pagination = data?.pagination;
  const summary = data?.summary;
  const totalCount = pagination?.total ?? 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Fetch owner-specific PC prices when an owner is selected
  const lwin18s = useMemo(() => products.map((p) => p.lwin18), [products]);

  const { data: ownerPricingData } = useQuery({
    ...api.wms.admin.stock.pricing.getOwnerPricing.queryOptions({
      lwin18s,
      ownerId: ownerId!,
    }),
    enabled: !!ownerId && lwin18s.length > 0,
  });

  const ownerPriceMap = ownerPricingData?.priceMap ?? {};

  // Active filters for chips
  const activeFilters: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (category) {
    activeFilters.push({
      key: 'category',
      label: category,
      onRemove: () => setCategory(undefined),
    });
  }
  if (ownerId) {
    const ownerName = owners.find((o) => o.ownerId === ownerId)?.ownerName ?? 'Unknown';
    activeFilters.push({
      key: 'owner',
      label: ownerName,
      onRemove: () => setOwnerId(undefined),
    });
  }
  if (debouncedSearch) {
    activeFilters.push({
      key: 'search',
      label: `"${debouncedSearch}"`,
      onRemove: () => {
        setSearch('');
        setDebouncedSearch('');
      },
    });
  }

  const clearAllFilters = () => {
    setCategory(undefined);
    setOwnerId(undefined);
    setSearch('');
    setDebouncedSearch('');
  };

  // Mutations
  const setImportPriceMut = useMutation({
    ...api.wms.admin.stock.pricing.setImportPrice.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getProducts.getQueryKey() });
      toast.success('Import price updated');
    },
    onError: () => toast.error('Failed to update import price'),
  });

  const setSellingPriceMut = useMutation({
    ...api.wms.admin.stock.pricing.setSellingPrice.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getProducts.getQueryKey() });
      toast.success('PC price updated');
    },
    onError: () => toast.error('Failed to update PC price'),
  });

  const setOwnerPricingMut = useMutation({
    ...api.wms.admin.stock.pricing.setOwnerPricing.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getOwnerPricing.getQueryKey() });
      const ownerName = owners.find((o) => o.ownerId === ownerId)?.ownerName ?? 'owner';
      toast.success(`PC price updated for ${ownerName}`);
    },
    onError: () => toast.error('Failed to update owner PC price'),
  });

  const bulkApplyMarginMut = useMutation({
    ...api.wms.admin.stock.pricing.bulkApplyMargin.mutationOptions(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getProducts.getQueryKey() });
      toast.success(`Updated ${result.updated} products, skipped ${result.skipped}`);
      setShowMarginPopover(false);
    },
    onError: () => toast.error('Failed to apply margin'),
  });

  // Handlers
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortOrder('asc');
      }
    },
    [sortBy],
  );

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? (
      <IconSortAscending className="h-3.5 w-3.5" />
    ) : (
      <IconSortDescending className="h-3.5 w-3.5" />
    );
  };

  const calcMargin = (importPrice: number | null, sellPrice: number | null) => {
    if (!importPrice || !sellPrice || importPrice <= 0 || sellPrice <= 0) return null;
    return (1 - importPrice / sellPrice) * 100;
  };

  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };

  // CSV export
  const handleExport = useCallback(() => {
    if (!products.length) return;
    const rows = products.map((p) => {
      const margin = calcMargin(p.importPricePerBottle, p.sellingPricePerBottle);
      const caseConfig = p.caseConfig ?? 12;
      const inBond = p.importPricePerBottle ? p.importPricePerBottle * (1 + IN_BOND_MARKUP) : null;
      return [
        p.productName,
        p.producer ?? '',
        `${caseConfig}x${p.bottleSize ?? '75cl'}`,
        p.totalCases,
        p.importPricePerBottle?.toFixed(2) ?? '',
        p.importPricePerBottle ? (p.importPricePerBottle * caseConfig).toFixed(2) : '',
        inBond?.toFixed(2) ?? '',
        inBond ? (inBond * caseConfig).toFixed(2) : '',
        p.sellingPricePerBottle?.toFixed(2) ?? '',
        p.sellingPricePerBottle ? (p.sellingPricePerBottle * caseConfig).toFixed(2) : '',
        margin != null ? margin.toFixed(1) : '',
      ].join(',');
    });
    const header =
      'Product,Producer,Pack,Cases,Import $/btl,Import $/case,In Bond $/btl,In Bond $/case,PC Price $/btl,PC Price $/case,Margin %';
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pricing-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [products]);

  const thBase = 'cursor-pointer select-none text-xs font-medium text-text-muted';

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      {/* Breadcrumb + Header */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm text-text-muted">
          <Link href="/platform/admin/home" className="hover:text-text-primary">
            <Typography variant="bodySm">Admin</Typography>
          </Link>
          <IconChevronRight className="h-4 w-4 text-text-muted" />
          <Typography variant="bodySm">Pricing Manager</Typography>
        </div>
        <Typography variant="h2">Pricing Manager</Typography>
        <Typography variant="bodySm" className="text-text-muted">
          Import, in bond (B2B), and private client pricing
        </Typography>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Products"
          value={summary?.totalProducts?.toLocaleString() ?? '\u2014'}
          subtitle="with stock"
        />
        <KpiCard
          label="Avg Margin"
          value={summary?.avgMargin != null ? `${summary.avgMargin.toFixed(1)}%` : '\u2014'}
          color={
            summary?.avgMargin == null
              ? 'default'
              : summary.avgMargin >= 20
                ? 'green'
                : summary.avgMargin >= 10
                  ? 'amber'
                  : 'red'
          }
        />
        <KpiCard
          label="Unpriced"
          value={summary?.unpricedCount?.toString() ?? '\u2014'}
          subtitle="have import but no sell price"
          color={summary?.unpricedCount && summary.unpricedCount > 0 ? 'amber' : 'default'}
        />
        <KpiCard
          label="Total Sell Value"
          value={summary?.totalSellingValue ? formatValue(summary.totalSellingValue) : '\u2014'}
          subtitle={
            summary?.totalImportValue
              ? `Import: ${formatValue(summary.totalImportValue)}`
              : undefined
          }
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category pills */}
        <div className="flex gap-2">
          {([
            { key: 'Wine' as const, label: 'Wine' },
            { key: 'Spirits' as const, label: 'Spirits' },
            { key: 'RTD' as const, label: 'RTD' },
          ]).map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(category === cat.key ? undefined : cat.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                category === cat.key
                  ? 'bg-text-primary text-white'
                  : 'bg-surface-muted text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Owner dropdown */}
        <select
          value={ownerId ?? ''}
          onChange={(e) => setOwnerId(e.target.value || undefined)}
          className="rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm text-text-primary transition-colors focus:border-border-brand focus:outline-none"
        >
          <option value="">All Owners</option>
          {owners.map((o) => (
            <option key={o.ownerId} value={o.ownerId}>
              {o.ownerName ?? 'Unknown'} ({o.totalCases} cases)
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 lg:max-w-xs">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border-primary bg-background-primary py-2 pl-10 pr-4 text-sm transition-colors focus:border-border-brand focus:outline-none"
          />
        </div>

        {/* Apply Margin */}
        <div className="relative" ref={marginPopoverRef}>
          <button
            onClick={() => setShowMarginPopover(!showMarginPopover)}
            className="flex items-center gap-2 rounded-lg border border-border-primary bg-background-primary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
          >
            <IconPercentage className="h-4 w-4" />
            Apply Margin
          </button>
          {showMarginPopover && (
            <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-border-primary bg-background-primary p-4 shadow-lg">
              <p className="mb-3 text-sm font-medium text-text-primary">Bulk Apply Margin</p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Margin %</label>
                  <input
                    type="number"
                    value={marginPercent}
                    onChange={(e) => setMarginPercent(e.target.value)}
                    className="w-full rounded border border-border-primary bg-background-primary px-3 py-1.5 text-sm focus:border-border-brand focus:outline-none"
                    min="0.1"
                    max="99.9"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Scope</label>
                  <p className="text-xs text-text-secondary">
                    {category ? `${category} products only` : 'All categories'}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    className="rounded"
                  />
                  Overwrite existing prices
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowMarginPopover(false)}
                    className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const pct = parseFloat(marginPercent);
                      if (isNaN(pct) || pct <= 0 || pct >= 100) {
                        toast.error('Enter a valid margin between 0.1% and 99.9%');
                        return;
                      }
                      bulkApplyMarginMut.mutate({
                        marginPercent: pct,
                        category,
                        overwriteExisting,
                      });
                    }}
                    disabled={bulkApplyMarginMut.isPending}
                    className="flex items-center gap-1 rounded bg-fill-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-fill-brand/90 disabled:opacity-50"
                  >
                    {bulkApplyMarginMut.isPending && (
                      <IconLoader2 className="h-3 w-3 animate-spin" />
                    )}
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Export CSV */}
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg border border-border-primary bg-background-primary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
        >
          <IconDownload className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <span
              key={f.key}
              className="flex items-center gap-1 rounded-full border border-border-muted bg-background-primary px-3 py-1 text-xs text-text-secondary"
            >
              {f.label}
              <button
                onClick={f.onRemove}
                className="ml-0.5 rounded-full p-0.5 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
              >
                <IconX className="h-3 w-3" />
              </button>
            </span>
          ))}
          {activeFilters.length > 1 && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-text-muted">
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
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border-muted bg-surface-muted/60 backdrop-blur-sm">
                <tr>
                  <th
                    className={`px-3 py-3 text-left ${thBase}`}
                    onClick={() => handleSort('productName')}
                  >
                    <span className="flex items-center gap-1">
                      Product {renderSortIcon('productName')}
                    </span>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-text-muted">
                    Pack
                  </th>
                  <th
                    className={`px-3 py-3 text-right ${thBase}`}
                    onClick={() => handleSort('totalCases')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Cases {renderSortIcon('totalCases')}
                    </span>
                  </th>
                  <th
                    className={`px-3 py-3 text-right ${thBase}`}
                    onClick={() => handleSort('importPrice')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Import $/btl {renderSortIcon('importPrice')}
                    </span>
                  </th>
                  <th className="hidden px-3 py-3 text-right text-xs font-medium text-text-muted lg:table-cell">
                    Import $/case
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-text-muted">
                    <span className="flex items-center justify-end gap-1">
                      In Bond $/btl
                      <span className="text-[10px] font-normal text-text-muted/60">+{IN_BOND_MARKUP * 100}%</span>
                    </span>
                  </th>
                  <th className="hidden px-3 py-3 text-right text-xs font-medium text-text-muted lg:table-cell">
                    In Bond $/case
                  </th>
                  <th
                    className={`px-3 py-3 text-right ${thBase}`}
                    onClick={() => handleSort('sellingPrice')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      {ownerId ? (
                        <span className="text-violet-600">
                          PC Price $/btl
                        </span>
                      ) : (
                        'PC Price $/btl'
                      )}
                      {renderSortIcon('sellingPrice')}
                    </span>
                  </th>
                  <th className="hidden px-3 py-3 text-right text-xs font-medium text-text-muted lg:table-cell">
                    PC Price $/case
                  </th>
                  <th
                    className={`px-3 py-3 text-right ${thBase}`}
                    onClick={() => handleSort('margin')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Margin % {renderSortIcon('margin')}
                    </span>
                  </th>
                  <th className="hidden px-3 py-3 text-right text-xs font-medium text-text-muted xl:table-cell">
                    Margin $/btl
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-20 text-center text-text-muted">
                      No products found
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const caseConfig = product.caseConfig ?? 12;
                    const importPrice = product.importPricePerBottle;
                    // When owner is selected, use owner-specific PC price (fall back to default)
                    const ownerPcPrice = ownerId ? ownerPriceMap[product.lwin18] : undefined;
                    const sellPrice = ownerPcPrice ?? product.sellingPricePerBottle;
                    const hasOwnerPrice = ownerId != null && ownerPcPrice != null;
                    const margin = calcMargin(importPrice, sellPrice);
                    const marginPerBottle =
                      importPrice && sellPrice && importPrice > 0 && sellPrice > 0
                        ? sellPrice - importPrice
                        : null;

                    return (
                      <tr
                        key={product.lwin18}
                        className="transition-colors hover:bg-surface-muted/30"
                      >
                        {/* Product */}
                        <td className="px-3 py-3">
                          <p className="font-medium text-text-primary">{product.productName}</p>
                          {product.producer && (
                            <p className="text-xs text-text-muted">{product.producer}</p>
                          )}
                        </td>

                        {/* Pack */}
                        <td className="px-3 py-3 text-xs tabular-nums text-text-secondary">
                          {caseConfig}x{product.bottleSize ?? '75cl'}
                        </td>

                        {/* Cases */}
                        <td className="px-3 py-3 text-right tabular-nums font-medium">
                          {product.totalCases}
                        </td>

                        {/* Import $/btl (editable) */}
                        <PriceCell
                          value={importPrice}
                          onSave={(v) =>
                            setImportPriceMut.mutate({
                              lwin18: product.lwin18,
                              importPricePerBottle: v,
                              source: 'manual',
                            })
                          }
                        />

                        {/* Import $/case */}
                        <td className="hidden px-3 py-3 text-right tabular-nums text-text-secondary lg:table-cell">
                          {importPrice != null && importPrice > 0
                            ? `$${(importPrice * caseConfig).toFixed(2)}`
                            : '\u2014'}
                        </td>

                        {/* In Bond $/btl (computed) */}
                        {(() => {
                          const inBondPrice = importPrice != null && importPrice > 0
                            ? importPrice * (1 + IN_BOND_MARKUP)
                            : null;
                          return (
                            <>
                              <td className="px-3 py-3 text-right tabular-nums text-text-secondary">
                                {inBondPrice != null
                                  ? `$${inBondPrice.toFixed(2)}`
                                  : '\u2014'}
                              </td>

                              {/* In Bond $/case */}
                              <td className="hidden px-3 py-3 text-right tabular-nums text-text-secondary lg:table-cell">
                                {inBondPrice != null
                                  ? `$${(inBondPrice * caseConfig).toFixed(2)}`
                                  : '\u2014'}
                              </td>
                            </>
                          );
                        })()}

                        {/* PC Price $/btl (editable) */}
                        <PriceCell
                          value={sellPrice}
                          highlight={hasOwnerPrice}
                          onSave={(v) => {
                            if (ownerId) {
                              setOwnerPricingMut.mutate({
                                lwin18: product.lwin18,
                                ownerId,
                                pcSellingPricePerBottle: v,
                              });
                            } else {
                              setSellingPriceMut.mutate({
                                lwin18: product.lwin18,
                                sellingPricePerBottle: v,
                              });
                            }
                          }}
                        />

                        {/* PC Price $/case */}
                        <td className="hidden px-3 py-3 text-right tabular-nums text-text-secondary lg:table-cell">
                          {sellPrice != null && sellPrice > 0
                            ? `$${(sellPrice * caseConfig).toFixed(2)}`
                            : '\u2014'}
                        </td>

                        {/* Margin % */}
                        <td className="px-3 py-3 text-right tabular-nums">
                          <span className="flex items-center justify-end gap-1.5">
                            <MarginDot margin={margin} />
                            {margin != null ? `${margin.toFixed(1)}%` : '\u2014'}
                          </span>
                        </td>

                        {/* Margin $/btl */}
                        <td className="hidden px-3 py-3 text-right tabular-nums text-text-secondary xl:table-cell">
                          {marginPerBottle != null
                            ? `$${marginPerBottle.toFixed(2)}`
                            : '\u2014'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          {/* Page size selector */}
          <div className="flex items-center gap-1 rounded-lg border border-border-muted p-0.5">
            {PAGE_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => setLimit(size)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  limit === size
                    ? 'bg-text-primary text-white'
                    : 'text-text-muted hover:bg-surface-muted hover:text-text-primary'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
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
            <span className="px-4 text-sm tabular-nums text-text-muted">
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
        </div>
      )}
    </div>
  );
};

export default PricingManagerPage;
