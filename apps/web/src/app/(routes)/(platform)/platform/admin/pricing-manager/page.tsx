'use client';

import {
  IconAlertTriangle,
  IconBottle,
  IconBuildingWarehouse,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCurrencyDollar,
  IconDownload,
  IconLoader2,
  IconPencil,
  IconPercentage,
  IconReportMoney,
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
type SortField =
  | 'productName'
  | 'vintage'
  | 'totalCases'
  | 'importPrice'
  | 'sellingPrice'
  | 'margin';
type SortOrder = 'asc' | 'desc';

// ─── Owner visual cue ─────────────────────────────────────────────────────────
// A colored dot + left border + badge so it's obvious at a glance whose stock a
// row belongs to — especially when an unfiltered ("All Owners") list mixes
// consignors. Craft & Culture is pinned to brand emerald; every other owner gets
// a stable color from a hash of its name, so the same owner always looks the same.

type OwnerStyle = { badge: string; border: string; dot: string };

const OWNER_PALETTE: OwnerStyle[] = [
  { badge: 'bg-violet-100 text-violet-700', border: 'border-l-violet-400', dot: 'bg-violet-500' },
  { badge: 'bg-blue-100 text-blue-700', border: 'border-l-blue-400', dot: 'bg-blue-500' },
  { badge: 'bg-rose-100 text-rose-700', border: 'border-l-rose-400', dot: 'bg-rose-500' },
  { badge: 'bg-cyan-100 text-cyan-700', border: 'border-l-cyan-400', dot: 'bg-cyan-500' },
  { badge: 'bg-fuchsia-100 text-fuchsia-700', border: 'border-l-fuchsia-400', dot: 'bg-fuchsia-500' },
  { badge: 'bg-indigo-100 text-indigo-700', border: 'border-l-indigo-400', dot: 'bg-indigo-500' },
  { badge: 'bg-teal-100 text-teal-700', border: 'border-l-teal-400', dot: 'bg-teal-500' },
];

// Shown when a single lwin18 is split across more than one owner.
const MIXED_OWNER_STYLE: OwnerStyle = {
  badge: 'bg-amber-100 text-amber-800',
  border: 'border-l-amber-500',
  dot: 'bg-amber-500',
};

const normalizeOwner = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const ownerStyle = (name: string): OwnerStyle => {
  const key = normalizeOwner(name);
  if (key.includes('craftculture')) {
    return { badge: 'bg-emerald-100 text-emerald-700', border: 'border-l-emerald-500', dot: 'bg-emerald-500' };
  }
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return OWNER_PALETTE[hash % OWNER_PALETTE.length] ?? OWNER_PALETTE[0]!;
};

// Compact label for the badge (full name stays in the title tooltip).
const shortOwner = (name: string): string => {
  const key = normalizeOwner(name);
  if (key.includes('craftculture')) return 'C&C';
  if (key.includes('rarewine')) return 'RareWine';
  if (key.includes('crurated')) return 'CRURATED';
  return name.replace(/\b(Ltd|LLC|ApS|Trading|Limited|SPC)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
};

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

// ─── Margin Cell (bespoke per-line margin % over landed — Spirits/RTD) ─────────

const MarginEditCell = ({
  value,
  onSave,
  tdClassName = '',
}: {
  value: number | null;
  onSave: (pct: number) => void;
  tdClassName?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? value.toFixed(1) : '');

  if (!editing) {
    return (
      <td className={`px-3 py-2.5 text-right tabular-nums ${tdClassName}`}>
        <button
          type="button"
          className="group/edit inline-flex items-center gap-1 hover:underline"
          onClick={() => {
            setDraft(value != null ? value.toFixed(1) : '');
            setEditing(true);
          }}
        >
          {value != null ? (
            <span className="font-semibold text-emerald-600">{value.toFixed(1)}%</span>
          ) : (
            <span className="text-text-muted/40">— set</span>
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
          const num = parseFloat(draft);
          if (!isNaN(num) && num > 0 && num < 100 && num !== value) onSave(num);
          setEditing(false);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-16 rounded border border-border-primary bg-background-primary px-1.5 py-0.5 text-right font-mono text-xs tabular-nums focus:border-border-brand focus:outline-none"
          placeholder="0.0"
          type="number"
          step="0.1"
          min="0"
          max="99.9"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditing(false);
              setDraft(value != null ? value.toFixed(1) : '');
            }
          }}
        />
        <span className="text-xs text-text-muted">%</span>
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

// ─── Logistics Cell (per-line logistics $/btl override, clearable) ────────────

const LogisticsCell = ({
  value,
  effective,
  onSave,
  tdClassName = '',
}: {
  /** stored per-line override; null when inherited from system freight/fallback */
  value: number | null;
  /** effective logistics currently applied (shown to the operator) */
  effective: number | null;
  onSave: (v: number | null) => void;
  tdClassName?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? value.toFixed(2) : '');

  if (!editing) {
    const isOverride = value != null;
    return (
      <td className={`px-3 py-2.5 text-right tabular-nums ${tdClassName}`}>
        <button
          type="button"
          className={`group/edit inline-flex items-center gap-1 hover:underline ${
            isOverride ? 'font-medium text-text-secondary' : 'text-text-muted'
          }`}
          onClick={() => {
            setDraft(value != null ? value.toFixed(2) : '');
            setEditing(true);
          }}
          title={
            isOverride
              ? 'Per-line logistics override'
              : 'Live system freight — click to override this line'
          }
        >
          {effective != null ? (
            `$${effective.toFixed(2)}`
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
            onSave(null); // clear -> revert to system freight / fallback
          } else {
            const num = parseFloat(t);
            if (!isNaN(num) && num >= 0 && num !== value) onSave(num);
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

// ─── Transfers Cell (FZ→mainland fee $/btl, $2.50 default, clearable) ──────────

const TransfersCell = ({
  value,
  effective,
  onSave,
  tdClassName = '',
}: {
  /** stored per-SKU transfer fee; null when the $2.50 default applies */
  value: number | null;
  /** effective transfer fee currently applied (shown to the operator) */
  effective: number | null;
  onSave: (v: number | null) => void;
  tdClassName?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? value.toFixed(2) : '');

  if (!editing) {
    const isOverride = value != null;
    return (
      <td className={`px-3 py-2.5 text-right tabular-nums ${tdClassName}`}>
        <button
          type="button"
          className={`group/edit inline-flex items-center gap-1 hover:underline ${
            isOverride ? 'font-medium text-text-secondary' : 'text-text-muted'
          }`}
          onClick={() => {
            setDraft(value != null ? value.toFixed(2) : '');
            setEditing(true);
          }}
          title={
            isOverride
              ? 'Per-SKU transfer fee'
              : 'Default $2.50 — click to set a per-SKU fee'
          }
        >
          {effective != null ? (
            `$${effective.toFixed(2)}`
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
            onSave(null); // clear -> revert to the $2.50 default
          } else {
            const num = parseFloat(t);
            if (!isNaN(num) && num >= 0 && num !== value) onSave(num);
          }
          setEditing(false);
        }}
      >
        <span className="text-xs text-text-muted">$</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-20 rounded border border-border-primary bg-background-primary px-1.5 py-0.5 text-right font-mono text-xs tabular-nums focus:border-border-brand focus:outline-none"
          placeholder="2.50"
          type="number"
          step="0.01"
          min="0"
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
    <CardContent className="gap-1.5 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </p>
        {icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${theme.chip}`}>
            {icon}
          </span>
        )}
      </div>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums ${theme.text}`}>{value}</p>
      {subtitle && <p className="mt-0.5 text-[11px] leading-tight text-text-muted">{subtitle}</p>}
      {onClick && (
        <p className="mt-1.5 text-[10px] font-medium text-fill-brand">
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

const MarginDot = ({
  margin,
  good = 20,
  ok = 10,
}: {
  margin: number | null;
  good?: number;
  ok?: number;
}) => {
  if (margin == null)
    return <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />;
  if (margin >= good) return <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />;
  if (margin >= ok) return <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-red-500" />;
};

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr>
    <td className="px-3 py-3">
      <div className="h-4 w-40 animate-pulse rounded bg-surface-muted" />
      <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-surface-muted" />
    </td>
    {Array.from({ length: 9 }).map((_, i) => (
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

  // Flat logistics still fed to the bulk "Apply Margin" tool (which prices
  // import + flat logistics for manual-import SKUs). Landed on the table itself
  // uses the live per-line breakdown, so this is no longer user-editable.
  const [logisticsPerBottle] = useState<number>(25);

  // Adjustable in-bond (B2B) markup %, applied on landed cost. Persisted.
  const [inBondMarkupPct, setInBondMarkupPct] = useState<number>(() => {
    if (typeof window === 'undefined') return IN_BOND_MARKUP * 100;
    const stored = Number(localStorage.getItem('pm-inbond-markup-pct'));
    return Number.isFinite(stored) && stored >= 0 ? stored : IN_BOND_MARKUP * 100;
  });
  useEffect(() => {
    localStorage.setItem('pm-inbond-markup-pct', String(inBondMarkupPct));
  }, [inBondMarkupPct]);

  // Global PC margin % (no owner selected). 0 = unset → show stored prices.
  const [pcMarginPct, setPcMarginPct] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const stored = Number(localStorage.getItem('pm-pc-margin-pct'));
    return Number.isFinite(stored) && stored >= 0 ? stored : 0;
  });
  useEffect(() => {
    localStorage.setItem('pm-pc-margin-pct', String(pcMarginPct));
  }, [pcMarginPct]);

  // Which margin the green MARGIN column shows:
  //  • 'ibLanded' — In-Bond (B2B) price vs Landed cost. Varies per owner (their
  //    in-bond markup) and is the real cost-to-B2B margin.
  //  • 'pcIb' — Private Client price vs In-Bond. Usually a flat % (the PC margin).
  const [marginBasis, setMarginBasis] = useState<'ibLanded' | 'pcIb'>(() => {
    if (typeof window === 'undefined') return 'ibLanded';
    return localStorage.getItem('pm-margin-basis') === 'pcIb' ? 'pcIb' : 'ibLanded';
  });
  useEffect(() => {
    localStorage.setItem('pm-margin-basis', marginBasis);
  }, [marginBasis]);

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
    retry: 2,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.stock.pricing.getOwnerSettings.queryKey(),
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
  // PC margin — per-owner when an owner is selected, else the global PC% (0 = unset)
  const effPcPct = ownerId ? ownerDraft.pcPct : pcMarginPct > 0 ? pcMarginPct : null;

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
    retry: 2,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getProducts.queryKey() });
      toast.success('Import price updated');
    },
    onError: () => toast.error('Failed to update import price'),
  });

  const setCostOverrideMut = useMutation({
    ...api.wms.admin.stock.pricing.setCostOverride.mutationOptions(),
    retry: 2,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getProducts.queryKey() });
      toast.success('Cost override updated');
    },
    onError: () => toast.error('Failed to update cost override'),
  });

  const setLineLogisticsMut = useMutation({
    ...api.wms.admin.stock.pricing.setLineLogistics.mutationOptions(),
    retry: 2,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getProducts.queryKey() });
      toast.success('Logistics updated');
    },
    onError: () => toast.error('Failed to update logistics'),
  });

  const setTransferPriceMut = useMutation({
    ...api.wms.admin.stock.pricing.setTransferPrice.mutationOptions(),
    retry: 2,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getProducts.queryKey() });
      toast.success('Transfer fee updated');
    },
    onError: () => toast.error('Failed to update transfer fee'),
  });

  const setSellingPriceMut = useMutation({
    ...api.wms.admin.stock.pricing.setSellingPrice.mutationOptions(),
    retry: 2,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getProducts.queryKey() });
      toast.success('PC price updated');
    },
    onError: () => toast.error('Failed to update PC price'),
  });

  const setSellMarginMut = useMutation({
    ...api.wms.admin.stock.pricing.setSellMargin.mutationOptions(),
    retry: 2,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getProducts.queryKey() });
      toast.success('Margin updated');
    },
    onError: () => toast.error('Failed to update margin'),
  });

  const setOwnerPricingMut = useMutation({
    ...api.wms.admin.stock.pricing.setOwnerPricing.mutationOptions(),
    retry: 2,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getOwnerPricing.queryKey() });
      const ownerName = owners.find((o) => o.ownerId === ownerId)?.ownerName ?? 'owner';
      toast.success(`PC price updated for ${ownerName}`);
    },
    onError: () => toast.error('Failed to update owner PC price'),
  });

  const bulkApplyMarginMut = useMutation({
    ...api.wms.admin.stock.pricing.bulkApplyMargin.mutationOptions(),
    retry: 2,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getProducts.queryKey() });
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getOwnerPricing.queryKey() });
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
        'Product', 'Producer', 'Vintage', 'Pack', 'Cases', 'Bottles', 'Import $/btl', 'Logistics $/btl',
        'Transfer $/btl', 'Override $/btl', 'Landed $/btl', 'Import $/case', 'In Bond $/btl', 'In Bond $/case',
        'PC Price $/btl', 'PC Price $/case', 'Margin %',
      ]];
      for (const p of all) {
        const caseConfig = p.caseConfig ?? 12;
        const override = p.costOverridePerBottle ?? null;
        // Logistics = live system freight/btl; C&C wine with no profile → $22.50.
        // Transfer = FZ→mainland ($2.50 default).
        const systemLog = (p as { systemLogistics?: number | null }).systemLogistics ?? 0;
        const isCcWine =
          (p as { isCraftCulture?: number }).isCraftCulture === 1 &&
          (p.category === 'Wine' || p.category == null);
        const lineLog = (p as { lineLogistics?: number | null }).lineLogistics ?? null;
        const rowLog =
          lineLog != null ? lineLog : systemLog > 0 ? systemLog : isCcWine ? 22.5 : 0;
        const transferDefault =
          (p as { isZeroTransferOwner?: number }).isZeroTransferOwner === 1 ? 0 : 2.5;
        const rowTransfer =
          (p as { transferPricePerBottle?: number | null }).transferPricePerBottle ??
          transferDefault;
        const rowInbondDiv = (() => {
          const pct = ownerId ? effInbondPct : (p.ownerInbondPct ?? inBondMarkupPct);
          return pct < 100 ? 1 - pct / 100 : null;
        })();
        const rowPcDiv = (() => {
          const pct = ownerId ? effPcPct : (p.ownerPcPct ?? (pcMarginPct > 0 ? pcMarginPct : null));
          return pct != null && pct < 100 ? 1 - pct / 100 : null;
        })();
        const hasCost = (p.importPricePerBottle != null && p.importPricePerBottle > 0) || override != null;
        const landed = hasCost
          ? (p.importPricePerBottle ?? 0) + rowLog + rowTransfer + (override ?? 0)
          : null;
        const inBond = landed && rowInbondDiv ? landed / rowInbondDiv : null;
        const ownerP = ownerId ? ownerPrices[p.lwin18] : undefined;
        const computed =
          rowPcDiv != null && inBond != null && inBond > 0
            ? Math.round(inBond * 100) / 100 / rowPcDiv
            : null;
        const sell =
          ownerP != null && ownerP > 0 ? ownerP : computed != null ? computed : p.sellingPricePerBottle;
        // Margin measured against the in-bond (B2B) price
        const margin = calcMargin(inBond, sell);
        const num = (v: number | null | undefined, dp = 2) =>
          v != null ? Number(v.toFixed(dp)) : '';
        aoa.push([
          p.productName,
          p.producer ?? '',
          p.vintage ?? '',
          `${caseConfig}x${p.bottleSize ?? '75cl'}`,
          p.totalCases,
          p.totalCases * caseConfig,
          num(p.importPricePerBottle),
          landed != null ? num(rowLog) : '',
          landed != null ? num(rowTransfer) : '',
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
        { wch: 40 }, { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 7 }, { wch: 8 }, { wch: 12 }, { wch: 13 },
        { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 9 },
      ];
      ws['!autofilter'] = { ref: `A1:P${all.length + 1}` };
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
    effInbondPct,
    effPcPct,
    logisticsPerBottle,
    inBondMarkupPct,
    pcMarginPct,
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Products"
          value={summary?.totalProducts?.toLocaleString() ?? '—'}
          subtitle="with stock"
          icon={<IconBottle className="h-5 w-5" />}
        />
        <KpiCard
          label="Stock at Cost"
          value={summary?.stockAtCost ? formatValue(summary.stockAtCost) : '—'}
          subtitle="landed cost of stock on hand"
          icon={<IconBuildingWarehouse className="h-5 w-5" />}
        />
        <KpiCard
          label="In-Bond Value"
          value={summary?.inBondValue ? formatValue(summary.inBondValue) : '—'}
          subtitle="B2B value of stock"
          icon={<IconCurrencyDollar className="h-5 w-5" />}
        />
        <KpiCard
          label="PC Value"
          value={summary?.pcValue ? formatValue(summary.pcValue) : '—'}
          color="brand"
          subtitle="private client value of stock"
          icon={<IconCurrencyDollar className="h-5 w-5" />}
        />
        <KpiCard
          label="C&C Profit"
          value={
            summary?.potentialGrossProfit != null
              ? formatValue(summary.potentialGrossProfit)
              : '—'
          }
          color={
            summary?.potentialGrossProfit != null && summary.potentialGrossProfit < 0
              ? 'red'
              : 'green'
          }
          subtitle="in-bond (B2B) less landed cost"
          icon={<IconReportMoney className="h-5 w-5" />}
        />
        <KpiCard
          label="Blended Margin"
          value={summary?.blendedMargin != null ? `${summary.blendedMargin.toFixed(1)}%` : '—'}
          subtitle="in-bond vs landed, value-weighted"
          color={
            summary?.blendedMargin == null
              ? 'default'
              : summary.blendedMargin >= 15
                ? 'green'
                : summary.blendedMargin >= 5
                  ? 'amber'
                  : 'red'
          }
          icon={
            summary?.blendedMargin != null && summary.blendedMargin < 5 ? (
              <IconTrendingDown className="h-5 w-5" />
            ) : (
              <IconTrendingUp className="h-5 w-5" />
            )
          }
        />
        <KpiCard
          label="Unpriced"
          value={summary?.unpricedCount?.toString() ?? '—'}
          subtitle="have import but no sell price"
          color={summary?.unpricedCount && summary.unpricedCount > 0 ? 'amber' : 'default'}
          icon={<IconAlertTriangle className="h-5 w-5" />}
          onClick={() => setPriceFilter(priceFilter === 'unpriced' ? undefined : 'unpriced')}
          active={priceFilter === 'unpriced'}
        />
        <KpiCard
          label="Below Cost"
          value={summary?.belowCostCount != null ? summary.belowCostCount.toString() : '—'}
          subtitle="priced at/below landed cost"
          color={summary?.belowCostCount ? 'red' : 'default'}
          icon={<IconAlertTriangle className="h-5 w-5" />}
          onClick={() =>
            setPriceFilter(priceFilter === 'lossMaking' ? undefined : 'lossMaking')
          }
          active={priceFilter === 'lossMaking'}
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

        {/* Search — primary control, given a distinct surface + focus ring so it
            stands out from the filter chips rather than blending into the bar. */}
        <div className="relative flex-1 lg:max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search wines, producers or LWIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search products"
            className="w-full rounded-lg border-2 border-border-primary bg-surface-muted/50 py-2.5 pl-10 pr-9 text-sm shadow-sm transition-all placeholder:text-text-muted focus:border-border-brand focus:bg-background-primary focus:outline-none focus:ring-2 focus:ring-border-brand/25"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted transition-colors hover:bg-fill-primary-hover hover:text-text-primary"
            >
              <IconX className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Global rates (when no owner selected) */}
        {!ownerId && (
          <>
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
            <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-background-primary px-3 py-2">
              <span className="whitespace-nowrap text-xs text-text-muted">PC&nbsp;%</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="—"
                value={pcMarginPct || ''}
                onChange={(e) => setPcMarginPct(Math.max(0, Number(e.target.value) || 0))}
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

        {/* Apply Margin — start of the actions cluster, pushed to the right so
            filters (left) read as distinct from actions (right). */}
        <div className="relative ml-auto" ref={marginPopoverRef}>
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
                    On landed cost (import + logistics)
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
                        logisticsPerBottle:
                          category === 'Spirits' || category === 'RTD' ? 0 : effLogistics,
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
              <thead className="sticky top-0 z-10 bg-surface-muted shadow-[0_1px_0_rgba(0,0,0,0.06),0_4px_8px_-4px_rgba(0,0,0,0.08)]">
                {/* Group row */}
                <tr className="text-[10px] font-semibold uppercase tracking-wide">
                  <th className="px-3 pb-1.5 pt-2.5" colSpan={3} />
                  <th
                    title="Cost build-up per bottle: Import + Logistics + Transfer + Override = Landed"
                    className="border-l-2 border-slate-300 bg-slate-100/70 px-3 pb-1.5 pt-2.5 text-center text-slate-500"
                    colSpan={5}
                  >
                    Cost
                  </th>
                  <th
                    title="In-bond (B2B) selling price tier for trade"
                    className="border-l-2 border-blue-300 bg-blue-50 px-3 pb-1.5 pt-2.5 text-center text-blue-600"
                  >
                    In&nbsp;Bond · B2B
                  </th>
                  <th
                    title="Private client (retail) selling price tier"
                    className="border-l-2 border-violet-300 bg-violet-50 px-3 pb-1.5 pt-2.5 text-center text-violet-600"
                  >
                    Private&nbsp;Client
                  </th>
                  <th
                    title="Margin of PC price over the in-bond (B2B) price"
                    className="border-l-2 border-emerald-300 bg-emerald-50 px-3 pb-1.5 pt-2.5 text-center text-emerald-600"
                  >
                    Margin
                  </th>
                </tr>
                {/* Column row */}
                <tr className="border-b border-border-muted">
                  <th
                    className={`px-3 pb-2.5 pt-1 text-left ${thBase}`}
                    onClick={() => handleSort('productName')}
                    title="Wine / product name and producer"
                  >
                    <span className="flex items-center gap-1">
                      Product {renderSortIcon('productName')}
                    </span>
                  </th>
                  <th
                    className={`px-2 pb-2.5 pt-1 text-center ${thBase}`}
                    onClick={() => handleSort('vintage')}
                    title="Vintage year (NV = non-vintage). Click to sort."
                  >
                    <span className="flex items-center justify-center gap-1">
                      Vintage {renderSortIcon('vintage')}
                    </span>
                  </th>
                  <th
                    className={`px-3 pb-2.5 pt-1 text-right ${thBase}`}
                    onClick={() => handleSort('totalCases')}
                    title="Cases on hand (pack size shown below the count)"
                  >
                    <span className="flex items-center justify-end gap-1">
                      Stock {renderSortIcon('totalCases')}
                    </span>
                  </th>
                  <th
                    className={`border-l-2 border-slate-300 px-3 pb-2.5 pt-1 text-right ${thBase}`}
                    onClick={() => handleSort('importPrice')}
                    title="Import price per bottle (ex-works cost). Click a cell to edit."
                  >
                    <span className="flex items-center justify-end gap-1">
                      Import {renderSortIcon('importPrice')}
                    </span>
                  </th>
                  <th
                    title="Live group/shipment freight per bottle. Click a cell to override this line; clear to revert to the system value."
                    className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-text-muted"
                  >
                    Logistics
                  </th>
                  <th
                    title="FZ→mainland transfer fee per bottle ($2.50 default). Click a cell to edit."
                    className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-text-muted"
                  >
                    Transfers
                  </th>
                  <th
                    title="Manual per-SKU cost adjustment (can be +/-), added to landed. Click a cell to edit."
                    className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-text-muted"
                  >
                    Override
                  </th>
                  <th
                    title="Landed cost per bottle = Import + Logistics + Transfer + Override"
                    className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-text-muted"
                  >
                    Landed
                  </th>
                  <th
                    title="In-bond (B2B) price = Landed / (1 - In-Bond%)"
                    className="border-l-2 border-blue-300 px-3 pb-2.5 pt-1 text-right text-xs font-medium text-blue-600/80"
                  >
                    In Bond
                    <span className="ml-1 text-[10px] font-normal text-text-muted/60">
                      {ownerId ? `${effInbondPct}% mgn` : 'per owner'}
                    </span>
                  </th>
                  <th
                    className={`border-l-2 border-violet-300 px-3 pb-2.5 pt-1 text-right ${thBase}`}
                    onClick={() => handleSort('sellingPrice')}
                    title="Private client price = In-Bond / (1 - PC%). Click a cell to edit."
                  >
                    <span className="flex items-center justify-end gap-1 text-violet-600">
                      PC Price {renderSortIcon('sellingPrice')}
                    </span>
                  </th>
                  <th
                    className={`border-l-2 border-emerald-300 px-3 pb-2.5 pt-1 text-right ${thBase}`}
                    title={
                      marginBasis === 'ibLanded'
                        ? 'Margin = (In-Bond − Landed) / In-Bond — the B2B margin over cost (varies per owner)'
                        : 'Margin = (PC − In-Bond) / PC — the private-client margin over the in-bond price'
                    }
                  >
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className="flex cursor-pointer items-center justify-end gap-1"
                        onClick={() => handleSort('margin')}
                      >
                        Margin {renderSortIcon('margin')}
                      </span>
                      <div
                        className="flex overflow-hidden rounded-md border border-emerald-300 text-[9px] font-semibold normal-case tracking-normal"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setMarginBasis('ibLanded')}
                          title="In-Bond (B2B) vs Landed cost"
                          className={`px-1.5 py-0.5 ${
                            marginBasis === 'ibLanded'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          IB·Landed
                        </button>
                        <button
                          type="button"
                          onClick={() => setMarginBasis('pcIb')}
                          title="Private Client vs In-Bond price"
                          className={`border-l border-emerald-300 px-1.5 py-0.5 ${
                            marginBasis === 'pcIb'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          PC·IB
                        </button>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : products.length === 0 &&
                  !(includeInbound && (data?.inbound?.length ?? 0) > 0) ? (
                  <tr>
                    <td colSpan={10} className="py-20 text-center text-text-muted">
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
                    // Rates: a selected owner's rates apply to all rows; in "All Owners" each row
                    // uses ITS owner's own rates (falling back to the global toolbar values).
                    const orow = product as {
                      ownerLogistics?: number | null;
                      ownerInbondPct?: number | null;
                      ownerPcPct?: number | null;
                    };
                    // Logistics = live group/shipment freight per bottle (from the
                    // system; read-only). C&C-owned wine with no freight profile
                    // (old imports) falls back to $22.50. Transfers = FZ→mainland
                    // fee ($2.50 default, editable per SKU).
                    const systemLog =
                      (product as { systemLogistics?: number | null }).systemLogistics ?? 0;
                    const isCcWine =
                      (product as { isCraftCulture?: number }).isCraftCulture === 1 &&
                      (product.category === 'Wine' || product.category == null);
                    // Per-line override beats live system freight / the C&C fallback
                    const lineLogistics =
                      (product as { lineLogistics?: number | null }).lineLogistics ?? null;
                    const rowLogistics =
                      lineLogistics != null
                        ? lineLogistics
                        : systemLog > 0
                          ? systemLog
                          : isCcWine
                            ? 22.5
                            : 0;
                    const transferStored =
                      (product as { transferPricePerBottle?: number | null })
                        .transferPricePerBottle ?? null;
                    // Cru Wine / Crurated default to $0 transfer; everyone else $2.50
                    const transferDefault =
                      (product as { isZeroTransferOwner?: number }).isZeroTransferOwner === 1
                        ? 0
                        : 2.5;
                    const rowTransfer = transferStored ?? transferDefault;
                    const rowInbondPct = ownerId
                      ? effInbondPct
                      : (orow.ownerInbondPct ?? inBondMarkupPct);
                    const rowInbondDivisor = rowInbondPct < 100 ? 1 - rowInbondPct / 100 : null;
                    const rowPcPct = ownerId
                      ? effPcPct
                      : (orow.ownerPcPct ?? (pcMarginPct > 0 ? pcMarginPct : null));
                    const rowPcDivisor =
                      rowPcPct != null && rowPcPct < 100 ? 1 - rowPcPct / 100 : null;
                    // Landed = import (paid) + logistics + transfer + manual override
                    const hasCost = (importPrice != null && importPrice > 0) || costOverride != null;
                    const landed = hasCost
                      ? (importPrice ?? 0) + rowLogistics + rowTransfer + (costOverride ?? 0)
                      : null;
                    // Spirits & RTD are priced solely by a bespoke per-line margin
                    // over landed — the global in-bond/PC % never applies to them.
                    const isSpiritOrRtd =
                      product.category === 'Spirits' || product.category === 'RTD';
                    const bespokeMargin =
                      (product as { sellMarginPct?: number | null }).sellMarginPct ?? null;

                    const ownerPcPrice = ownerId ? ownerPriceMap[product.lwin18] : undefined;
                    const storedOwnerPrice =
                      ownerId != null && ownerPcPrice != null && ownerPcPrice > 0 ? ownerPcPrice : null;

                    let inBondPrice: number | null;
                    let sellPrice: number | null;
                    let isSuggestedPc: boolean;
                    let hasOwnerPrice: boolean;
                    let margin: number | null;

                    if (isSpiritOrRtd) {
                      // One sell price: sell = landed / (1 - margin/100); no B2B/PC split
                      const bespokeSell =
                        bespokeMargin != null && landed != null && bespokeMargin < 100
                          ? landed / (1 - bespokeMargin / 100)
                          : product.sellingPricePerBottle;
                      sellPrice = bespokeSell;
                      inBondPrice = bespokeSell;
                      isSuggestedPc = false;
                      hasOwnerPrice = false;
                      margin = bespokeMargin;
                    } else {
                      inBondPrice =
                        landed != null && rowInbondDivisor ? landed / rowInbondDivisor : null;
                      // PC precedence: an ACTIVE PC% drives the price and beats stored prices;
                      // else stored owner price, then default. PC is a margin on the IN-BOND
                      // price (which already reflects the override via landed).
                      const computedPc =
                        rowPcDivisor != null && inBondPrice != null && inBondPrice > 0
                          ? Math.round(inBondPrice * 100) / 100 / rowPcDivisor
                          : null;
                      sellPrice =
                        computedPc != null
                          ? computedPc
                          : (storedOwnerPrice ?? product.sellingPricePerBottle);
                      isSuggestedPc = computedPc != null;
                      hasOwnerPrice = computedPc == null && storedOwnerPrice != null;
                      // Margin measured against the in-bond (B2B) price
                      margin = calcMargin(inBondPrice, sellPrice);
                    }
                    const marginPerBottle =
                      !isSpiritOrRtd &&
                      inBondPrice &&
                      sellPrice &&
                      inBondPrice > 0 &&
                      sellPrice > 0
                        ? sellPrice - inBondPrice
                        : null;
                    // Below cost = selling at/below the landed cost
                    const isLoss =
                      sellPrice != null && sellPrice > 0 && landed != null && sellPrice <= landed;
                    const eta =
                      isInbound && 'earliestEta' in product
                        ? (product as { earliestEta?: Date | null }).earliestEta ?? null
                        : null;
                    // Margin the green column shows, per the header toggle.
                    // 'ibLanded' = In-Bond vs Landed (B2B margin over cost, varies
                    // by owner); 'pcIb' = the existing PC-vs-In-Bond margin.
                    // Spirits/RTD keep their single bespoke margin either way.
                    const displayMargin = isSpiritOrRtd
                      ? margin
                      : marginBasis === 'pcIb'
                        ? margin
                        : calcMargin(landed, inBondPrice);
                    const displayMarginPerBottle = isSpiritOrRtd
                      ? marginPerBottle
                      : marginBasis === 'pcIb'
                        ? marginPerBottle
                        : inBondPrice != null && landed != null && inBondPrice > 0
                          ? inBondPrice - landed
                          : null;
                    // IB·Landed margins run lower than PC margins, so the
                    // green/amber/red bands are lower in that mode.
                    const marginGood = marginBasis === 'ibLanded' ? 12 : 20;
                    const marginOk = marginBasis === 'ibLanded' ? 6 : 10;
                    const marginColor =
                      displayMargin == null
                        ? 'text-text-muted'
                        : displayMargin >= marginGood
                          ? 'font-medium text-emerald-600'
                          : displayMargin >= marginOk
                            ? 'font-medium text-amber-600'
                            : 'font-medium text-red-600';

                    // Owner cue — colored left border + badge so it's obvious
                    // whose stock a row is, especially in a mixed "All Owners"
                    // list. > 1 owner on one lwin18 shows a "Mixed" flag.
                    const ownerNames = product.ownerNames ?? [];
                    const firstOwner = ownerNames[0];
                    const ownerCue = firstOwner
                      ? {
                          fullName: firstOwner,
                          isMixed: (product.ownerCount ?? 1) > 1,
                          style:
                            (product.ownerCount ?? 1) > 1
                              ? MIXED_OWNER_STYLE
                              : ownerStyle(firstOwner),
                        }
                      : null;

                    return (
                      <tr
                        key={`${isInbound ? 'inb-' : ''}${product.lwin18}`}
                        className={`transition-colors ${
                          isInbound
                            ? 'bg-amber-50/60 hover:bg-amber-50'
                            : isLoss
                              ? 'bg-red-50/70 hover:bg-red-50'
                              : 'even:bg-surface-muted/40 hover:bg-surface-muted/60'
                        }`}
                      >
                        {/* Product */}
                        <td
                          className={`border-l-4 px-3 py-2.5 ${
                            ownerCue?.style.border ?? 'border-l-transparent'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[15px] font-semibold leading-tight tracking-tight text-text-primary">
                              {product.productName}
                            </p>
                            {ownerCue && (
                              <span
                                title={
                                  ownerCue.isMixed
                                    ? `Mixed ownership: ${product.ownerNames.join(', ')}`
                                    : ownerCue.fullName
                                }
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold ${ownerCue.style.badge}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${ownerCue.style.dot}`} />
                                {ownerCue.isMixed
                                  ? `Mixed · ${product.ownerCount}`
                                  : shortOwner(ownerCue.fullName)}
                              </span>
                            )}
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

                        {/* Vintage */}
                        <td className="px-2 py-2.5 text-center">
                          {product.vintage ? (
                            <span className="tabular-nums text-text-secondary">{product.vintage}</span>
                          ) : (
                            <span className="text-[11px] text-text-muted/50">NV</span>
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
                          tdClassName="border-l-2 border-slate-300"
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

                        {/* Logistics — live system freight, overridable per line */}
                        <LogisticsCell
                          value={lineLogistics}
                          effective={landed != null ? rowLogistics : null}
                          onSave={(v) =>
                            setLineLogisticsMut.mutate({
                              lwin18: product.lwin18,
                              logisticsPerBottle: v,
                            })
                          }
                        />

                        {/* Transfers — FZ→mainland fee, editable ($2.50 default) */}
                        <TransfersCell
                          value={transferStored}
                          effective={landed != null ? rowTransfer : null}
                          onSave={(v) =>
                            setTransferPriceMut.mutate({
                              lwin18: product.lwin18,
                              transferPricePerBottle: v,
                            })
                          }
                        />

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
                        <td className="border-l-2 border-blue-300 px-3 py-2.5 text-right tabular-nums">
                          <div className="font-medium text-blue-700">
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
                          tdClassName="border-l-2 border-violet-300"
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

                        {/* Margin — editable bespoke margin for Spirits/RTD, read-only for Wine */}
                        {isSpiritOrRtd && !isInbound ? (
                          <MarginEditCell
                            value={bespokeMargin}
                            tdClassName="border-l-2 border-emerald-300"
                            onSave={(pct) => {
                              const sell =
                                landed != null && pct < 100
                                  ? Math.round((landed / (1 - pct / 100)) * 100) / 100
                                  : null;
                              setSellMarginMut.mutate({
                                lwin18: product.lwin18,
                                sellMarginPct: pct,
                                sellingPricePerBottle: sell,
                              });
                            }}
                          />
                        ) : (
                          <td className="border-l-2 border-emerald-300 px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5 tabular-nums">
                              <MarginDot margin={displayMargin} good={marginGood} ok={marginOk} />
                              <span className={marginColor}>
                                {displayMargin != null ? `${displayMargin.toFixed(1)}%` : '—'}
                              </span>
                            </div>
                            {displayMarginPerBottle != null && (
                              <div className="text-[10px] tabular-nums text-text-muted/60">
                                ${displayMarginPerBottle.toFixed(2)}/btl
                              </div>
                            )}
                          </td>
                        )}
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
