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
  IconInfoCircle,
  IconLoader2,
  IconPencil,
  IconPercentage,
  IconRefresh,
  IconReportMoney,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTrendingDown,
  IconTrendingUp,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import PricingBandsEditor from '@/app/_wms/components/PricingBandsEditor';
import pricePricingManagerRow, {
  type PricingManagerRowInput,
} from '@/app/_wms/utils/pricePricingManagerRow';
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

// ─── Display currency ─────────────────────────────────────────────────────────

/** AED per USD — the dirham peg, the same rate the price lists convert at */
const AED_PER_USD = 3.6725;

type DisplayCurrency = 'USD' | 'AED';

/**
 * The currency prices are shown in. Every price is stored and edited in USD;
 * this only changes how a figure is written on screen.
 */
const CurrencyContext = createContext<DisplayCurrency>('USD');

/**
 * Write a USD amount in the display currency
 *
 * @example
 *   money(14.28, 'USD'); // "$14.28"
 *   money(14.28, 'AED'); // "AED 52.44"
 *   money(5881, 'AED', 0); // "AED 21,598"
 *
 * @param usd - Amount in USD
 * @param ccy - Currency to show it in
 * @param decimals - Decimal places (default 2)
 * @returns The formatted amount
 */
const money = (usd: number, ccy: DisplayCurrency, decimals = 2) => {
  const v = ccy === 'AED' ? usd * AED_PER_USD : usd;
  const n = v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return ccy === 'AED' ? `AED ${n}` : `$${n}`;
};

// ─── PriceCell (click-to-edit) ────────────────────────────────────────────────

/**
 * A per-case figure, written so it can be read at a glance
 *
 * The case price is what most trade buyers actually transact in, and it was
 * rendered at ten pixels and sixty percent opacity with no thousands
 * separator: "$5881/cs" against a bottle price in full contrast. Anyone
 * comparing case prices down a column was reading the least legible number on
 * the screen.
 *
 * @param perBottle - The per-bottle price
 * @param caseConfig - Bottles in the case
 * @param ccy - Currency to show it in
 * @returns e.g. "$5,881/case"
 */
const casePrice = (
  perBottle: number,
  caseConfig: number,
  ccy: DisplayCurrency = 'USD',
) => `${money(perBottle * caseConfig, ccy, 0)}/case`;

/**
 * Profit per bottle and per case, in the units wine is actually sold in
 *
 * The per-bottle figure was already computed and rendered at ten pixels in
 * forty-percent grey under the margin percentage — the number the business
 * runs on, styled as a footnote. A percentage tells you whether a line is
 * healthy; this tells you what it earns, and a case figure is what gets quoted.
 *
 * @param perBottle - Profit on one bottle
 * @param caseConfig - Bottles in the case
 * @param ccy - Currency to show it in
 * @returns e.g. "$14.28/btl · $86/case"
 */
const profitPerUnit = (
  perBottle: number,
  caseConfig: number,
  ccy: DisplayCurrency = 'USD',
) =>
  `${money(perBottle, ccy)}/btl · ${money(perBottle * caseConfig, ccy, 0)}/case`;

/** The shipment statuses the in-transit price list will publish from */
const INBOUND_LISTABLE = [
  'booked',
  'picked_up',
  'in_transit',
  'arrived_port',
  'customs_clearance',
  'cleared',
  'at_warehouse',
];

/**
 * One price, edited on a phone: a USD field and a Save button
 *
 * The table's cells edit in place, which a thumb cannot do; this is the same
 * save, from the card a phone shows instead of the row.
 */
const PhonePriceField = ({
  label,
  value,
  onSave,
  hint,
}: {
  label: string;
  value: number | null;
  onSave: (v: number) => void;
  hint?: (v: number) => string | null;
}) => {
  const [draft, setDraft] = useState(value != null ? value.toFixed(2) : '');
  const num = parseFloat(draft);
  const valid = !isNaN(num) && num > 0;
  const changed = valid && (value == null || Math.abs(num - value) >= 0.005);

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <span className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
          <input
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-11 w-full rounded-lg border border-border-muted bg-fill-primary pl-7 pr-3 text-base tabular-nums text-text-primary focus:border-text-primary focus:outline-none"
          />
        </span>
        <button
          type="button"
          disabled={!changed}
          onClick={() => onSave(num)}
          className="h-11 shrink-0 rounded-lg bg-text-primary px-4 text-sm font-semibold text-surface-primary disabled:opacity-30"
        >
          Save
        </button>
      </span>
      {valid && hint?.(num) ? <span className="mt-1 block text-xs text-text-muted">{hint(num)}</span> : null}
    </label>
  );
};

/**
 * A blanket margin % typed straight into a price column's header
 *
 * In Bond and PC each carry their own, so changing one never looks like it
 * changes the other. Clicks stay inside, so a sortable header does not sort.
 */
const HeaderPctInput = ({
  value,
  onChange,
  onCommit,
  title,
  tone,
  allowEmpty = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  onCommit: () => void;
  title: string;
  tone: 'blue' | 'violet';
  allowEmpty?: boolean;
}) => (
  <label
    title={title}
    onClick={(e) => e.stopPropagation()}
    className={`flex items-center gap-0.5 rounded border px-1 py-0.5 text-[10px] font-semibold normal-case ${
      tone === 'blue'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-violet-200 bg-violet-50 text-violet-700'
    }`}
  >
    <input
      type="number"
      min="0"
      max="99"
      step="0.1"
      placeholder="—"
      value={value ?? ''}
      onChange={(e) =>
        onChange(
          e.target.value === '' && allowEmpty
            ? null
            : Math.max(0, Number(e.target.value) || 0),
        )
      }
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className="w-10 bg-transparent text-right tabular-nums focus:outline-none"
    />
    %
  </label>
);

const PriceCell = ({
  value,
  onSave,
  highlight,
  sub,
  suggested,
  variant = 'muted',
  tdClassName = '',
  hintFor,
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
  /**
   * Shown under the input as the price is typed — used to say what margin the
   * number being entered actually represents, so nobody types a price that
   * quietly sells at a loss.
   */
  hintFor?: (price: number) => string | null;
}) => {
  const ccy = useContext(CurrencyContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toFixed(2) ?? '');
  /** Set by Escape so a blur racing the unmount cannot commit the abandoned edit */
  const discarded = useRef(false);

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
            `${suggested ? '~' : ''}${money(value, ccy)}`
          ) : (
            <span className="text-text-muted/40">—</span>
          )}
          <IconPencil className="h-3 w-3 opacity-0 transition-opacity group-hover/edit:opacity-60" />
        </button>
        {sub && value != null && value > 0 && (
          <div className="pm-sub text-[11px] font-medium tabular-nums text-text-muted">
            {sub}
          </div>
        )}
      </td>
    );
  }

  /**
   * Take the typed price, wherever the person went next.
   *
   * Pricing a shipment is a column of these, and moving on by clicking the
   * next cell or pressing Tab threw the number away without a word — the row
   * simply still read the old price, which looks like the save failed rather
   * than like it never happened. Enter, Tab, Save and clicking elsewhere now
   * all commit; only Escape discards, which is the one gesture that means it.
   */
  const commit = () => {
    if (discarded.current) {
      discarded.current = false;

      return;
    }

    const num = parseFloat(draft);

    if (!isNaN(num) && num > 0 && num !== value) onSave(num);

    setEditing(false);
  };

  return (
    <td className={`px-3 py-2.5 ${tdClassName}`}>
      <form
        className="flex items-center justify-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <span className="text-xs text-text-muted">
          {ccy === 'AED' ? 'USD' : '$'}
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-20 rounded border border-border-primary bg-background-primary px-1.5 py-0.5 text-right font-mono text-xs tabular-nums focus:border-text-primary focus:ring-2 focus:ring-text-primary/30 focus:outline-none"
          placeholder="0.00"
          type="number"
          step="0.01"
          min="0"
          autoFocus
          /*
            Clicking the Save button blurs the input first, so committing here
            is what actually saves in that case too; the submit handler then
            finds nothing left to change. Escape clears the draft before the
            blur lands, so it stays a discard.
          */
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              // Set before the state change so a blur racing the unmount
              // cannot commit the very edit being abandoned
              discarded.current = true;
              setDraft(value?.toFixed(2) ?? '');
              setEditing(false);
            }
          }}
        />
        <button
          type="submit"
          className="rounded bg-text-primary px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-text-primary/90"
        >
          Save
        </button>
      </form>
      {hintFor &&
        (() => {
          const hint = hintFor(parseFloat(draft));
          return hint ? (
            <div className="mt-0.5 text-right text-[10px] tabular-nums text-text-muted">
              {hint}
            </div>
          ) : null;
        })()}
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
  const ccy = useContext(CurrencyContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? value.toFixed(2) : '');
  /** Set by Escape so a blur racing the unmount cannot commit the abandoned edit */
  const discarded = useRef(false);

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
            `${value! >= 0 ? '+' : '−'}${money(Math.abs(value!), ccy)}`
          ) : (
            <span className="text-text-muted/40">—</span>
          )}
          <IconPencil className="h-3 w-3 opacity-0 transition-opacity group-hover/edit:opacity-60" />
        </button>
      </td>
    );
  }

  /** Same rule as the price cells: only Escape throws the edit away */
  const commit = () => {
    if (discarded.current) {
      discarded.current = false;

      return;
    }

    const t = draft.trim();

    if (t === '') {
      onSave(null);
    } else {
      const num = parseFloat(t);

      if (!isNaN(num) && num !== value) onSave(num);
    }

    setEditing(false);
  };

  return (
    <td className={`px-3 py-2.5 ${tdClassName}`}>
      <form
        className="flex items-center justify-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <span className="text-xs text-text-muted">
          {ccy === 'AED' ? 'USD' : '$'}
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-20 rounded border border-border-primary bg-background-primary px-1.5 py-0.5 text-right font-mono text-xs tabular-nums focus:border-text-primary focus:outline-none"
          placeholder="0.00"
          type="number"
          step="0.01"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              discarded.current = true;
              setEditing(false);
              setDraft(value != null ? value.toFixed(2) : '');
            }
          }}
          onBlur={commit}
        />
        <button
          type="submit"
          className="rounded bg-text-primary px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-text-primary/90"
        >
          Save
        </button>
      </form>
    </td>
  );
};

