'use client';

import {
  IconAdjustments,
  IconArrowsExchange,
  IconBuildingWarehouse,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheck,
  IconColumns3,
  IconDownload,
  IconLayoutRows,
  IconLock,
  IconPackage,
  IconPrinter,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTags,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import usePrint from '@/app/_wms/hooks/usePrint';
import PrinterProvider from '@/app/_wms/providers/PrinterProvider';
import { generateBatchLabelsZpl } from '@/app/_wms/utils/generateLabelZpl';
import type { LabelData } from '@/app/_wms/utils/generateLabelZpl';
import useTRPC from '@/lib/trpc/browser';

type SortField = 'productName' | 'totalCases' | 'vintage' | 'receivedAt';
type SortOrder = 'asc' | 'desc';
type QuickFilter = 'all' | 'lowStock' | 'reserved' | 'expiring' | 'ownStock' | 'consignment';
type CategoryFilter = 'Wine' | 'Spirits' | 'RTD';
type RowDensity = 'compact' | 'normal' | 'relaxed';

const DENSITY_CLASSES: Record<RowDensity, { td: string; text: string }> = {
  compact: { td: 'px-3 py-1.5', text: 'text-xs' },
  normal: { td: 'px-4 py-3', text: 'text-sm' },
  relaxed: { td: 'px-4 py-4', text: 'text-sm' },
};

const DEFAULT_COLUMNS = {
  producer: true,
  lwin18: true,
  vintage: true,
  size: true,
  pack: true,
  cases: true,
  available: true,
  reserved: true,
  locations: true,
  owners: true,
  status: true,
  bottles: true,
};

/** Load persisted preference from localStorage */
const loadPreference = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** Save preference to localStorage */
const savePreference = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail if storage is full
  }
};

// ─── Skeleton Row ───────────────────────────────────────────────────────────

const SkeletonRow = ({ density }: { density: RowDensity }) => {
  const cls = DENSITY_CLASSES[density].td;
  return (
    <tr className="border-b border-border-muted">
      <td className={cls}><div className="h-4 w-4 animate-pulse rounded bg-surface-muted" /></td>
      <td className={cls}><div className="h-4 w-48 animate-pulse rounded bg-surface-muted" /></td>
      <td className={cls}><div className="h-4 w-28 animate-pulse rounded bg-surface-muted" /></td>
      <td className={cls}><div className="h-4 w-36 animate-pulse rounded bg-surface-muted" /></td>
      <td className={cls}><div className="h-4 w-12 animate-pulse rounded bg-surface-muted" /></td>
      <td className={cls}><div className="h-4 w-10 animate-pulse rounded bg-surface-muted" /></td>
      <td className={cls}><div className="h-4 w-10 animate-pulse rounded bg-surface-muted" /></td>
      <td className={cls}><div className="h-4 w-10 animate-pulse rounded bg-surface-muted" /></td>
      <td className={cls}><div className="h-4 w-8 animate-pulse rounded bg-surface-muted" /></td>
      <td className={cls}><div className="h-4 w-8 animate-pulse rounded bg-surface-muted" /></td>
      <td className={cls}><div className="h-4 w-16 animate-pulse rounded bg-surface-muted" /></td>
    </tr>
  );
};

// ─── Status Dot ─────────────────────────────────────────────────────────────

interface StatusIndicatorProps {
  expiryStatus: string;
  availableCases: number;
}

const StatusIndicator = ({ expiryStatus, availableCases }: StatusIndicatorProps) => {
  // Priority: expired > expiring (90 days) > stock level
  if (expiryStatus === 'expired') {
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span className="text-red-600">Expired</span>
      </span>
    );
  }
  if (expiryStatus === 'warning') {
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-orange-500" />
        <span className="text-orange-600">Expiring</span>
      </span>
    );
  }
  if (availableCases === 0) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        <span className="text-text-muted">Out of Stock</span>
      </span>
    );
  }
  if (availableCases === 1) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="text-red-600">Final Case</span>
      </span>
    );
  }
  if (availableCases === 2) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="text-amber-600">Low Stock</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      <span className="text-emerald-600">Good</span>
    </span>
  );
};

