'use client';

import {
  IconAdjustments,
  IconAnchor,
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconArrowsExchange,
  IconBuildingWarehouse,
  IconCamera,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheck,
  IconColumns3,
  IconCurrencyDollar,
  IconDeviceFloppy,
  IconDownload,
  IconHistory,
  IconLayoutRows,
  IconLoader2,
  IconLock,
  IconMinus,
  IconPackage,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconShip,
  IconSortAscending,
  IconSortDescending,
  IconTags,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import ShipmentStatusBadge from '@/app/_logistics/components/ShipmentStatusBadge';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import PackBadge from '@/app/_wms/components/PackBadge';
import ProductMovementHistory from '@/app/_wms/components/ProductMovementHistory';
import usePrint from '@/app/_wms/hooks/usePrint';
import PrinterProvider from '@/app/_wms/providers/PrinterProvider';
import exportStockToExcel from '@/app/_wms/utils/exportStockToExcel';
import type { StockExportProduct } from '@/app/_wms/utils/exportStockToExcel';
import { generateBatchLabelsZpl } from '@/app/_wms/utils/generateLabelZpl';
import type { LabelData } from '@/app/_wms/utils/generateLabelZpl';
import generateStockPalletLabelZpl from '@/app/_wms/utils/generateStockPalletLabelZpl';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

type SortField = 'productName' | 'totalCases' | 'vintage' | 'receivedAt';
type SortOrder = 'asc' | 'desc';
type QuickFilter =
  | 'all'
  | 'lowStock'
  | 'reserved'
  | 'expiring'
  | 'ownStock'
  | 'consignment'
  | 'inbound';
type CategoryFilter = 'Wine' | 'Spirits' | 'RTD';
type RowDensity = 'compact' | 'normal' | 'relaxed';

/** Compact money formatter for the KPI cards ($1.2M / $489K / $842) */
const fmtMoney = (v: number) =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
      ? `$${(v / 1_000).toFixed(0)}K`
      : `$${v.toFixed(0)}`;

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
  importPrice: true,
  importCasePrice: true,
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
    <tr className="border-border-muted border-b">
      <td className={cls}>
        <div className="bg-surface-muted h-4 w-4 animate-pulse rounded" />
      </td>
      <td className={cls}>
        <div className="bg-surface-muted h-4 w-48 animate-pulse rounded" />
      </td>
      <td className={cls}>
        <div className="bg-surface-muted h-4 w-28 animate-pulse rounded" />
      </td>
      <td className={cls}>
        <div className="bg-surface-muted h-4 w-36 animate-pulse rounded" />
      </td>
      <td className={cls}>
        <div className="bg-surface-muted h-4 w-12 animate-pulse rounded" />
      </td>
      <td className={cls}>
        <div className="bg-surface-muted h-4 w-10 animate-pulse rounded" />
      </td>
      <td className={cls}>
        <div className="bg-surface-muted h-4 w-10 animate-pulse rounded" />
      </td>
      <td className={cls}>
        <div className="bg-surface-muted h-4 w-10 animate-pulse rounded" />
      </td>
      <td className={cls}>
        <div className="bg-surface-muted h-4 w-8 animate-pulse rounded" />
      </td>
      <td className={cls}>
        <div className="bg-surface-muted h-4 w-8 animate-pulse rounded" />
      </td>
      <td className={cls}>
        <div className="bg-surface-muted h-4 w-16 animate-pulse rounded" />
      </td>
    </tr>
  );
};

// ─── Status Dot ─────────────────────────────────────────────────────────────

interface StatusIndicatorProps {
  expiryStatus: string;
  availableCases: number;
  /** Loose bottles left after a case was cracked — stock, just not in cases. */
  openBottles?: number;
}

const StatusIndicator = ({
  expiryStatus,
  availableCases,
  openBottles = 0,
}: StatusIndicatorProps) => {
  // Priority: expired > expiring (90 days) > stock level
  if (expiryStatus === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Expired
      </span>
    );
  }
  if (expiryStatus === 'warning') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        Expiring
      </span>
    );
  }
  if (availableCases === 0 && openBottles > 0) {
    // Not "Out" — there are bottles on the shelf, they just aren't a case.
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {openBottles} loose
      </span>
    );
  }
  if (availableCases === 0) {
    return (
      <span className="bg-surface-muted text-text-muted inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium">
        <span className="bg-border-muted h-1.5 w-1.5 rounded-full" />
        Out
      </span>
    );
  }
  if (availableCases === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Final
      </span>
    );
  }
  if (availableCases <= 2) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Good
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
    className="text-text-muted hover:bg-fill-primary-hover hover:text-text-primary rounded-md p-2.5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {icon}
  </button>
);

// ─── Print Cell ─────────────────────────────────────────────────────────────

interface PrintCellProps {
  maxQty: number;
  defaultQty?: number;
  onPrint: (qty: number) => void;
}

const PrintCell = ({ maxQty, defaultQty, onPrint }: PrintCellProps) => {
  const initialQty = defaultQty ?? maxQty;
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(initialQty);

  if (!editing) {
    return (
      <td className="px-3 py-2 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setQty(initialQty);
            setEditing(true);
          }}
          className="text-text-muted hover:bg-surface-muted hover:text-text-brand rounded p-1 transition-colors"
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
          onChange={(e) =>
            setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))
          }
          onClick={(e) => e.stopPropagation()}
          className="border-border-primary bg-background-primary focus:border-border-brand w-12 rounded border px-1.5 py-0.5 text-center text-xs tabular-nums focus:outline-none"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrint(qty);
            setEditing(false);
          }}
          className="bg-fill-brand hover:bg-fill-brand/90 rounded px-2 py-0.5 text-[11px] font-medium text-white transition-colors"
        >
          Print
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditing(false);
          }}
          className="text-text-muted hover:text-text-primary rounded p-0.5"
        >
          <IconX className="h-3 w-3" />
        </button>
      </div>
    </td>
  );
};

// ─── BOE Cell (click-to-edit) ────────────────────────────────────────────────

const BoeCell = ({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  if (!editing) {
    return (
      <td className="text-text-muted hidden px-3 py-2 font-mono text-xs sm:table-cell">
        <button
          type="button"
          className="cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(value ?? '');
            setEditing(true);
          }}
        >
          {value || '—'}
        </button>
      </td>
    );
  }

  return (
    <td className="hidden px-3 py-2 sm:table-cell">
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = draft.trim();
          if (trimmed !== (value ?? '')) {
            onSave(trimmed);
          }
          setEditing(false);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="border-border-primary bg-background-primary focus:border-border-brand w-28 rounded border px-1.5 py-0.5 font-mono text-xs focus:outline-none"
          placeholder="RE BOE"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditing(false);
              setDraft(value ?? '');
            }
          }}
        />
        <button
          type="submit"
          onClick={(e) => e.stopPropagation()}
          className="bg-fill-brand hover:bg-fill-brand/90 rounded px-2 py-0.5 text-[11px] font-medium text-white transition-colors"
        >
          Save
        </button>
      </form>
    </td>
  );
};

// ─── Import Price Cell (click-to-edit) ────────────────────────────────────────

const ImportPriceCell = ({
  value,
  onSave,
  density,
}: {
  value: number | null;
  onSave: (v: number) => void;
  density: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toFixed(2) ?? '');

  if (!editing) {
    return (
      <td className={`${density} hidden text-right tabular-nums lg:table-cell`}>
        <button
          type="button"
          className="text-text-muted hover:text-text-primary cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(value?.toFixed(2) ?? '');
            setEditing(true);
          }}
        >
          {value != null ? `$${value.toFixed(2)}` : '—'}
        </button>
      </td>
    );
  }

  return (
    <td className={`${density} hidden lg:table-cell`}>
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
        <span className="text-text-muted text-xs">$</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="border-border-primary bg-background-primary focus:border-border-brand w-20 rounded border px-1.5 py-0.5 text-right font-mono text-xs tabular-nums focus:outline-none"
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
          onClick={(e) => e.stopPropagation()}
          className="bg-fill-brand hover:bg-fill-brand/90 rounded px-2 py-0.5 text-[11px] font-medium text-white transition-colors"
        >
          Save
        </button>
      </form>
    </td>
  );
};

// ─── Reservation Holders ────────────────────────────────────────────────────

interface ReservationHoldersProps {
  stockIds: string[];
}

/**
 * Name the orders holding this product's reserved cases
 *
 * "Reserved: 4" is not an answer to "reserved for whom?", and until now the
 * only way to find out was a database query — the existing endpoint went from
 * an order to its stock, never the other way.
 *
 * Loaded only when a row is expanded and something is actually reserved, so
 * the common case costs nothing.
 */
const ReservationHolders = ({ stockIds }: ReservationHoldersProps) => {
  const api = useTRPC();

  const { data, isLoading } = useQuery({
    ...api.wms.admin.ownership.getStockReservations.queryOptions({ stockIds }),
    enabled: stockIds.length > 0,
  });

  if (isLoading) {
    return (
      <Typography variant="bodyXs" colorRole="muted" className="px-4 pb-4 sm:px-8">
        Looking up what is holding these cases...
      </Typography>
    );
  }

  const reservations = data?.reservations ?? [];

  if (reservations.length === 0) {
    /*
      Reserved with nothing holding it is a stuck counter, not a promise to a
      customer — an order released or deleted without its reservation being
      cleared. Saying so is more use than an empty panel.
    */
    return (
      <div className="border-border-muted border-t px-4 py-3 sm:px-8">
        <Typography variant="bodyXs" className="text-amber-600">
          Cases are marked reserved but no active order holds them — the
          reservation was left behind when an order was released or removed.
        </Typography>
      </div>
    );
  }

  return (
    <div className="border-border-muted border-t px-4 py-3 sm:px-8">
      <Typography
        variant="bodyXs"
        className="text-text-muted mb-2 font-semibold uppercase tracking-wider"
      >
        Reserved for
      </Typography>
      <div className="flex flex-wrap gap-2">
        {reservations.map((reservation) => (
          <span
            key={reservation.id}
            className="border-border-muted bg-background-primary inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
          >
            <span className="font-medium">{reservation.orderNumber}</span>
            <span className="text-text-muted">
              {reservation.quantityCases} case
              {reservation.quantityCases === 1 ? '' : 's'}
            </span>
            <span className="text-text-muted uppercase">
              {reservation.orderType}
            </span>
          </span>
        ))}
      </div>
    </div>
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
      openBottles: number | null;
      ownerId: string;
      ownerName: string;
      lotNumber: string | null;
      expiryDate: Date | null;
      reExportBoeNumber: string | null;
      photos: string[] | null;
    }[];
  };
  isExpanded: boolean;
  onToggle: () => void;
  density: RowDensity;
  visibleColumns: Record<string, boolean>;
  onPrintLabels: (
    product: ProductRowProps['product'],
    loc: ProductRowProps['product']['locations'][number],
    qty: number,
  ) => void;
  onUpdateBoe: (stockId: string, value: string) => void;
  onAdjustStock: (stockId: string, newQuantity: number, reason: string) => void;
  onCorrectPack: (
    stockId: string,
    newCaseConfig: number,
    reason: string,
  ) => void;
  onEditName: (
    lwin18: string,
    productName: string,
    producer: string | null,
  ) => void;
  isAdjusting: boolean;
  isCorrectingPack: boolean;
  editingLwin18: string | null;
  onStartEditName: (lwin18: string) => void;
  onCancelEditName: () => void;
  importPrice: number | null;
  onSetImportPrice: (lwin18: string, price: number) => void;
  onTransferOwnership: (
    stockId: string,
    newOwnerId: string,
    qty: number,
    notes?: string,
  ) => void;
  isTransferring: boolean;
  partners: { id: string; name: string; type: string }[];
  /**
   * Names of confusingly-similar wines also in stock (same vintage,
   * near-identical name).
   */
  lookalikeTwins?: string[];
  /** Show wine names in full, wrapping, rather than clipped to the column */
  fullNames?: boolean;
}