// ─── Margin Cell (per-line margin %; the price follows) ─────────────────────────

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
  /** Set by Escape so a blur racing the unmount cannot commit the abandoned edit */
  const discarded = useRef(false);

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

  /** Same rule as every other cell here: only Escape throws the edit away */
  const commit = () => {
    if (discarded.current) {
      discarded.current = false;

      return;
    }

    const num = parseFloat(draft);

    if (!isNaN(num) && num > 0 && num < 100 && num !== value) onSave(num);

    setEditing(false);
  };

  return (
    <td className={`px-3 py-2.5 ${tdClassName}`}>
      <form
        className="flex items-center justify-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-16 rounded border border-border-primary bg-background-primary px-1.5 py-0.5 text-right font-mono text-xs tabular-nums focus:border-text-primary focus:ring-2 focus:ring-text-primary/30 focus:outline-none"
          placeholder="0.0"
          type="number"
          step="0.1"
          min="0"
          max="99.9"
          autoFocus
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              discarded.current = true;
              setEditing(false);
              setDraft(value != null ? value.toFixed(1) : '');
            }
          }}
        />
        <span className="text-xs text-text-muted">%</span>
        <button
          type="submit"
          className="rounded bg-text-primary px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-text-primary/90"
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
  const ccy = useContext(CurrencyContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? value.toFixed(2) : '');
  /** Set by Escape so a blur racing the unmount cannot commit the abandoned edit */
  const discarded = useRef(false);

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
            money(effective, ccy)
          ) : (
            <span className="text-text-muted/40">—</span>
          )}
          <IconPencil className="h-3 w-3 opacity-0 transition-opacity group-hover/edit:opacity-60" />
        </button>
      </td>
    );
  }

  /** Same rule as every other cell here: only Escape throws the edit away */
  const commit = () => {
    if (discarded.current) {
      discarded.current = false;

      return;
    }

    const t = draft.trim();

    if (t === '') {
      onSave(null); // clear -> revert to system freight / fallback
    } else {
      const num = parseFloat(t);

      if (!isNaN(num) && num >= 0 && num !== value) onSave(num);
    }

    setEditing(false);
  };

  return (
    <td className={`px-3 py-2.5 ${tdClassName}`}>
      <form
        className="flex items-center justify-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <span className="text-xs text-text-muted">
          {ccy === 'AED' ? 'USD' : '$'}
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-20 rounded border border-border-primary bg-background-primary px-1.5 py-0.5 text-right font-mono text-xs tabular-nums focus:border-text-primary focus:outline-none"
          placeholder="0.00"
          type="number"
          step="0.01"
          min="0"
          autoFocus
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              discarded.current = true;
              setEditing(false);
              setDraft(value != null ? value.toFixed(2) : '');
            }
          }}
        />
        <button
          type="submit"
          className="rounded bg-text-primary px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-text-primary/90"
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
  const ccy = useContext(CurrencyContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? value.toFixed(2) : '');
  /** Set by Escape so a blur racing the unmount cannot commit the abandoned edit */
  const discarded = useRef(false);

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
            money(effective, ccy)
          ) : (
            <span className="text-text-muted/40">—</span>
          )}
          <IconPencil className="h-3 w-3 opacity-0 transition-opacity group-hover/edit:opacity-60" />
        </button>
      </td>
    );
  }

  /** Same rule as every other cell here: only Escape throws the edit away */
  const commit = () => {
    if (discarded.current) {
      discarded.current = false;

      return;
    }

    const t = draft.trim();

    if (t === '') {
      onSave(null); // clear -> revert to the $2.50 default
    } else {
      const num = parseFloat(t);

      if (!isNaN(num) && num >= 0 && num !== value) onSave(num);
    }

    setEditing(false);
  };

  return (
    <td className={`px-3 py-2.5 ${tdClassName}`}>
      <form
        className="flex items-center justify-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <span className="text-xs text-text-muted">
          {ccy === 'AED' ? 'USD' : '$'}
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-20 rounded border border-border-primary bg-background-primary px-1.5 py-0.5 text-right font-mono text-xs tabular-nums focus:border-text-primary focus:outline-none"
          placeholder="2.50"
          type="number"
          step="0.01"
          min="0"
          autoFocus
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              discarded.current = true;
              setEditing(false);
              setDraft(value != null ? value.toFixed(2) : '');
            }
          }}
        />
        <button
          type="submit"
          className="rounded bg-text-primary px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-text-primary/90"
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
  brand: { text: 'text-text-primary', chip: 'bg-text-primary/10 text-text-primary', ring: 'ring-text-primary' },
} as const;