// ─── Owner Badge ────────────────────────────────────────────────────────────

const OwnerBadge = ({ name }: { name: string }) => {
  const isCnC = name === 'Craft & Culture';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isCnC
          ? 'bg-fill-brand/10 text-text-brand'
          : 'bg-surface-muted text-text-secondary'
      }`}
    >
      {name}
    </span>
  );
};

// ─── Pagination Button ──────────────────────────────────────────────────────

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
    className="rounded-md p-2 text-text-muted transition-colors hover:bg-fill-primary-hover hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {icon}
  </button>
);

// ─── Print Cell ─────────────────────────────────────────────────────────────

interface PrintCellProps {
  maxQty: number;
  onPrint: (qty: number) => void;
}

const PrintCell = ({ maxQty, onPrint }: PrintCellProps) => {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(maxQty);

  if (!editing) {
    return (
      <td className="px-3 py-2 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setQty(maxQty);
            setEditing(true);
          }}
          className="rounded p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-brand"
          title="Print labels"
        >
          <IconPrinter className="h-4 w-4" />
        </button>
      </td>
    );
  }

  return (
    <td className="px-3 py-2 text-right">
      <div className="flex items-center justify-end gap-1.5">
        <input
          type="number"
          min={1}
          max={maxQty}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))}
          onClick={(e) => e.stopPropagation()}
          className="w-12 rounded border border-border-primary bg-background-primary px-1.5 py-0.5 text-center text-xs tabular-nums focus:border-border-brand focus:outline-none"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrint(qty);
            setEditing(false);
          }}
          className="rounded bg-fill-brand px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-fill-brand/90"
        >
          Print
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditing(false);
          }}
          className="rounded p-0.5 text-text-muted hover:text-text-primary"
        >
          <IconX className="h-3 w-3" />
        </button>
      </div>
    </td>
  );
};

// ─── Product Row ────────────────────────────────────────────────────────────

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
    totalBottles: number;
    locations: {
      stockId: string;
      locationCode: string;
      locationType: string;
      storageMethod: string | null;
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
  density: RowDensity;
  visibleColumns: Record<string, boolean>;
  onPrintLabels: (product: ProductRowProps['product'], loc: ProductRowProps['product']['locations'][number], qty: number) => void;
}

const ProductRow = ({ product, isExpanded, onToggle, density, visibleColumns, onPrintLabels }: ProductRowProps) => {
  const dc = DENSITY_CLASSES[density];
  const tdClass = dc.td;
  const tdClassRight = `${dc.td} text-right tabular-nums`;

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-border-muted transition-colors hover:bg-surface-muted ${dc.text}`}
      >
        {/* Expand chevron */}
        <td className={`${tdClass} w-8 text-text-muted`}>
          <IconChevronDown
            className={`h-4 w-4 transition-transform ${isExpanded ? 'text-text-brand' : '-rotate-90'}`}
          />
        </td>

        {/* Product name */}
        <td className={`${tdClass} max-w-[280px] truncate font-medium text-text-primary`}>
          {product.productName}
        </td>

        {/* Producer */}
        {visibleColumns.producer && (
          <td className={`${tdClass} hidden max-w-[160px] truncate text-text-muted lg:table-cell`}>
            {product.producer ?? '—'}
          </td>
        )}

        {/* LWIN18 */}
        {visibleColumns.lwin18 && (
          <td className={`${tdClass} hidden font-mono text-xs text-text-muted xl:table-cell`}>
            {product.lwin18}
          </td>
        )}

        {/* Vintage */}
        {visibleColumns.vintage && (
          <td className={`${tdClass} text-text-primary`}>{product.vintage ?? '—'}</td>
        )}

        {/* Size */}
        {visibleColumns.size && (
          <td className={`${tdClass} hidden text-text-muted 2xl:table-cell`}>
            {product.bottleSize ?? '75cl'}
          </td>
        )}

        {/* Pack */}
        {visibleColumns.pack && (
          <td className={`${tdClass} hidden text-text-muted 2xl:table-cell`}>
            {product.caseConfig ?? 12}
          </td>
        )}

        {/* Cases */}
        {visibleColumns.cases && (
          <td className={`${tdClassRight} text-base font-bold text-text-primary`}>
            {product.totalCases}
          </td>
        )}

        {/* Available */}
        {visibleColumns.available && (
          <td className={tdClassRight}>
            <span className={product.availableCases > 0 ? 'font-semibold text-text-brand' : 'text-text-muted'}>
              {product.availableCases}
            </span>
          </td>
        )}

        {/* Reserved */}
        {visibleColumns.reserved && (
          <td className={tdClassRight}>
            {product.reservedCases > 0 ? (
              <span className="font-medium text-amber-600">{product.reservedCases}</span>
            ) : (
              <span className="text-text-muted">—</span>
            )}
          </td>
        )}

        {/* Bottles */}
        {visibleColumns.bottles && (
          <td className={`${tdClassRight} hidden text-text-muted md:table-cell`}>
            {product.totalBottles}
          </td>
        )}

        {/* Locations */}
        {visibleColumns.locations && (
          <td className={`${tdClassRight} hidden text-text-muted md:table-cell`}>
            {product.locationCount}
          </td>
        )}

        {/* Owners */}
        {visibleColumns.owners && (
          <td className={`${tdClassRight} hidden text-text-muted lg:table-cell`}>
            {product.ownerCount}
          </td>
        )}

        {/* Status */}
        {visibleColumns.status && (
          <td className={`${tdClass} hidden lg:table-cell`}>
            <StatusIndicator
              expiryStatus={product.expiryStatus}
              availableCases={product.availableCases}
            />
          </td>
        )}
      </tr>

      {/* Expanded location breakdown */}
      {isExpanded && product.locations.length > 0 && (
        <tr>
          <td colSpan={20} className="bg-surface-muted px-0 py-0">
            <div className="border-b border-border-muted px-8 py-4">
              <div className="mb-3 flex items-center justify-between">
                <Typography variant="bodyXs" className="font-semibold uppercase tracking-wider text-text-muted">
                  Location Breakdown — {product.locations.length} record{product.locations.length !== 1 ? 's' : ''}
                </Typography>
                <div className="flex gap-2">
                  <Link
                    href={`/platform/admin/wms/transfer?lwin18=${product.lwin18}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="outline" size="xs">
                      <IconArrowsExchange className="mr-1 h-3 w-3" />
                      Transfer
                    </Button>
                  </Link>
                  <Link
                    href={`/platform/admin/wms/labels?search=${product.lwin18}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="outline" size="xs">
                      <IconTags className="mr-1 h-3 w-3" />
                      Labels
                    </Button>
                  </Link>
                  <Link
                    href={`/platform/admin/wms/stock/adjust?lwin18=${product.lwin18}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="outline" size="xs">
                      <IconAdjustments className="mr-1 h-3 w-3" />
                      Adjust
                    </Button>
                  </Link>
                </div>
              </div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-text-muted">
                    <th className="px-3 py-1.5 text-left">Location</th>
                    <th className="px-3 py-1.5 text-left">Storage</th>
                    <th className="px-3 py-1.5 text-right">Qty</th>
                    <th className="px-3 py-1.5 text-right">Avail</th>
                    <th className="w-[100px] px-3 py-1.5 text-left" />
                    <th className="px-3 py-1.5 text-left">Owner</th>
                    <th className="px-3 py-1.5 text-left">Lot</th>
                    <th className="px-3 py-1.5 text-left">Expiry</th>
                    <th className="px-3 py-1.5 text-right">Print</th>
                  </tr>
                </thead>
                <tbody>
                  {product.locations.map((loc) => {
                    // Availability ratio: how much of this location's stock is available
                    const availPercent = loc.quantityCases > 0
                      ? (loc.availableCases / loc.quantityCases) * 100
                      : 0;
                    const barColor = availPercent === 100
                      ? 'bg-emerald-500'
                      : availPercent >= 50
                        ? 'bg-fill-brand'
                        : availPercent > 0
                          ? 'bg-amber-500'
                          : 'bg-gray-300';
                    const storageLabel = loc.storageMethod === 'pallet'
                      ? 'Pallet'
                      : loc.storageMethod === 'mixed'
                        ? 'Mixed'
                        : 'Shelf';

                    return (
                      <tr key={loc.stockId} className="border-t border-border-muted">
                        <td className="px-3 py-2 font-mono text-xs font-medium text-text-brand">
                          {loc.locationCode}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            loc.storageMethod === 'pallet'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-50 text-blue-600'
                          }`}>
                            {storageLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-text-primary">
                          {loc.quantityCases}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-primary">
                          {loc.availableCases}
                        </td>
                        <td className="px-3 py-2">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-muted">
                            <div
                              className={`h-full rounded-full ${barColor} transition-all`}
                              style={{ width: `${Math.min(availPercent, 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <OwnerBadge name={loc.ownerName} />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-text-muted">
                          {loc.lotNumber ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-text-muted">
                          {loc.expiryDate
                            ? new Date(loc.expiryDate).toLocaleDateString('en-GB')
                            : '—'}
                        </td>
                        <PrintCell
                          maxQty={loc.quantityCases}
                          onPrint={(qty) => onPrintLabels(product, loc, qty)}
                        />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Column Toggle Popover ──────────────────────────────────────────────────

interface ColumnToggleProps {
  columns: Record<string, boolean>;
  onChange: (columns: Record<string, boolean>) => void;
}

const COLUMN_LABELS: Record<string, string> = {
  producer: 'Producer',
  lwin18: 'LWIN18',
  vintage: 'Vintage',
  size: 'Bottle Size',
  pack: 'Case Pack',
  cases: 'Total Cases',
  available: 'Available',
  reserved: 'Reserved',
  bottles: 'Bottles',
  locations: 'Locations',
  owners: 'Owners',
  status: 'Status',
};

const ColumnToggle = ({ columns, onChange }: ColumnToggleProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
        <IconColumns3 className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-border-muted bg-background-primary p-2 shadow-lg">
          <Typography variant="bodyXs" className="mb-2 px-2 font-semibold uppercase tracking-wider text-text-muted">
            Columns
          </Typography>
          {Object.entries(COLUMN_LABELS).map(([key, label]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-muted"
            >
              <input
                type="checkbox"
                checked={columns[key] ?? true}
                onChange={(e) => {
                  const next = { ...columns, [key]: e.target.checked };
                  onChange(next);
                }}
                className="rounded border-border-primary accent-fill-brand"
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ──────────────────────────────────────────────────────────────

/**
 * Stock Explorer — best-in-class warehouse inventory search, filter, and analysis tool
 */
const StockExplorerPage = () => {
  const api = useTRPC();
  const { print } = usePrint();

  // Search & filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [vintageFrom, setVintageFrom] = useState('');
  const [vintageTo, setVintageTo] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [category, setCategory] = useState<CategoryFilter | undefined>('Wine');
  const [sortBy, setSortBy] = useState<SortField>('totalCases');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(50);

  // Persisted preferences
  const [density, setDensity] = useState<RowDensity>(() => loadPreference('se-density', 'normal'));
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() =>
    loadPreference('se-columns', DEFAULT_COLUMNS),
  );

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
  }, [ownerId, vintageFrom, vintageTo, sortBy, sortOrder, quickFilter, category]);

  // Persist preferences
  useEffect(() => {
    savePreference('se-density', density);
  }, [density]);
  useEffect(() => {
    savePreference('se-columns', visibleColumns);
  }, [visibleColumns]);

  // Fetch stock data
  const { data: stockData, isLoading } = useQuery({
    ...api.wms.admin.stock.getByProduct.queryOptions({
      search: debouncedSearch || undefined,
      ownerId: ownerId || undefined,
      category: category || undefined,
      quickFilter: quickFilter !== 'all' ? quickFilter : undefined,
      vintageFrom: vintageFrom ? Number(vintageFrom) : undefined,
      vintageTo: vintageTo ? Number(vintageTo) : undefined,
      sortBy,
      sortOrder,
      limit,
      offset: page * limit,
    }),
  });

  // Fetch overview for KPI cards
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

  // Composite key for rows: lwin18 + caseConfig to distinguish pack sizes
  const rowKey = useCallback(
    (product: { lwin18: string; caseConfig: number | null }) =>
      `${product.lwin18}-${product.caseConfig ?? 0}`,
    [],
  );

  // Toggle row expansion
  const toggleRow = useCallback((key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
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
      'Bottles',
      'Locations',
      'Owners',
      'Status',
    ];
    const csvSafe = (val: string | number | null | undefined) => {
      const str = String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = products.map((p) => [
      csvSafe(p.productName),
      csvSafe(p.producer),
      csvSafe(p.lwin18),
      csvSafe(p.vintage),
      csvSafe(p.bottleSize),
      csvSafe(p.caseConfig),
      csvSafe(p.totalCases),
      csvSafe(p.availableCases),
      csvSafe(p.reservedCases),
      csvSafe(p.totalBottles),
      csvSafe(p.locationCount),
      csvSafe(p.ownerCount),
      csvSafe(p.expiryStatus),
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
    setCategory('Wine');
    setVintageFrom('');
    setVintageTo('');
    setQuickFilter('all');
    setSortBy('totalCases');
    setSortOrder('desc');
    setPage(0);
  }, []);

  // Print labels handler
  const handlePrintLabels = useCallback(
    async (
      product: ProductRowProps['product'],
      loc: ProductRowProps['product']['locations'][number],
      qty: number,
    ) => {
      const packSize = `${product.caseConfig ?? 12}x${((Number(product.bottleSize?.replace(/[^\d]/g, '')) || 750) / 10).toFixed(0)}cl`;
      const labels: LabelData[] = Array.from({ length: qty }, () => ({
        productName: product.productName,
        lwin18: product.lwin18,
        packSize,
        vintage: product.vintage ?? undefined,
        locationCode: loc.locationCode,
        owner: loc.ownerName,
        lotNumber: loc.lotNumber ?? undefined,
        showBarcode: false,
        showQr: true,
      }));
      const zpl = generateBatchLabelsZpl(labels);
      const success = await print(zpl, '4x2');
      if (success) {
        toast.success(`Printing ${qty} label${qty !== 1 ? 's' : ''} for ${product.productName}`);
      } else {
        toast.error('Print failed — check printer connection');
      }
    },
    [print],
  );

  const hasActiveFilters = debouncedSearch || ownerId || vintageFrom || vintageTo || quickFilter !== 'all';

  // Find the selected owner name for filter chips
  const selectedOwnerName = useMemo(() => {
    if (!ownerId) return '';
    return owners.find((o) => o.ownerId === ownerId)?.ownerName ?? '';
  }, [ownerId, owners]);

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? (
      <IconSortAscending className="h-3.5 w-3.5" />
    ) : (
      <IconSortDescending className="h-3.5 w-3.5" />
    );
  };

  const thBase =
    'text-xs font-medium uppercase tracking-wider text-text-muted cursor-pointer select-none transition-colors hover:text-text-brand';
  const dc = DENSITY_CLASSES[density];

  // Quick filter definitions
  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'lowStock', label: 'Low Stock' },
    { key: 'reserved', label: 'Reserved' },
    { key: 'expiring', label: 'Expiring' },
    { key: 'ownStock', label: 'C&C Only' },
    { key: 'consignment', label: 'Consignment' },
  ];

  // Compute col count for colSpan
  const visibleColCount = 2 + Object.values(visibleColumns).filter(Boolean).length;

  return (
    <div className="container mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link
                href="/platform/admin"
                className="text-text-muted transition-colors hover:text-text-primary"
              >
                <Typography variant="bodySm">Admin</Typography>
              </Link>
              <IconChevronRight className="h-4 w-4 text-text-muted" />
              <Typography variant="bodySm">Stock Explorer</Typography>
            </div>
            <Typography variant="headingLg" className="mb-1">
              Stock Explorer
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              Full warehouse inventory — search, filter, analyze, and export
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            {/* Density toggle */}
            <div className="flex items-center rounded-lg border border-border-muted">
              {(['compact', 'normal', 'relaxed'] as RowDensity[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={`px-2 py-1.5 transition-colors ${
                    density === d
                      ? 'bg-fill-brand/10 text-text-brand'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  title={`${d} density`}
                >
                  <IconLayoutRows
                    className="h-4 w-4"
                    strokeWidth={d === 'compact' ? 2.5 : d === 'normal' ? 2 : 1.5}
                  />
                </button>
              ))}
            </div>

            {/* Column toggle */}
            <ColumnToggle columns={visibleColumns} onChange={setVisibleColumns} />

            {/* Export */}
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!products.length}>
              <IconDownload className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        {overview && (
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
            {/* Total Stock */}
            <div className="rounded-lg border border-border-muted bg-background-primary px-3 py-2.5 text-center">
              <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-500">
                <IconPackage size={13} />
              </div>
              <div className="text-lg font-bold leading-tight">{overview.summary.totalCases.toLocaleString()}</div>
              <div className="text-[11px] text-text-muted">Cases</div>
              <div className="text-[10px] text-text-muted">{overview.summary.uniqueProducts} products</div>
            </div>

            {/* Available */}
            <div className="rounded-lg border border-border-muted bg-background-primary px-3 py-2.5 text-center">
              <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-500">
                <IconCircleCheck size={13} />
              </div>
              <div className="text-lg font-bold leading-tight text-emerald-600">
                {overview.summary.availableCases.toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted">Available</div>
              <div className="text-[10px] text-text-muted">
                {overview.summary.totalCases > 0
                  ? `${Math.round((overview.summary.availableCases / overview.summary.totalCases) * 100)}%`
                  : '—'}
              </div>
            </div>

            {/* Reserved */}
            <div className="rounded-lg border border-border-muted bg-background-primary px-3 py-2.5 text-center">
              <div className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md ${
                overview.summary.reservedCases > 0 ? 'bg-amber-50 text-amber-500' : 'bg-gray-50 text-gray-300'
              }`}>
                <IconLock size={13} />
              </div>
              <div className={`text-lg font-bold leading-tight ${overview.summary.reservedCases > 0 ? 'text-amber-600' : ''}`}>
                {overview.summary.reservedCases.toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted">Reserved</div>
              <div className="text-[10px] text-text-muted">
                {overview.summary.reservedCases > 0 ? 'Allocated' : 'None'}
              </div>
            </div>

            {/* Utilization */}
            <div className="rounded-lg border border-border-muted bg-background-primary px-3 py-2.5 text-center">
              <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-500">
                <IconBuildingWarehouse size={13} />
              </div>
              <div className="text-lg font-bold leading-tight">{overview.locations.utilizationPercent}%</div>
              <div className="text-[11px] text-text-muted">Utilization</div>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-border-muted">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${overview.locations.utilizationPercent}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-text-muted">
                  {overview.locations.occupied}/{overview.locations.active}
                </span>
              </div>
            </div>

            {/* Movements */}
            <div className="rounded-lg border border-border-muted bg-background-primary px-3 py-2.5 text-center">
              <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-cyan-50 text-cyan-500">
                <IconArrowsExchange size={13} />
              </div>
              <div className="text-lg font-bold leading-tight">{overview.movements.last7Days}</div>
              <div className="text-[11px] text-text-muted">Moves (7d)</div>
              <div className="text-[10px] text-text-muted">{overview.movements.last24Hours} today</div>
            </div>

            {/* Owners */}
            <div className="rounded-lg border border-border-muted bg-background-primary px-3 py-2.5 text-center">
              <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-500">
                <IconUsers size={13} />
              </div>
              <div className="text-lg font-bold leading-tight">{overview.summary.uniqueOwners}</div>
              <div className="text-[11px] text-text-muted">Owners</div>
              <div className="truncate text-[10px] text-text-muted">
                {overview.topOwners[0]
                  ? `${overview.topOwners[0].ownerName}: ${overview.topOwners[0].totalCases}`
                  : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[280px] flex-1">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, producer, LWIN18..."
              className="w-full rounded-lg border border-border-primary bg-background-primary py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-border-brand"
            />
          </div>

          {/* Owner filter */}
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="rounded-lg border border-border-primary bg-background-primary px-3 py-2.5 text-sm text-text-primary focus:border-border-brand focus:outline-none"
          >
            <option value="">All Owners</option>
            {owners.map((o) => (
              <option key={o.ownerId} value={o.ownerId}>
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
              className="w-20 rounded-lg border border-border-primary bg-background-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-brand focus:outline-none"
            />
            <span className="text-text-muted">—</span>
            <input
              type="number"
              value={vintageTo}
              onChange={(e) => setVintageTo(e.target.value)}
              placeholder="To"
              min={1900}
              max={2100}
              className="w-20 rounded-lg border border-border-primary bg-background-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-brand focus:outline-none"
            />
          </div>
        </div>

        {/* Category + Quick Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category pills */}
          {([
            { key: 'Wine' as const, label: 'Wine' },
            { key: 'Spirits' as const, label: 'Spirits' },
            { key: 'RTD' as const, label: 'RTD' },
          ]).map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(category === cat.key ? undefined : cat.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                category === cat.key
                  ? 'bg-text-primary text-white'
                  : 'bg-surface-muted text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
              }`}
            >
              {cat.label}
            </button>
          ))}

          {/* Divider */}
          <div className="mx-1 h-4 w-px bg-border-muted" />

          {/* Quick filters */}
          {quickFilters.map((qf) => (
            <button
              key={qf.key}
              onClick={() => setQuickFilter(qf.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                quickFilter === qf.key
                  ? 'bg-fill-brand text-white'
                  : 'bg-surface-muted text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
              }`}
            >
              {qf.label}
            </button>
          ))}
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {debouncedSearch && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-muted bg-background-primary px-3 py-1 text-xs text-text-secondary">
                Search: &ldquo;{debouncedSearch}&rdquo;
                <button onClick={() => { setSearch(''); setDebouncedSearch(''); }} className="text-text-muted hover:text-text-primary">
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedOwnerName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-muted bg-background-primary px-3 py-1 text-xs text-text-secondary">
                Owner: {selectedOwnerName}
                <button onClick={() => setOwnerId('')} className="text-text-muted hover:text-text-primary">
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            )}
            {(vintageFrom || vintageTo) && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-muted bg-background-primary px-3 py-1 text-xs text-text-secondary">
                Vintage: {vintageFrom || '...'} — {vintageTo || '...'}
                <button onClick={() => { setVintageFrom(''); setVintageTo(''); }} className="text-text-muted hover:text-text-primary">
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            )}
            {quickFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-muted bg-background-primary px-3 py-1 text-xs text-text-secondary">
                Filter: {quickFilters.find((q) => q.key === quickFilter)?.label}
                <button onClick={() => setQuickFilter('all')} className="text-text-muted hover:text-text-primary">
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results count + pagination info */}
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
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className={`w-full ${dc.text}`}>
                <thead className="sticky top-0 z-10 border-b border-border-muted bg-background-primary">
                  <tr>
                    <th className={`${dc.td} w-8`} />
                    <th
                      className={`${dc.td} text-left ${thBase}`}
                      onClick={() => handleSort('productName')}
                    >
                      <span className="flex items-center gap-1">
                        Product {renderSortIcon('productName')}
                      </span>
                    </th>
                    {visibleColumns.producer && (
                      <th className={`${dc.td} hidden text-left lg:table-cell ${thBase}`}>
                        Producer
                      </th>
                    )}
                    {visibleColumns.lwin18 && (
                      <th className={`${dc.td} hidden text-left xl:table-cell ${thBase}`}>
                        LWIN18
                      </th>
                    )}
                    {visibleColumns.vintage && (
                      <th
                        className={`${dc.td} text-left ${thBase}`}
                        onClick={() => handleSort('vintage')}
                      >
                        <span className="flex items-center gap-1">
                          Vintage {renderSortIcon('vintage')}
                        </span>
                      </th>
                    )}
                    {visibleColumns.size && (
                      <th className={`${dc.td} hidden text-left 2xl:table-cell ${thBase}`}>
                        Size
                      </th>
                    )}
                    {visibleColumns.pack && (
                      <th className={`${dc.td} hidden text-left 2xl:table-cell ${thBase}`}>
                        Pack
                      </th>
                    )}
                    {visibleColumns.cases && (
                      <th
                        className={`${dc.td} text-right ${thBase}`}
                        onClick={() => handleSort('totalCases')}
                      >
                        <span className="flex items-center justify-end gap-1">
                          Cases {renderSortIcon('totalCases')}
                        </span>
                      </th>
                    )}
                    {visibleColumns.available && (
                      <th className={`${dc.td} text-right ${thBase}`}>Avail</th>
                    )}
                    {visibleColumns.reserved && (
                      <th className={`${dc.td} text-right ${thBase}`}>Rsvd</th>
                    )}
                    {visibleColumns.bottles && (
                      <th className={`${dc.td} hidden text-right md:table-cell ${thBase}`}>
                        Btls
                      </th>
                    )}
                    {visibleColumns.locations && (
                      <th className={`${dc.td} hidden text-right md:table-cell ${thBase}`}>
                        Locs
                      </th>
                    )}
                    {visibleColumns.owners && (
                      <th className={`${dc.td} hidden text-right lg:table-cell ${thBase}`}>
                        Owners
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th className={`${dc.td} hidden text-left lg:table-cell ${thBase}`}>
                        Status
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <SkeletonRow key={i} density={density} />
                    ))
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColCount} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
                            <IconSearch className="h-6 w-6 text-text-muted" />
                          </div>
                          <div>
                            <Typography variant="bodySm" className="font-medium">
                              {hasActiveFilters ? 'No stock matches your filters' : 'No inventory yet'}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                              {hasActiveFilters
                                ? 'Try adjusting your search or clearing filters'
                                : 'Import stock from Zoho or receive a shipment to get started'}
                            </Typography>
                          </div>
                          {hasActiveFilters ? (
                            <Button variant="outline" size="sm" onClick={clearFilters}>
                              Clear Filters
                            </Button>
                          ) : (
                            <Link href="/platform/admin/wms/receive">
                              <Button variant="primary" size="sm">Go to Receiving</Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => {
                      const key = rowKey(product);
                      const isExpanded = expandedRows.has(key);
                      return (
                        <ProductRow
                          key={key}
                          product={product}
                          isExpanded={isExpanded}
                          onToggle={() => toggleRow(key)}
                          density={density}
                          visibleColumns={visibleColumns}
                          onPrintLabels={handlePrintLabels}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination + page size */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted">Show</span>
            {[50, 100, 200].map((size) => (
              <button
                key={size}
                onClick={() => {
                  setLimit(size);
                  setPage(0);
                }}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  limit === size
                    ? 'bg-text-primary text-white'
                    : 'bg-fill-secondary text-text-secondary hover:bg-fill-tertiary'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          {totalPages > 1 && (
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
          )}
        </div>
      </div>
    </div>
  );
};

/** Wrap in PrinterProvider since Stock Explorer is outside the WMS layout */
const StockExplorerWithPrinter = () => (
  <PrinterProvider>
    <StockExplorerPage />
  </PrinterProvider>
);

export default StockExplorerWithPrinter;
