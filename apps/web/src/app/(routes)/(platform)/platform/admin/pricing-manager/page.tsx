'use client';

import {
  IconAlertTriangle,
  IconBottle,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCurrencyDollar,
  IconDownload,
  IconLoader2,
  IconPencil,
  IconPercentage,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTrendingDown,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

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
  sub,
  suggested,
  variant = 'muted',
  tdClassName = '',
}: {
  value: number | null;
  onSave: (v: number) => void;
  highlight?: boolean;
  /** small per-case (or secondary) figure shown under the price */
  sub?: string;
  /** value is computed from a margin %, not saved — render as a hint */
  suggested?: boolean;
  variant?: 'muted' | 'prominent';
  tdClassName?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toFixed(2) ?? '');

  const valueColor = suggested
    ? 'italic text-violet-400'
    : highlight
      ? 'text-violet-600 font-semibold'
      : variant === 'prominent'
        ? 'font-semibold text-text-primary'
        : 'text-text-secondary';

  if (!editing) {
    return (
      <td className={`px-3 py-2.5 text-right tabular-nums ${tdClassName}`}>
        <button
          type="button"
          className={`group/edit inline-flex items-center gap-1 hover:underline ${valueColor}`}
          onClick={() => {
            setDraft(value?.toFixed(2) ?? '');
            setEditing(true);
          }}
        >
          {value != null && value > 0 ? (
            `${suggested ? '~' : ''}$${value.toFixed(2)}`
          ) : (
            <span className="text-text-muted/40">—</span>
          )}
          <IconPencil className="h-3 w-3 opacity-0 transition-opacity group-hover/edit:opacity-60" />
        </button>
        {sub && value != null && value > 0 && (
          <div className="text-[10px] tabular-nums text-text-muted/60">{sub}</div>
        )}
      </td>
    );
  }

  return (
    <td className={`px-3 py-2.5 ${tdClassName}`}>
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

// ─── Override Cell (manual landed-cost adjustment, signed / clearable) ─────────

const OverrideCell = ({
  value,
  onSave,
  tdClassName = '',
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  tdClassName?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? value.toFixed(2) : '');

  if (!editing) {
    const has = value != null && value !== 0;
    return (
      <td className={`px-3 py-2.5 text-right tabular-nums ${tdClassName}`}>
        <button
          type="button"
          className={`group/edit inline-flex items-center gap-1 hover:underline ${
            has ? (value! < 0 ? 'text-red-500' : 'font-medium text-text-secondary') : 'text-text-muted/40'
          }`}
          onClick={() => {
            setDraft(value != null ? value.toFixed(2) : '');
            setEditing(true);
          }}
        >
          {has ? (
            `${value! >= 0 ? '+' : '−'}$${Math.abs(value!).toFixed(2)}`
          ) : (
            <span className="text-text-muted/40">—</span>
          )}
          <IconPencil className="h-3 w-3 opacity-0 transition-opacity group-hover/edit:opacity-60" />
        </button>
      </td>
    );
  }

  return (
    <td className={`px-3 py-2.5 ${tdClassName}`}>
      <form
        className="flex items-center justify-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (t === '') {
            onSave(null);
          } else {
            const num = parseFloat(t);
            if (!isNaN(num) && num !== value) onSave(num);
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
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditing(false);
              setDraft(value != null ? value.toFixed(2) : '');
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

const KPI_THEMES = {
  default: { text: 'text-text-primary', chip: 'bg-surface-muted text-text-muted', ring: 'ring-text-primary' },
  green: { text: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-500', ring: 'ring-emerald-400' },
  amber: { text: 'text-amber-600', chip: 'bg-amber-50 text-amber-500', ring: 'ring-amber-400' },
  red: { text: 'text-red-600', chip: 'bg-red-50 text-red-500', ring: 'ring-red-400' },
  brand: { text: 'text-text-primary', chip: 'bg-fill-brand/10 text-fill-brand', ring: 'ring-fill-brand' },
} as const;

const KpiCard = ({
  label,
  value,
  subtitle,
  color = 'default',
  icon,
  onClick,
  active,
}: {
  label: string;
  value: string;
  subtitle?: string;
  color?: keyof typeof KPI_THEMES;
  icon?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) => {
  const theme = KPI_THEMES[color];

  const inner = (
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </p>
        {icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${theme.chip}`}>
            {icon}
          </span>
        )}
      </div>
      <p className={`mt-3 text-3xl font-bold tracking-tight tabular-nums ${theme.text}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-text-muted">{subtitle}</p>}
      {onClick && (
        <p className="mt-2 text-[11px] font-medium text-fill-brand">
          {active ? '✓ Filtering — click to clear' : 'Click to filter →'}
        </p>
      )}
    </CardContent>
  );

  return (
    <Card
      className={`overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${active ? `ring-2 ${theme.ring}` : ''}`}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="w-full text-left transition-colors hover:bg-surface-muted/40"
        >
          {inner}
        </button>
      ) : (
        inner
      )}
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
    {Array.from({ length: 8 }).map((_, i) => (
      <td key={i} className="px-3 py-3">
        <div className="ml-auto h-4 w-14 animate-pulse rounded bg-surface-muted" />
      </td>
    ))}
  </tr>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const PricingManagerPage = () => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);

  // State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter | undefined>('Wine');
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortField>('productName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState<number>(50);

  // Flat logistics cost per bottle (added to import → landed cost). Persisted.
  const [logisticsPerBottle, setLogisticsPerBottle] = useState<number>(() => {
    if (typeof window === 'undefined') return 25;
    const stored = Number(localStorage.getItem('pm-logistics-per-bottle'));
    return Number.isFinite(stored) && stored >= 0 ? stored : 25;
  });
  useEffect(() => {
    localStorage.setItem('pm-logistics-per-bottle', String(logisticsPerBottle));
  }, [logisticsPerBottle]);

  // Adjustable in-bond (B2B) markup %, applied on landed cost. Persisted.
  const [inBondMarkupPct, setInBondMarkupPct] = useState<number>(() => {
    if (typeof window === 'undefined') return IN_BOND_MARKUP * 100;
    const stored = Number(localStorage.getItem('pm-inbond-markup-pct'));
    return Number.isFinite(stored) && stored >= 0 ? stored : IN_BOND_MARKUP * 100;
  });
  useEffect(() => {
    localStorage.setItem('pm-inbond-markup-pct', String(inBondMarkupPct));
  }, [inBondMarkupPct]);

  // Price-gap quick filter
  const [priceFilter, setPriceFilter] = useState<
    'unpriced' | 'lossMaking' | 'noImport' | undefined
  >(undefined);
  const [includeInbound, setIncludeInbound] = useState(false);

  // Per-owner pricing settings (logistics / in-bond margin / PC margin)
  const { data: ownerSettings } = useQuery({
    ...api.wms.admin.stock.pricing.getOwnerSettings.queryOptions({ ownerId: ownerId ?? '' }),
    enabled: !!ownerId,
  });
  const [ownerDraft, setOwnerDraft] = useState<{
    logistics: number;
    inbondPct: number;
    pcPct: number | null;
  }>({ logistics: 25, inbondPct: 10, pcPct: null });
  useEffect(() => {
    if (ownerSettings) {
      setOwnerDraft({
        logistics: ownerSettings.logisticsPerBottle,
        inbondPct: ownerSettings.inbondMarginPct,
        pcPct: ownerSettings.pcMarginPct,
      });
    }
  }, [ownerSettings]);

  const setOwnerSettingsMut = useMutation({
    ...api.wms.admin.stock.pricing.setOwnerSettings.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.stock.pricing.getOwnerSettings.getQueryKey(),
      });
    },
    onError: () => toast.error('Failed to save owner settings'),
  });
  const saveOwnerSettings = (draft: {
    logistics: number;
    inbondPct: number;
    pcPct: number | null;
  }) => {
    if (!ownerId) return;
    setOwnerSettingsMut.mutate({
      ownerId,
      logisticsPerBottle: draft.logistics,
      inbondMarginPct: draft.inbondPct,
      pcMarginPct: draft.pcPct,
    });
  };

  // Effective rates: owner settings when an owner is selected, else global defaults
  const effLogistics = ownerId ? ownerDraft.logistics : logisticsPerBottle;
  const effInbondPct = ownerId ? ownerDraft.inbondPct : inBondMarkupPct;
  // In-Bond is a MARGIN on landed cost: price = landed / (1 - margin%)
  const effInbondDivisor = effInbondPct < 100 ? 1 - effInbondPct / 100 : null;
  // Per-owner PC margin — when set, computes a suggested PC price off landed
  const effPcPct = ownerId ? ownerDraft.pcPct : null;
  const effPcDivisor = effPcPct != null && effPcPct < 100 ? 1 - effPcPct / 100 : null;

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
  }, [sortBy, sortOrder, category, ownerId, priceFilter, includeInbound, limit]);

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
      priceFilter,
      includeInbound,
      sortBy,
      sortOrder,
      limit,
      offset: page * limit,
    }),
    [debouncedSearch, category, ownerId, priceFilter, includeInbound, sortBy, sortOrder, limit, page],
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
    setPriceFilter(undefined);
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

  const setCostOverrideMut = useMutation({
    ...api.wms.admin.stock.pricing.setCostOverride.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getProducts.getQueryKey() });
      toast.success('Cost override updated');
    },
    onError: () => toast.error('Failed to update cost override'),
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
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getOwnerPricing.getQueryKey() });
      const scope = ownerId
        ? owners.find((o) => o.ownerId === ownerId)?.ownerName ?? 'owner'
        : 'default PC';
      toast.success(`${scope}: updated ${result.updated}, skipped ${result.skipped}`);
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

  // Excel export — pages through ALL filtered rows (not just the current page)
  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const pageSize = 200;
      const all: typeof products = [];
      for (let offset = 0; offset < 20000; offset += pageSize) {
        const res = await trpcClient.wms.admin.stock.pricing.getProducts.query({
          search: debouncedSearch || undefined,
          category,
          ownerId,
          priceFilter,
          sortBy,
          sortOrder,
          limit: pageSize,
          offset,
        });
        all.push(...res.products);
        if (!res.pagination.hasMore) break;
      }
      if (!all.length) {
        toast.info('No products to export');
        return;
      }

      // Owner-specific PC prices when an owner is selected
      const ownerPrices: Record<string, number> = {};
      if (ownerId) {
        const lwins = [...new Set(all.map((p) => p.lwin18))];
        for (let i = 0; i < lwins.length; i += 500) {
          const partial = await trpcClient.wms.admin.stock.pricing.getOwnerPricing.query({
            lwin18s: lwins.slice(i, i + 500),
            ownerId,
          });
          Object.assign(ownerPrices, partial.priceMap);
        }
      }

      const XLSX = await import('xlsx');
      const aoa: (string | number)[][] = [[
        'Product', 'Producer', 'Pack', 'Cases', 'Import $/btl', 'Logistics $/btl',
        'Override $/btl', 'Landed $/btl', 'Import $/case', 'In Bond $/btl', 'In Bond $/case',
        'PC Price $/btl', 'PC Price $/case', 'Margin %',
      ]];
      for (const p of all) {
        const caseConfig = p.caseConfig ?? 12;
        const override = p.costOverridePerBottle ?? null;
        const hasCost = (p.importPricePerBottle != null && p.importPricePerBottle > 0) || override != null;
        const landed = hasCost
          ? (p.importPricePerBottle ?? 0) + effLogistics + (override ?? 0)
          : null;
        const sell = (ownerId ? ownerPrices[p.lwin18] : undefined) ?? p.sellingPricePerBottle;
        const margin = calcMargin(landed, sell);
        const inBond = landed && effInbondDivisor ? landed / effInbondDivisor : null;
        const num = (v: number | null | undefined, dp = 2) =>
          v != null ? Number(v.toFixed(dp)) : '';
        aoa.push([
          p.productName,
          p.producer ?? '',
          `${caseConfig}x${p.bottleSize ?? '75cl'}`,
          p.totalCases,
          num(p.importPricePerBottle),
          landed != null ? num(effLogistics) : '',
          override != null ? num(override) : '',
          num(landed),
          num(p.importPricePerBottle != null ? p.importPricePerBottle * caseConfig : null),
          num(inBond),
          num(inBond != null ? inBond * caseConfig : null),
          num(sell),
          num(sell != null ? sell * caseConfig : null),
          num(margin, 1),
        ]);
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: 40 }, { wch: 22 }, { wch: 10 }, { wch: 7 }, { wch: 12 }, { wch: 13 },
        { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 9 },
      ];
      ws['!autofilter'] = { ref: `A1:N${all.length + 1}` };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pricing');
      XLSX.writeFile(wb, `pricing-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`Exported ${all.length} products`);
    } catch (err) {
      console.error('Pricing export failed', { err });
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [
    isExporting,
    trpcClient,
    debouncedSearch,
    category,
    ownerId,
    priceFilter,
    sortBy,
    sortOrder,
    effLogistics,
    effInbondDivisor,
  ]);

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
          icon={<IconBottle className="h-5 w-5" />}
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
          icon={
            summary?.avgMargin != null && summary.avgMargin < 10 ? (
              <IconTrendingDown className="h-5 w-5" />
            ) : (
              <IconTrendingUp className="h-5 w-5" />
            )
          }
        />
        <KpiCard
          label="Unpriced"
          value={summary?.unpricedCount?.toString() ?? '\u2014'}
          subtitle="have import but no sell price"
          color={summary?.unpricedCount && summary.unpricedCount > 0 ? 'amber' : 'default'}
          icon={<IconAlertTriangle className="h-5 w-5" />}
          onClick={() => setPriceFilter(priceFilter === 'unpriced' ? undefined : 'unpriced')}
          active={priceFilter === 'unpriced'}
        />
        <KpiCard
          label="Total Sell Value"
          value={summary?.totalSellingValue ? formatValue(summary.totalSellingValue) : '\u2014'}
          color="brand"
          icon={<IconCurrencyDollar className="h-5 w-5" />}
          subtitle={
            summary?.totalImportValue
              ? `Import: ${formatValue(summary.totalImportValue)}`
              : undefined
          }
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-muted bg-surface-muted/20 p-3">
        {/* Category pills */}
        <div className="flex gap-1.5">
          {([
            { key: 'Wine' as const, label: 'Wine' },
            { key: 'Spirits' as const, label: 'Spirits' },
            { key: 'RTD' as const, label: 'RTD' },
          ]).map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(category === cat.key ? undefined : cat.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                category === cat.key
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'bg-background-primary text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
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

        {/* Global rates (when no owner selected) */}
        {!ownerId && (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-background-primary px-3 py-2">
              <span className="whitespace-nowrap text-xs text-text-muted">Logistics&nbsp;$/btl</span>
              <input
                type="number"
                min="0"
                step="1"
                value={logisticsPerBottle}
                onChange={(e) => setLogisticsPerBottle(Math.max(0, Number(e.target.value) || 0))}
                className="w-14 rounded border border-border-muted bg-background-primary px-1.5 py-0.5 text-right text-sm tabular-nums focus:border-border-brand focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-background-primary px-3 py-2">
              <span className="whitespace-nowrap text-xs text-text-muted">In&nbsp;Bond&nbsp;%</span>
              <input
                type="number"
                min="0"
                step="1"
                value={inBondMarkupPct}
                onChange={(e) => setInBondMarkupPct(Math.max(0, Number(e.target.value) || 0))}
                className="w-12 rounded border border-border-muted bg-background-primary px-1.5 py-0.5 text-right text-sm tabular-nums focus:border-border-brand focus:outline-none"
              />
            </div>
          </>
        )}

        {/* Per-owner rates (when an owner is selected) — saved to that owner */}
        {ownerId && (
          <div className="flex items-center gap-3 rounded-lg border border-violet-300 bg-violet-50/50 px-3 py-2">
            <span className="whitespace-nowrap text-xs font-medium text-violet-700">
              {owners.find((o) => o.ownerId === ownerId)?.ownerName ?? 'Owner'} rates
            </span>
            <label className="flex items-center gap-1 whitespace-nowrap text-xs text-text-muted">
              Log&nbsp;$
              <input
                type="number"
                min="0"
                step="1"
                value={ownerDraft.logistics}
                onChange={(e) =>
                  setOwnerDraft((d) => ({ ...d, logistics: Math.max(0, Number(e.target.value) || 0) }))
                }
                onBlur={() => saveOwnerSettings(ownerDraft)}
                className="w-12 rounded border border-violet-200 bg-background-primary px-1.5 py-0.5 text-right text-sm tabular-nums focus:border-violet-500 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1 whitespace-nowrap text-xs text-text-muted">
              In-Bond&nbsp;%
              <input
                type="number"
                min="0"
                step="0.5"
                value={ownerDraft.inbondPct}
                onChange={(e) =>
                  setOwnerDraft((d) => ({ ...d, inbondPct: Math.max(0, Number(e.target.value) || 0) }))
                }
                onBlur={() => saveOwnerSettings(ownerDraft)}
                className="w-12 rounded border border-violet-200 bg-background-primary px-1.5 py-0.5 text-right text-sm tabular-nums focus:border-violet-500 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1 whitespace-nowrap text-xs text-text-muted">
              PC&nbsp;%
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="—"
                value={ownerDraft.pcPct ?? ''}
                onChange={(e) =>
                  setOwnerDraft((d) => ({
                    ...d,
                    pcPct: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                onBlur={() => saveOwnerSettings(ownerDraft)}
                className="w-12 rounded border border-violet-200 bg-background-primary px-1.5 py-0.5 text-right text-sm tabular-nums focus:border-violet-500 focus:outline-none"
              />
            </label>
          </div>
        )}

        {/* Apply Margin */}
        <div className="relative" ref={marginPopoverRef}>
          <button
            onClick={() => {
              const opening = !showMarginPopover;
              setShowMarginPopover(opening);
              if (opening && ownerId && ownerDraft.pcPct != null) {
                setMarginPercent(String(ownerDraft.pcPct));
              }
            }}
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
                    {category ? `${category} products` : 'All categories'}
                    {ownerId ? (
                      <>
                        {' · '}
                        <span className="font-medium text-violet-600">
                          {owners.find((o) => o.ownerId === ownerId)?.ownerName ?? 'owner'} PC price
                        </span>
                      </>
                    ) : (
                      ' · default PC price'
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-text-muted">
                    On landed cost (import + ${effLogistics.toFixed(0)} logistics)
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
                        ownerId,
                        logisticsPerBottle: effLogistics,
                        inbondMarginPct: effInbondPct,
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

        {/* Export all filtered rows → Excel */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 rounded-lg border border-border-primary bg-background-primary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          {isExporting ? (
            <IconLoader2 className="h-4 w-4 animate-spin" />
          ) : (
            <IconDownload className="h-4 w-4" />
          )}
          {isExporting ? 'Exporting…' : 'Export Excel'}
        </button>
      </div>

      {/* Price-gap quick filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Show
        </span>
        {([
          { key: undefined, label: 'All' },
          { key: 'unpriced' as const, label: 'Unpriced' },
          { key: 'lossMaking' as const, label: 'Below cost' },
          { key: 'noImport' as const, label: 'No import cost' },
        ]).map((f) => (
          <button
            key={f.label}
            onClick={() => setPriceFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              priceFilter === f.key
                ? 'border-transparent bg-text-primary text-white shadow-sm'
                : 'border-border-muted bg-background-primary text-text-secondary hover:border-border-primary hover:text-text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border-muted" />
        <button
          onClick={() => setIncludeInbound((v) => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
            includeInbound
              ? 'border-transparent bg-amber-500 text-white shadow-sm'
              : 'border-amber-300 bg-amber-50/40 text-amber-700 hover:bg-amber-50'
          }`}
        >
          {includeInbound ? '✓ Inbound stock' : '+ Inbound stock'}
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
              <thead className="sticky top-0 z-10 bg-surface-muted/80 backdrop-blur-sm">
                {/* Group row */}
                <tr className="text-[10px] font-semibold uppercase tracking-wide">
                  <th className="px-3 pb-1.5 pt-2.5" colSpan={2} />
                  <th className="border-l border-slate-200 bg-slate-100/70 px-3 pb-1.5 pt-2.5 text-center text-slate-500" colSpan={4}>
                    Cost
                  </th>
                  <th className="border-l border-blue-200 bg-blue-50 px-3 pb-1.5 pt-2.5 text-center text-blue-600">
                    In&nbsp;Bond · B2B
                  </th>
                  <th className="border-l border-violet-200 bg-violet-50 px-3 pb-1.5 pt-2.5 text-center text-violet-600">
                    Private&nbsp;Client
                  </th>
                  <th className="border-l border-emerald-200 bg-emerald-50 px-3 pb-1.5 pt-2.5 text-center text-emerald-600">
                    Margin
                  </th>
                </tr>
                {/* Column row */}
                <tr className="border-b border-border-muted">
                  <th
                    className={`px-3 pb-2.5 pt-1 text-left ${thBase}`}
                    onClick={() => handleSort('productName')}
                  >
                    <span className="flex items-center gap-1">
                      Product {renderSortIcon('productName')}
                    </span>
                  </th>
                  <th
                    className={`px-3 pb-2.5 pt-1 text-right ${thBase}`}
                    onClick={() => handleSort('totalCases')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Stock {renderSortIcon('totalCases')}
                    </span>
                  </th>
                  <th
                    className={`border-l border-slate-200 px-3 pb-2.5 pt-1 text-right ${thBase}`}
                    onClick={() => handleSort('importPrice')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Import {renderSortIcon('importPrice')}
                    </span>
                  </th>
                  <th className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-text-muted">
                    Logistics
                  </th>
                  <th className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-text-muted">
                    Override
                  </th>
                  <th className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-text-muted">
                    Landed
                  </th>
                  <th className="border-l border-blue-200 px-3 pb-2.5 pt-1 text-right text-xs font-medium text-blue-600/80">
                    In Bond
                    <span className="ml-1 text-[10px] font-normal text-text-muted/60">{effInbondPct}% mgn</span>
                  </th>
                  <th
                    className={`border-l border-violet-200 px-3 pb-2.5 pt-1 text-right ${thBase}`}
                    onClick={() => handleSort('sellingPrice')}
                  >
                    <span className="flex items-center justify-end gap-1 text-violet-600">
                      PC Price {renderSortIcon('sellingPrice')}
                    </span>
                  </th>
                  <th
                    className={`border-l border-emerald-200 px-3 pb-2.5 pt-1 text-right ${thBase}`}
                    onClick={() => handleSort('margin')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Margin {renderSortIcon('margin')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : products.length === 0 &&
                  !(includeInbound && (data?.inbound?.length ?? 0) > 0) ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center text-text-muted">
                      No products found
                    </td>
                  </tr>
                ) : (
                  [
                    ...(includeInbound && page === 0
                      ? (data?.inbound ?? []).map((p) => ({ product: p, isInbound: true }))
                      : []),
                    ...products.map((p) => ({ product: p, isInbound: false })),
                  ].map(({ product, isInbound }) => {
                    const caseConfig = product.caseConfig ?? 12;
                    const importPrice = product.importPricePerBottle;
                    const costOverride =
                      (product as { costOverridePerBottle?: number | null }).costOverridePerBottle ??
                      null;
                    // Landed cost = import + flat logistics + manual override
                    const hasCost = (importPrice != null && importPrice > 0) || costOverride != null;
                    const landed = hasCost
                      ? (importPrice ?? 0) + effLogistics + (costOverride ?? 0)
                      : null;
                    const inBondPrice =
                      landed != null && effInbondDivisor ? landed / effInbondDivisor : null;
                    // When owner is selected, use owner-specific PC price (fall back to default)
                    const ownerPcPrice = ownerId ? ownerPriceMap[product.lwin18] : undefined;
                    const storedPc = ownerPcPrice ?? product.sellingPricePerBottle;
                    const hasStoredPc = storedPc != null && storedPc > 0;
                    // When owner PC% is set and nothing stored, suggest PC = in-bond / (1 - PC%)
                    // (PC margin stacks on the In-Bond B2B price, not on landed cost).
                    // Round in-bond to 2dp first so it matches the displayed figure.
                    const computedPc =
                      effPcDivisor != null && inBondPrice != null && inBondPrice > 0
                        ? Math.round(inBondPrice * 100) / 100 / effPcDivisor
                        : null;
                    const sellPrice = hasStoredPc ? storedPc : computedPc;
                    const isSuggestedPc = !hasStoredPc && computedPc != null;
                    const hasOwnerPrice = ownerId != null && ownerPcPrice != null;
                    const margin = calcMargin(landed, sellPrice);
                    const marginPerBottle =
                      landed && sellPrice && landed > 0 && sellPrice > 0
                        ? sellPrice - landed
                        : null;
                    const isLoss =
                      sellPrice != null && sellPrice > 0 && landed != null && sellPrice <= landed;
                    const eta =
                      isInbound && 'earliestEta' in product
                        ? (product as { earliestEta?: Date | null }).earliestEta ?? null
                        : null;
                    const marginColor =
                      margin == null
                        ? 'text-text-muted'
                        : margin >= 20
                          ? 'font-medium text-emerald-600'
                          : margin >= 10
                            ? 'font-medium text-amber-600'
                            : 'font-medium text-red-600';

                    return (
                      <tr
                        key={`${isInbound ? 'inb-' : ''}${product.lwin18}`}
                        className={`transition-colors ${
                          isInbound
                            ? 'bg-amber-50/60 hover:bg-amber-50'
                            : isLoss
                              ? 'bg-red-50/70 hover:bg-red-50'
                              : 'even:bg-surface-muted/25 hover:bg-surface-muted/50'
                        }`}
                      >
                        {/* Product */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <p className="font-medium leading-tight text-text-primary">
                              {product.productName}
                            </p>
                            {isInbound && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                                Inbound
                              </span>
                            )}
                          </div>
                          {product.producer && (
                            <p className="text-xs text-text-muted">{product.producer}</p>
                          )}
                          {isInbound && (
                            <p className="text-[10px] text-amber-600">
                              {eta
                                ? `ETA ${new Date(eta).toLocaleDateString('en-GB')}`
                                : 'In transit'}
                            </p>
                          )}
                        </td>

                        {/* Stock (cases + pack) */}
                        <td className="px-3 py-2.5 text-right">
                          <div className="font-medium tabular-nums text-text-primary">
                            {product.totalCases}
                          </div>
                          <div className="text-[10px] tabular-nums text-text-muted/70">
                            {caseConfig}×{product.bottleSize ?? '75cl'}
                          </div>
                        </td>

                        {/* Import (editable) — COST group */}
                        <PriceCell
                          value={importPrice}
                          tdClassName="border-l border-slate-200"
                          sub={
                            importPrice != null && importPrice > 0
                              ? `$${(importPrice * caseConfig).toFixed(0)}/cs`
                              : undefined
                          }
                          onSave={(v) =>
                            setImportPriceMut.mutate({
                              lwin18: product.lwin18,
                              importPricePerBottle: v,
                              source: 'manual',
                            })
                          }
                        />

                        {/* Logistics */}
                        <td className="px-3 py-2.5 text-right tabular-nums text-text-muted">
                          {landed != null ? `$${effLogistics.toFixed(2)}` : '—'}
                        </td>

                        {/* Override (manual per-SKU landed adjustment) */}
                        <OverrideCell
                          value={costOverride}
                          onSave={(v) =>
                            setCostOverrideMut.mutate({
                              lwin18: product.lwin18,
                              costOverridePerBottle: v,
                            })
                          }
                        />

                        {/* Landed (emphasised) */}
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <div className="font-semibold text-text-primary">
                            {landed != null ? `$${landed.toFixed(2)}` : '—'}
                          </div>
                          {landed != null && (
                            <div className="text-[10px] text-text-muted/60">
                              ${(landed * caseConfig).toFixed(0)}/cs
                            </div>
                          )}
                        </td>

                        {/* In Bond — B2B group */}
                        <td className="border-l border-blue-200 px-3 py-2.5 text-right tabular-nums">
                          <div className="text-blue-700">
                            {inBondPrice != null ? `$${inBondPrice.toFixed(2)}` : '—'}
                          </div>
                          {inBondPrice != null && (
                            <div className="text-[10px] text-text-muted/60">
                              ${(inBondPrice * caseConfig).toFixed(0)}/cs
                            </div>
                          )}
                        </td>

                        {/* PC Price (editable) — Private Client group */}
                        <PriceCell
                          value={sellPrice}
                          highlight={hasOwnerPrice}
                          suggested={isSuggestedPc}
                          variant="prominent"
                          tdClassName="border-l border-violet-200"
                          sub={
                            sellPrice != null && sellPrice > 0
                              ? `$${(sellPrice * caseConfig).toFixed(0)}/cs`
                              : undefined
                          }
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

                        {/* Margin */}
                        <td className="border-l border-emerald-200 px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 tabular-nums">
                            <MarginDot margin={margin} />
                            <span className={marginColor}>
                              {margin != null ? `${margin.toFixed(1)}%` : '—'}
                            </span>
                          </div>
                          {marginPerBottle != null && (
                            <div className="text-[10px] tabular-nums text-text-muted/60">
                              ${marginPerBottle.toFixed(2)}/btl
                            </div>
                          )}
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