const KpiCard = ({
  label,
  value,
  subtitle,
  secondary,
  color = 'default',
  icon,
  onClick,
  active,
}: {
  label: string;
  value: string;
  subtitle?: string;
  /**
   * In-transit, shown beneath the landed figure rather than added to it.
   *
   * Blending them would overstate what can be sold this week — wine on the
   * water is owned, not available — and showing only the landed figure reports
   * zero against a partner whose entire holding is in transit. Both, labelled.
   */
  secondary?: string;
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
      {secondary && (
        <p className="mt-0.5 text-[11px] font-medium leading-tight text-text-warning">
          {secondary}
        </p>
      )}
      {subtitle && <p className="mt-0.5 text-[11px] leading-tight text-text-muted">{subtitle}</p>}
      {onClick && (
        <p className="mt-1.5 text-[10px] font-medium text-text-primary">
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

// ─── Header Info (hover tooltip on a small ⓘ icon) ────────────────────────────
// Surfaces the per-column explanation that used to live in an invisible native
// `title`. stopPropagation on the trigger so clicking the icon in a sortable
// header doesn't also trigger a sort.

const HeaderInfo = ({ text }: { text: string }) => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex cursor-help text-text-muted/50 transition-colors hover:text-text-secondary"
          onClick={(e) => e.stopPropagation()}
        >
          <IconInfoCircle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="block max-w-[230px] text-left text-xs font-normal normal-case leading-snug tracking-normal">
          {text}
        </span>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const VENUE_NAMES: Record<string, string> = {
  bordeaux_index: 'Bordeaux Index',
  bbx: 'BBX',
  wine_collector: 'Wine Collector',
  cult_wines: 'Cult Wines',
  cultx: 'CultX',
};

/**
 * London in-bond market for the row's bottle size, beside our In Bond price
 *
 * The lowest ask is what a trade buyer could buy it for in London today, so it
 * leads; the last trade stands in when nothing is offered. The percentage is
 * how far our price sits above or below it. A check, never a price we set.
 */
/** How far above London our price may sit before it is flagged, in percent */
const LONDON_PREMIUM_BAND = 30;

const LondonCell = ({
  market,
  ours,
  canAsk,
  asking,
  onAsk,
}: {
  market?: {
    bidUsd: number | null;
    askUsd: number | null;
    lastUsd: number | null;
    lastTradedAt: Date | string | null;
    venues: string[];
    checkedAt: Date | string;
  };
  ours: number | null;
  /** A 75cl wine with a real LWIN, which the exchanges could list */
  canAsk: boolean;
  asking: boolean;
  onAsk: () => void;
}) => {
  const ccy = useContext(CurrencyContext);
  const lead = market?.askUsd ?? market?.lastUsd ?? null;

  const askButton = canAsk && (
    <button
      type="button"
      onClick={onAsk}
      disabled={asking}
      title="Ask Wine Labs for today's London price (15 to 30 credits)"
      className="inline-flex align-middle text-text-muted/50 hover:text-text-primary disabled:opacity-50"
    >
      {asking ? <IconLoader2 size={12} className="animate-spin" /> : <IconRefresh size={12} />}
    </button>
  );

  if (!market || lead == null) {
    return (
      <td className="px-3 py-2.5 text-right">
        <span className="text-text-muted/40">—</span>
        {askButton}
      </td>
    );
  }

  const gap = ours != null && ours > 0 ? Math.round(((ours - lead) / lead) * 100) : null;
  const traded = market.lastTradedAt
    ? new Date(market.lastTradedAt).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    : null;
  const title = [
    market.askUsd != null ? `Lowest ask ${money(market.askUsd, ccy)}` : 'No asks',
    market.bidUsd != null ? `best bid ${money(market.bidUsd, ccy)}` : 'no bids',
    market.lastUsd != null ? `last trade ${money(market.lastUsd, ccy)}${traded ? ` (${traded})` : ''}` : 'no trades',
    `on ${market.venues.map((venue) => VENUE_NAMES[venue] ?? venue).join(', ')}`,
    `checked ${new Date(market.checkedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
  ].join(', ');

  // Our price carries freight to Dubai, so up to 30% above London is the
  // normal band and stays grey; below London is a selling point, well above
  // it is a price a trade buyer will question
  const tone =
    gap == null
      ? ''
      : gap < 0
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
        : gap > LONDON_PREMIUM_BAND
          ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
          : 'bg-fill-secondary text-text-muted';

  return (
    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums" title={title}>
      <span className="inline-flex items-center justify-end gap-1.5">
        <span className="font-medium text-text-primary">{money(lead, ccy, 0)}</span>
        {market.askUsd == null && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">last</span>
        )}
        {gap != null && (
          <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}>
            {gap > 0 ? `+${gap}%` : gap < 0 ? `${gap}%` : '0%'}
          </span>
        )}
        {askButton}
      </span>
    </td>
  );
};

const SkeletonRow = () => (
  <tr>
    <td className="px-3 py-3">
      <div className="h-4 w-40 animate-pulse rounded bg-surface-muted" />
      <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-surface-muted" />
    </td>
    {Array.from({ length: 12 }).map((_, i) => (
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
  // Display currency, remembered per browser. Prices stay stored in USD.
  const [currency, setCurrency] = useState<DisplayCurrency>('USD');
  useEffect(() => {
    try {
      if (localStorage.getItem('pm_currency') === 'AED') setCurrency('AED');
    } catch {
      // storage blocked — stay on USD
    }
  }, []);
  const changeCurrency = (next: DisplayCurrency) => {
    setCurrency(next);
    try {
      localStorage.setItem('pm_currency', next);
    } catch {
      // storage blocked — the choice just won't persist
    }
  };

  // State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter | undefined>('Wine');
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortField>('productName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState<number>(50);
  // Compact: one line a wine, so 30 or more fit on a screen. Remembered per browser.
  const [compact, setCompact] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem('pm-density') === 'comfortable') setCompact(false);
    } catch {
      // Storage blocked: stay compact
    }
  }, []);
  const changeDensity = (next: boolean) => {
    setCompact(next);
    try {
      localStorage.setItem('pm-density', next ? 'compact' : 'comfortable');
    } catch {
      // Storage blocked: the choice lasts this visit
    }
  };

  // Flat logistics still fed to the bulk "Apply Margin" tool (which prices
  // import + flat logistics for manual-import SKUs). Landed on the table itself
  // uses the live per-line breakdown, so this is no longer user-editable.
  const [logisticsPerBottle] = useState<number>(25);
  const [showBands, setShowBands] = useState(false);
  // Lines ticked for a bulk action. Keyed by LWIN, which is what margin and
  // release are stored against.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkB2b, setBulkB2b] = useState('');
  const [bulkPc, setBulkPc] = useState('');

  // Adjustable in-bond (B2B) markup %, applied on landed cost. Persisted.
  const [inBondMarkupPct, setInBondMarkupPct] = useState<number>(() => {
    if (typeof window === 'undefined') return IN_BOND_MARKUP * 100;
    // Read the KEY, not Number() of it. localStorage.getItem returns null when
    // the key was never written, and Number(null) is 0 — which passed the
    // `>= 0` guard and set the B2B markup to ZERO. Every wine with no owner
    // margin of its own (all in-transit stock) then priced at landed cost, and
    // a quote built from this screen went out at cost.
    const raw = localStorage.getItem('pm-inbond-markup-pct');
    if (raw === null || raw.trim() === '') return IN_BOND_MARKUP * 100;
    const stored = Number(raw);
    return Number.isFinite(stored) && stored > 0 ? stored : IN_BOND_MARKUP * 100;
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
  /**
   * Which price-gap filters are on. Several at once, ANDed.
   *
   * One at a time could not express "released but not on the price list" — the
   * state that matters most, because it is finished work a customer still
   * cannot see.
   */
  type PriceFilterKey =
    | 'unpriced'
    | 'lossMaking'
    | 'noImport'
    | 'notReleased'
    | 'released'
    | 'onPriceList'
    | 'notOnPriceList';

  const [priceFilters, setPriceFilters] = useState<PriceFilterKey[]>([]);

  const togglePriceFilter = (key: PriceFilterKey) =>
    setPriceFilters((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key],
    );
  const [includeInbound, setIncludeInbound] = useState(false);
  const [includeSoldOut, setIncludeSoldOut] = useState(false);
  // Row-expand: which lwin18's last-sold detail is open (null = all collapsed)
  const [expandedLwin, setExpandedLwin] = useState<string | null>(null);

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
  /**
   * Which owner's rates the boxes are currently showing.
   *
   * Seeded once per owner, not on every resolution of the query. It used to
   * reseed whenever `ownerSettings` changed, which includes the moment the
   * fetch lands and every refetch triggered by an unrelated save — so a rate
   * typed in the second after picking an owner was overwritten by the server's
   * old value before the blur that would have saved it. The number went in,
   * the field went back, and nothing said why.
   */
  const seededOwner = useRef<string | null>(null);

  useEffect(() => {
    if (!ownerId) {
      seededOwner.current = null;

      return;
    }

    if (ownerSettings && seededOwner.current !== ownerId) {
      seededOwner.current = ownerId;
      setOwnerDraft({
        logistics: ownerSettings.logisticsPerBottle,
        inbondPct: ownerSettings.inbondMarginPct,
        pcPct: ownerSettings.pcMarginPct,
      });
    }
  }, [ownerSettings, ownerId]);

  // A margin typed on a row, or implied by a price typed into In Bond. Stored
  // as a MARGIN so it keeps working when the cost moves — a stored price goes
  // stale the moment freight lands.
  const setLineMarginsMut = useMutation({
    ...api.wms.admin.stock.pricing.setLineMargins.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(`Could not set margin: ${error.message}`),
  });

  // The gate's trigger: a wine held off the price lists until someone with the
  // commercial call says it is priced. Without this the gate has no way out.
  const setReleaseMut = useMutation({
    ...api.wms.admin.stock.pricing.setRelease.mutationOptions(),
    onSuccess: (r) => {
      /*
        Reports what changed, not what was asked for.

        "1 wine held back" appeared with a tick while the badge stayed exactly
        where it was, because the count returned was the size of the request.
        A success message that cannot fail is not a success message.
      */
      if (r.touched === 0) {
        toast.warning(
          'Nothing changed — that wine has no pricing row to hold back. Set a price on it first.',
        );
      } else {
        toast.success(
          r.released
            ? `${r.touched} wine${r.touched === 1 ? '' : 's'} released to the price lists`
            : `${r.touched} wine${r.touched === 1 ? '' : 's'} held back`,
        );
      }
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(`Could not release: ${error.message}`),
  });

  const setAvailabilityMut = useMutation({
    ...api.wms.admin.stock.pricing.setInboundAvailability.mutationOptions(),
    onSuccess: (r) => {
      /*
        Says what changed. "Held for its owner" is the quietest way for a wine
        to be missing from a price list, so lifting it should be as loud as
        setting it.
      */
      if (r.updated === 0) {
        toast.warning('No lines changed — those may already be set that way.');
      } else {
        toast.success(
          r.notForSale
            ? `${r.updated} line${r.updated === 1 ? '' : 's'} held for their owner`
            : `${r.updated} line${r.updated === 1 ? '' : 's'} marked for sale — release them to publish`,
        );
      }
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(`Could not change availability: ${error.message}`),
  });

  const setAvailability = (
    lines: { shipmentNumber: string; lwin18: string }[],
    notForSale: boolean,
  ) => {
    if (lines.length === 0) return;

    setAvailabilityMut.mutate({ lines, notForSale });
  };

  const setOwnerSettingsMut = useMutation({
    ...api.wms.admin.stock.pricing.setOwnerSettings.mutationOptions(),
    retry: 2,
    onSuccess: (saved) => {
      /*
        Said out loud. These rates reprice every line on the screen, and the
        only previous feedback was the number staying where it was typed —
        which looks identical to a save that never happened.
      */
      toast.success(
        `Rates saved — in-bond ${saved.inbondMarginPct}%` +
          (saved.pcMarginPct != null ? `, private client ${saved.pcMarginPct}%` : ', no PC margin'),
      );
      void queryClient.invalidateQueries();
    },
    onError: (error) =>
      toast.error(`Could not save these rates: ${error.message}`),
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

  const release = (
    rows: { lwin18: string; ownerId?: string | null }[],
    released: boolean,
  ) => {
    setReleaseMut.mutate({
      released,
      lwin18s: rows.map((r) => r.lwin18),
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
  }, [sortBy, sortOrder, category, ownerId, priceFilters, includeInbound, includeSoldOut, limit]);

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
  const ownerName = ownerId
    ? (owners.find((o) => o.ownerId === ownerId)?.ownerName ?? null)
    : null;

  // Query
  const queryInput = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      category,
      ownerId,
      priceFilters,
      includeInbound,
      includeSoldOut,
      sortBy,
      sortOrder,
      limit,
      offset: page * limit,
    }),
    [debouncedSearch, category, ownerId, priceFilters, includeInbound, includeSoldOut, sortBy, sortOrder, limit, page],
  );

  const { data, isLoading } = useQuery(
    api.wms.admin.stock.pricing.getProducts.queryOptions(queryInput),
  );

  const products = data?.products ?? [];
  const pagination = data?.pagination;
  const summary = data?.summary;

  /**
   * What the in-transit rows are worth, priced the same way the table prices
   * them.
   *
   * Kept apart from the landed summary rather than folded into it. Stock at
   * cost and in-bond value are asset figures where "in the warehouse" and "on
   * the water" are genuinely different answers, and a blended total would
   * overstate what is sellable now. But zero above sixty-five priced wines is
   * no answer at all, so both are shown.
   */
  const inTransitTotals = useMemo(() => {
    const rows = includeInbound ? (data?.inbound ?? []) : [];
    let products = 0;
    let bottles = 0;
    let cost = 0;
    let inBond = 0;
    let pc = 0;

    for (const row of rows) {
      const caseConfig = row.caseConfig || 1;
      const rowBottles = (row.totalCases ?? 0) * caseConfig;
      const override = row.costOverridePerBottle ?? null;
      const hasCost =
        (row.importPricePerBottle != null && row.importPricePerBottle > 0) ||
        override != null;

      products += 1;
      bottles += rowBottles;

      if (!hasCost) continue;

      const landed =
        (row.importPricePerBottle ?? 0) +
        (row.systemLogistics ?? 0) +
        (row.transferPricePerBottle ?? 2.5) +
        (override ?? 0);

      const inBondPct = row.ownerInbondPct ?? inBondMarkupPct;
      const inBondPrice = inBondPct < 100 ? landed / (1 - inBondPct / 100) : null;
      // No PC margin on the owner means no private-client price, not a zero
      const pcPct = row.ownerPcPct;
      const pcPrice =
        pcPct != null && pcPct < 100 && inBondPrice != null
          ? inBondPrice / (1 - pcPct / 100)
          : null;

      cost += landed * rowBottles;
      if (inBondPrice != null) inBond += inBondPrice * rowBottles;
      if (pcPrice != null) pc += pcPrice * rowBottles;
    }

    return { products, bottles, cost, inBond, pc };
  }, [data?.inbound, includeInbound, inBondMarkupPct]);
  /**
   * Every line on screen, with its owner.
   *
   * A bulk release has to know whose stock each line is, so the rows travel
   * rather than just their codes.
   */
  const allRows: {
    lwin18: string;
    ownerId?: string | null;
    shipmentNumber?: string | null;
  }[] = [
    ...(includeInbound ? (data?.inbound ?? []) : []),
    ...products,
  ];

  /** Selected lines that are in transit — the only ones this applies to */
  const selectedInbound = (includeInbound ? (data?.inbound ?? []) : [])
    .filter((row) => selected.has(row.lwin18) && row.shipmentNumber)
    .map((row) => ({
      shipmentNumber: row.shipmentNumber as string,
      lwin18: row.lwin18,
    }));

  // Every line on screen — the "select all" target, so a filter or search
  // narrows what a bulk action touches.
  const visibleLwins = [
    ...(includeInbound ? (data?.inbound ?? []) : []),
    ...products,
  ].map((p) => p.lwin18);

  // Ticked lines that are still on screen. A tick survives a search or filter
  // change, and bulk actions used to apply to lines the user could no longer
  // see; they now apply to these only.
  const visibleLwinSet = new Set(visibleLwins);
  const selectedVisible = [...selected].filter((lwin18) => visibleLwinSet.has(lwin18));
  const hiddenSelectedCount = selected.size - selectedVisible.length;

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

  // London in-bond market from the Wine Labs snapshot; reading it spends no credits
  const visibleKey = visibleLwins.join(',');
  const londonLwins = useMemo(
    () => (visibleKey ? [...new Set(visibleKey.split(','))].slice(0, 1000) : []),
    [visibleKey],
  );
  const { data: londonData } = useQuery({
    ...api.wms.admin.stock.pricing.getLondonInBond.queryOptions({ lwin18s: londonLwins }),
    enabled: londonLwins.length > 0,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const londonPrices = londonData?.prices ?? {};

  // One wine's London price asked for now, before quoting on it; spends credits
  const [askingLondon, setAskingLondon] = useState<string | null>(null);
  const refreshLondonMut = useMutation({
    ...api.wms.admin.stock.pricing.refreshLondonInBond.mutationOptions(),
    onMutate: ({ lwin18 }) => setAskingLondon(lwin18),
    onSettled: () => setAskingLondon(null),
    onSuccess: ({ status }) => {
      void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getLondonInBond.queryKey() });
      toast.success(status === 'priced' ? 'London price updated' : 'Not listed on the London exchanges');
    },
    onError: (error) => toast.error(error.message),
  });

  /*
    Every wine on screen, or the ticked ones, priced in London in one go.

    Each wine costs 15 to 30 Wine Labs credits (nothing if asked in the last
    10 minutes), so the button asks once with the count before it spends.
    Three at a time, so a page of wines comes back in a minute or two without
    tripping Wine Labs' rate limit. Internal codes (9xxxxxx) are skipped: the
    London exchanges do not know them.
  */
  const londonTargets = (
    selected.size > 0 ? londonLwins.filter((lwin) => selected.has(lwin)) : londonLwins
  ).filter((lwin) => !/^9\d{6}-/.test(lwin));
  const [confirmLondon, setConfirmLondon] = useState(false);
  const [londonRun, setLondonRun] = useState<{ done: number; total: number } | null>(null);
  const pullLondon = async (lwins: string[]) => {
    setConfirmLondon(false);
    setLondonRun({ done: 0, total: lwins.length });
    let next = 0;
    let priced = 0;
    let unlisted = 0;
    let failed = 0;
    const worker = async () => {
      while (next < lwins.length) {
        const lwin18 = lwins[next++]!;
        try {
          const { status } = await trpcClient.wms.admin.stock.pricing.refreshLondonInBond.mutate({ lwin18 });
          if (status === 'priced') priced++;
          else unlisted++;
        } catch {
          failed++;
        }
        setLondonRun((run) => run && { ...run, done: run.done + 1 });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setLondonRun(null);
    void queryClient.invalidateQueries({ queryKey: api.wms.admin.stock.pricing.getLondonInBond.queryKey() });
    toast.success(
      `London prices: ${priced} priced, ${unlisted} not listed${failed ? `, ${failed} could not be read` : ''}`,
    );
  };

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
  /*
    The price filters belong here too, now that several can be on at once.

    They were only shown as pressed chips in a row of eight, so two active
    filters looked much like one — and "Clear all" was the only way to drop
    either, which throws away the owner and the search with them.
  */
  const PRICE_FILTER_LABELS: Record<string, string> = {
    unpriced: 'Unpriced',
    lossMaking: 'Below cost',
    noImport: 'No import cost',
    notReleased: 'Not released',
    released: 'Released',
    onPriceList: 'On price list',
    notOnPriceList: 'Not on price list',
  };

  for (const key of priceFilters) {
    activeFilters.push({
      key: `price-${key}`,
      label: PRICE_FILTER_LABELS[key] ?? key,
      onRemove: () => togglePriceFilter(key),
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
    setPriceFilters([]);
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

  const formatValue = (usd: number) => {
    const v = currency === 'AED' ? usd * AED_PER_USD : usd;
    const sym = currency === 'AED' ? 'AED ' : '$';
    if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${sym}${(v / 1_000).toFixed(1)}K`;
    return `${sym}${v.toFixed(0)}`;
  };

  // Excel export — pages through ALL filtered rows (not just the current page)
  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const pageSize = 200;
      const landedRows: typeof products = [];
      // In-transit lines come back whole on every page, so they are taken once
      let inboundRows: NonNullable<typeof data>['inbound'] = [];
      for (let offset = 0; offset < 20000; offset += pageSize) {
        const res = await trpcClient.wms.admin.stock.pricing.getProducts.query({
          search: debouncedSearch || undefined,
          category,
          ownerId,
          priceFilters,
          includeInbound,
          includeSoldOut,
          sortBy,
          sortOrder,
          limit: pageSize,
          offset,
        });
        if (offset === 0) inboundRows = includeInbound ? (res.inbound ?? []) : [];
        landedRows.push(...res.products);
        if (!res.pagination.hasMore) break;
      }
      // Same order as the table: in transit first, then landed stock
      const all = [
        ...inboundRows.map((p) => ({ ...p, exportStatus: `In transit${p.shipmentNumber ? ` (${p.shipmentNumber})` : ''}` })),
        ...landedRows.map((p) => ({ ...p, exportStatus: 'In stock' })),
      ];
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
        'Product', 'Producer', 'Vintage', 'Status', 'Pack', 'Cases', 'Bottles', 'Import $/btl', 'Logistics $/btl',
        'Transfer $/btl', 'Override $/btl', 'Landed $/btl', 'Import $/case', 'In Bond $/btl', 'In Bond $/case',
        'PC Price $/btl', 'PC Price $/case', 'Margin % (PC vs In Bond)', 'Margin % (In Bond vs Landed)',
      ]];
      for (const p of all) {
        const caseConfig = p.caseConfig ?? 12;
        const override = p.costOverridePerBottle ?? null;
        // The same function the table uses, so a margin typed on the row is in the sheet too
        const priced = pricePricingManagerRow(p as PricingManagerRowInput, {
          ownerSelected: !!ownerId,
          effInbondPct,
          effPcPct,
          inBondMarkupPct,
          pcMarginPct,
          ownerPcPrice: ownerId ? ownerPrices[p.lwin18] : null,
        });
        const rowLog = priced.logistics;
        const rowTransfer = priced.transfer;
        const landed = priced.landed;
        const inBond = priced.inBond;
        const sell = priced.sellPrice;
        const margin = priced.pcMargin;
        const num = (v: number | null | undefined, dp = 2) =>
          v != null ? Number(v.toFixed(dp)) : '';
        aoa.push([
          p.productName,
          p.producer ?? '',
          p.vintage ?? '',
          p.exportStatus,
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
          num(priced.inbondMargin, 1),
        ]);
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: 40 }, { wch: 22 }, { wch: 8 }, { wch: 24 }, { wch: 10 }, { wch: 7 }, { wch: 8 }, { wch: 12 }, { wch: 13 },
        { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      ];
      ws['!autofilter'] = { ref: `A1:S${all.length + 1}` };
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
    priceFilters,
    includeInbound,
    includeSoldOut,
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
    <CurrencyContext.Provider value={currency}>
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <AdminPageHeader
        title="Pricing Manager"
        description="Import, in bond (B2B), and private client pricing"
      />

      {/*
        These read landed stock only, and say so when that is not what is on
        screen. A partner whose wine is all still in transit showed "0 products
        · — · — · $0" directly above a list of sixty-five of their wines, which
        reads as a broken page rather than as two different questions.
      */}

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Products"
          value={summary?.totalProducts?.toLocaleString() ?? '—'}
          secondary={
            inTransitTotals.products > 0
              ? `+ ${inTransitTotals.products.toLocaleString()} in transit`
              : undefined
          }
          subtitle="landed in the warehouse"
          icon={<IconBottle className="h-5 w-5" />}
        />
        <KpiCard
          label="Stock at Cost"
          value={summary?.stockAtCost ? formatValue(summary.stockAtCost) : '—'}
          secondary={
            inTransitTotals.cost > 0
              ? `+ ${formatValue(inTransitTotals.cost)} in transit`
              : undefined
          }
          subtitle="landed cost of stock on hand"
          icon={<IconBuildingWarehouse className="h-5 w-5" />}
        />
        <KpiCard
          label="In-Bond Value"
          value={summary?.inBondValue ? formatValue(summary.inBondValue) : '—'}
          secondary={
            inTransitTotals.inBond > 0
              ? `+ ${formatValue(inTransitTotals.inBond)} in transit`
              : undefined
          }
          subtitle="B2B value of stock"
          icon={<IconCurrencyDollar className="h-5 w-5" />}
        />
        <KpiCard
          label="PC Value"
          value={summary?.pcValue ? formatValue(summary.pcValue) : '—'}
          color="brand"
          secondary={
            inTransitTotals.pc > 0
              ? `+ ${formatValue(inTransitTotals.pc)} in transit`
              : inTransitTotals.products > 0
                ? 'in-transit lines have no PC margin set'
                : undefined
          }
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
          onClick={() => togglePriceFilter('unpriced')}
          active={priceFilters.includes('unpriced')}
        />
        <KpiCard
          label="Below Cost"
          value={summary?.belowCostCount != null ? summary.belowCostCount.toString() : '—'}
          subtitle="priced at/below landed cost"
          color={summary?.belowCostCount ? 'red' : 'default'}
          icon={<IconAlertTriangle className="h-5 w-5" />}
          onClick={() =>
            togglePriceFilter('lossMaking')
          }
          active={priceFilters.includes('lossMaking')}
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

        {/* Search — full width so it wraps onto its own line directly beneath
            the category pills. It used to sit wedged between the owner
            dropdown and the action buttons at text-sm on a muted fill, where
            what you had typed was genuinely hard to read. */}
        <div className="relative w-full">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search wines, producers or LWIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search products"
            className="w-full rounded-xl border-2 border-border-primary bg-surface-primary py-3 pl-12 pr-11 text-base font-medium text-text-primary shadow-sm transition-all placeholder:font-normal placeholder:text-text-muted/70 focus:border-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary/25"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-muted hover:bg-fill-secondary hover:text-text-primary"
            >
              <IconX className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Owner dropdown */}
        <select
          value={ownerId ?? ''}
          onChange={(e) => setOwnerId(e.target.value || undefined)}
          className="rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm text-text-primary transition-colors focus:border-text-primary focus:outline-none"
        >
          <option value="">All Owners</option>
          {owners.map((o) => (
            <option key={o.ownerId} value={o.ownerId}>
              {o.ownerName ?? 'Unknown'} (
              {o.totalCases > 0
                ? `${o.totalCases} cases`
                : `${(o as { inboundCases?: number }).inboundCases ?? 0} inbound`}
              )
            </option>
          ))}
        </select>


        <button
          type="button"
          onClick={() => setShowBands(true)}
          className="whitespace-nowrap rounded-lg border border-border-muted px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-fill-secondary"
          title="Set the margin taken over landed cost, by what the bottle cost"
        >
          Margin tiers…
        </button>

        {showBands && (
          <PricingBandsEditor
            ownerId={ownerId || null}
            ownerName={owners.find((o) => o.ownerId === ownerId)?.ownerName ?? null}
            onClose={() => setShowBands(false)}
          />
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
                    className="w-full rounded border border-border-primary bg-background-primary px-3 py-1.5 text-sm focus:border-text-primary focus:outline-none"
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
                    className="flex items-center gap-1 rounded bg-text-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-text-primary/90 disabled:opacity-50"
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

        {/* Display currency — every figure on screen; edits stay in USD */}
        <div
          className="flex overflow-hidden rounded-lg border border-border-primary text-sm font-medium"
          title="Show prices in USD or AED (at 3.6725). Prices are still entered in USD."
        >
          {(['USD', 'AED'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => changeCurrency(c)}
              className={`px-3 py-2 transition-colors ${
                currency === c
                  ? 'bg-text-primary text-background-primary'
                  : 'bg-background-primary text-text-secondary hover:bg-surface-muted'
              }`}
            >
              {c}
            </button>
          ))}
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
        {/*
          Two groups, because they answer different questions. The first three
          are gaps in the pricing; the next four are where a wine has got to on
          its way to a customer. Eight chips in one undifferentiated row read as
          eight alternatives, which is also how they behaved until they started
          combining.
        */}
        {([
          { key: undefined, label: 'All' },
          { key: 'unpriced' as const, label: 'Unpriced' },
          { key: 'lossMaking' as const, label: 'Below cost' },
          { key: 'noImport' as const, label: 'No import cost' },
          { key: 'divider' as const, label: '' },
          /*
            The working filter. Pricing a shipment is a line-by-line pass
            ending in a release, and the finished lines stayed in the list with
            the unfinished ones — so the job appeared to get longer the closer
            it came to done.
          */
          /*
            Named for what they test.

            They were "On price list" / "Not on price list" while testing only
            whether a wine had been released. The catalogue applies more gates
            than that, so a released wine held for its owner sat under "On
            price list" wearing a badge saying it was not listed — two true
            statements contradicting each other because one of them was
            mislabelled. The badge says whether a wine reaches the list; these
            say whether anyone has released it.
          */
          { key: 'notReleased' as const, label: 'Not released' },
          { key: 'released' as const, label: 'Released' },
          /*
            The question people actually mean. Released says someone cleared it;
            this says a customer can see it — released, not held for its owner,
            classified, and with a cost to price from.
          */
          { key: 'onPriceList' as const, label: 'On price list' },
          /* The queue: not released, held, unclassified or unpriced */
          { key: 'notOnPriceList' as const, label: 'Not on price list' },
        ]).map((f) => (
          f.key === 'divider' ? (
            <span key="gap-divider" className="mx-1 h-4 w-px bg-border-muted" />
          ) : (
          <button
            key={f.label}
            // Toggles. "Released" and "Not on price list" together is the whole
            // point: finished work a customer still cannot see.
            onClick={() =>
              f.key === undefined
                ? setPriceFilters([])
                : togglePriceFilter(f.key)
            }
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              f.key === undefined
                ? priceFilters.length === 0
                  ? 'border-transparent bg-text-primary text-white shadow-sm'
                  : 'border-border-muted bg-background-primary text-text-secondary hover:border-border-primary hover:text-text-primary'
                : priceFilters.includes(f.key)
                  ? 'border-transparent bg-text-primary text-white shadow-sm'
                  : 'border-border-muted bg-background-primary text-text-secondary hover:border-border-primary hover:text-text-primary'
            }`}
          >
            {f.label}
          </button>
          )
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
        <button
          onClick={() => setIncludeSoldOut((v) => !v)}
          title="Show sold-out SKUs (0 cases on hand) so you can see what's moved"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
            includeSoldOut
              ? 'border-transparent bg-text-primary text-white shadow-sm'
              : 'border-border-muted bg-background-primary text-text-secondary hover:border-border-primary hover:text-text-primary'
          }`}
        >
          {includeSoldOut ? '✓ Sold (0 qty)' : '+ Sold (0 qty)'}
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
              {(
                totalCount + (includeInbound ? (data?.inbound?.length ?? 0) : 0)
              ).toLocaleString()}{' '}
              product
              {totalCount + (includeInbound ? (data?.inbound?.length ?? 0) : 0) !== 1
                ? 's'
                : ''}
              {includeInbound && (data?.inbound?.length ?? 0) > 0 && (
                <span className="text-text-muted/70">
                  {' '}
                  ({data?.inbound?.length} in transit)
                </span>
              )}
              {debouncedSearch && ` matching "${debouncedSearch}"`}
            </>
          )}
        </span>
        <span className="flex items-center gap-3">
          {londonRun ? (
            <span className="font-medium text-text-secondary">
              Pulling London prices… {londonRun.done} of {londonRun.total}
            </span>
          ) : confirmLondon ? (
            <span className="flex items-center gap-2">
              <span className="text-text-secondary">
                {londonTargets.length} {londonTargets.length === 1 ? 'wine' : 'wines'}, up to{' '}
                {(londonTargets.length * 30).toLocaleString()} Wine Labs credits
              </span>
              <button
                type="button"
                disabled={londonTargets.length === 0}
                onClick={() => void pullLondon(londonTargets)}
                className="rounded-md bg-text-primary px-2.5 py-0.5 font-medium text-surface-primary disabled:opacity-40"
              >
                Pull
              </button>
              <button
                type="button"
                onClick={() => setConfirmLondon(false)}
                className="rounded-md px-2 py-0.5 font-medium hover:bg-surface-muted hover:text-text-primary"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmLondon(true)}
              title={
                selected.size > 0
                  ? 'Ask Wine Labs for the London price of every ticked wine'
                  : 'Ask Wine Labs for the London price of every wine on this page'
              }
              className="rounded-lg border border-border-muted px-2.5 py-0.5 font-medium hover:bg-surface-muted hover:text-text-primary"
            >
              Pull London prices{selected.size > 0 ? ` (${londonTargets.length} ticked)` : ''}
            </button>
          )}
          <span className="flex items-center gap-0.5 rounded-lg border border-border-muted p-0.5">
            {[
              { value: true, label: 'Compact' },
              { value: false, label: 'Comfortable' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => changeDensity(option.value)}
                aria-pressed={compact === option.value}
                className={`rounded-md px-2.5 py-0.5 font-medium transition-colors ${
                  compact === option.value
                    ? 'bg-text-primary text-surface-primary'
                    : 'hover:bg-surface-muted hover:text-text-primary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </span>
          {totalPages > 1 && (
            <span>
              Page {page + 1} of {totalPages}
            </span>
          )}
        </span>
      </div>

      {/* Bulk actions — appears once anything is ticked. One margin and one
          release for a whole shipment, instead of 165 trips through a sheet. */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-text-primary bg-surface-secondary px-4 py-2.5 shadow-sm">
          <span className="text-sm font-semibold text-text-primary">
            {selectedVisible.length} selected
            {hiddenSelectedCount > 0 && (
              <span className="ml-1 font-normal text-text-muted">
                ({hiddenSelectedCount} hidden by the current filter, not included)
              </span>
            )}
          </span>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-text-muted">B2B&nbsp;%</label>
            <input
              type="number"
              min="0"
              max="99"
              step="0.5"
              value={bulkB2b}
              onChange={(e) => setBulkB2b(e.target.value)}
              placeholder="—"
              className="w-16 rounded border border-border-muted bg-background-primary px-1.5 py-1 text-right text-sm tabular-nums"
            />
            <label className="text-xs text-text-muted">PC&nbsp;%</label>
            <input
              type="number"
              min="0"
              max="99"
              step="0.5"
              value={bulkPc}
              onChange={(e) => setBulkPc(e.target.value)}
              placeholder="—"
              className="w-16 rounded border border-border-muted bg-background-primary px-1.5 py-1 text-right text-sm tabular-nums"
            />
            <button
              type="button"
              disabled={
                (bulkB2b === '' && bulkPc === '') ||
                setLineMarginsMut.isPending ||
                selectedVisible.length === 0
              }
              onClick={() => {
                const count = selectedVisible.length;
                setLineMarginsMut.mutate(
                  {
                    lwin18s: selectedVisible,
                    ...(bulkB2b !== '' ? { b2bMarginPct: Number(bulkB2b) } : {}),
                    ...(bulkPc !== '' ? { pcMarginPct: Number(bulkPc) } : {}),
                  },
                  {
                    onSuccess: () =>
                      toast.success(`Margin set on ${count} wines`),
                  },
                );
              }}
              className="rounded bg-text-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              Apply margin
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/*
              For sale, per line, without leaving the screen.

              A consignment is rarely all one thing — Ihab Toma's is mostly wine
              being delivered to him with a few lines we are selling. The
              shipment-wide hold is right for the shipment and wrong for those
              few, and saying so meant opening Logistics and editing each line's
              Availability by hand. It is also the step that defeats every other
              one: a line held for its owner cannot reach a price list however
              it is priced or released, so releasing it appears to do nothing.
            */}
            {selectedInbound.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setAvailability(selectedInbound, false)}
                  title="Sell these lines, overriding the shipment's hold"
                  className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Mark for sale
                </button>
                <button
                  type="button"
                  onClick={() => setAvailability(selectedInbound, true)}
                  title="Keep these lines off every price list and quote"
                  className="rounded border border-border-muted px-3 py-1 text-xs font-semibold text-text-muted hover:bg-fill-secondary"
                >
                  Hold for owner
                </button>
                <span className="h-4 w-px bg-border-muted" />
              </>
            )}
            <button
              type="button"
              onClick={() =>
                release(
                  allRows.filter((r) => selected.has(r.lwin18)),
                  true,
                )
              }
              className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Release to price list
            </button>
            <button
              type="button"
              onClick={() =>
                release(
                  allRows.filter((r) => selected.has(r.lwin18)),
                  false,
                )
              }
              className="rounded border border-border-muted px-3 py-1 text-xs font-semibold text-text-muted hover:bg-fill-secondary"
            >
              Hold back
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {/*
              Compact rows: a wine on one line, case figures dropped (the
              bottle price is what gets compared down a column), the name cut
              with the full name on hover. Plain CSS so every cell follows
              without each one knowing about the setting.
            */}
            <style>{`
              .pm-compact > tbody > tr > td { padding-top: 3px; padding-bottom: 3px; font-size: 13px; line-height: 20px; }
              .pm-compact .pm-sub, .pm-compact .pm-meta { display: none; }
              .pm-compact .pm-product { min-width: 400px; max-width: 460px; overflow: hidden; }
              .pm-compact .pm-namerow { flex-wrap: nowrap; gap: 6px; max-width: 440px; }
              .pm-compact .pm-why { display: none; }
              .pm-compact .pm-namerow > * { flex-shrink: 0; white-space: nowrap; }
              .pm-compact .pm-namerow > button { flex-shrink: 1; min-width: 0; }
              .pm-compact .pm-name { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
            `}</style>
            <table className={`w-full text-sm ${compact ? 'pm-compact' : ''}`}>
              <thead className="sticky top-0 z-10 hidden bg-surface-muted md:table-header-group shadow-[0_1px_0_rgba(0,0,0,0.06),0_4px_8px_-4px_rgba(0,0,0,0.08)]">
                {/* Group row */}
                <tr className="text-[10px] font-semibold uppercase tracking-wide">
                  {/* Sits over the pinned pair, so it is pinned with them */}
                  <th
                    className="bg-surface-muted sticky left-0 z-20 px-3 pb-1.5 pt-2.5"
                    colSpan={2}
                  />
                  <th className="px-3 pb-1.5 pt-2.5" colSpan={2} />
                  <th
                    title="Cost build-up per bottle: Import + Logistics + Transfer + Override = Landed"
                    className="border-l-2 border-slate-300 bg-slate-100/70 px-3 pb-1.5 pt-2.5 text-center text-slate-500"
                    colSpan={5}
                  >
                    Cost
                  </th>
                  <th
                    title="In-bond (B2B) selling price tier for trade, beside the London in-bond market"
                    className="border-l-2 border-blue-300 bg-blue-50 px-3 pb-1.5 pt-2.5 text-center text-blue-600"
                    colSpan={2}
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
                    title="Margin and cash profit, on the basis chosen below"
                    className="border-l-2 border-emerald-300 bg-emerald-50 px-3 pb-1.5 pt-2.5 text-center text-emerald-600"
                    colSpan={2}
                  >
                    Margin &amp; Profit
                  </th>
                </tr>
                {/* Column row */}
                <tr className="border-b border-border-muted">
                  <th className="bg-surface-muted sticky left-0 z-20 w-8 px-2 pb-2.5 pt-1">
                    <input
                      type="checkbox"
                      title="Select every line shown"
                      checked={
                        visibleLwins.length > 0 &&
                        selectedVisible.length >= visibleLwinSet.size
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? new Set(visibleLwins) : new Set(),
                        )
                      }
                      className="h-3.5 w-3.5 cursor-pointer"
                    />
                  </th>
                  {/*
                    Pinned. This table is far wider than any screen, so
                    scrolling right to reach the private-client price took the
                    name of the wine off the left-hand edge with it — the prices
                    were legible and anonymous.
                  */}
                  <th
                    className={`bg-surface-muted sticky left-8 z-20 px-3 pb-2.5 pt-1 text-left ${thBase}`}
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
                  >
                    <span className="flex items-center justify-end gap-1">
                      Import {renderSortIcon('importPrice')}
                      <HeaderInfo text="Import price per bottle — the ex-works goods cost, before freight. Click a cell to edit." />
                    </span>
                  </th>
                  <th className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-text-muted">
                    <span className="flex items-center justify-end gap-1">
                      Logistics
                      <HeaderInfo text="Live group/shipment freight per bottle (auto-updates). Click a cell to override this line; clear to revert to the system value." />
                    </span>
                  </th>
                  <th className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-text-muted">
                    <span className="flex items-center justify-end gap-1">
                      Transfers
                      <HeaderInfo text="FZ→mainland transfer fee per bottle ($2.50 default; $0 for consignment owners). Click a cell to edit." />
                    </span>
                  </th>
                  <th className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-text-muted">
                    <span className="flex items-center justify-end gap-1">
                      Override
                      <HeaderInfo text="Manual per-SKU cost adjustment (can be + or −), added to landed cost. Click a cell to edit." />
                    </span>
                  </th>
                  <th className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-text-muted">
                    <span className="flex items-center justify-end gap-1">
                      Landed
                      <HeaderInfo text="Landed cost per bottle = Import + Logistics + Transfer + Override." />
                    </span>
                  </th>
                  <th className="border-l-2 border-blue-300 px-3 pb-2.5 pt-1 text-right text-xs font-medium text-blue-600/80">
                    <span className="flex items-center justify-end gap-1">
                      In Bond
                      {/* The margin was only changeable from a chip in this
                          header or a panel that appears when an owner is
                          picked — neither of which reads as "change the
                          margin". Make it a button that says so. */}
                      {/* The blanket In Bond rate sits on its own column, apart
                          from PC: PC stays put while the In Bond rate moves */}
                      <HeaderPctInput
                        tone="blue"
                        title={ownerId ? `${ownerName ?? 'Owner'} In Bond margin %` : 'In Bond margin % for all wines'}
                        value={ownerId ? ownerDraft.inbondPct : inBondMarkupPct}
                        onChange={(v) =>
                          ownerId
                            ? setOwnerDraft((d) => ({ ...d, inbondPct: v ?? 0 }))
                            : setInBondMarkupPct(v ?? 0)
                        }
                        onCommit={() => ownerId && saveOwnerSettings(ownerDraft)}
                      />
                      <HeaderInfo text="In-Bond (B2B) price = Landed / (1 − margin). The margin comes from the tiers (by landed cost), an owner's own rate, or a per-wine override." />
                    </span>
                  </th>
                  <th className="px-3 pb-2.5 pt-1 text-right text-xs font-medium text-blue-600/80">
                    <span className="flex items-center justify-end gap-1">
                      London
                      <HeaderInfo text="London in-bond market for the bottle size of the row (a magnum priced as a magnum), from the exchanges Wine Labs reads (Bordeaux Index, BBX and others; not Liv-ex): the lowest ask, or the last trade when nothing is offered, and how far our In Bond price sits from it. Our price carries freight to Dubai, so expect it above London: green is below London, grey up to 30% above, red more than 30% above. LAST means no one is offering it and the last trade is shown. Refreshed from the Wine Labs page." />
                    </span>
                  </th>
                  <th
                    className={`border-l-2 border-violet-300 px-3 pb-2.5 pt-1 text-right ${thBase}`}
                    onClick={() => handleSort('sellingPrice')}
                  >
                    <span className="flex items-center justify-end gap-1 text-violet-600">
                      PC Price {renderSortIcon('sellingPrice')}
                      <HeaderPctInput
                        tone="violet"
                        allowEmpty
                        title={ownerId ? `${ownerName ?? 'Owner'} PC margin %` : 'PC margin % for all wines (empty keeps stored prices)'}
                        value={ownerId ? ownerDraft.pcPct : pcMarginPct || null}
                        onChange={(v) =>
                          ownerId
                            ? setOwnerDraft((d) => ({ ...d, pcPct: v }))
                            : setPcMarginPct(v ?? 0)
                        }
                        onCommit={() => ownerId && saveOwnerSettings(ownerDraft)}
                      />
                      <HeaderInfo text="Private Client price = Landed / (1 − PC margin), taken over landed cost in its own right rather than stacked on the B2B price. Click a cell to type a fixed price instead." />
                    </span>
                  </th>
                  <th
                    className={`border-l-2 border-emerald-300 px-3 pb-2.5 pt-1 text-right ${thBase}`}
                  >
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className="flex cursor-pointer items-center justify-end gap-1"
                        onClick={() => handleSort('margin')}
                      >
                        Margin {renderSortIcon('margin')}
                        <HeaderInfo text="IB·Landed = (In-Bond − Landed) / In-Bond, the B2B margin over cost (varies per owner). PC·IB = (PC − In-Bond) / PC, the private-client margin. Toggle below." />
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
                              : 'bg-surface-primary text-emerald-700 hover:bg-emerald-50'
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
                              : 'bg-surface-primary text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          PC·IB
                        </button>
                      </div>
                    </div>
                  </th>
                  {/*
                    Profit in money, as its own column.

                    It was a sub-line under the percentage, which is where you
                    put a footnote, not the figure the business runs on — the
                    first question asked of the screen was "how do I see
                    profit?" while it was on it.
                  */}
                  <th className={`px-3 pb-2.5 pt-1 text-right ${thBase}`}>
                    <span className="flex items-center justify-end gap-1">
                      Profit
                      <HeaderInfo text="Cash profit per bottle and per case, on the basis selected to the left. Expand a row for what the whole line earns." />
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
                    <td colSpan={14} className="py-20 text-center text-text-muted">
                      {/*
                        An owner holding nothing but wine in transit reads as an
                        owner holding nothing, unless the screen says which of
                        the two it means. "No products found" is true and
                        useless: the stock is there, one toggle away.
                      */}
                      {(() => {
                        const owner = owners.find((o) => o.ownerId === ownerId) as
                          | { inboundCases?: number; ownerName?: string }
                          | undefined;
                        const waiting = owner?.inboundCases ?? 0;

                        if (!includeInbound && waiting > 0) {
                          return (
                            <span>
                              Nothing landed for {owner?.ownerName ?? 'this owner'} —
                              their stock is all in transit.{' '}
                              <button
                                type="button"
                                onClick={() => setIncludeInbound(true)}
                                className="font-medium text-text-primary hover:underline"
                              >
                                Show inbound stock
                              </button>
                            </span>
                          );
                        }

                        /*
                          A dead end should offer the way out.

                          Filters combine now, so it is easy to reach an empty
                          screen by one chip too many — and "No products found"
                          reads as an absence of stock rather than an
                          over-narrowed view.
                        */
                        if (priceFilters.length > 0) {
                          return (
                            <span>
                              Nothing matches{' '}
                              {priceFilters
                                .map((k) => PRICE_FILTER_LABELS[k] ?? k)
                                .join(' + ')}
                              .{' '}
                              <button
                                type="button"
                                onClick={() => setPriceFilters([])}
                                className="font-medium text-text-primary hover:underline"
                              >
                                Clear these filters
                              </button>
                            </span>
                          );
                        }

                        return 'No products found';
                      })()}
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
                    // Kept for the cells that edit them
                    const lineLogistics =
                      (product as { lineLogistics?: number | null }).lineLogistics ?? null;
                    const transferStored =
                      (product as { transferPricePerBottle?: number | null })
                        .transferPricePerBottle ?? null;
                    /*
                      One definition of every price on the row, shared with the
                      Excel export so the sheet always says what the screen says.
                      A selected owner's rates apply to all rows; in "All Owners"
                      each row uses its owner's rates, then the toolbar. A margin
                      typed on this row beats both.
                    */
                    const priced = pricePricingManagerRow(product as PricingManagerRowInput, {
                      ownerSelected: !!ownerId,
                      effInbondPct,
                      effPcPct,
                      inBondMarkupPct,
                      pcMarginPct,
                      ownerPcPrice: ownerId ? ownerPriceMap[product.lwin18] : null,
                    });
                    const rowLogistics = priced.logistics;
                    const rowTransfer = priced.transfer;
                    const landed = priced.landed;
                    const inBondPrice = priced.inBond;
                    const sellPrice = priced.sellPrice;
                    const isSuggestedPc = priced.computedPc != null;
                    const hasOwnerPrice = priced.computedPc == null && priced.storedOwnerPrice != null;
                    // Margin measured against the in-bond (B2B) price
                    const margin = priced.pcMargin;
                    const marginPerBottle =
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
                    const displayMargin =
                      marginBasis === 'pcIb' ? margin : calcMargin(landed, inBondPrice);
                    const displayMarginPerBottle =
                      marginBasis === 'pcIb'
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

                    // Last realized sale (Zoho B2B or PCO) for the expand panel
                    const lastSold =
                      (
                        product as {
                          lastSold?: {
                            pricePerBottle: number;
                            ref: string;
                            soldAt: string | Date | null;
                            tier: 'B2B' | 'PC';
                          } | null;
                        }
                      ).lastSold ?? null;
                    const isExpanded = expandedLwin === product.lwin18;

                    // The two prices a phone can change too; one definition for both layouts.
                    // In bond: the margin the typed price implies is what gets stored.
                    const saveInBond = (price: number) => {
                      if (landed == null || landed <= 0) {
                        toast.error('This wine has no landed cost yet, so an In Bond price cannot be set. Add the cost first.');
                        return;
                      }
                      const pct = ((price - landed) / price) * 100;
                      setLineMarginsMut.mutate({
                        lwin18s: [product.lwin18],
                        b2bMarginPct: Math.max(0, Math.min(99, Number(pct.toFixed(2)))),
                      });
                    };
                    const inBondHint = (price: number) =>
                      landed != null && landed > 0 && price > 0
                        ? price <= landed
                          ? `below cost — landed is ${money(landed, currency)}`
                          : `${(((price - landed) / price) * 100).toFixed(1)}% margin on landed`
                        : null;
                    const savePc = (v: number) => {
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
                    };

                    return (
                      <Fragment
                        key={`${isInbound ? 'inb-' : ''}${product.lwin18}${
                          isInbound
                            ? `-${(product as { shipmentNumber?: string | null }).shipmentNumber ?? ''}`
                            : `-${(product as { ownerId?: string | null }).ownerId ?? ''}`
                        }`}
                      >
                      {/*
                        Opaque, and inherited by the pinned column.

                        Pinning the product cell gave it a background of its
                        own, which then sat over the row's own colour — an
                        in-transit row lost its amber and a below-cost row its
                        red in the one column that names the wine, and the
                        hover stopped at the second column. The row owns the
                        colour and the pinned cell inherits it, which needs the
                        row to be genuinely opaque: a translucent stripe lets
                        the columns scrolling underneath show through.
                      */}
                      <tr
                        className={`hidden transition-colors md:table-row ${
                          isInbound
                            ? 'bg-amber-50 hover:bg-amber-100'
                            : isLoss
                              ? 'bg-red-50 hover:bg-red-100'
                              : 'bg-surface-primary even:bg-surface-muted hover:bg-surface-muted'
                        }`}
                      >
                        <td className="sticky left-0 z-10 w-8 bg-inherit px-2 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(product.lwin18)}
                            onChange={(e) =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(product.lwin18);
                                else next.delete(product.lwin18);
                                return next;
                              })
                            }
                            className="h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>

                        {/* Product — pinned; see the header for why */}
                        <td
                          className={`pm-product sticky left-8 z-10 border-l-4 bg-inherit px-3 py-2.5 ${
                            ownerCue?.style.border ?? 'border-l-transparent'
                          }`}
                        >
                          <div className="pm-namerow flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedLwin((cur) =>
                                  cur === product.lwin18 ? null : product.lwin18,
                                )
                              }
                              title={`${product.productName}: show last sold price`}
                              className="flex min-w-0 items-center gap-1 text-left"
                            >
                              <IconChevronRight
                                className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                                  isExpanded ? 'rotate-90 text-text-secondary' : 'text-text-muted/60'
                                }`}
                              />
                              <span className="pm-name text-[15px] font-semibold leading-tight tracking-tight text-text-primary">
                                {product.productName}
                              </span>
                            </button>
                            {/* Vintage and a non-standard size ride in the pinned
                                column, so a row still reads as one wine when the
                                table is scrolled across to the prices */}
                            <span className="text-[13px] font-semibold tabular-nums text-text-secondary">
                              {product.vintage || 'NV'}
                              {product.bottleSize && !/^75\s?cl$|^750\s?ml$/i.test(product.bottleSize) && (
                                <span className="ml-1 font-normal text-text-muted">{product.bottleSize}</span>
                              )}
                            </span>
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
                            {/* One chip says it is in transit and on which
                                shipment; the full number and ETA are in its title */}
                            {isInbound && (() => {
                              const shipment = (product as { shipmentNumber?: string | null })
                                .shipmentNumber;
                              return (
                                <span
                                  title={`In transit${shipment ? ` on ${shipment}` : ''}${
                                    eta ? `, ETA ${new Date(eta).toLocaleDateString('en-GB')}` : ''
                                  }`}
                                  className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800"
                                >
                                  {shipment ? shipment.replace(/^SHP-\d{4}-/, 'SHP ') : 'Inbound'}
                                </span>
                              );
                            })()}
                          {/* Whether this wine is on the price lists, and the
                              one control that changes it. */}
                          {(() => {
                            const released = (
                              product as { pricingReleasedAt?: Date | string | null }
                            ).pricingReleasedAt;
                            /*
                              Released is not the same as listed.

                              The catalogue applies more gates than this badge
                              ever did, so a wine could read "on price list"
                              and be nowhere on it. Whatever is actually
                              holding it back is named here rather than left to
                              be discovered by looking at the live site.
                            */
                            const p = product as {
                              notForSale?: boolean;
                              hsCode?: string | null;
                              shipmentStatus?: string;
                              importPricePerBottle?: number | null;
                            };
                            const blockers = isInbound
                              ? [
                                  p.notForSale ? 'held for its owner' : null,
                                  !p.hsCode ? 'no HS code — outside the wine feed' : null,
                                  !INBOUND_LISTABLE.includes(p.shipmentStatus ?? '')
                                    ? `shipment is ${p.shipmentStatus?.replace(/_/g, ' ')}`
                                    : null,
                                  landed == null || landed <= 0 ? 'no cost, so no price' : null,
                                ].filter(Boolean)
                              : [];
                            const gated =
                              isInbound &&
                              ((product as { shipmentNumber?: string | null })
                                .shipmentNumber ?? '') >= 'SHP-2026-0012';
                            if (!gated && !released) return null;
                            return released ? (
                              <button
                                type="button"
                                title={
                                  blockers.length > 0
                                    ? `Released, but the price list still excludes it: ${blockers.join('; ')}`
                                    : 'On the price lists — click to hold it back'
                                }
                                onClick={() =>
                                  release([product], false)
                                }
                                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                                  blockers.length > 0
                                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                }`}
                              >
                                {blockers.length > 0 ? 'Released, not listed' : 'On price list'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                title="Held off the price lists until you release it"
                                onClick={() =>
                                  release([product], true)
                                }
                                className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-700 hover:bg-red-200"
                              >
                                Release
                              </button>
                            );
                          })()}
                          {/* Named on the row: a tooltip is not a place to
                              keep the reason a wine is not selling. */}
                          {(() => {
                            const p = product as {
                              notForSale?: boolean;
                              hsCode?: string | null;
                              pricingReleasedAt?: Date | string | null;
                            };
                            /*
                              Shown whether or not the line is released.

                              These were only named on released rows, so the
                              queue of work — everything a customer cannot see —
                              stayed silent about the two things that most often
                              need doing. The badge already says whether it has
                              been released; this says what else is missing.
                            */
                            if (!isInbound) return null;
                            const why = [
                              p.notForSale ? 'held for its owner' : null,
                              !p.hsCode ? 'no HS code' : null,
                              landed == null || landed <= 0 ? 'no cost' : null,
                            ].filter(Boolean);

                            return why.length > 0 ? (
                              <span className="pm-why text-[9px] font-medium text-amber-700">
                                {why.join(' · ')}
                              </span>
                            ) : null;
                          })()}
                          </div>
                          {product.producer && (
                            <p className="pm-meta text-xs text-text-muted">{product.producer}</p>
                          )}
                          {isInbound && (
                            <p className="pm-meta text-[10px] text-amber-600">
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
                          <div className="pm-sub text-[10px] tabular-nums text-text-muted/70">
                            {caseConfig}×{product.bottleSize ?? '75cl'}
                          </div>
                        </td>

                        {/* Import (editable) — COST group */}
                        <PriceCell
                          value={importPrice}
                          tdClassName="border-l-2 border-slate-300"
                          sub={
                            importPrice != null && importPrice > 0
                              ? casePrice(importPrice, caseConfig, currency)
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
                            {landed != null ? money(landed, currency) : '—'}
                          </div>
                          {landed != null && (
                            <div className="pm-sub text-[11px] font-medium text-text-muted">
                              {casePrice(landed, caseConfig, currency)}
                            </div>
                          )}
                        </td>

                        {/* In Bond — B2B group */}
                        {/* In Bond — type a price and the MARGIN it implies is
                            what gets stored, so the price tracks cost instead of
                            detaching from it when freight lands. The hint says
                            what margin the number represents as it is typed. */}
                        <PriceCell
                          value={inBondPrice}
                          variant="prominent"
                          tdClassName="border-l-2 border-blue-300"
                          sub={
                            inBondPrice != null
                              ? casePrice(inBondPrice, caseConfig, currency)
                              : undefined
                          }
                          hintFor={inBondHint}
                          onSave={saveInBond}
                        />
                        <LondonCell
                          market={londonPrices[product.lwin18]}
                          ours={inBondPrice}
                          canAsk={/^[1-8]\d{6}-?\d{4}-?\d{2}-?\d{5}$/.test(product.lwin18 ?? '')}
                          asking={askingLondon === product.lwin18}
                          onAsk={() => refreshLondonMut.mutate({ lwin18: product.lwin18 })}
                        />

                        {/* PC Price (editable) — Private Client group */}
                        <PriceCell
                          value={sellPrice}
                          highlight={hasOwnerPrice}
                          suggested={isSuggestedPc}
                          variant="prominent"
                          tdClassName="border-l-2 border-violet-300"
                          sub={
                            sellPrice != null && sellPrice > 0
                              ? casePrice(sellPrice, caseConfig, currency)
                              : undefined
                          }
                          onSave={savePc}
                        />

                        {/* Margin — type a % on any row and the price follows.
                            It was read-only for wine, so the only way to move a
                            price was a cost override, which is the wrong lever:
                            it falsifies the cost to reach a price. */}
                        <MarginEditCell
                          value={displayMargin}
                          tdClassName="border-l-2 border-emerald-300"
                          onSave={(pct) =>
                            setLineMarginsMut.mutate({
                              lwin18s: [product.lwin18],
                              ...(marginBasis === 'pcIb'
                                ? { pcMarginPct: pct }
                                : { b2bMarginPct: pct }),
                            })
                          }
                        />

                        {/* Profit — money, in both units the wine is sold in */}
                        <td className="px-3 py-2.5 text-right">
                          {displayMarginPerBottle != null ? (
                            <>
                              <div
                                className={`font-semibold tabular-nums ${
                                  displayMarginPerBottle < 0
                                    ? 'text-red-600'
                                    : 'text-emerald-700'
                                }`}
                              >
                                ${displayMarginPerBottle.toFixed(2)}
                                <span className="text-[10px] font-normal text-text-muted">
                                  /btl
                                </span>
                              </div>
                              <div className="pm-sub text-[11px] font-medium tabular-nums text-text-muted">
                                $
                                {Math.round(
                                  displayMarginPerBottle * caseConfig,
                                ).toLocaleString('en-US')}
                                /case
                              </div>
                            </>
                          ) : (
                            <span className="text-text-muted/40">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="hidden bg-surface-muted/40 md:table-row">
                          <td colSpan={14} className="border-l-4 border-l-transparent px-3 py-3">
                            {/*
                              What the line is worth if it all sells at the
                              current price. Per bottle and per case answer "is
                              this priced well"; the total answers "is this
                              worth my attention", and a healthy margin on two
                              bottles is not the same call as the same margin on
                              sixty.
                            */}
                            {displayMarginPerBottle != null &&
                              product.totalCases > 0 && (
                                <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                                  <span className="font-semibold uppercase tracking-wide text-text-muted">
                                    Profit if sold
                                  </span>
                                  <span className="tabular-nums">
                                    <span
                                      className={`text-sm font-semibold ${
                                        displayMarginPerBottle < 0
                                          ? 'text-red-600'
                                          : 'text-emerald-700'
                                      }`}
                                    >
                                      $
                                      {Math.round(
                                        displayMarginPerBottle *
                                          product.totalCases *
                                          caseConfig,
                                      ).toLocaleString('en-US')}
                                    </span>
                                    <span className="text-text-muted">
                                      {' '}
                                      on {(product.totalCases * caseConfig).toLocaleString()}{' '}
                                      bottles
                                    </span>
                                  </span>
                                  <span className="tabular-nums text-text-secondary">
                                    {profitPerUnit(displayMarginPerBottle, caseConfig, currency)}
                                  </span>
                                  <span className="text-[10px] uppercase tracking-wide text-text-muted">
                                    {marginBasis === 'ibLanded'
                                      ? 'B2B over landed cost'
                                      : 'private client over B2B'}
                                  </span>
                                </div>
                              )}
                            {lastSold ? (
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs">
                                <span className="font-semibold uppercase tracking-wide text-text-muted">
                                  Last sold
                                </span>
                                <span className="tabular-nums">
                                  <span className="text-sm font-semibold text-text-primary">
                                    ${lastSold.pricePerBottle.toFixed(2)}
                                  </span>
                                  <span className="text-text-muted">/btl</span>
                                  <span className="ml-1.5 text-[10px] text-text-muted/70">
                                    {casePrice(lastSold.pricePerBottle, caseConfig, currency)}
                                  </span>
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                                    lastSold.tier === 'PC'
                                      ? 'bg-violet-100 text-violet-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {lastSold.tier === 'PC' ? 'Private Client' : 'B2B / Zoho'}
                                </span>
                                <span className="text-text-secondary">
                                  Order{' '}
                                  <span className="font-medium tabular-nums">{lastSold.ref}</span>
                                </span>
                                {lastSold.soldAt && (
                                  <span className="text-text-muted">
                                    {new Date(lastSold.soldAt).toLocaleDateString('en-GB', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs italic text-text-muted">
                                No recorded sale yet for this wine.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                      {/* The phone's version of this row: the figures that matter, a tap for the rest */}
                      <tr className="md:hidden">
                        <td colSpan={14} className="border-b border-border-muted p-0">
                          <button
                            type="button"
                            onClick={() => setExpandedLwin((cur) => (cur === product.lwin18 ? null : product.lwin18))}
                            aria-expanded={isExpanded}
                            className={`block w-full p-4 text-left ${isInbound ? 'bg-amber-50' : isLoss ? 'bg-red-50' : ''}`}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-text-primary">{product.productName}</span>
                                <span className="mt-0.5 block text-xs text-text-muted">
                                  {[ownerCue?.isMixed ? 'Mixed owners' : ownerCue?.fullName, `${caseConfig}×${product.bottleSize ?? '75cl'}`, `${product.totalCases} cs`].filter(Boolean).join(' · ')}
                                </span>
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-1">
                                {isInbound ? (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                    In transit{eta ? ` · ${new Date(eta).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                                  </span>
                                ) : null}
                                {isLoss ? (
                                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Below cost</span>
                                ) : null}
                              </span>
                            </span>
                            <span className="mt-3 grid grid-cols-4 gap-2 text-xs">
                              {[
                                ['Landed', landed != null ? money(landed, currency) : '—', 'text-text-primary'],
                                ['In bond', inBondPrice != null ? money(inBondPrice, currency) : '—', 'text-text-primary font-semibold'],
                                ['Private', sellPrice != null && sellPrice > 0 ? money(sellPrice, currency) : '—', 'text-text-primary font-semibold'],
                                ['Margin', displayMargin != null ? `${displayMargin.toFixed(1)}%` : '—', marginColor],
                              ].map(([label, value, tone]) => (
                                <span key={label} className="min-w-0">
                                  <span className="block text-[10px] uppercase tracking-wide text-text-muted">{label}</span>
                                  <span className={`block truncate tabular-nums ${tone}`}>{value}</span>
                                </span>
                              ))}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="space-y-3 border-t border-border-muted bg-surface-muted/40 p-4">
                              {displayMarginPerBottle != null && product.totalCases > 0 ? (
                                <p className="text-xs text-text-muted">
                                  Profit if sold{' '}
                                  <span className={`font-semibold ${displayMarginPerBottle < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                    ${Math.round(displayMarginPerBottle * product.totalCases * caseConfig).toLocaleString('en-US')}
                                  </span>{' '}
                                  on {(product.totalCases * caseConfig).toLocaleString()} bottles
                                </p>
                              ) : null}
                              <p className="text-xs text-text-muted">
                                {lastSold
                                  ? `Last sold at $${lastSold.pricePerBottle.toFixed(2)}/btl · ${lastSold.tier === 'PC' ? 'Private Client' : 'B2B'} · ${lastSold.ref}`
                                  : 'No recorded sale yet for this wine.'}
                              </p>
                              {landed != null && landed > 0 ? (
                                <PhonePriceField label="In bond per bottle (USD)" value={inBondPrice} onSave={saveInBond} hint={inBondHint} />
                              ) : null}
                              <PhonePriceField label="Private client per bottle (USD)" value={sellPrice} onSave={savePc} />
                              <p className="text-[11px] text-text-muted">Costs, logistics and overrides are edited on a larger screen.</p>
                            </div>
                          )}
                        </td>
                      </tr>
                      </Fragment>
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
    </CurrencyContext.Provider>
  );
};

export default PricingManagerPage;