const ProductRow = ({
  product,
  isExpanded,
  onToggle,
  density,
  visibleColumns,
  onPrintLabels,
  onUpdateBoe,
  onAdjustStock,
  onCorrectPack,
  onEditName,
  isAdjusting,
  isCorrectingPack,
  editingLwin18,
  onStartEditName,
  onCancelEditName,
  importPrice,
  onSetImportPrice,
  onTransferOwnership,
  isTransferring,
  partners,
  lookalikeTwins,
  fullNames,
}: ProductRowProps) => {
  // Bottles left loose in a bay after a case was cracked. They are stock, but
  // the case count cannot express them — 0 cases, 5 bottles.
  const looseBottles = (product.locations ?? []).reduce(
    (sum, location) => sum + (location.openBottles ?? 0),
    0,
  );

  const [adjustingStockId, setAdjustingStockId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [packStockId, setPackStockId] = useState<string | null>(null);
  const [packConfig, setPackConfig] = useState(0);
  const [packReason, setPackReason] = useState('');
  const [transferringStockId, setTransferringStockId] = useState<string | null>(
    null,
  );
  const [transferOwnerId, setTransferOwnerId] = useState('');
  const [transferQty, setTransferQty] = useState(0);
  const [transferNotes, setTransferNotes] = useState('');
  const [lightboxPhotos, setLightboxPhotos] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const editingName = editingLwin18 === product.lwin18;
  const isSaving = editingLwin18 === `saving:${product.lwin18}`;
  const [editName, setEditName] = useState(product.productName);
  const [editProducer, setEditProducer] = useState(product.producer ?? '');
  const dc = DENSITY_CLASSES[density];
  const tdClass = dc.td;
  const tdClassRight = `${dc.td} text-right tabular-nums`;

  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-border-muted even:bg-surface-muted/20 hover:bg-surface-muted/60 cursor-pointer border-b transition-colors ${dc.text}`}
      >
        {/* Expand chevron */}
        <td className={`${tdClass} text-text-muted w-8`}>
          <IconChevronDown
            className={`h-4 w-4 transition-transform ${isExpanded ? 'text-text-brand' : '-rotate-90'}`}
          />
        </td>

        {/* Product name */}
        <td
          className={`${tdClass} text-text-primary max-w-[360px] font-medium`}
        >
          {editingName || isSaving ? (
            <div
              className="flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="border-border-muted bg-background-primary text-text-primary focus:border-border-brand h-7 w-full rounded border px-2 text-sm focus:outline-none"
                  placeholder="Product name"
                  autoFocus
                />
                <input
                  type="text"
                  value={editProducer}
                  onChange={(e) => setEditProducer(e.target.value)}
                  className="border-border-muted bg-background-primary text-text-muted focus:border-border-brand h-7 w-full rounded border px-2 text-xs focus:outline-none"
                  placeholder="Producer"
                />
              </div>
              <button
                onClick={() => {
                  if (editName.trim()) {
                    void onEditName(
                      product.lwin18,
                      editName.trim(),
                      editProducer.trim() || null,
                    );
                  }
                }}
                disabled={isSaving || !editName.trim()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-emerald-500 text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {isSaving ? (
                  <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <IconDeviceFloppy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => {
                  onCancelEditName();
                  setEditName(product.productName);
                  setEditProducer(product.producer ?? '');
                }}
                className="bg-surface-muted text-text-muted flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div
              className={`group/name flex items-center gap-1.5 ${
                fullNames ? 'flex-wrap' : 'truncate'
              }`}
            >
              {/*
                Truncation hides the part that distinguishes one wine from
                another: two Masseria Alfano rows read identically to the pixel
                and differ only past the ellipsis. Full names wrap rather than
                clip, so the row grows instead of the name disappearing.
              */}
              <span
                className={fullNames ? '' : 'truncate'}
                title={product.productName}
              >
                {product.productName}
              </span>
              <PackBadge
                pack={product.caseConfig}
                bottleSize={product.bottleSize}
              />
              {lookalikeTwins && lookalikeTwins.length > 0 && (
                <span
                  title={`Lookalike — easily confused with: ${lookalikeTwins.join(', ')}. Check the LWIN when picking.`}
                  className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300"
                >
                  ⚠ lookalike
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditName(product.productName);
                  setEditProducer(product.producer ?? '');
                  onStartEditName(product.lwin18);
                }}
                className="text-text-muted/40 hover:bg-surface-muted hover:text-text-brand hidden shrink-0 rounded p-0.5 transition-colors group-hover/name:inline-flex"
              >
                <IconPencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </td>

        {/* Producer */}
        {visibleColumns.producer && (
          <td
            className={`${tdClass} text-text-muted hidden max-w-[160px] truncate lg:table-cell`}
          >
            {product.producer ?? '—'}
          </td>
        )}

        {/* LWIN18 */}
        {visibleColumns.lwin18 && (
          <td
            className={`${tdClass} text-text-muted hidden font-mono text-xs lg:table-cell`}
          >
            {product.lwin18}
          </td>
        )}

        {/* Vintage */}
        {visibleColumns.vintage && (
          <td className={`${tdClass} text-text-primary`}>
            {product.vintage ?? '—'}
          </td>
        )}

        {/* Size */}
        {visibleColumns.size && (
          <td className={`${tdClass} text-text-muted hidden xl:table-cell`}>
            {product.bottleSize ?? '75cl'}
          </td>
        )}

        {/* Pack */}
        {visibleColumns.pack && (
          <td className={`${tdClass} text-text-muted hidden xl:table-cell`}>
            {product.caseConfig ?? 12}
          </td>
        )}

        {/* Cases — with any loose bottles, which are stock the case count
            cannot express (a cracked case leaves 0 cases and 5 bottles). */}
        {visibleColumns.cases && (
          <td
            className={`${tdClassRight} text-text-primary text-base font-bold`}
          >
            {product.totalCases}
            {looseBottles > 0 && (
              <span className="ml-1 rounded bg-amber-100 px-1 py-px align-middle text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                +{looseBottles} loose
              </span>
            )}
          </td>
        )}

        {/* Available */}
        {visibleColumns.available && (
          <td className={tdClassRight}>
            <span
              className={
                product.availableCases > 0
                  ? 'text-text-brand font-semibold'
                  : 'text-text-muted'
              }
            >
              {product.availableCases}
            </span>
          </td>
        )}

        {/* Reserved */}
        {visibleColumns.reserved && (
          <td className={tdClassRight}>
            {product.reservedCases > 0 ? (
              <span className="font-medium text-amber-600">
                {product.reservedCases}
              </span>
            ) : (
              <span className="text-text-muted">—</span>
            )}
          </td>
        )}

        {/* Import Price per Bottle */}
        {visibleColumns.importPrice && (
          <ImportPriceCell
            value={importPrice}
            onSave={(v) => onSetImportPrice(product.lwin18, v)}
            density={tdClass}
          />
        )}

        {/* Import Price per Case (editable — saves as per-bottle) */}
        {visibleColumns.importCasePrice && (
          <ImportPriceCell
            value={
              importPrice != null
                ? importPrice * (product.caseConfig ?? 12)
                : null
            }
            onSave={(casePrice) => {
              const perBottle = casePrice / (product.caseConfig ?? 12);
              onSetImportPrice(
                product.lwin18,
                parseFloat(perBottle.toFixed(4)),
              );
            }}
            density={tdClass}
          />
        )}

        {/* Bottles */}
        {visibleColumns.bottles && (
          <td
            className={`${tdClassRight} text-text-muted hidden md:table-cell`}
          >
            {product.totalBottles}
          </td>
        )}

        {/* Locations */}
        {visibleColumns.locations && (
          <td
            className={`${tdClassRight} text-text-muted hidden md:table-cell`}
          >
            {product.locationCount}
          </td>
        )}

        {/* Owners */}
        {visibleColumns.owners && (
          <td
            className={`${tdClassRight} text-text-muted hidden lg:table-cell`}
          >
            {product.ownerCount}
          </td>
        )}

        {/* Status */}
        {visibleColumns.status && (
          <td className={`${tdClass} hidden lg:table-cell`}>
            <StatusIndicator
              expiryStatus={product.expiryStatus}
              openBottles={looseBottles}
              availableCases={product.availableCases}
            />
          </td>
        )}
      </tr>

      {/* Expanded location breakdown */}
      {isExpanded && product.locations.length > 0 && (
        <tr>
          <td colSpan={20} className="bg-surface-muted px-0 py-0">
            <div className="border-border-muted border-b px-4 py-4 sm:px-8">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Typography
                  variant="bodyXs"
                  className="text-text-muted font-semibold uppercase tracking-wider"
                >
                  Location Breakdown — {product.locations.length} record
                  {product.locations.length !== 1 ? 's' : ''}
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
                  <Button
                    variant={showHistory ? 'primary' : 'outline'}
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHistory((v) => !v);
                    }}
                  >
                    <IconHistory className="mr-1 h-3 w-3" />
                    History
                  </Button>
                  <Button
                    variant={adjustingStockId ? 'primary' : 'outline'}
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (adjustingStockId) {
                        setAdjustingStockId(null);
                        setAdjustQty(0);
                        setAdjustReason('');
                      } else if (product.locations[0]) {
                        setAdjustingStockId(product.locations[0].stockId);
                        setAdjustQty(product.locations[0].quantityCases);
                        setAdjustReason('');
                      }
                    }}
                  >
                    <IconAdjustments className="mr-1 h-3 w-3" />
                    {adjustingStockId ? 'Cancel' : 'Adjust'}
                  </Button>
                  <Button
                    variant={packStockId ? 'default' : 'outline'}
                    size="xs"
                    title="Correct the pack size when it was recorded wrongly — keeps the case count, moves the bottle count"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (packStockId) {
                        setPackStockId(null);
                        setPackReason('');
                      } else if (product.locations[0]) {
                        setPackStockId(product.locations[0].stockId);
                        setPackConfig(product.caseConfig ?? 0);
                        setPackReason('');
                      }
                    }}
                  >
                    <IconPackage className="mr-1 h-3 w-3" />
                    {packStockId ? 'Cancel' : 'Fix pack'}
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-text-muted text-[11px] uppercase tracking-wider">
                      <th className="px-3 py-1.5 text-left">Location</th>
                      <th className="px-3 py-1.5 text-left">Storage</th>
                      <th className="px-3 py-1.5 text-right">Qty</th>
                      <th className="px-3 py-1.5 text-right">Avail</th>
                      <th className="w-[100px] px-3 py-1.5 text-left" />
                      <th className="px-3 py-1.5 text-left">Owner</th>
                      <th className="hidden px-3 py-1.5 text-left sm:table-cell">
                        Lot
                      </th>
                      <th className="hidden px-3 py-1.5 text-left sm:table-cell">
                        Expiry
                      </th>
                      <th className="hidden px-3 py-1.5 text-left sm:table-cell">
                        RE BOE
                      </th>
                      <th className="hidden px-3 py-1.5 text-center sm:table-cell">
                        Photos
                      </th>
                      <th className="px-3 py-1.5 text-right">Print</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.locations.map((loc) => {
                      // Availability ratio: how much of this location's stock is available
                      const availPercent =
                        loc.quantityCases > 0
                          ? (loc.availableCases / loc.quantityCases) * 100
                          : 0;
                      const barColor =
                        availPercent === 100
                          ? 'bg-emerald-500'
                          : availPercent >= 50
                            ? 'bg-fill-brand'
                            : availPercent > 0
                              ? 'bg-amber-500'
                              : 'bg-gray-300';
                      const storageLabel =
                        loc.storageMethod === 'pallet'
                          ? 'Pallet'
                          : loc.storageMethod === 'mixed'
                            ? 'Mixed'
                            : 'Shelf';

                      const isThisAdjusting = adjustingStockId === loc.stockId;
                      const isThisTransferring =
                        transferringStockId === loc.stockId;

                      return (
                        <Fragment key={loc.stockId}>
                          <tr
                            className={`border-border-muted border-t ${isThisAdjusting ? 'bg-amber-50' : ''}`}
                            onClick={
                              adjustingStockId
                                ? (e) => {
                                    e.stopPropagation();
                                    setAdjustingStockId(loc.stockId);
                                    setAdjustQty(loc.quantityCases);
                                    setAdjustReason('');
                                  }
                                : undefined
                            }
                          >
                            <td className="text-text-brand px-3 py-2 font-mono text-xs font-medium">
                              {loc.locationCode}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                  loc.storageMethod === 'pallet'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-blue-50 text-blue-600'
                                }`}
                              >
                                {storageLabel}
                              </span>
                            </td>
                            <td className="text-text-primary px-3 py-2 text-right font-medium tabular-nums">
                              {loc.quantityCases}
                              {(loc.openBottles ?? 0) > 0 && (
                                <span
                                  title="Loose bottles from an opened case"
                                  className="ml-1 rounded bg-amber-100 px-1 py-px text-[10px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                >
                                  +{loc.openBottles} loose
                                </span>
                              )}
                            </td>
                            <td className="text-text-primary px-3 py-2 text-right tabular-nums">
                              {loc.availableCases}
                            </td>
                            <td className="px-3 py-2">
                              <div className="bg-border-muted/40 h-2 w-full overflow-hidden rounded-full">
                                <div
                                  className={`h-full rounded-full ${barColor} transition-all`}
                                  style={{
                                    width: `${Math.min(availPercent, 100)}%`,
                                  }}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="group/owner flex items-center gap-1">
                                <OwnerBadge name={loc.ownerName} />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTransferringStockId(loc.stockId);
                                    setTransferOwnerId('');
                                    setTransferQty(loc.quantityCases);
                                    setTransferNotes('');
                                    setAdjustingStockId(null);
                                  }}
                                  className="text-text-muted/40 hover:bg-surface-muted hover:text-text-brand hidden shrink-0 rounded p-0.5 transition-colors group-hover/owner:inline-flex"
                                  title="Change owner"
                                >
                                  <IconPencil className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="text-text-muted hidden px-3 py-2 font-mono text-xs sm:table-cell">
                              {loc.lotNumber ?? '—'}
                            </td>
                            <td className="text-text-muted hidden px-3 py-2 sm:table-cell">
                              {loc.expiryDate
                                ? new Date(loc.expiryDate).toLocaleDateString(
                                    'en-GB',
                                  )
                                : '—'}
                            </td>
                            <BoeCell
                              value={loc.reExportBoeNumber}
                              onSave={(val) => onUpdateBoe(loc.stockId, val)}
                            />
                            <td className="hidden px-3 py-2 text-center sm:table-cell">
                              {loc.photos && loc.photos.length > 0 && (
                                <button
                                  type="button"
                                  className="text-text-muted hover:bg-surface-muted hover:text-text-primary inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxPhotos(loc.photos!);
                                    setLightboxIndex(0);
                                  }}
                                >
                                  <IconCamera className="h-3.5 w-3.5" />
                                  {loc.photos.length}
                                </button>
                              )}
                            </td>
                            <PrintCell
                              maxQty={loc.quantityCases}
                              defaultQty={
                                loc.storageMethod === 'pallet' ? 1 : undefined
                              }
                              onPrint={(qty) =>
                                onPrintLabels(product, loc, qty)
                              }
                            />
                          </tr>
                          {isThisAdjusting && (
                            <tr className="border-t border-amber-200 bg-amber-50">
                              <td colSpan={20} className="px-3 py-3">
                                <div
                                  className="flex flex-wrap items-center gap-3"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-text-muted text-xs font-medium">
                                    Adjust qty:
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      className="border-border-primary bg-background-primary hover:bg-surface-muted flex h-8 w-8 items-center justify-center rounded border text-lg font-bold transition-colors"
                                      onClick={() =>
                                        setAdjustQty((q) => Math.max(0, q - 1))
                                      }
                                    >
                                      <IconMinus className="h-4 w-4" />
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      value={adjustQty}
                                      onChange={(e) =>
                                        setAdjustQty(
                                          Math.max(
                                            0,
                                            parseInt(e.target.value) || 0,
                                          ),
                                        )
                                      }
                                      className="border-border-primary bg-background-primary focus:border-border-brand h-8 w-16 rounded border text-center text-sm font-medium tabular-nums focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      className="border-border-primary bg-background-primary hover:bg-surface-muted flex h-8 w-8 items-center justify-center rounded border text-lg font-bold transition-colors"
                                      onClick={() => setAdjustQty((q) => q + 1)}
                                    >
                                      <IconPlus className="h-4 w-4" />
                                    </button>
                                  </div>
                                  {adjustQty !== loc.quantityCases && (
                                    <span
                                      className={`text-xs font-medium ${adjustQty > loc.quantityCases ? 'text-emerald-600' : 'text-red-600'}`}
                                    >
                                      {adjustQty > loc.quantityCases ? '+' : ''}
                                      {adjustQty - loc.quantityCases}
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    value={adjustReason}
                                    onChange={(e) =>
                                      setAdjustReason(e.target.value)
                                    }
                                    placeholder="Reason (required)"
                                    className="border-border-primary bg-background-primary focus:border-border-brand h-8 min-w-[200px] flex-1 rounded border px-2 text-sm focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      adjustQty === loc.quantityCases ||
                                      !adjustReason.trim() ||
                                      isAdjusting
                                    }
                                    className="bg-fill-brand hover:bg-fill-brand/90 flex h-8 items-center gap-1 rounded px-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
                                    onClick={() => {
                                      onAdjustStock(
                                        loc.stockId,
                                        adjustQty,
                                        adjustReason.trim(),
                                      );
                                      // Close the panel here (this row owns the state);
                                      // the page handles the toast + refetch on success.
                                      setAdjustingStockId(null);
                                      setAdjustQty(0);
                                      setAdjustReason('');
                                    }}
                                  >
                                    {isAdjusting ? (
                                      <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <IconCheck className="h-3.5 w-3.5" />
                                    )}
                                    Save
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {packStockId === loc.stockId && (
                            <tr className="border-t border-sky-200 bg-sky-50">
                              <td colSpan={20} className="px-3 py-3">
                                <div
                                  className="flex flex-wrap items-center gap-3"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-text-muted text-xs font-medium">
                                    Bottles per case:
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={packConfig}
                                    onChange={(e) =>
                                      setPackConfig(
                                        Math.max(
                                          1,
                                          parseInt(e.target.value) || 1,
                                        ),
                                      )
                                    }
                                    className="border-border-primary bg-background-primary focus:border-border-brand h-8 w-16 rounded border text-center text-sm font-medium tabular-nums focus:outline-none"
                                  />
                                  {packConfig !== (product.caseConfig ?? 0) && (
                                    <span className="text-text-muted text-xs font-medium">
                                      {loc.quantityCases} cases stay &middot;
                                      bottles{' '}
                                      <span className="line-through">
                                        {loc.quantityCases *
                                          (product.caseConfig ?? 0)}
                                      </span>{' '}
                                      <span
                                        className={
                                          packConfig > (product.caseConfig ?? 0)
                                            ? 'font-semibold text-emerald-600'
                                            : 'font-semibold text-red-600'
                                        }
                                      >
                                        {loc.quantityCases * packConfig}
                                      </span>
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    value={packReason}
                                    onChange={(e) =>
                                      setPackReason(e.target.value)
                                    }
                                    placeholder="Reason (required)"
                                    className="border-border-primary bg-background-primary focus:border-border-brand h-8 min-w-[200px] flex-1 rounded border px-2 text-sm focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      packConfig ===
                                        (product.caseConfig ?? 0) ||
                                      packConfig < 1 ||
                                      !packReason.trim() ||
                                      isCorrectingPack
                                    }
                                    className="bg-fill-brand hover:bg-fill-brand/90 flex h-8 items-center gap-1 rounded px-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
                                    onClick={() => {
                                      onCorrectPack(
                                        loc.stockId,
                                        packConfig,
                                        packReason.trim(),
                                      );
                                      setPackStockId(null);
                                      setPackReason('');
                                    }}
                                  >
                                    {isCorrectingPack ? (
                                      <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <IconCheck className="h-3.5 w-3.5" />
                                    )}
                                    Save
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {isThisTransferring && (
                            <tr className="border-t border-purple-200 bg-purple-50">
                              <td colSpan={20} className="px-3 py-3">
                                <div
                                  className="flex flex-wrap items-center gap-3"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-text-muted text-xs font-medium">
                                    Transfer to:
                                  </span>
                                  <select
                                    value={transferOwnerId}
                                    onChange={(e) =>
                                      setTransferOwnerId(e.target.value)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="border-border-primary bg-background-primary focus:border-border-brand h-8 rounded border px-2 text-sm focus:outline-none"
                                  >
                                    <option value="">Select owner...</option>
                                    {partners
                                      .filter((p) => p.id !== loc.ownerId)
                                      .map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name}
                                        </option>
                                      ))}
                                  </select>
                                  <span className="text-text-muted text-xs font-medium">
                                    Qty:
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      className="border-border-primary bg-background-primary hover:bg-surface-muted flex h-8 w-8 items-center justify-center rounded border text-lg font-bold transition-colors"
                                      onClick={() =>
                                        setTransferQty((q) =>
                                          Math.max(1, q - 1),
                                        )
                                      }
                                    >
                                      <IconMinus className="h-4 w-4" />
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      max={loc.quantityCases}
                                      value={transferQty}
                                      onChange={(e) =>
                                        setTransferQty(
                                          Math.max(
                                            1,
                                            Math.min(
                                              loc.quantityCases,
                                              parseInt(e.target.value) || 1,
                                            ),
                                          ),
                                        )
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      className="border-border-primary bg-background-primary focus:border-border-brand h-8 w-16 rounded border text-center text-sm font-medium tabular-nums focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      className="border-border-primary bg-background-primary hover:bg-surface-muted flex h-8 w-8 items-center justify-center rounded border text-lg font-bold transition-colors"
                                      onClick={() =>
                                        setTransferQty((q) =>
                                          Math.min(loc.quantityCases, q + 1),
                                        )
                                      }
                                    >
                                      <IconPlus className="h-4 w-4" />
                                    </button>
                                  </div>
                                  {transferQty !== loc.quantityCases && (
                                    <span className="text-xs font-medium text-amber-600">
                                      Partial ({transferQty}/{loc.quantityCases}
                                      )
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    value={transferNotes}
                                    onChange={(e) =>
                                      setTransferNotes(e.target.value)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="Notes (optional)"
                                    className="border-border-primary bg-background-primary focus:border-border-brand h-8 min-w-[160px] flex-1 rounded border px-2 text-sm focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      !transferOwnerId || isTransferring
                                    }
                                    className="flex h-8 items-center gap-1 rounded bg-purple-600 px-3 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                                    onClick={() => {
                                      onTransferOwnership(
                                        loc.stockId,
                                        transferOwnerId,
                                        transferQty,
                                        transferNotes.trim() || undefined,
                                      );
                                      setTransferringStockId(null);
                                    }}
                                  >
                                    {isTransferring ? (
                                      <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <IconCheck className="h-3.5 w-3.5" />
                                    )}
                                    Transfer
                                  </button>
                                  <button
                                    type="button"
                                    className="text-text-muted hover:text-text-primary flex h-8 items-center rounded px-2 text-sm transition-colors"
                                    onClick={() => setTransferringStockId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/*
                Reserved cases were a number with nothing behind it. The stock
                screens said how many; naming the order that holds them meant
                reading the database by hand.
              */}
              {product.reservedCases > 0 && (
                <ReservationHolders
                  stockIds={product.locations.map((loc) => loc.stockId)}
                />
              )}

              {showHistory && (
                <ProductMovementHistory lwin18={product.lwin18} />
              )}
            </div>
          </td>
        </tr>
      )}
      {lightboxPhotos &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setLightboxPhotos(null)}
          >
            <div
              className="relative max-h-[90vh] max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxPhotos[lightboxIndex]}
                alt={`Receiving photo ${lightboxIndex + 1}`}
                className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
              />
              <button
                type="button"
                className="text-text-primary absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg"
                onClick={() => setLightboxPhotos(null)}
              >
                <IconX className="h-4 w-4" />
              </button>
              {lightboxPhotos.length > 1 && (
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 px-4 py-2">
                  <button
                    type="button"
                    className="text-white disabled:opacity-30"
                    disabled={lightboxIndex === 0}
                    onClick={() => setLightboxIndex((i) => i - 1)}
                  >
                    <IconChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-sm text-white">
                    {lightboxIndex + 1} / {lightboxPhotos.length}
                  </span>
                  <button
                    type="button"
                    className="text-white disabled:opacity-30"
                    disabled={lightboxIndex === lightboxPhotos.length - 1}
                    onClick={() => setLightboxIndex((i) => i + 1)}
                  >
                    <IconChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

// ─── Inbound Product Row ─────────────────────────────────────────────────────

interface InboundProduct {
  groupKey: string;
  productName: string;
  producer: string | null;
  lwin: string | null;
  vintage: number | null;
  bottleSizeMl: number | null;
  bottlesPerCase: number | null;
  expectedCases: number;
  costPerBottle: number | null;
  expectedBottles: number;
  shipmentCount: number;
  earliestEta: Date | null;
  latestEta: Date | null;
  category: string | null;
  shipments: {
    shipmentId: string;
    shipmentNumber: string;
    shipmentStatus: string;
    partnerName: string | null;
    cases: number;
    eta: Date | null;
    ata: Date | null;
    originCountry: string | null;
  }[];
}

interface InboundProductRowProps {
  product: InboundProduct;
  isExpanded: boolean;
  /** Show wine names in full, wrapping, rather than clipped to the column */
  fullNames?: boolean;
  onToggle: () => void;
  density: RowDensity;
}

const InboundProductRow = ({
  product,
  isExpanded,
  onToggle,
  density,
  fullNames,
}: InboundProductRowProps) => {
  const dc = DENSITY_CLASSES[density];
  const tdClass = dc.td;
  const tdClassRight = `${dc.td} text-right tabular-nums`;

  const formatEta = (date: Date | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  };

  const sizeLabel = product.bottleSizeMl
    ? product.bottleSizeMl >= 1000
      ? `${(product.bottleSizeMl / 1000).toFixed(1)}L`
      : `${product.bottleSizeMl / 10}cl`
    : '75cl';

  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-border-muted cursor-pointer border-b border-l-2 border-l-blue-400 transition-colors hover:bg-blue-50/30 ${dc.text}`}
      >
        {/* Expand chevron */}
        <td className={`${tdClass} text-text-muted w-8`}>
          <IconChevronDown
            className={`h-4 w-4 transition-transform ${isExpanded ? 'text-blue-500' : '-rotate-90'}`}
          />
        </td>

        {/* Product name */}
        <td
          className={`${tdClass} text-text-primary font-medium ${
            fullNames ? 'min-w-[22rem]' : 'max-w-[280px] truncate'
          }`}
        >
          <span title={product.productName}>
            {product.productName}
          </span>
        </td>

        {/* Producer */}
        <td
          className={`${tdClass} text-text-muted hidden max-w-[160px] truncate lg:table-cell`}
        >
          {product.producer ?? '—'}
        </td>

        {/* LWIN */}
        <td
          className={`${tdClass} text-text-muted hidden font-mono text-xs xl:table-cell`}
        >
          {product.lwin ?? '—'}
        </td>

        {/* Vintage */}
        <td className={`${tdClass} text-text-primary`}>
          {product.vintage ?? '—'}
        </td>

        {/* Size */}
        <td className={`${tdClass} text-text-muted hidden 2xl:table-cell`}>
          {sizeLabel}
        </td>

        {/* Pack */}
        <td className={`${tdClass} text-text-muted hidden 2xl:table-cell`}>
          {product.bottlesPerCase ?? 12}
        </td>

        {/* Expected Cases */}
        <td className={`${tdClassRight} text-base font-bold text-blue-600`}>
          {product.expectedCases}
        </td>

        {/* ETA */}
        <td className={tdClassRight}>
          <span className="text-text-muted">
            {formatEta(product.earliestEta)}
          </span>
        </td>

        {/* Shipments */}
        <td className={tdClassRight}>
          <span className="text-text-muted">{product.shipmentCount}</span>
        </td>

        {/* Import $/btl */}
        <td
          className={`${tdClass} hidden text-right tabular-nums lg:table-cell`}
        >
          {product.costPerBottle != null ? (
            <span className="text-text-muted">
              ${product.costPerBottle.toFixed(2)}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </td>

        {/* Import $/case */}
        <td
          className={`${tdClass} hidden text-right tabular-nums lg:table-cell`}
        >
          {product.costPerBottle != null ? (
            <span className="text-text-muted">
              $
              {(product.costPerBottle * (product.bottlesPerCase ?? 12)).toFixed(
                2,
              )}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </td>

        {/* Bottles (hidden on inbound) */}
        <td className={`${tdClassRight} text-text-muted hidden md:table-cell`}>
          {product.expectedBottles}
        </td>

        {/* Locs placeholder */}
        <td className={`${tdClassRight} hidden md:table-cell`}>
          <span className="text-text-muted">—</span>
        </td>

        {/* Owners placeholder */}
        <td className={`${tdClassRight} hidden lg:table-cell`}>
          <span className="text-text-muted">—</span>
        </td>

        {/* Status */}
        <td className={`${tdClass} hidden lg:table-cell`}>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <IconAnchor className="h-3 w-3" />
            Inbound
          </span>
        </td>
      </tr>

      {/* Expanded shipment breakdown */}
      {isExpanded && product.shipments.length > 0 && (
        <tr>
          <td colSpan={20} className="bg-blue-50/30 px-0 py-0">
            <div className="border-border-muted border-b px-4 py-4 sm:px-8">
              <Typography
                variant="bodyXs"
                className="text-text-muted mb-3 font-semibold uppercase tracking-wider"
              >
                Shipment Breakdown — {product.shipments.length} shipment
                {product.shipments.length !== 1 ? 's' : ''}
              </Typography>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-text-muted text-[11px] uppercase tracking-wider">
                      <th className="px-3 py-1.5 text-left">Shipment</th>
                      <th className="px-3 py-1.5 text-left">Status</th>
                      <th className="px-3 py-1.5 text-left">Partner</th>
                      <th className="px-3 py-1.5 text-right">Cases</th>
                      <th className="px-3 py-1.5 text-left">ETA</th>
                      <th className="hidden px-3 py-1.5 text-left sm:table-cell">
                        Origin
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.shipments.map((s) => (
                      <tr
                        key={s.shipmentId}
                        className="border-border-muted border-t"
                      >
                        <td className="px-3 py-2">
                          <Link
                            href={`/platform/admin/logistics/shipments/${s.shipmentId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-text-brand font-medium hover:underline"
                          >
                            {s.shipmentNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <ShipmentStatusBadge
                            status={s.shipmentStatus as 'booked'}
                          />
                        </td>
                        <td className="text-text-muted px-3 py-2">
                          {s.partnerName ?? '—'}
                        </td>
                        <td className="text-text-primary px-3 py-2 text-right font-medium tabular-nums">
                          {s.cases}
                        </td>
                        <td className="text-text-muted px-3 py-2">
                          {s.eta
                            ? new Date(s.eta).toLocaleDateString('en-GB')
                            : '—'}
                        </td>
                        <td className="text-text-muted hidden px-3 py-2 sm:table-cell">
                          {s.originCountry ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
  importPrice: 'Import $/btl',
  importCasePrice: 'Import $/case',
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
        <div className="border-border-muted bg-background-primary absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border p-2 shadow-lg">
          <Typography
            variant="bodyXs"
            className="text-text-muted mb-2 px-2 font-semibold uppercase tracking-wider"
          >
            Columns
          </Typography>
          {Object.entries(COLUMN_LABELS).map(([key, label]) => (
            <label
              key={key}
              className="hover:bg-surface-muted flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={columns[key] ?? true}
                onChange={(e) => {
                  const next = { ...columns, [key]: e.target.checked };
                  onChange(next);
                }}
                className="border-border-primary accent-fill-brand rounded"
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
 * Stock Explorer — best-in-class warehouse inventory search, filter, and
 * analysis tool
 */
const StockExplorerPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { print } = usePrint();

  // Update RE BOE on a stock record
  const { mutate: updateBoe } = useMutation({
    ...api.wms.admin.stock.updateBoe.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.stock.getByProduct.queryKey(),
      });
      toast.success('RE BOE updated');
    },
    onError: () => {
      toast.error('Failed to update RE BOE');
    },
  });

  const handleUpdateBoe = useCallback(
    (stockId: string, reExportBoeNumber: string) => {
      updateBoe({ stockId, reExportBoeNumber });
    },
    [updateBoe],
  );

  // Adjust stock quantity
  const { mutate: adjustStock, isPending: isAdjustingStock } = useMutation({
    ...api.wms.admin.stock.adjustQuantity.mutationOptions(),
    onSuccess: (data) => {
      // Note: the adjust panel state (adjustingStockId/adjustQty/adjustReason)
      // lives in ProductRow, not here — resetting it from this scope threw a
      // ReferenceError after the write committed, which surfaced as a false
      // "Failed to adjust" toast. The row closes its own panel on submit.
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.stock.getByProduct.queryKey(),
      });
      if (data.noChange) {
        toast.info('No change needed');
      } else {
        toast.success(
          `Stock adjusted: ${data.oldQuantity} → ${data.newQuantity} cases`,
        );
      }
    },
    onError: (err) => {
      console.error('adjustStock failed:', err);
      toast.error(`Failed to adjust stock: ${err.message}`);
    },
  });

  const handleAdjustStock = useCallback(
    (stockId: string, newQuantity: number, reason: string) => {
      adjustStock({ stockId, newQuantity, reason });
    },
    [adjustStock],
  );

  // Correct a mis-recorded pack size (cases stay, bottles follow the new pack)
  const { mutate: correctPack, isPending: isCorrectingPack } = useMutation({
    ...api.wms.admin.stock.correctPackConfig.mutationOptions(),
    onSuccess: (data) => {
      // Panel state lives in ProductRow — see the adjust note above.
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.stock.getByProduct.queryKey(),
      });
      if (data.noChange) {
        toast.info('No change needed');
      } else {
        toast.success(
          `Pack corrected to ${data.caseConfig}×: ${data.cases} cases, ${data.bottlesBefore ?? 'unknown'} → ${data.bottlesAfter} bottles`,
        );
      }
    },
    onError: (err) => {
      console.error('correctPack failed:', err);
      toast.error(`Failed to correct pack: ${err.message}`);
    },
  });

  const handleCorrectPack = useCallback(
    (stockId: string, newCaseConfig: number, reason: string) => {
      correctPack({ stockId, newCaseConfig, reason });
    },
    [correctPack],
  );

  // Update product name across all records
  const trpcClient = useTRPCClient();
  const [editingLwin18, setEditingLwin18] = useState<string | null>(null);

  const handleEditName = useCallback(
    (lwin18: string, productName: string, producer: string | null) => {
      setEditingLwin18(`saving:${lwin18}`);
      // Fire mutation — don't await anything, httpBatchStreamLink hangs promises
      trpcClient.wms.admin.stock.updateProductName
        .mutate({ lwin18, productName, producer })
        .catch(() => {});
      // After 1.5s: close editor, refetch data, show toast
      setTimeout(() => {
        setEditingLwin18(null);
        toast.success('Product name updated');
        void queryClient.refetchQueries({ type: 'active' });
      }, 1500);
    },
    [api, queryClient, trpcClient],
  );

  // Search & filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Seed the search from a ?q= param (e.g. arriving via the ⌘K command palette).
  const searchParams = useSearchParams();
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearch(q);
      setDebouncedSearch(q);
    }
    // Only on first mount / param change — user edits take over afterwards.
  }, [searchParams]);
  const [ownerId, setOwnerId] = useState<string>('');
  const [vintageFrom, setVintageFrom] = useState('');
  const [vintageTo, setVintageTo] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [showValueDetail, setShowValueDetail] = useState(false);
  /**
   * Whether wine names are shown in full.
   *
   * Clipping hides the part that tells two wines apart — two Masseria Alfano
   * rows read identically to the pixel and differ only past the ellipsis. Off
   * by default because the table is wide, remembered because whoever needs it
   * needs it every time.
   */
  const [fullNames, setFullNames] = useState(false);

  useEffect(() => {
    setFullNames(localStorage.getItem('se-full-names') === '1');
  }, []);

  useEffect(() => {
    localStorage.setItem('se-full-names', fullNames ? '1' : '0');
  }, [fullNames]);
  const [showZeroQty, setShowZeroQty] = useState(false);
  const [category, setCategory] = useState<CategoryFilter | undefined>('Wine');
  const [sortBy, setSortBy] = useState<SortField>('totalCases');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(50);
  const [isExporting, setIsExporting] = useState(false);

  // Persisted preferences
  const [density, setDensity] = useState<RowDensity>(() =>
    loadPreference('se-density', 'normal'),
  );
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    () => ({
      ...DEFAULT_COLUMNS,
      ...loadPreference('se-columns', DEFAULT_COLUMNS),
    }),
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
  }, [
    ownerId,
    vintageFrom,
    vintageTo,
    sortBy,
    sortOrder,
    quickFilter,
    category,
    showZeroQty,
  ]);

  // Persist preferences
  useEffect(() => {
    savePreference('se-density', density);
  }, [density]);
  useEffect(() => {
    savePreference('se-columns', visibleColumns);
  }, [visibleColumns]);

  const isInboundView = quickFilter === 'inbound';

  // Clear category when entering inbound view (items may not have HS codes yet)
  useEffect(() => {
    if (isInboundView) {
      setCategory(undefined);
    }
  }, [isInboundView]);

  // Map sort fields for inbound view
  const inboundSortBy =
    sortBy === 'totalCases'
      ? ('expectedCases' as const)
      : sortBy === 'receivedAt'
        ? ('eta' as const)
        : (sortBy as 'productName' | 'vintage');

  // Fetch stock data (disabled when viewing inbound)
  const { data: stockData, isLoading } = useQuery({
    ...api.wms.admin.stock.getByProduct.queryOptions({
      search: debouncedSearch || undefined,
      ownerId: ownerId || undefined,
      category: category || undefined,
      includeZeroQty: showZeroQty || undefined,
      quickFilter:
        quickFilter !== 'all' && quickFilter !== 'inbound'
          ? quickFilter
          : undefined,
      vintageFrom: vintageFrom ? Number(vintageFrom) : undefined,
      vintageTo: vintageTo ? Number(vintageTo) : undefined,
      sortBy,
      sortOrder,
      limit,
      offset: page * limit,
    }),
    enabled: !isInboundView,
  });

  // Fetch inbound stock data (only when inbound filter active)
  const { data: inboundData, isLoading: isLoadingInbound } = useQuery({
    ...api.wms.admin.stock.getInbound.queryOptions({
      search: debouncedSearch || undefined,
      category: undefined,
      sortBy: inboundSortBy,
      sortOrder,
      limit,
      offset: page * limit,
    }),
    enabled: isInboundView,
  });

  // Fetch overview for KPI cards (scoped to the selected owner)
  const { data: overview } = useQuery({
    ...api.wms.admin.stock.getOverview.queryOptions({
      ownerId: ownerId || undefined,
    }),
  });

  // Stock whose pack contradicts its own LWIN. Picking uses the row's pack, so
  // this is the reading that decides how many cases get cracked.
  const { data: packMismatches } = useQuery(
    api.wms.admin.stock.findPackMismatches.queryOptions(),
  );

  /**
   * What a repacked row is missing, counted before anything is written.
   *
   * Shown only when there is something to fill, so it disappears once done
   * rather than becoming another permanent banner.
   */
  const { data: backfillPreview, refetch: refetchBackfill } = useQuery({
    queryKey: ['stock-backfill-preview'],
    queryFn: () =>
      trpcClient.wms.admin.stock.backfillDetails.mutate({ dryRun: true }),
  });

  const { mutate: backfillDetails, isPending: isBackfilling } = useMutation({
    ...api.wms.admin.stock.backfillDetails.mutationOptions(),
    onSuccess: (r) => {
      toast.success(
        `Filled ${r.producers} producer${r.producers === 1 ? '' : 's'} and ${r.boes} re-export BOE${r.boes === 1 ? '' : 's'}`,
      );
      void refetchBackfill();
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(`Could not fill: ${error.message}`),
  });

  // Lookalike wines in stock (near-identical names) → flag rows so they're
  // reviewed before a picking mix-up (the Talenti vs Talenti Piero trap).
  const { data: lookalikeData } = useQuery({
    ...api.wms.admin.stock.lookalikes.queryOptions(),
    staleTime: 5 * 60 * 1000,
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

  // Fetch bulk import prices for visible products
  const visibleLwin18s = useMemo(
    () => products.map((p) => p.lwin18),
    [products],
  );
  const { data: bulkPricing } = useQuery({
    ...api.wms.admin.stock.pricing.getBulk.queryOptions({
      lwin18s: visibleLwin18s,
    }),
    enabled: visibleLwin18s.length > 0 && !isInboundView,
  });

  // Set import price mutation
  const { mutate: setImportPrice } = useMutation({
    ...api.wms.admin.stock.pricing.setImportPrice.mutationOptions(),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.stock.pricing.getBulk.queryKey(),
      });
    },
    onSuccess: () => {
      toast.success('Import price updated');
    },
    onError: (err) => {
      console.error('setImportPrice error:', err);
      toast.error(`Price update error: ${err.message}`);
    },
  });

  const handleSetImportPrice = useCallback(
    (lwin18: string, price: number) => {
      setImportPrice({ lwin18, importPricePerBottle: price, source: 'manual' });
    },
    [setImportPrice],
  );

  // Partners list for ownership transfer dropdown
  const { data: partnersData } = useQuery({
    ...api.partners.list.queryOptions(),
  });
  const partnersList = useMemo(() => partnersData ?? [], [partnersData]);

  // Transfer ownership mutation
  const { mutate: transferOwnership, isPending: isTransferring } = useMutation({
    ...api.wms.admin.ownership.transfer.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.stock.getByProduct.queryKey(),
      });
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.stock.getByOwner.queryKey(),
      });
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.stock.getOverview.queryKey(),
      });
      toast.success('Ownership transferred');
    },
    onError: (err) => {
      toast.error(`Transfer failed: ${err.message}`);
    },
  });

  const handleTransferOwnership = useCallback(
    (
      stockId: string,
      newOwnerId: string,
      quantityCases: number,
      notes?: string,
    ) => {
      transferOwnership({ stockId, newOwnerId, quantityCases, notes });
    },
    [transferOwnership],
  );

  const inboundProducts = useMemo(
    () => (inboundData?.products ?? []) as InboundProduct[],
    [inboundData],
  );
  const totalCount = isInboundView
    ? (inboundData?.pagination?.total ?? 0)
    : (stockData?.pagination?.total ?? 0);
  const totalPages = Math.ceil(totalCount / limit);
  const activeLoading = isInboundView ? isLoadingInbound : isLoading;

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

  // Excel export — fetches ALL pages for the current filters (not just this page)
  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const baseInput = {
        search: debouncedSearch || undefined,
        ownerId: ownerId || undefined,
        category: category || undefined,
        includeZeroQty: showZeroQty || undefined,
        quickFilter:
          quickFilter !== 'all' && quickFilter !== 'inbound'
            ? quickFilter
            : undefined,
        vintageFrom: vintageFrom ? Number(vintageFrom) : undefined,
        vintageTo: vintageTo ? Number(vintageTo) : undefined,
        sortBy,
        sortOrder,
      };

      // Page through all matching products (server caps limit at 200)
      const pageSize = 200;
      const allProducts: StockExportProduct[] = [];
      for (let offset = 0; offset < 20000; offset += pageSize) {
        const res = await trpcClient.wms.admin.stock.getByProduct.query({
          ...baseInput,
          limit: pageSize,
          offset,
        });
        allProducts.push(...res.products);
        if (!res.pagination.hasMore) break;
      }

      if (!allProducts.length) {
        toast.info('No stock matches the current filters');
        return;
      }

      // Fetch import prices for all exported products (chunked)
      const priceMap: Record<string, { importPricePerBottle: number }> = {};
      const lwin18s = [...new Set(allProducts.map((p) => p.lwin18))];
      for (let i = 0; i < lwin18s.length; i += 200) {
        const chunk = lwin18s.slice(i, i + 200);
        const partial = await trpcClient.wms.admin.stock.pricing.getBulk.query({
          lwin18s: chunk,
        });
        Object.assign(priceMap, partial);
      }

      const label =
        owners.find((o) => o.ownerId === ownerId)?.ownerName ??
        category ??
        undefined;
      exportStockToExcel(allProducts, { priceMap, label });
      toast.success(`Exported ${allProducts.length} products to Excel`);
    } catch (err) {
      console.error('Stock Excel export failed', { err });
      toast.error('Export failed — please try again');
    } finally {
      setIsExporting(false);
    }
  }, [
    isExporting,
    debouncedSearch,
    ownerId,
    category,
    showZeroQty,
    quickFilter,
    vintageFrom,
    vintageTo,
    sortBy,
    sortOrder,
    trpcClient,
    owners,
  ]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setOwnerId('');
    setCategory('Wine');
    setVintageFrom('');
    setVintageTo('');
    setQuickFilter('all');
    setShowZeroQty(false);
    setSortBy('totalCases');
    setSortOrder('desc');
    setPage(0);
  }, []);

  // Print labels handler — pallet storage uses 4x6" pallet labels, shelf/other uses 4x2" case labels
  const handlePrintLabels = useCallback(
    async (
      product: ProductRowProps['product'],
      loc: ProductRowProps['product']['locations'][number],
      qty: number,
    ) => {
      const packSize = `${product.caseConfig ?? 12}x${product.bottleSize ?? '75cl'}`;

      if (loc.storageMethod === 'pallet') {
        const zpl = Array.from({ length: qty }, () =>
          generateStockPalletLabelZpl({
            productName: product.productName,
            producer: product.producer ?? undefined,
            lwin18: product.lwin18,
            packSize,
            vintage: product.vintage ?? undefined,
            ownerName: loc.ownerName,
            quantityCases: loc.quantityCases,
            lotNumber: loc.lotNumber ?? undefined,
          }),
        ).join('\n');
        const success = await print(zpl, '4x6');
        if (success) {
          toast.success(
            `Printing ${qty} pallet label${qty !== 1 ? 's' : ''} for ${product.productName}`,
          );
        } else {
          toast.error('Print failed — check printer connection');
        }
      } else {
        const labels: LabelData[] = Array.from({ length: qty }, () => ({
          barcode: product.lwin18,
          productName: product.productName,
          producer: product.producer ?? undefined,
          lwin18: product.lwin18,
          packSize,
          vintage: product.vintage ?? undefined,
          locationCode: loc.locationCode,
          owner: loc.ownerName,
          lotNumber: loc.lotNumber ?? undefined,
          showBarcode: true,
        }));
        const zpl = generateBatchLabelsZpl(labels);
        const success = await print(zpl, '4x2');
        if (success) {
          toast.success(
            `Printing ${qty} label${qty !== 1 ? 's' : ''} for ${product.productName}`,
          );
        } else {
          toast.error('Print failed — check printer connection');
        }
      }
    },
    [print],
  );

  const hasActiveFilters =
    debouncedSearch ||
    ownerId ||
    vintageFrom ||
    vintageTo ||
    quickFilter !== 'all' ||
    showZeroQty;

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
    { key: 'inbound', label: 'Inbound' },
    { key: 'lowStock', label: 'Low Stock' },
    { key: 'reserved', label: 'Reserved' },
    { key: 'expiring', label: 'Expiring' },
    { key: 'ownStock', label: 'C&C Only' },
    { key: 'consignment', label: 'Consignment' },
  ];

  // Compute col count for colSpan
  const visibleColCount =
    2 + Object.values(visibleColumns).filter(Boolean).length;

  return (
    <div className="container mx-auto max-w-[2000px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link
                href="/platform/admin"
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <Typography variant="bodySm">Admin</Typography>
              </Link>
              <IconChevronRight className="text-text-muted h-4 w-4" />
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
            <div className="border-border-muted flex items-center rounded-lg border">
              {(['compact', 'normal', 'relaxed'] as RowDensity[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={`px-3 py-2 transition-colors ${
                    density === d
                      ? 'bg-fill-brand/10 text-text-brand'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  title={`${d} density`}
                >
                  <IconLayoutRows
                    className="h-4 w-4"
                    strokeWidth={
                      d === 'compact' ? 2.5 : d === 'normal' ? 2 : 1.5
                    }
                  />
                </button>
              ))}
            </div>

            {/* Column toggle */}
            <ColumnToggle
              columns={visibleColumns}
              onChange={setVisibleColumns}
            />

            {/* Export — all filtered rows to Excel */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={
                isExporting ||
                isInboundView ||
                (!products.length && !showZeroQty)
              }
              title={
                isInboundView
                  ? 'Switch off Inbound to export stock'
                  : 'Export all filtered rows to Excel'
              }
            >
              {isExporting ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconDownload className="h-4 w-4" />
              )}
              {isExporting ? 'Exporting…' : 'Export Excel'}
            </Button>
          </div>
        </div>

        {/*
          Details a repacked row never inherited.

          Read-time fallbacks fix a screen; these two have to be in the data. A
          re-export BOE is a customs record and belongs on the row that clears,
          not derived for a display; a producer that only exists at read time is
          absent from every export and every downstream system.
        */}
        {backfillPreview && (backfillPreview.producers > 0 || backfillPreview.boes > 0) && (
          <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              {backfillPreview.producers > 0
                ? `${backfillPreview.producers} row${backfillPreview.producers === 1 ? '' : 's'} with no producer`
                : ''}
              {backfillPreview.producers > 0 && backfillPreview.boes > 0 ? ' · ' : ''}
              {backfillPreview.boes > 0
                ? `${backfillPreview.boes} with no re-export BOE`
                : ''}
            </p>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
              Repacked stock inherits only what the case it came from carried.
              These can be filled from the wine&rsquo;s own LWIN record and from
              the shipment they arrived on — nothing is invented, and only blanks
              are touched.
            </p>
            <button
              type="button"
              onClick={() => backfillDetails({ dryRun: false })}
              disabled={isBackfilling}
              className="mt-2 rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isBackfilling ? 'Filling…' : 'Fill them in'}
            </button>
          </div>
        )}

        {/* A stock row's LWIN states the pack in its own digits, so it can be
            checked against the row. When they disagree the pick engine cracks
            the wrong number of cases and the order ships short — which is what
            this whole sweep started from. */}
        {packMismatches && packMismatches.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {packMismatches.length} stock row
              {packMismatches.length === 1 ? '' : 's'} disagree with their own
              LWIN
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              Picking uses the row&rsquo;s pack, so where it is wrong the order
              ships short or long. Correct the pack on the row, or the LWIN,
              against what is physically in the bay.
            </p>
            <div className="mt-2 max-h-40 space-y-1 overflow-auto">
              {packMismatches.slice(0, 25).map((row) => (
                <div key={row.stockId} className="text-xs">
                  <span className="font-medium">{row.productName}</span>
                  <span className="text-text-muted ml-1 font-mono">
                    {row.lwin18}
                  </span>
                  {row.locationCode ? (
                    <span className="text-text-muted ml-1 font-mono">
                      @ {row.locationCode}
                    </span>
                  ) : null}
                  <span className="block text-amber-700 dark:text-amber-400">
                    {row.differs.join(' · ')}
                    {row.bottlesByRow !== row.bottlesByLwin
                      ? ` — ${row.bottlesByRow} bottles by the row, ${row.bottlesByLwin} by the LWIN`
                      : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {overview && (
          <>
            <div
              className={`grid grid-cols-3 gap-2.5 sm:grid-cols-4 ${overview.inbound.cases > 0 ? 'lg:grid-cols-9' : 'lg:grid-cols-8'}`}
            >
              {/* Total Stock */}
              <div className="to-background-primary rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/40 px-3 py-2.5 text-center shadow-sm">
                <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-blue-100/70 text-blue-500">
                  <IconPackage size={13} />
                </div>
                <div className="text-lg font-bold leading-tight">
                  {overview.summary.totalCases.toLocaleString()}
                </div>
                <div className="text-text-muted text-[11px]">Cases</div>
                <div className="text-text-muted text-[10px]">
                  {overview.summary.uniqueProducts} products
                </div>
              </div>

              {/* Total Bottles */}
              <div className="to-background-primary rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/40 px-3 py-2.5 text-center shadow-sm">
                <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100/70 text-indigo-500">
                  <IconTags size={13} />
                </div>
                <div className="text-lg font-bold leading-tight">
                  {overview.summary.totalBottles.toLocaleString()}
                </div>
                <div className="text-text-muted text-[11px]">Items</div>
              </div>

              {/* Available */}
              <div className="to-background-primary rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 px-3 py-2.5 text-center shadow-sm">
                <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100/70 text-emerald-500">
                  <IconCircleCheck size={13} />
                </div>
                <div className="text-lg font-bold leading-tight text-emerald-600">
                  {overview.summary.availableCases.toLocaleString()}
                </div>
                <div className="text-text-muted text-[11px]">Available</div>
                <div className="text-text-muted text-[10px]">
                  {overview.summary.totalCases > 0
                    ? `${Math.round((overview.summary.availableCases / overview.summary.totalCases) * 100)}%`
                    : '—'}
                </div>
              </div>

              {/* Reserved */}
              <div className="to-background-primary rounded-xl border border-amber-100 bg-gradient-to-b from-amber-50/40 px-3 py-2.5 text-center shadow-sm">
                <div
                  className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md ${
                    overview.summary.reservedCases > 0
                      ? 'bg-amber-100/70 text-amber-500'
                      : 'bg-surface-muted text-text-muted'
                  }`}
                >
                  <IconLock size={13} />
                </div>
                <div
                  className={`text-lg font-bold leading-tight ${overview.summary.reservedCases > 0 ? 'text-amber-600' : ''}`}
                >
                  {overview.summary.reservedCases.toLocaleString()}
                </div>
                <div className="text-text-muted text-[11px]">Reserved</div>
                <div className="text-text-muted text-[10px]">
                  {overview.summary.reservedCases > 0 ? 'Allocated' : 'None'}
                </div>
              </div>

              {/* Utilization */}
              <div className="to-background-primary rounded-xl border border-purple-100 bg-gradient-to-b from-purple-50/40 px-3 py-2.5 text-center shadow-sm">
                <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-purple-100/70 text-purple-500">
                  <IconBuildingWarehouse size={13} />
                </div>
                <div className="text-lg font-bold leading-tight">
                  {overview.locations.utilizationPercent}%
                </div>
                <div className="text-text-muted text-[11px]">Utilization</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-purple-100">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all"
                      style={{
                        width: `${overview.locations.utilizationPercent}%`,
                      }}
                    />
                  </div>
                  <span className="text-text-muted text-[10px] tabular-nums">
                    {overview.locations.occupied}/{overview.locations.active}
                  </span>
                </div>
              </div>

              {/* Movements */}
              <div className="to-background-primary rounded-xl border border-cyan-100 bg-gradient-to-b from-cyan-50/40 px-3 py-2.5 text-center shadow-sm">
                <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-cyan-100/70 text-cyan-500">
                  <IconArrowsExchange size={13} />
                </div>
                <div className="text-lg font-bold leading-tight">
                  {overview.movements.last7Days}
                </div>
                <div className="text-text-muted text-[11px]">Moves (7d)</div>
                <div className="text-text-muted text-[10px]">
                  {overview.movements.last24Hours} (24h)
                </div>
              </div>

              {/* Owners */}
              <div className="to-background-primary rounded-xl border border-rose-100 bg-gradient-to-b from-rose-50/40 px-3 py-2.5 text-center shadow-sm">
                <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-rose-100/70 text-rose-500">
                  <IconUsers size={13} />
                </div>
                <div className="text-lg font-bold leading-tight">
                  {overview.summary.uniqueOwners}
                </div>
                <div className="text-text-muted text-[11px]">Owners</div>
                <div className="text-text-muted truncate text-[10px]">
                  {overview.topOwners[0]
                    ? `${overview.topOwners[0].ownerName}: ${overview.topOwners[0].totalCases}`
                    : '—'}
                </div>
              </div>

              {/* Value */}
              <button
                onClick={() => setShowValueDetail((v) => !v)}
                title="Click for cost / in-bond / PC value breakdown"
                className={`rounded-xl border px-3 py-2.5 text-center shadow-sm transition-colors ${
                  showValueDetail
                    ? 'border-green-300 bg-green-50 ring-1 ring-green-200'
                    : 'to-background-primary border-green-100 bg-gradient-to-b from-green-50/40 hover:border-green-200 hover:bg-green-50/50'
                }`}
              >
                <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-green-100/70 text-green-600">
                  <IconCurrencyDollar size={13} />
                </div>
                <div className="text-lg font-bold leading-tight text-green-700">
                  {fmtMoney(overview.valuation.totalValue)}
                </div>
                <div className="text-text-muted text-[11px]">
                  Value{ownerId ? ' · owner' : ''}
                </div>
                {overview.inbound.value > 0 && (
                  <div className="text-[10px] font-medium text-blue-500">
                    +{fmtMoney(overview.inbound.value)} inbound
                  </div>
                )}
                <div className="text-text-muted text-[10px]">
                  {overview.valuation.pricedProducts}/
                  {overview.valuation.totalProducts} priced
                </div>
              </button>

              {/* Inbound */}
              {overview.inbound.cases > 0 && (
                <button
                  onClick={() =>
                    setQuickFilter(isInboundView ? 'all' : 'inbound')
                  }
                  className={`rounded-xl border px-3 py-2.5 text-center shadow-sm transition-colors ${
                    isInboundView
                      ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                      : 'to-background-primary border-blue-100 bg-gradient-to-b from-blue-50/40 hover:border-blue-200 hover:bg-blue-50/50'
                  }`}
                >
                  <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-blue-100/70 text-blue-500">
                    <IconShip size={13} />
                  </div>
                  <div className="text-lg font-bold leading-tight text-blue-600">
                    {overview.inbound.cases.toLocaleString()}
                  </div>
                  <div className="text-text-muted text-[11px]">Inbound</div>
                  <div className="text-text-muted text-[10px]">
                    {overview.inbound.shipments} shipment
                    {overview.inbound.shipments !== 1 ? 's' : ''}
                  </div>
                  {overview.inbound.value > 0 && (
                    <div className="text-[10px] font-medium text-blue-500">
                      {fmtMoney(overview.inbound.value)}
                    </div>
                  )}
                </button>
              )}
            </div>

            {/* Value breakdown panel */}
            {showValueDetail && (
              <div className="border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-text-primary text-sm font-semibold">
                    Stock Value Breakdown{ownerId ? ' · selected owner' : ''}
                  </div>
                  <button
                    onClick={() => setShowValueDetail(false)}
                    className="text-text-muted hover:text-text-primary text-xs"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    {
                      label: 'Cost (landed)',
                      v: overview.valuation.costValue,
                      c: 'text-text-primary',
                    },
                    {
                      label: 'In-Bond (B2B)',
                      v: overview.valuation.inBondValue,
                      c: 'text-blue-600',
                    },
                    {
                      label: 'Private Client',
                      v: overview.valuation.pcValue,
                      c: 'text-violet-600',
                    },
                    {
                      label: 'Inbound (in-transit)',
                      v: overview.inbound.value,
                      c: 'text-sky-500',
                    },
                    {
                      label: 'Total incl. inbound',
                      v: overview.valuation.costValue + overview.inbound.value,
                      c: 'text-green-700',
                    },
                  ].map((t) => (
                    <div
                      key={t.label}
                      className="border-border-muted bg-background-primary rounded-lg border px-3 py-2"
                    >
                      <div
                        className={`text-base font-bold tabular-nums ${t.c}`}
                      >
                        {fmtMoney(t.v)}
                      </div>
                      <div className="text-text-muted text-[10px]">
                        {t.label}
                      </div>
                    </div>
                  ))}
                </div>
                {overview.valuation.byOwner.length > 1 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-border-muted text-text-muted border-b text-left">
                          <th className="py-1 font-medium">Owner</th>
                          <th className="py-1 text-right font-medium">Cases</th>
                          <th className="py-1 text-right font-medium">Cost</th>
                          <th className="py-1 text-right font-medium">
                            In-Bond
                          </th>
                          <th className="py-1 text-right font-medium">PC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-border-muted divide-y">
                        {overview.valuation.byOwner.map((o) => (
                          <tr key={o.ownerId ?? o.ownerName}>
                            <td className="py-1">{o.ownerName ?? 'Unknown'}</td>
                            <td className="py-1 text-right tabular-nums">
                              {o.cases.toLocaleString()}
                            </td>
                            <td className="py-1 text-right tabular-nums">
                              {fmtMoney(o.costValue)}
                            </td>
                            <td className="py-1 text-right tabular-nums text-blue-600">
                              {fmtMoney(o.inBondValue)}
                            </td>
                            <td className="py-1 text-right tabular-nums text-violet-600">
                              {fmtMoney(o.pcValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Search & Filters */}
        <div className="space-y-3">
          {/* Search - full width on mobile */}
          <div className="relative">
            <IconSearch className="text-text-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, producer, LWIN18..."
              className="border-border-primary bg-background-primary text-text-primary placeholder:text-text-muted focus:border-border-brand focus:ring-border-brand w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1"
            />
          </div>

          {/* Owner + Vintage row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Owner filter */}
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="border-border-primary bg-background-primary text-text-primary focus:border-border-brand flex-1 rounded-lg border px-3 py-2.5 text-sm focus:outline-none sm:flex-none"
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
                className="border-border-primary bg-background-primary text-text-primary placeholder:text-text-muted focus:border-border-brand w-20 rounded-lg border px-3 py-2.5 text-sm focus:outline-none"
              />
              <span className="text-text-muted">—</span>
              <input
                type="number"
                value={vintageTo}
                onChange={(e) => setVintageTo(e.target.value)}
                placeholder="To"
                min={1900}
                max={2100}
                className="border-border-primary bg-background-primary text-text-primary placeholder:text-text-muted focus:border-border-brand w-20 rounded-lg border px-3 py-2.5 text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Category + Quick Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category pills */}
          {[
            { key: 'Wine' as const, label: 'Wine' },
            { key: 'Spirits' as const, label: 'Spirits' },
            { key: 'RTD' as const, label: 'RTD' },
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() =>
                setCategory(category === cat.key ? undefined : cat.key)
              }
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                category === cat.key
                  ? 'bg-text-primary text-white'
                  : 'bg-surface-muted text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
              }`}
            >
              {cat.label}
            </button>
          ))}

          {/* Divider */}
          <div className="bg-border-muted mx-1 h-4 w-px" />

          {/* Quick filters */}
          {quickFilters.map((qf) => (
            <button
              key={qf.key}
              onClick={() => setQuickFilter(qf.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                quickFilter === qf.key
                  ? qf.key === 'inbound'
                    ? 'bg-blue-600 text-white'
                    : 'bg-fill-brand text-white'
                  : qf.key === 'inbound'
                    ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    : 'bg-surface-muted text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
              }`}
            >
              {qf.label}
            </button>
          ))}

          {/* Divider */}
          <div className="bg-border-muted mx-1 h-4 w-px" />

          {/* Zero qty toggle */}
          <button
            onClick={() => setShowZeroQty((v) => !v)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              showZeroQty
                ? 'bg-amber-600 text-white'
                : 'bg-surface-muted text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
            }`}
          >
            Show 0 Qty
          </button>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {debouncedSearch && (
              <span className="border-border-muted bg-background-primary text-text-secondary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                Search: &ldquo;{debouncedSearch}&rdquo;
                <button
                  onClick={() => {
                    setSearch('');
                    setDebouncedSearch('');
                  }}
                  className="text-text-muted hover:text-text-primary"
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedOwnerName && (
              <span className="border-border-muted bg-background-primary text-text-secondary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                Owner: {selectedOwnerName}
                <button
                  onClick={() => setOwnerId('')}
                  className="text-text-muted hover:text-text-primary"
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            )}
            {(vintageFrom || vintageTo) && (
              <span className="border-border-muted bg-background-primary text-text-secondary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                Vintage: {vintageFrom || '...'} — {vintageTo || '...'}
                <button
                  onClick={() => {
                    setVintageFrom('');
                    setVintageTo('');
                  }}
                  className="text-text-muted hover:text-text-primary"
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            )}
            {quickFilter !== 'all' && (
              <span className="border-border-muted bg-background-primary text-text-secondary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                Filter: {quickFilters.find((q) => q.key === quickFilter)?.label}
                <button
                  onClick={() => setQuickFilter('all')}
                  className="text-text-muted hover:text-text-primary"
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-text-muted hover:text-text-primary text-xs font-medium transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results count + pagination info */}
        <div className="text-text-muted flex items-center justify-between text-xs">
          <span>
            {activeLoading ? (
              'Loading...'
            ) : (
              <>
                {totalCount.toLocaleString()} {isInboundView ? 'inbound' : ''}{' '}
                product{totalCount !== 1 ? 's' : ''}
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
              <table className={`w-full ${dc.text}`}>
                <thead className="border-border-muted bg-surface-muted/60 sticky top-0 z-10 border-b">
                  <tr>
                    <th className={`${dc.td} w-8`} />
                    <th
                      className={`${dc.td} text-left ${thBase}`}
                      onClick={() => handleSort('productName')}
                    >
                      <span className="flex items-center gap-1">
                        Product {renderSortIcon('productName')}
                        {/*
                          Names clip to the column, and what gets clipped is
                          often the part that tells two wines apart. This shows
                          them whole; the row grows rather than the name
                          disappearing.
                        */}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setFullNames((value) => !value);
                          }}
                          title={
                            fullNames
                              ? 'Clip long names to the column'
                              : 'Show full names — rows grow to fit'
                          }
                          className={`ml-1 rounded p-0.5 transition-colors ${
                            fullNames
                              ? 'text-text-brand'
                              : 'text-text-muted/50 hover:text-text-primary'
                          }`}
                        >
                          {fullNames ? (
                            <IconArrowsDiagonalMinimize2 className="h-3.5 w-3.5" />
                          ) : (
                            <IconArrowsDiagonal className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </span>
                    </th>
                    {visibleColumns.producer && (
                      <th
                        className={`${dc.td} hidden text-left lg:table-cell ${thBase}`}
                      >
                        Producer
                      </th>
                    )}
                    {visibleColumns.lwin18 && (
                      <th
                        className={`${dc.td} hidden text-left lg:table-cell ${thBase}`}
                      >
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
                      <th
                        className={`${dc.td} hidden text-left xl:table-cell ${thBase}`}
                      >
                        Size
                      </th>
                    )}
                    {visibleColumns.pack && (
                      <th
                        className={`${dc.td} hidden text-left xl:table-cell ${thBase}`}
                      >
                        Pack
                      </th>
                    )}
                    {visibleColumns.cases && (
                      <th
                        className={`${dc.td} text-right ${thBase}`}
                        onClick={() => handleSort('totalCases')}
                      >
                        <span className="flex items-center justify-end gap-1">
                          {isInboundView ? 'Expected' : 'Cases'}{' '}
                          {renderSortIcon('totalCases')}
                        </span>
                      </th>
                    )}
                    {visibleColumns.available && (
                      <th className={`${dc.td} text-right ${thBase}`}>
                        {isInboundView ? 'ETA' : 'Avail'}
                      </th>
                    )}
                    {visibleColumns.reserved && (
                      <th
                        className={`${dc.td} text-right ${thBase}`}
                        title={
                          isInboundView
                            ? 'Number of shipments this product is arriving in'
                            : undefined
                        }
                      >
                        {isInboundView ? 'Shipments' : 'Rsvd'}
                      </th>
                    )}
                    {visibleColumns.importPrice && (
                      <th
                        className={`${dc.td} hidden text-right lg:table-cell ${thBase}`}
                      >
                        Import&nbsp;$/btl
                      </th>
                    )}
                    {visibleColumns.importCasePrice && (
                      <th
                        className={`${dc.td} hidden text-right lg:table-cell ${thBase}`}
                      >
                        Import&nbsp;$/case
                      </th>
                    )}
                    {visibleColumns.bottles && (
                      <th
                        className={`${dc.td} hidden text-right md:table-cell ${thBase}`}
                      >
                        Btls
                      </th>
                    )}
                    {visibleColumns.locations && (
                      <th
                        className={`${dc.td} hidden text-right md:table-cell ${thBase}`}
                      >
                        Locs
                      </th>
                    )}
                    {visibleColumns.owners && (
                      <th
                        className={`${dc.td} hidden text-right lg:table-cell ${thBase}`}
                      >
                        Owners
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th
                        className={`${dc.td} hidden text-left lg:table-cell ${thBase}`}
                      >
                        Status
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <SkeletonRow key={i} density={density} />
                    ))
                  ) : isInboundView ? (
                    inboundProducts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={visibleColCount}
                          className="py-20 text-center"
                        >
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                              <IconShip className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                              <Typography
                                variant="bodySm"
                                className="font-medium"
                              >
                                No inbound shipments
                              </Typography>
                              <Typography
                                variant="bodyXs"
                                colorRole="muted"
                                className="mt-1"
                              >
                                Items from booked shipments will appear here
                                automatically
                              </Typography>
                            </div>
                            <Link href="/platform/admin/logistics">
                              <Button variant="outline" size="sm">
                                <IconShip className="mr-1 h-4 w-4" />
                                Go to Logistics
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      inboundProducts.map((product) => {
                        const key = product.groupKey;
                        const isExpanded = expandedRows.has(key);
                        return (
                          <InboundProductRow
                            key={key}
                            product={product}
                            isExpanded={isExpanded}
                            onToggle={() => toggleRow(key)}
                            density={density}
                            fullNames={fullNames}
                          />
                        );
                      })
                    )
                  ) : products.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColCount}
                        className="py-20 text-center"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="bg-surface-muted flex h-12 w-12 items-center justify-center rounded-full">
                            <IconSearch className="text-text-muted h-6 w-6" />
                          </div>
                          <div>
                            <Typography
                              variant="bodySm"
                              className="font-medium"
                            >
                              {hasActiveFilters
                                ? 'No stock matches your filters'
                                : 'No inventory yet'}
                            </Typography>
                            <Typography
                              variant="bodyXs"
                              colorRole="muted"
                              className="mt-1"
                            >
                              {hasActiveFilters
                                ? 'Try adjusting your search or clearing filters'
                                : 'Import stock from Zoho or receive a shipment to get started'}
                            </Typography>
                          </div>
                          {hasActiveFilters ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearFilters}
                            >
                              Clear Filters
                            </Button>
                          ) : (
                            <Link href="/platform/admin/wms/receive">
                              <Button variant="primary" size="sm">
                                Go to Receiving
                              </Button>
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
                          fullNames={fullNames}
                          lookalikeTwins={lookalikeData?.byLwin18[
                            product.lwin18
                          ]?.map((t) => t.productName)}
                          isExpanded={isExpanded}
                          onToggle={() => toggleRow(key)}
                          density={density}
                          visibleColumns={visibleColumns}
                          onPrintLabels={handlePrintLabels}
                          onUpdateBoe={handleUpdateBoe}
                          onAdjustStock={handleAdjustStock}
                          onCorrectPack={handleCorrectPack}
                          isCorrectingPack={isCorrectingPack}
                          onEditName={handleEditName}
                          isAdjusting={isAdjustingStock}
                          editingLwin18={editingLwin18}
                          onStartEditName={setEditingLwin18}
                          onCancelEditName={() => setEditingLwin18(null)}
                          importPrice={
                            bulkPricing?.[product.lwin18]
                              ?.importPricePerBottle ?? null
                          }
                          onSetImportPrice={handleSetImportPrice}
                          onTransferOwnership={handleTransferOwnership}
                          isTransferring={isTransferring}
                          partners={partnersList}
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
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-sm">Show</span>
            {[50, 100, 200].map((size) => (
              <button
                key={size}
                onClick={() => {
                  setLimit(size);
                  setPage(0);
                }}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
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
              <span className="text-text-muted px-4 text-sm tabular-nums">
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
