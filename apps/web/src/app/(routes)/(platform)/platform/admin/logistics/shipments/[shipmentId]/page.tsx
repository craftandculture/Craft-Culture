'use client';

import {
  IconArrowLeft,
  IconCalculator,
  IconCheck,
  IconCloud,
  IconFileText,
  IconLoader2,
  IconLock,
  IconPackage,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUpload,
  IconWand,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import ActivityLog from '@/app/_logistics/components/ActivityLog';
import LogisticsDocumentUpload from '@/app/_logistics/components/DocumentUpload';
import ShipmentReconciliation from '@/app/_logistics/components/ShipmentReconciliation';
import ShipmentStatusBadge from '@/app/_logistics/components/ShipmentStatusBadge';
import ShipmentStatusStepper from '@/app/_logistics/components/ShipmentStatusStepper';
import ShipmentTracker from '@/app/_logistics/components/ShipmentTracker';
import isValidHsCode from '@/app/_logistics/utils/isValidHsCode';
import type { LwinLookupResult } from '@/app/_lwin/components/LwinLookup';
import LwinLookup from '@/app/_lwin/components/LwinLookup';
import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Sheet from '@/app/_ui/components/Sheet/Sheet';
import SheetContent from '@/app/_ui/components/Sheet/SheetContent';
import SheetDescription from '@/app/_ui/components/Sheet/SheetDescription';
import SheetTitle from '@/app/_ui/components/Sheet/SheetTitle';
import Typography from '@/app/_ui/components/Typography/Typography';
import OwnerBadge from '@/app/_wms/components/OwnerBadge';
import type { LogisticsShipment } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

const HS_CODES = [
  { value: '22042100', label: 'Wine' },
  { value: '22041000', label: 'Sparkling' },
  { value: '22084000', label: 'Rum' },
  { value: '22083000', label: 'Whisky' },
  { value: '22030000', label: 'Beer' },
  { value: '22082000', label: 'Brandy' },
  { value: '22089090', label: 'Tequila/Spirit' },
  { value: '22085000', label: 'Gin' },
  { value: '22087000', label: 'Liquor' },
  { value: '22086000', label: 'Vodka' },
  { value: '22060000', label: 'Cider' },
];

const hsLabel = (code: string | null) => HS_CODES.find((h) => h.value === code)?.label ?? null;

/**
 * Whether a value is a complete LWIN, and so safe to show as mapped.
 *
 * A seven-digit stem names the wine but not the bottling, and an account
 * number from an invoice names nothing at all. Both used to carry the green
 * tick, which staff read as a line already dealt with.
 */
const isCompleteLwin = (value: string | null | undefined) =>
  /^\d{7}-\d{4}-\d{2}-\d{5}$/.test((value ?? '').trim());

/**
 * The standard codes, plus whatever this line already carries.
 *
 * HS_CODES lists eleven. Real lines carry national subheadings — 22042142,
 * 22042143, 22041011 — which are not among them, so the select had no matching
 * option and rendered "Not set" against a line that plainly had a code. Saving
 * that sheet then wiped a valid customs code with an empty one.
 */
const hsOptionsFor = (current: string | null | undefined) => {
  const code = (current ?? '').trim();

  if (!code || HS_CODES.some((option) => option.value === code)) {
    return HS_CODES;
  }

  // The option renders as "value — label", so the label must not repeat the
  // code or it reads "22042143 — 22042143 — on this line".
  return [...HS_CODES, { value: code, label: 'already on this line' }];
};

type ShipmentStatus = LogisticsShipment['status'];

const statusOptions: { value: ShipmentStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'booked', label: 'Booked' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'arrived_port', label: 'Arrived Port' },
  { value: 'customs_clearance', label: 'Customs Clearance' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'at_warehouse', label: 'At Warehouse' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

type TabType = 'overview' | 'tracking' | 'items' | 'documents' | 'costs';

const SHIP_COST_CATEGORIES = [
  'freight',
  'insurance',
  'origin_handling',
  'destination_handling',
  'customs',
  'gov_fees',
  'delivery',
  'other',
] as const;
type ShipCostCategory = (typeof SHIP_COST_CATEGORIES)[number];
const catLabel = (c: string) => c.replace(/_/g, ' ');
const ledgerSelectCls =
  'rounded-lg border border-border-primary bg-background-primary px-2.5 py-2 text-sm text-text-primary focus:border-border-brand focus:outline-none';

// Colour-coded tints per invoice/document, cycled — matches the group ledger.
const LEDGER_TINTS = [
  { card: 'border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-900/10', accent: 'border-l-blue-400', dot: 'bg-blue-400' },
  { card: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10', accent: 'border-l-amber-400', dot: 'bg-amber-400' },
  { card: 'border-violet-200 bg-violet-50/60 dark:border-violet-900/40 dark:bg-violet-900/10', accent: 'border-l-violet-400', dot: 'bg-violet-400' },
  { card: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10', accent: 'border-l-emerald-400', dot: 'bg-emerald-400' },
  { card: 'border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-900/10', accent: 'border-l-rose-400', dot: 'bg-rose-400' },
  { card: 'border-teal-200 bg-teal-50/60 dark:border-teal-900/40 dark:bg-teal-900/10', accent: 'border-l-teal-400', dot: 'bg-teal-400' },
] as const;

/**
 * Shipment detail page with tabs
 */
const ShipmentDetailPage = () => {
  const params = useParams();
  const shipmentId = params.shipmentId as string;
  const api = useTRPC();
  const router = useRouter();
  const _queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  /** Blank means take today's market rate rather than a negotiated one */
  const [agreedRate, setAgreedRate] = useState('');
  /** What the shipment is really billed in, where the import got it wrong */
  const [fxCurrency, setFxCurrency] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingTransitBoe, setIsEditingTransitBoe] = useState(false);
  const [editedTransitBoe, setEditedTransitBoe] = useState('');
  const [isEditingReExportBoe, setIsEditingReExportBoe] = useState(false);
  const [editedReExportBoe, setEditedReExportBoe] = useState('');
  const [isEditingAwb, setIsEditingAwb] = useState(false);
  const [editedAwb, setEditedAwb] = useState('');
  const [editingCostField, setEditingCostField] = useState<string | null>(null);
  const [editedCostValue, setEditedCostValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    productName: '',
    cases: '',
    bottlesPerCase: '12',
    bottleSizeMl: '750',
    productCostPerBottle: '',
  });
  const [sheetItemId, setSheetItemId] = useState<string | null>(null);
  const [editingPackItemId, setEditingPackItemId] = useState<string | null>(null);
  const [editPack, setEditPack] = useState({ bottlesPerCase: '', bottleSizeMl: '' });
  const [sheetForm, setSheetForm] = useState({
    productName: '', producer: '', vintage: '', region: '',
    countryOfOrigin: '', hsCode: '', lwin: '', cases: '', bottlesPerCase: '',
    bottleSizeMl: '', productCostPerBottle: '',
    overrideOwnerId: '' as string | null, overrideOwnerName: '' as string | null,
    /** null inherits the shipment */
    notForSale: null as boolean | null,
  });

  const { data: shipment, isLoading, isError, error, refetch } = useQuery({
    ...api.logistics.admin.getOne.queryOptions({ id: shipmentId }),
  });

  const { mutate: updateStatus, isPending: isUpdatingStatus } = useMutation(
    api.logistics.admin.updateStatus.mutationOptions({
      onSuccess: () => {
        toast.success('Status updated');
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: updateShipment, isPending: isUpdatingShipment } = useMutation(
    api.logistics.admin.update.mutationOptions({
      onSuccess: () => {
        toast.success('Shipment updated');
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { data: partners } = useQuery({
    ...api.partners.getMany.queryOptions({ limit: 100 }),
  });

  const { data: partnersList } = useQuery({
    ...api.partners.list.queryOptions(),
  });

  const { mutate: addItem, isPending: isAddingItemPending } = useMutation(
    api.logistics.admin.addItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item added');
        setIsAddingItem(false);
        setNewItem({ productName: '', cases: '', bottlesPerCase: '12', bottleSizeMl: '750', productCostPerBottle: '' });
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: removeItem } = useMutation(
    api.logistics.admin.removeItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item removed');
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: updateItem, isPending: isUpdatingItem } = useMutation(
    api.logistics.admin.updateItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item updated');
        setSheetItemId(null);
        setEditingPackItemId(null);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: syncToZoho, isPending: isSyncingToZoho } = useMutation(
    api.logistics.admin.syncItemsToZoho.mutationOptions({
      onSuccess: (result) => {
        const { created, updated, exists, skipped, errors } = result.summary;
        const parts = [
          `${created} created`,
          `${updated} updated`,
          `${exists} unchanged`,
        ];
        if (skipped > 0) parts.push(`${skipped} skipped`);
        if (errors > 0) parts.push(`${errors} errors`);
        const message = `Synced to Zoho: ${parts.join(', ')}`;
        if (result.success) {
          toast.success(message);
        } else {
          toast.warning(message);
        }
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: autoAssignHs, isPending: isAutoAssigningHs } = useMutation(
    api.logistics.admin.autoAssignHsCodes.mutationOptions({
      onSuccess: (result) => {
        toast.success(`HS codes assigned: ${result.updated} updated, ${result.skipped} skipped`);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: backfillDetails, isPending: isBackfilling } = useMutation(
    api.logistics.admin.backfillItemDetails.mutationOptions({
      onSuccess: (result) => {
        const d = result.diagnostics;

        toast.success(
          `${result.regionsFilled} regions and ${result.hsFilled} HS codes filled` +
            (result.normalised > 0
              ? ` · ${result.normalised} off-menu subheadings pulled back onto a menu code`
              : '') +
            (result.hsFlagged > 0
              ? ` · ${result.hsFlagged} named like a spirit, check: ${result.flaggedExamples.slice(0, 3).join(', ')}`
              : ''),
          { duration: 8000 },
        );

        // Says what it saw, so a run that fills nothing is explicable rather
        // than just disappointing.
        if (result.regionsFilled === 0 || result.hsFilled === 0) {
          toast.info(
            `${d.total} lines · ${d.withLwin} have a LWIN, ${d.withNumericLwin} of those are numeric and can be looked up · ` +
              `${d.referenceMatches} found in the LWIN reference · ${d.hsAlreadySet} already had a valid HS code` +
              (d.hsInvalid > 0
                ? `, ${d.hsInvalid} held something that is not a code`
                : '') +
              ` · ${d.regionAlreadySet} already had a region`,
            { duration: 15000 },
          );
        }
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: repriceFromTotals, isPending: isRepricing } = useMutation(
    api.logistics.admin.repriceFromTotals.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.corrected} lines re-costed from their invoice totals` +
            (result.circular > 0
              ? ` · ${result.circular} cannot be checked — their total was calculated from the price, so the invoice must be re-imported`
              : '') +
            (result.unchanged > 0 ? ` · ${result.unchanged} left alone` : '') +
            (result.withoutTotal > 0
              ? ` · ${result.withoutTotal} have no stated total and were left`
              : '') +
            ` · priced at ${result.rate} ${result.currency}/USD`,
          { duration: 10000 },
        );
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { data: lwinMismatches } = useQuery(
    api.logistics.admin.findLwinMismatches.queryOptions(),
  );

  const mismatchesForShipment = (lwinMismatches ?? []).filter(
    (row) => row.shipmentId === shipmentId,
  );

  const { mutate: autoMatchLwins, isPending: isMatchingLwins } = useMutation(
    api.logistics.admin.autoMatchLwins.mutationOptions({
      onSuccess: (result) => {
        // The ones it declined to guess are the actual work, so they lead.
        toast.success(
          result.needsReview > 0
            ? `${result.applied} matched · ${result.needsReview} need a decision`
            : `All ${result.applied} matched`,
        );
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: setShipmentFx, isPending: isPricing } = useMutation(
    api.logistics.admin.setShipmentFx.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.itemsPriced} lines priced at ${result.rate.toFixed(4)} ${result.currency}/USD (${result.rateSource})`,
        );
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  /**
   * Whether Clear all is armed.
   *
   * Resets itself shortly after arming, so a button left in the dangerous
   * state cannot be fired by someone returning to the tab later.
   */
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!confirmClear) return;

    const timer = setTimeout(() => setConfirmClear(false), 6000);

    return () => clearTimeout(timer);
  }, [confirmClear]);

  const { mutate: clearItems, isPending: isClearingItems } = useMutation(
    api.logistics.admin.clearShipmentItems.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.removed} items removed`);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: calculateLandedCost, isPending: isCalculating } = useMutation(
    api.logistics.admin.calculateLandedCost.mutationOptions({
      onSuccess: (result) => {
        // Report LOGISTICS cost, not the blended landed-per-bottle (which
        // averages cheap and expensive wines and is meaningless).
        const logistics = result.items.reduce(
          (s, i) =>
            s +
            (i.freightAllocated ?? 0) +
            (i.handlingAllocated ?? 0) +
            (i.insuranceAllocated ?? 0) +
            (i.govFeesAllocated ?? 0),
          0,
        );
        const bottles = result.items.reduce((s, i) => s + i.totalBottles, 0);
        toast.success(
          `Landed cost applied — ${formatPrice(logistics, 'USD')} logistics${
            bottles ? ` (${formatPrice(logistics / bottles, 'USD')}/bottle)` : ''
          }`,
        );
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: extractInvoice, isPending: isExtracting } = useMutation(
    api.logistics.admin.extractShipmentInvoice.mutationOptions({
      onSuccess: (r) => {
        toast.success(
          `Pulled ${r.chargeCount} charges from ${r.documentsParsed} invoice${
            r.documentsParsed !== 1 ? 's' : ''
          } — ${formatPrice(r.totalLogisticsUsd, 'USD')} logistics${
            r.currencies.length ? ` (${r.currencies.join(', ')})` : ''
          }`,
        );
        if (r.unresolvedCurrencies.length) {
          toast.warning(
            `Couldn't auto-convert ${r.unresolvedCurrencies.join(', ')} — check those amounts.`,
          );
        }
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  // Native cost ledger — add/delete manual lines
  const [newLine, setNewLine] = useState({
    category: 'freight' as ShipCostCategory,
    description: '',
    amount: '',
    currency: 'USD',
    fxToUsd: '1',
  });
  const { mutate: addCostLine, isPending: isAddingLine } = useMutation(
    api.logistics.admin.addShipmentCostLine.mutationOptions({
      onSuccess: () => {
        setNewLine((l) => ({ ...l, description: '', amount: '' }));
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const { mutate: delCostLine } = useMutation(
    api.logistics.admin.deleteShipmentCostLine.mutationOptions({
      onSuccess: () => void refetch(),
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: deleteShipment, isPending: isDeleting } = useMutation(
    api.logistics.admin.delete.mutationOptions({
      onSuccess: () => {
        toast.success('Shipment deleted');
        router.push('/platform/admin/logistics/shipments');
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleStatusChange = (status: ShipmentStatus) => {
    updateStatus({ id: shipmentId, status });
  };

  const handlePartnerChange = (partnerId: string) => {
    updateShipment({ id: shipmentId, partnerId: partnerId || null });
  };

  const handleAddItem = () => {
    if (!newItem.productName || !newItem.cases) {
      toast.error('Product name and cases are required');
      return;
    }
    addItem({
      shipmentId,
      productName: newItem.productName,
      cases: parseInt(newItem.cases, 10),
      bottlesPerCase: parseInt(newItem.bottlesPerCase, 10) || 12,
      bottleSizeMl: parseInt(newItem.bottleSizeMl, 10) || 750,
      productCostPerBottle: newItem.productCostPerBottle ? parseFloat(newItem.productCostPerBottle) : undefined,
    });
  };

  const handleLwinSelect = (_itemId: string, result: LwinLookupResult) => {
    // Auto-detect HS code: sparkling = 22041000, still wine = 22042100
    const text = `${result.classification ?? ''} ${result.displayName}`.toLowerCase();
    const isSparkling = ['champagne', 'sparkling', 'cava', 'prosecco', 'cremant', 'sekt', 'spumante']
      .some((t) => text.includes(t));

    // Populate the sheet form so the user can review before saving
    setSheetForm((f) => ({
      ...f,
      lwin: result.lwin18,
      producer: result.producer || f.producer,
      vintage: result.vintage ? String(result.vintage) : f.vintage,
      region: result.region || f.region,
      countryOfOrigin: result.country || f.countryOfOrigin,
      hsCode: isSparkling ? '22041000' : '22042100',
      bottlesPerCase: String(result.caseSize),
      bottleSizeMl: String(result.bottleSizeMl),
    }));
    toast.success('LWIN matched — review fields and save');
  };

  const handleSavePack = (itemId: string) => {
    const bpc = parseInt(editPack.bottlesPerCase, 10);
    const bsml = parseInt(editPack.bottleSizeMl, 10);
    if (!bpc || bpc < 1 || !bsml || bsml < 1) return;
    updateItem({ itemId, bottlesPerCase: bpc, bottleSizeMl: bsml });
    setEditingPackItemId(null);
  };

  const handleUseSupplierSku = (itemId: string, supplierSku: string) => {
    updateItem({
      itemId,
      lwin: supplierSku, // Use supplier SKU as the identifier
      supplierSku: supplierSku,
    });
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Icon icon={IconLoader2} className="animate-spin" size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Typography variant="headingSm" className="text-text-danger mb-2">
              Error loading shipment
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              {error?.message || 'An unexpected error occurred'}
            </Typography>
            <div className="mt-4">
              <Link href="/platform/admin/logistics">
                <Button variant="outline" size="sm">
                  <Icon icon={IconArrowLeft} size="sm" className="mr-2" />
                  Back to list
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Typography variant="headingSm">Shipment not found</Typography>
            <Typography variant="bodySm" colorRole="muted" className="mt-2">
              The shipment with ID {shipmentId} does not exist.
            </Typography>
            <div className="mt-4">
              <Link href="/platform/admin/logistics">
                <Button variant="outline" size="sm">
                  <Icon icon={IconArrowLeft} size="sm" className="mr-2" />
                  Back to list
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: typeof IconPackage }[] = [
    { id: 'overview', label: 'Overview', icon: IconFileText },
    { id: 'tracking', label: 'Tracking', icon: IconRefresh },
    { id: 'items', label: `Items (${shipment.items?.length ?? 0})`, icon: IconPackage },
    { id: 'documents', label: `Documents (${shipment.documents?.length ?? 0})`, icon: IconUpload },
    { id: 'costs', label: 'Costs', icon: IconCalculator },
  ];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/platform/admin/logistics">
              <Button variant="ghost" size="sm">
                <Icon icon={IconArrowLeft} size="sm" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                {isEditingName ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const trimmed = editedName.trim();
                      if (trimmed !== (shipment.name ?? '')) {
                        updateShipment({
                          id: shipmentId,
                          name: trimmed || null,
                        });
                      }
                      setIsEditingName(false);
                    }}
                  >
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="h-9 w-64 text-lg font-semibold"
                      placeholder="e.g. RAREWINE Air freight 1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsEditingName(false);
                          setEditedName(shipment.name ?? '');
                        }
                      }}
                    />
                    <Button type="submit" variant="ghost" size="sm">
                      <Icon icon={IconCheck} size="sm" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingName(false);
                        setEditedName(shipment.name ?? '');
                      }}
                    >
                      <Icon icon={IconX} size="sm" />
                    </Button>
                  </form>
                ) : (
                  <button
                    className="flex items-center gap-2"
                    onClick={() => {
                      setEditedName(shipment.name ?? '');
                      setIsEditingName(true);
                    }}
                  >
                    <Typography variant="headingLg">
                      {shipment.name || shipment.shipmentNumber}
                    </Typography>
                    <Icon
                      icon={IconPencil}
                      size="sm"
                      className="text-text-muted"
                    />
                  </button>
                )}
                <ShipmentStatusBadge status={shipment.status} />
              </div>
              <div className="flex items-center gap-2 text-sm text-text-muted">
                {shipment.name && (
                  <>
                    <span className="font-mono">{shipment.shipmentNumber}</span>
                    <span>·</span>
                  </>
                )}
                <span>{shipment.type === 'inbound' ? 'Import' : 'Export'}</span>
                <span>·</span>
                <span>
                  {shipment.originCity ?? shipment.originCountry ?? 'Origin'} →{' '}
                  {shipment.destinationCity ?? shipment.destinationWarehouse ?? 'Destination'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <Icon icon={IconRefresh} size="sm" />
            </Button>
            <Select value={shipment.status} onValueChange={handleStatusChange} disabled={isUpdatingStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteShipment({ id: shipmentId })}
                  disabled={isDeleting}
                >
                  <ButtonContent iconLeft={IconTrash}>Confirm</ButtonContent>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  <Icon icon={IconX} size="sm" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                <Icon icon={IconTrash} size="sm" />
              </Button>
            )}
          </div>
        </div>

        {/* Status Stepper */}
        <Card>
          <CardContent className="p-4">
            <ShipmentStatusStepper
              currentStatus={shipment.status}
              onStatusClick={handleStatusChange}
            />
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border-muted overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-border-brand text-text-brand'
                  : 'border-transparent text-text-muted hover:border-border-muted hover:text-text-primary'
              }`}
            >
              <Icon icon={tab.icon} size="sm" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Shipment Details
                </Typography>
                <dl className="space-y-3">
                  <div className="flex justify-between items-center">
                    <dt className="text-text-muted">Partner</dt>
                    <dd>
                      <Select
                        value={shipment.partnerId ?? ''}
                        onValueChange={handlePartnerChange}
                        disabled={isUpdatingShipment}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Select partner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {partners?.map((partner) => (
                            <SelectItem key={partner.id} value={partner.id}>
                              {partner.businessName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-text-muted">Type</dt>
                    <dd>
                      <Select
                        value={shipment.type}
                        onValueChange={(value: 'inbound' | 'outbound' | 're_export') => {
                          updateShipment({ id: shipmentId, type: value });
                        }}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inbound">Import</SelectItem>
                          <SelectItem value="outbound">Export</SelectItem>
                          <SelectItem value="re_export">Re-Export</SelectItem>
                        </SelectContent>
                      </Select>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-text-muted">Transport</dt>
                    <dd>
                      <Select
                        value={shipment.transportMode}
                        onValueChange={(value: 'sea_fcl' | 'sea_lcl' | 'air' | 'road') => {
                          updateShipment({ id: shipmentId, transportMode: value });
                        }}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sea_fcl">Sea FCL</SelectItem>
                          <SelectItem value="sea_lcl">Sea LCL</SelectItem>
                          <SelectItem value="air">Air</SelectItem>
                          <SelectItem value="road">Road</SelectItem>
                        </SelectContent>
                      </Select>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Carrier</dt>
                    <dd>{shipment.carrierName ?? '-'}</dd>
                  </div>
                  {shipment.transportMode === 'air' ? (
                    <div className="flex justify-between">
                      <dt className="text-text-muted">AWB #</dt>
                      <dd className="font-mono">
                        {isEditingAwb ? (
                          <form
                            className="flex items-center gap-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const trimmed = editedAwb.trim();
                              if (trimmed !== (shipment.awbNumber ?? '')) {
                                updateShipment({
                                  id: shipmentId,
                                  awbNumber: trimmed || undefined,
                                });
                              }
                              setIsEditingAwb(false);
                            }}
                          >
                            <Input
                              value={editedAwb}
                              onChange={(e) => setEditedAwb(e.target.value)}
                              className="h-7 w-40 font-mono text-sm"
                              placeholder="AWB number"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setIsEditingAwb(false);
                                  setEditedAwb(shipment.awbNumber ?? '');
                                }
                              }}
                            />
                            <Button type="submit" variant="ghost" size="sm">
                              <Icon icon={IconCheck} size="sm" />
                            </Button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            className="cursor-pointer hover:underline"
                            onClick={() => {
                              setEditedAwb(shipment.awbNumber ?? '');
                              setIsEditingAwb(true);
                            }}
                          >
                            {shipment.awbNumber || '-'}
                          </button>
                        )}
                      </dd>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-text-muted">Container #</dt>
                        <dd className="font-mono">{shipment.containerNumber ?? '-'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-text-muted">BOL #</dt>
                        <dd className="font-mono">{shipment.blNumber ?? '-'}</dd>
                      </div>
                    </>
                  )}
                  {shipment.type === 'inbound' && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-text-muted">Transit BOE #</dt>
                        <dd className="font-mono">
                          {isEditingTransitBoe ? (
                            <form
                              className="flex items-center gap-1"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const trimmed = editedTransitBoe.trim();
                                if (trimmed !== (shipment.transitBoeNumber ?? '')) {
                                  updateShipment({
                                    id: shipmentId,
                                    transitBoeNumber: trimmed || undefined,
                                  });
                                }
                                setIsEditingTransitBoe(false);
                              }}
                            >
                              <Input
                                value={editedTransitBoe}
                                onChange={(e) => setEditedTransitBoe(e.target.value)}
                                className="h-7 w-40 font-mono text-sm"
                                placeholder="DEC NO"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    setIsEditingTransitBoe(false);
                                    setEditedTransitBoe(shipment.transitBoeNumber ?? '');
                                  }
                                }}
                              />
                              <Button type="submit" variant="ghost" size="sm">
                                <Icon icon={IconCheck} size="sm" />
                              </Button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="cursor-pointer hover:underline"
                              onClick={() => {
                                setEditedTransitBoe(shipment.transitBoeNumber ?? '');
                                setIsEditingTransitBoe(true);
                              }}
                            >
                              {shipment.transitBoeNumber || '-'}
                            </button>
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-text-muted">Re-Export BOE #</dt>
                        <dd className="font-mono">
                          {isEditingReExportBoe ? (
                            <form
                              className="flex items-center gap-1"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const trimmed = editedReExportBoe.trim();
                                if (trimmed !== (shipment.reExportBoeNumber ?? '')) {
                                  updateShipment({
                                    id: shipmentId,
                                    reExportBoeNumber: trimmed || undefined,
                                  });
                                }
                                setIsEditingReExportBoe(false);
                              }}
                            >
                              <Input
                                value={editedReExportBoe}
                                onChange={(e) => setEditedReExportBoe(e.target.value)}
                                className="h-7 w-40 font-mono text-sm"
                                placeholder="RE BOE"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    setIsEditingReExportBoe(false);
                                    setEditedReExportBoe(shipment.reExportBoeNumber ?? '');
                                  }
                                }}
                              />
                              <Button type="submit" variant="ghost" size="sm">
                                <Icon icon={IconCheck} size="sm" />
                              </Button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="cursor-pointer hover:underline"
                              onClick={() => {
                                setEditedReExportBoe(shipment.reExportBoeNumber ?? '');
                                setIsEditingReExportBoe(true);
                              }}
                            >
                              {shipment.reExportBoeNumber || '-'}
                            </button>
                          )}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Timeline
                </Typography>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ETD</dt>
                    <dd>{formatDate(shipment.etd)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ATD</dt>
                    <dd>{formatDate(shipment.atd)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ETA</dt>
                    <dd>{formatDate(shipment.eta)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ATA</dt>
                    <dd>{formatDate(shipment.ata)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Delivered</dt>
                    <dd>{formatDate(shipment.deliveredAt)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Cargo Summary
                </Typography>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Total Cases
                    </Typography>
                    <Typography variant="headingMd">{shipment.totalCases ?? 0}</Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Total Bottles
                    </Typography>
                    <Typography variant="headingMd">{shipment.totalBottles ?? 0}</Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Weight (kg)
                    </Typography>
                    <Typography variant="headingMd">
                      {shipment.totalWeightKg?.toFixed(1) ?? '-'}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Landed Cost
                    </Typography>
                    <Typography variant="headingMd">
                      {shipment.totalLandedCostUsd
                        ? formatPrice(shipment.totalLandedCostUsd, 'USD')
                        : '-'}
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'tracking' && (
          <div className="space-y-6">
            <ShipmentTracker
              shipmentId={shipmentId}
              hillebrandShipmentId={shipment.hillebrandShipmentId}
              originCity={shipment.originCity}
              originCountry={shipment.originCountry}
              destinationCity={shipment.destinationCity}
              destinationWarehouse={shipment.destinationWarehouse}
              status={shipment.status}
              etd={shipment.etd}
              atd={shipment.atd}
              eta={shipment.eta}
              ata={shipment.ata}
              deliveredAt={shipment.deliveredAt}
            />

            {/* Activity Log */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Activity Log
                </Typography>
                <ActivityLog
                  activities={(shipment.activityLogs ?? []).map((log) => ({
                    id: log.id,
                    type: log.action,
                    description: log.notes ?? log.action,
                    createdAt: log.createdAt,
                    createdBy: log.user?.name ?? log.user?.email ?? null,
                    metadata: null,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'items' && (() => {
          const items = shipment.items ?? [];

          /*
            The lines know what they were billed in even when the shipment
            has not been stamped — anything imported before the importer
            recorded it would otherwise have no way to reach the rate control
            at all, which is how 165 euro lines came to sit with no cost and
            no button.
          */
          const billedCurrency =
            shipment.sourceCurrency ??
            items.find((item) => item.sourceCurrency)?.sourceCurrency ??
            null;
          // A partial code is not a mapping. Staff read the green tick as
          // work already done, so only a complete LWIN counts towards it.
          const mappedCount = items.filter((i) => isCompleteLwin(i.lwin)).length;
          // Any non-empty string used to count, so lines reading "Wine"
          // showed as complete while customs would reject them.
          const hsCount = items.filter((i) => isValidHsCode(i.hsCode)).length;
          const totalItems = items.length;
          const allHsSet = totalItems > 0 && hsCount === totalItems;
          const lwinSheetItem = items.find((i) => i.id === sheetItemId) ?? null;
          const totalCases = items.reduce((sum, i) => sum + (i.cases ?? 0), 0);
          const totalBottles = items.reduce((sum, i) => sum + (i.totalBottles ?? 0), 0);
          // Goods value, for checking against the invoice total. The column is
          // a per-bottle cost, so a column sum would be meaningless — it has to
          // be re-multiplied by the bottles on each line.
          const totalGoodsValue = items.reduce(
            (sum, i) => sum + (i.totalBottles ?? 0) * (i.productCostPerBottle ?? 0),
            0,
          );
          const pricedItems = items.filter((i) => i.productCostPerBottle != null).length;
          // The header figures are entered against the document; the lines are
          // what was actually imported. Silent disagreement between them is how
          // a mis-read invoice reaches landed cost unnoticed.
          const casesDiffer =
            shipment.totalCases != null && shipment.totalCases !== totalCases;
          const bottlesDiffer =
            shipment.totalBottles != null && shipment.totalBottles !== totalBottles;

          const openSheet = (item: typeof items[number]) => {
            setSheetItemId(item.id);
            setSheetForm({
              productName: item.productName,
              producer: item.producer ?? '',
              vintage: item.vintage ? String(item.vintage) : '',
              region: item.region ?? '',
              countryOfOrigin: item.countryOfOrigin ?? '',
              hsCode: item.hsCode ?? '',
              lwin: item.lwin ?? '',
              cases: String(item.cases),
              bottlesPerCase: String(item.bottlesPerCase || 12),
              bottleSizeMl: String(item.bottleSizeMl || 750),
              productCostPerBottle: item.productCostPerBottle ? String(item.productCostPerBottle) : '',
              overrideOwnerId: item.overrideOwnerId ?? null,
              overrideOwnerName: item.overrideOwnerName ?? null,
              notForSale: item.notForSale ?? null,
            });
          };

          const handleSaveSheet = () => {
            if (!sheetItemId) return;
            updateItem({
              itemId: sheetItemId,
              ...(sheetForm.productName && { productName: sheetForm.productName }),
              ...(sheetForm.lwin && { lwin: sheetForm.lwin }),
              producer: sheetForm.producer || null,
              vintage: sheetForm.vintage ? parseInt(sheetForm.vintage, 10) : null,
              region: sheetForm.region || null,
              countryOfOrigin: sheetForm.countryOfOrigin || null,
              hsCode: sheetForm.hsCode || null,
              cases: sheetForm.cases ? parseInt(sheetForm.cases, 10) : undefined,
              bottlesPerCase: sheetForm.bottlesPerCase ? parseInt(sheetForm.bottlesPerCase, 10) : null,
              bottleSizeMl: sheetForm.bottleSizeMl ? parseInt(sheetForm.bottleSizeMl, 10) : null,
              productCostPerBottle: sheetForm.productCostPerBottle ? parseFloat(sheetForm.productCostPerBottle) : null,
              overrideOwnerId: sheetForm.overrideOwnerId || null,
              overrideOwnerName: sheetForm.overrideOwnerName || null,
              notForSale: sheetForm.notForSale,
            });
          };

          return (
            <div className="space-y-4">
              {/* A generated LWIN carries the pack, vintage and bottle size in
                  its own digits, so it can be checked against the line it came
                  from. They disagree when the pack selector could not show the
                  line's real pack and quietly committed a different one. */}
              {mismatchesForShipment.length > 0 && (
                <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                  <CardContent className="px-6 py-4">
                    <Typography variant="bodySm" className="font-semibold text-amber-800 dark:text-amber-300">
                      {mismatchesForShipment.length} line
                      {mismatchesForShipment.length === 1 ? '' : 's'} carry a
                      LWIN that contradicts the line itself
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                      Check each against the supplier invoice and correct
                      whichever is wrong — the LWIN travels into the WMS as the
                      pack, onto case labels, and into picking.
                    </Typography>
                    <div className="mt-2 space-y-1">
                      {mismatchesForShipment.map((row) => (
                        <div key={row.itemId} className="text-xs">
                          <span className="font-medium">{row.productName}</span>
                          <span className="ml-1 font-mono text-text-muted">
                            {row.lwin}
                          </span>
                          <span className="block text-amber-700 dark:text-amber-400">
                            {row.differs.join(' · ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/*
                What the supplier's own paperwork says, beside what we hold.

                The document is the check on the import, not the other way
                round: every extraction fault this flow has had would have
                shown here as one number out of place.
              */}
              <ShipmentReconciliation
                shipmentId={shipmentId}
                declared={{
                  cases: shipment.declaredCases ?? null,
                  bottles: shipment.declaredBottles ?? null,
                  cartons: shipment.declaredCartons ?? null,
                  pallets: shipment.declaredPallets ?? null,
                  value: shipment.declaredValue ?? null,
                  currency: shipment.declaredCurrency ?? null,
                  source: shipment.declaredSource ?? null,
                  confirmedAt: shipment.declaredConfirmedAt ?? null,
                }}
                ours={{
                  cases: totalCases,
                  // Bottles billed loose, which is what a supplier's "bt"
                  // column totals — not every bottle in the shipment.
                  looseBottles: items.reduce(
                    (sum, i) => sum + (i.cases ? 0 : (i.totalBottles ?? 0)),
                    0,
                  ),
                  value: items.reduce(
                    (sum, i) => sum + (i.sourceTotal ?? 0),
                    0,
                  ),
                  currency: billedCurrency,
                }}
              />

              {/* Progress Bars */}
              {totalItems > 0 && (
                <Card>
                  <CardContent className="px-6 py-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Typography variant="bodyXs" className="font-medium">LWIN Mapping</Typography>
                        <div className="flex items-center gap-2">
                          {mappedCount < totalItems && (
                            <button
                              onClick={() => autoMatchLwins({ shipmentId, dryRun: false })}
                              disabled={isMatchingLwins}
                              className="flex items-center gap-1 text-xs text-text-brand hover:underline disabled:opacity-50"
                            >
                              <Icon icon={IconWand} size="sm" />
                              {isMatchingLwins ? 'Matching...' : 'Match all'}
                            </button>
                          )}
                          <Typography variant="bodyXs" colorRole="muted">{mappedCount}/{totalItems}</Typography>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-fill-secondary">
                        <div
                          className={`h-1.5 rounded-full transition-all ${mappedCount === totalItems ? 'bg-green-500' : 'bg-amber-400'}`}
                          style={{ width: `${(mappedCount / totalItems) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Typography variant="bodyXs" className="font-medium">HS Codes</Typography>
                        <div className="flex items-center gap-2">
                          {!allHsSet && (
                            <button
                              onClick={() => autoAssignHs({ shipmentId })}
                              disabled={isAutoAssigningHs}
                              className="flex items-center gap-1 text-xs text-text-brand hover:underline disabled:opacity-50"
                            >
                              <Icon icon={IconWand} size="sm" />
                              {isAutoAssigningHs ? 'Assigning...' : 'Auto-assign'}
                            </button>
                          )}
                          {/* The auto-assign above only touches LWIN-mapped
                              lines, which is why half a shipment stays blank.
                              This fills the region from the LWIN reference
                              first, then codes every line as wine or
                              sparkling. */}
                          <button
                            onClick={() =>
                              backfillDetails({ shipmentId, dryRun: false })
                            }
                            disabled={isBackfilling}
                            className="flex items-center gap-1 text-xs text-text-brand hover:underline disabled:opacity-50"
                          >
                            <Icon icon={IconWand} size="sm" />
                            {isBackfilling
                              ? 'Filling...'
                              : 'Fill regions & HS codes'}
                          </button>
                          <Typography variant="bodyXs" colorRole="muted">{hsCount}/{totalItems}</Typography>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-fill-secondary">
                        <div
                          className={`h-1.5 rounded-full transition-all ${allHsSet ? 'bg-green-500' : 'bg-red-400'}`}
                          style={{ width: `${(hsCount / totalItems) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/*
                      A supplier invoice is settled at one rate, so it converts
                      at one rate. Doing it per line is what turns 163 lines
                      into 163 calculations.
                    */}
                    {/*
                      Whether the goods are ours to sell at all. A client's
                      cellar coming into storage receives, locates and picks
                      like anything else, so nothing downstream can tell it
                      apart — it has to be said here, once, for the shipment.
                    */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-primary pt-3">
                      <Typography variant="bodyXs" colorRole="muted">
                        {shipment.notForSale
                          ? 'Held for owner — kept out of the catalogue, price lists and quotes'
                          : 'For sale — listed once received'}
                      </Typography>
                      <button
                        onClick={() =>
                          updateShipment({
                            id: shipmentId,
                            notForSale: !shipment.notForSale,
                          })
                        }
                        disabled={isUpdatingShipment}
                        className="flex items-center gap-1 text-xs text-text-brand hover:underline disabled:opacity-50"
                      >
                        <Icon icon={IconLock} size="sm" />
                        {shipment.notForSale ? 'Mark for sale' : 'Hold for owner'}
                      </button>
                    </div>

                    {/*
                      Shown for every shipment, not only the foreign ones.

                      It used to appear only when the currency read as non-USD,
                      which hid it in precisely the case that needs it: a
                      Wilkinson invoice names no currency, so a pound shipment
                      was stamped USD, looked domestic, and offered no way to
                      say otherwise. The prices stored are always the ones the
                      document billed, so naming the right currency here and
                      applying a rate repairs the figures rather than
                      compounding them.
                    */}
                    {totalItems > 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-primary pt-3">
                        <Typography variant="bodyXs" colorRole="muted">
                          {billedCurrency
                            ? `Billed in ${billedCurrency}`
                            : 'No currency recorded'}
                          {billedCurrency === 'USD'
                            ? ' · change it if this invoice was not in dollars'
                            : shipment.fxRateToUsd
                              ? ` · priced at ${shipment.fxRateToUsd.toFixed(4)} (${shipment.fxRateSource}${shipment.fxRateDate ? `, ${shipment.fxRateDate}` : ''})`
                              : ' · not yet priced in USD'}
                        </Typography>
                        <div className="flex items-center gap-2">
                          <Select
                            value={fxCurrency || billedCurrency || ''}
                            onValueChange={setFxCurrency}
                          >
                            <SelectTrigger className="h-8 w-24">
                              <SelectValue placeholder="Currency" />
                            </SelectTrigger>
                            <SelectContent>
                              {['GBP', 'EUR', 'USD', 'CHF', 'AED', 'HKD', 'JPY'].map(
                                (code) => (
                                  <SelectItem key={code} value={code}>
                                    {code}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            placeholder="Agreed rate"
                            value={agreedRate}
                            onChange={(event) => setAgreedRate(event.target.value)}
                            className="border-border-primary bg-fill-primary text-text-primary h-8 w-32 rounded-md border px-2 text-sm"
                          />
                          <button
                            onClick={() =>
                              setShipmentFx({
                                shipmentId,
                                agreedRate: agreedRate
                                  ? Number(agreedRate)
                                  : undefined,
                                // What it is actually billed in, which is not
                                // always what the import recorded.
                                currency:
                                  fxCurrency || billedCurrency || undefined,
                              })
                            }
                            disabled={isPricing}
                            className="flex items-center gap-1 text-xs text-text-brand hover:underline disabled:opacity-50"
                          >
                            <Icon icon={IconWand} size="sm" />
                            {isPricing
                              ? 'Pricing...'
                              : agreedRate
                                ? 'Apply rate'
                                : "Use today's rate"}
                          </button>
                          {/* A shipment imported before the price fix holds a
                              per-case figure in the per-bottle column. The
                              line totals were captured correctly, so it can be
                              repaired in place rather than cleared and
                              re-imported. */}
                          <button
                            onClick={() =>
                              repriceFromTotals({
                                shipmentId,
                                agreedRate: agreedRate
                                  ? Number(agreedRate)
                                  : undefined,
                              })
                            }
                            disabled={isRepricing}
                            className="flex items-center gap-1 text-xs text-text-brand hover:underline disabled:opacity-50"
                          >
                            <Icon icon={IconWand} size="sm" />
                            {isRepricing
                              ? 'Re-costing...'
                              : 'Re-cost from invoice totals'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Typography variant="headingSm">Items</Typography>
                    <div className="flex gap-2">
                      {/*
                        A mis-imported document is a whole list of wrong lines.
                        Undoing that one trash icon at a time is the problem the
                        import had, not a fix for it.
                      */}
                      {totalItems > 0 && (
                        <>
                        <Button
                          size="sm"
                          variant="outline"
                          colorRole="danger"
                          onClick={() => {
                            // A browser confirm is suppressible — after a few
                            // dismissals Chrome offers to stop the page
                            // showing them, and from then on this button
                            // deletes the whole shipment on one click. The
                            // confirmation is in the page instead, where
                            // nothing can turn it off.
                            if (confirmClear) {
                              clearItems({
                                shipmentId,
                                expectedCount: totalItems,
                              });
                              setConfirmClear(false);
                              return;
                            }

                            setConfirmClear(true);
                          }}
                          disabled={isClearingItems}
                        >
                          <ButtonContent
                            iconLeft={isClearingItems ? IconLoader2 : IconTrash}
                          >
                            {isClearingItems
                              ? 'Removing...'
                              : confirmClear
                                ? `Delete all ${totalItems}? Tap again`
                                : 'Clear all'}
                          </ButtonContent>
                        </Button>
                        {confirmClear && !isClearingItems && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmClear(false)}
                          >
                            Cancel
                          </Button>
                        )}
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncToZoho({ shipmentId })}
                        disabled={isSyncingToZoho || !items.some((i) => i.lwin) || !allHsSet}
                        title={!allHsSet ? 'All items must have HS codes before syncing' : undefined}
                      >
                        <ButtonContent iconLeft={isSyncingToZoho ? IconLoader2 : IconCloud}>
                          {isSyncingToZoho ? 'Syncing...' : 'Sync to Zoho'}
                        </ButtonContent>
                      </Button>
                      <Button size="sm" onClick={() => setIsAddingItem(true)}>
                        <ButtonContent iconLeft={IconPlus}>Add Item</ButtonContent>
                      </Button>
                    </div>
                  </div>

                  {/* Add Item Form */}
                  {isAddingItem && (
                    <div className="mb-6 rounded-lg border border-border-brand/30 bg-fill-brand/5 p-4">
                      <Typography variant="bodySm" className="mb-3 font-medium">
                        New Item
                      </Typography>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                          <label className="text-xs font-medium text-text-muted">Product Name</label>
                          <Input
                            placeholder="e.g. Chateau Margaux 2018"
                            value={newItem.productName}
                            onChange={(e) => setNewItem((p) => ({ ...p, productName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-muted">Cases</label>
                          <Input
                            type="number"
                            placeholder="20"
                            value={newItem.cases}
                            onChange={(e) => setNewItem((p) => ({ ...p, cases: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-muted">Bottles/Case</label>
                          <Input
                            type="number"
                            value={newItem.bottlesPerCase}
                            onChange={(e) => setNewItem((p) => ({ ...p, bottlesPerCase: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-muted">Bottle Size</label>
                          <select
                            value={newItem.bottleSizeMl}
                            onChange={(e) => setNewItem((p) => ({ ...p, bottleSizeMl: e.target.value }))}
                            className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          >
                            <option value="375">375ml (Half)</option>
                            <option value="500">500ml</option>
                            <option value="700">700ml</option>
                            <option value="750">750ml (Standard)</option>
                            <option value="1000">1000ml (1L)</option>
                            <option value="1500">1500ml (Magnum)</option>
                            <option value="3000">3000ml (Jeroboam)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-muted">Cost/Bottle (USD)</label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="12.00"
                            value={newItem.productCostPerBottle}
                            onChange={(e) => setNewItem((p) => ({ ...p, productCostPerBottle: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" onClick={handleAddItem} disabled={isAddingItemPending}>
                          <ButtonContent iconLeft={isAddingItemPending ? IconLoader2 : IconPlus}>
                            {isAddingItemPending ? 'Adding...' : 'Add Item'}
                          </ButtonContent>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setIsAddingItem(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Items Table */}
                  {!items.length ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Icon icon={IconPackage} size="lg" className="mb-3 text-text-muted" />
                      <Typography variant="bodySm" colorRole="muted">
                        No items added yet
                      </Typography>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => setIsAddingItem(true)}
                      >
                        <ButtonContent iconLeft={IconPlus}>Add First Item</ButtonContent>
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-6">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border-muted text-left text-xs uppercase tracking-wide text-text-muted">
                            <th className="pb-3 pl-6 pr-4">Product</th>
                            <th className="pb-3 pr-4">LWIN / SKU</th>
                            <th className="pb-3 pr-4">HS</th>
                            <th className="pb-3 pr-4 text-center">Pack</th>
                            <th className="pb-3 pr-4 text-right">Cases</th>
                            <th className="pb-3 pr-4 text-right">Bottles</th>
                            <th className="pb-3 pr-4 text-right">Cost/Btl</th>
                            <th className="pb-3 pr-4 text-right">Landed/Btl</th>
                            <th className="pb-3 pr-4 text-right">Margin</th>
                            <th className="pb-3 pr-6"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => {
                            // Skip vintage in metadata if already in product name
                            const vintageStr = item.vintage ? String(item.vintage) : null;
                            const showVintage = vintageStr && !item.productName.includes(vintageStr);
                            const metadata = [item.producer, showVintage ? vintageStr : null, item.region]
                              .filter(Boolean)
                              .join(' \u00b7 ');

                            return (
                              <tr
                                key={item.id}
                                className="border-b border-border-muted/50 transition-colors hover:bg-fill-secondary/50"
                              >
                                {/* Product — click to edit */}
                                <td className="py-3 pl-6 pr-4">
                                  <button
                                    onClick={() => openSheet(item)}
                                    className="text-left group"
                                  >
                                    <Typography variant="bodySm" className="font-medium leading-snug group-hover:text-text-brand transition-colors">
                                      {item.productName}
                                    </Typography>
                                    {metadata && (
                                      <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                                        {metadata}
                                      </Typography>
                                    )}
                                    {item.overrideOwnerName && (
                                      <div className="mt-1">
                                        <OwnerBadge ownerName={item.overrideOwnerName} size="sm" />
                                      </div>
                                    )}
                                  </button>
                                </td>

                                {/* LWIN / SKU */}
                                <td className="py-3 pr-4">
                                  {/* A partial or junk code must not carry the
                                      tick: it is read as a wine identified,
                                      and the line is then received and picked
                                      against nothing. */}
                                  {isCompleteLwin(item.lwin) ? (
                                    <button
                                      onClick={() => openSheet(item)}
                                      className="group flex items-center gap-1.5"
                                      title={`LWIN: ${item.lwin} — Click to change`}
                                    >
                                      <Badge colorRole="success" size="xs">
                                        <Icon icon={IconCheck} size="sm" className="mr-0.5" />
                                        <span className="font-mono">{item.lwin}</span>
                                      </Badge>
                                      <Icon
                                        icon={IconPencil}
                                        size="sm"
                                        className="text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                                      />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openSheet(item)}
                                      className="group flex items-center gap-1.5"
                                    >
                                      <Badge colorRole="warning" size="xs">
                                        Not mapped
                                      </Badge>
                                      <span className="flex items-center gap-0.5 text-xs text-text-brand opacity-0 transition-opacity group-hover:opacity-100">
                                        <Icon icon={IconSearch} size="sm" />
                                        Map
                                      </span>
                                    </button>
                                  )}
                                </td>

                                {/* HS Code */}
                                <td className="py-3 pr-4">
                                  {item.hsCode ? (
                                    <button
                                      onClick={() => openSheet(item)}
                                      className="text-xs font-medium text-green-700 hover:text-text-brand transition-colors"
                                      title={item.hsCode}
                                    >
                                      {hsLabel(item.hsCode) ?? item.hsCode}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openSheet(item)}
                                      className="text-xs font-medium text-red-500 hover:text-text-brand transition-colors"
                                    >
                                      Missing
                                    </button>
                                  )}
                                </td>

                                {/* Pack */}
                                <td className="py-3 pr-4 text-center">
                                  {editingPackItemId === item.id ? (
                                    <div className="flex items-center gap-1 justify-center">
                                      <input
                                        type="number"
                                        value={editPack.bottlesPerCase}
                                        onChange={(e) =>
                                          setEditPack((p) => ({ ...p, bottlesPerCase: e.target.value }))
                                        }
                                        className="w-12 rounded border border-border-primary bg-fill-primary px-1.5 py-1 text-center text-xs"
                                        min={1}
                                      />
                                      <span className="text-xs text-text-muted">&times;</span>
                                      <input
                                        type="number"
                                        value={editPack.bottleSizeMl}
                                        onChange={(e) =>
                                          setEditPack((p) => ({ ...p, bottleSizeMl: e.target.value }))
                                        }
                                        className="w-16 rounded border border-border-primary bg-fill-primary px-1.5 py-1 text-center text-xs"
                                        min={1}
                                      />
                                      <span className="text-xs text-text-muted">ml</span>
                                      <button
                                        onClick={() => handleSavePack(item.id)}
                                        className="rounded p-0.5 text-green-600 hover:bg-green-50"
                                        disabled={isUpdatingItem}
                                      >
                                        <Icon icon={IconCheck} size="sm" />
                                      </button>
                                      <button
                                        onClick={() => setEditingPackItemId(null)}
                                        className="rounded p-0.5 text-text-muted hover:bg-fill-secondary"
                                      >
                                        <Icon icon={IconX} size="sm" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingPackItemId(item.id);
                                        setEditPack({
                                          bottlesPerCase: String(item.bottlesPerCase || 12),
                                          bottleSizeMl: String(item.bottleSizeMl || 750),
                                        });
                                      }}
                                      className="inline-flex items-center rounded-md border border-border-muted bg-fill-secondary/50 px-2 py-0.5 text-xs font-medium transition-colors hover:border-border-brand hover:bg-fill-brand/5"
                                      title="Click to edit pack size"
                                    >
                                      {item.bottlesPerCase || 12} &times; {(item.bottleSizeMl || 750) / 10}cl
                                    </button>
                                  )}
                                </td>

                                {/* Cases */}
                                <td className="py-3 pr-4 text-right tabular-nums">
                                  <button onClick={() => openSheet(item)} className="hover:text-text-brand transition-colors">
                                    {item.cases}
                                  </button>
                                </td>

                                {/* Bottles */}
                                <td className="py-3 pr-4 text-right tabular-nums">
                                  {item.totalBottles ?? '-'}
                                </td>

                                {/* Cost/Btl */}
                                <td className="py-3 pr-4 text-right tabular-nums">
                                  <button onClick={() => openSheet(item)} className="hover:text-text-brand transition-colors">
                                    {item.productCostPerBottle
                                      ? `$${item.productCostPerBottle.toFixed(2)}`
                                      : '-'}
                                  </button>
                                </td>

                                {/* Landed/Btl */}
                                <td className="py-3 pr-4 text-right tabular-nums">
                                  {item.landedCostPerBottle
                                    ? `$${item.landedCostPerBottle.toFixed(2)}`
                                    : '-'}
                                </td>

                                {/* Margin */}
                                <td className="py-3 pr-4 text-right tabular-nums">
                                  {item.marginPercent !== null && item.marginPercent !== undefined ? (
                                    <span
                                      className={
                                        item.marginPercent >= 0 ? 'text-green-600' : 'text-red-600'
                                      }
                                    >
                                      {item.marginPercent.toFixed(0)}%
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>

                                {/* Delete */}
                                <td className="py-3 pr-6">
                                  <button
                                    onClick={() => removeItem({ itemId: item.id })}
                                    className="rounded p-1 text-text-muted transition-colors hover:bg-fill-danger/10 hover:text-text-danger"
                                  >
                                    <Icon icon={IconTrash} size="sm" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {/* Summary Footer */}
                        <tfoot>
                          <tr className="text-xs font-medium text-text-muted">
                            <td className="pb-1 pl-6 pr-4 pt-3">
                              {totalItems} item{totalItems !== 1 ? 's' : ''}
                            </td>
                            <td className="pb-1 pr-4 pt-3" colSpan={2}></td>
                            <td className="pb-1 pr-4 pt-3"></td>
                            <td className="pb-1 pr-4 pt-3 text-right tabular-nums font-semibold text-text-primary">
                              {totalCases}
                            </td>
                            <td className="pb-1 pr-4 pt-3 text-right tabular-nums font-semibold text-text-primary">
                              {totalBottles}
                            </td>
                            <td className="pb-1 pr-4 pt-3 text-right tabular-nums font-semibold text-text-primary">
                              {totalGoodsValue > 0
                                ? `$${totalGoodsValue.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : ''}
                            </td>
                            <td className="pb-1 pr-4 pt-3" colSpan={3}></td>
                          </tr>
                          {casesDiffer || bottlesDiffer || pricedItems < totalItems ? (
                            <tr className="text-xs text-text-warning">
                              <td className="pb-3 pl-6 pr-4" colSpan={10}>
                                {[
                                  casesDiffer
                                    ? `header says ${shipment.totalCases} cases, lines total ${totalCases}`
                                    : null,
                                  bottlesDiffer
                                    ? `header says ${shipment.totalBottles} bottles, lines total ${totalBottles}`
                                    : null,
                                  pricedItems < totalItems
                                    ? `${totalItems - pricedItems} line${totalItems - pricedItems === 1 ? '' : 's'} with no price, so the value above is understated`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </td>
                            </tr>
                          ) : null}
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Item Editor Sheet */}
              <Sheet open={!!lwinSheetItem} onOpenChange={(open) => { if (!open) setSheetItemId(null); }}>
                <SheetContent side="right" className="sm:max-w-lg overflow-y-auto p-6">
                  <SheetTitle className="mb-1">Edit Item</SheetTitle>
                  <SheetDescription className="mb-4 text-sm text-text-muted">
                    Update product details and LWIN mapping
                  </SheetDescription>

                  {lwinSheetItem && (
                    <div className="space-y-5">
                      {/* Editable Fields */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-text-muted">Product Name</label>
                          <Input
                            value={sheetForm.productName}
                            onChange={(e) => setSheetForm((f) => ({ ...f, productName: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Producer</label>
                            <Input
                              value={sheetForm.producer}
                              onChange={(e) => setSheetForm((f) => ({ ...f, producer: e.target.value }))}
                              placeholder="e.g. Chateau Margaux"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Vintage</label>
                            <Input
                              type="number"
                              value={sheetForm.vintage}
                              onChange={(e) => setSheetForm((f) => ({ ...f, vintage: e.target.value }))}
                              placeholder="NV"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Region</label>
                            <Input
                              value={sheetForm.region}
                              onChange={(e) => setSheetForm((f) => ({ ...f, region: e.target.value }))}
                              placeholder="e.g. Bordeaux"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Country</label>
                            <Input
                              value={sheetForm.countryOfOrigin}
                              onChange={(e) => setSheetForm((f) => ({ ...f, countryOfOrigin: e.target.value }))}
                              placeholder="e.g. France"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-text-muted">HS Code</label>
                          <select
                            value={sheetForm.hsCode}
                            onChange={(e) => setSheetForm((f) => ({ ...f, hsCode: e.target.value }))}
                            className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          >
                            <option value="">Not set</option>
                            {hsOptionsFor(sheetForm.hsCode).map((hs) => (
                              <option key={hs.value} value={hs.value}>
                                {hs.value} — {hs.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Cases</label>
                            <Input
                              type="number"
                              value={sheetForm.cases}
                              onChange={(e) => setSheetForm((f) => ({ ...f, cases: e.target.value }))}
                              min={1}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Btl/Case</label>
                            <Input
                              type="number"
                              value={sheetForm.bottlesPerCase}
                              onChange={(e) => setSheetForm((f) => ({ ...f, bottlesPerCase: e.target.value }))}
                              min={1}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-text-muted">Bottle Size</label>
                            <select
                              value={sheetForm.bottleSizeMl}
                              onChange={(e) => setSheetForm((f) => ({ ...f, bottleSizeMl: e.target.value }))}
                              className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            >
                              <option value="375">375ml</option>
                              <option value="500">500ml</option>
                              <option value="700">700ml</option>
                              <option value="750">750ml</option>
                              <option value="1000">1L</option>
                              <option value="1500">1.5L</option>
                              <option value="3000">3L</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-text-muted">Cost/Bottle (USD)</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={sheetForm.productCostPerBottle}
                            onChange={(e) => setSheetForm((f) => ({ ...f, productCostPerBottle: e.target.value }))}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-text-muted">Owner (override)</label>
                          <select
                            value={sheetForm.overrideOwnerId ?? ''}
                            onChange={(e) => {
                              const selectedId = e.target.value || null;
                              const selectedPartner = partnersList?.find((p) => p.id === selectedId);
                              setSheetForm((f) => ({
                                ...f,
                                overrideOwnerId: selectedId,
                                overrideOwnerName: selectedPartner?.name ?? null,
                              }));
                            }}
                            className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          >
                            <option value="">
                              {shipment.partner?.businessName
                                ? `${shipment.partner.businessName} (shipment default)`
                                : 'Inherit from shipment'}
                            </option>
                            {partnersList?.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-text-muted">
                            Availability
                          </label>
                          <select
                            value={
                              sheetForm.notForSale === null
                                ? ''
                                : sheetForm.notForSale
                                  ? 'held'
                                  : 'sale'
                            }
                            onChange={(event) =>
                              setSheetForm((f) => ({
                                ...f,
                                notForSale:
                                  event.target.value === ''
                                    ? null
                                    : event.target.value === 'held',
                              }))
                            }
                            className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          >
                            <option value="">
                              {shipment.notForSale
                                ? 'Held for owner (shipment default)'
                                : 'For sale (shipment default)'}
                            </option>
                            <option value="sale">For sale</option>
                            <option value="held">Held for owner — never listed</option>
                          </select>
                        </div>
                        <Button className="w-full" onClick={handleSaveSheet} disabled={isUpdatingItem}>
                          <ButtonContent iconLeft={isUpdatingItem ? IconLoader2 : IconCheck}>
                            {isUpdatingItem ? 'Saving...' : 'Save Changes'}
                          </ButtonContent>
                        </Button>
                      </div>

                      {/* LWIN Mapping */}
                      <div className="border-t border-border-muted pt-4">
                        <Typography variant="bodySm" className="font-medium mb-3">
                          LWIN Mapping
                        </Typography>
                        {(sheetForm.lwin || lwinSheetItem.lwin) && (
                          <div className="mb-3 rounded-lg bg-green-50 p-2 dark:bg-green-900/20">
                            <Typography variant="bodyXs" className="font-mono text-green-700 dark:text-green-400">
                              {sheetForm.lwin && sheetForm.lwin !== lwinSheetItem.lwin
                                ? `New: ${sheetForm.lwin}`
                                : `Current: ${lwinSheetItem.lwin}`}
                            </Typography>
                          </div>
                        )}
                        <LwinLookup
                          // Remounted per line: the vintage, pack and bottle
                          // size are seeded from props on first render only,
                          // so without this the panel keeps the previous
                          // line's pack while showing the new line's name.
                          key={lwinSheetItem.id}
                          productName={lwinSheetItem.productName}
                          defaultCaseSize={lwinSheetItem.bottlesPerCase || 12}
                          defaultBottleSize={lwinSheetItem.bottleSizeMl || 750}
                          defaultVintage={lwinSheetItem.vintage ?? undefined}
                          onSelect={(result) => handleLwinSelect(lwinSheetItem.id, result)}
                          disabled={isUpdatingItem}
                        />
                        {lwinSheetItem.supplierSku && !lwinSheetItem.lwin && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 w-full"
                            onClick={() => handleUseSupplierSku(lwinSheetItem.id, lwinSheetItem.supplierSku!)}
                            disabled={isUpdatingItem}
                          >
                            Use SKU: {lwinSheetItem.supplierSku}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
            </div>
          );
        })()}

        {activeTab === 'documents' && (
          <Card>
            <CardContent className="p-6">
              <Typography variant="headingSm" className="mb-4">
                Documents
              </Typography>
              {(shipment.groupDocuments?.length ?? 0) > 0 && (
                <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                  <Typography variant="labelSm" className="mb-2 block">
                    Shared from consolidation group
                  </Typography>
                  <div className="divide-y divide-blue-100">
                    {shipment.groupDocuments.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-3 py-1.5">
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 truncate text-sm text-text-brand hover:underline"
                        >
                          &#x1F4C4; {d.fileName}
                        </a>
                        <Typography variant="bodyXs" colorRole="muted" className="capitalize">
                          {d.documentType.replace(/_/g, ' ')}
                        </Typography>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <LogisticsDocumentUpload
                shipmentId={shipmentId}
                documents={shipment.documents ?? []}
                onUploadComplete={() => void refetch()}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'costs' && (
          <div className="space-y-6">
            {/* Vendor Bills */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Vendor Bills
                </Typography>
                <LogisticsDocumentUpload
                  shipmentId={shipmentId}
                  documents={(shipment.documents ?? []).filter((d) =>
                    ['shipping_invoice', 'gac_invoice', 'commercial_invoice', 'customs_declaration', 'delivery_note', 'other'].includes(d.documentType),
                  )}
                  onUploadComplete={() => void refetch()}
                />
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="headingSm">Cost Breakdown</Typography>
                  {shipment.groupId ? (
                    <Link
                      href={`/platform/admin/logistics/groups/${shipment.groupId}`}
                      className="text-sm font-medium text-text-brand hover:underline"
                    >
                      Managed by group →
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => extractInvoice({ shipmentId })}
                        disabled={isExtracting || !(shipment.documents ?? []).length}
                        title="Read the uploaded invoice and fill the cost fields automatically"
                      >
                        <ButtonContent iconLeft={isExtracting ? IconLoader2 : IconWand}>
                          {isExtracting ? 'Reading…' : 'Extract from invoice'}
                        </ButtonContent>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => calculateLandedCost({ shipmentId })}
                        disabled={isCalculating || !shipment.items?.length}
                      >
                        <ButtonContent iconLeft={isCalculating ? IconLoader2 : IconCalculator}>
                          {isCalculating ? 'Calculating...' : 'Calculate Landed Cost'}
                        </ButtonContent>
                      </Button>
                    </div>
                  )}
                </div>
                {shipment.groupId && (
                  <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
                    <Typography variant="bodyXs" colorRole="muted">
                      This shipment is in a consolidation group — its freight &amp; logistics are
                      allocated at the group level so shared costs aren&apos;t counted more than
                      once. Don&apos;t calculate here or you&apos;ll overwrite the group&apos;s
                      allocation with this shipment&apos;s own (empty) costs.
                    </Typography>
                  </div>
                )}
                {shipment.groupId ? (
                  (() => {
                    const gItems = shipment.items ?? [];
                    const bof = (i: {
                      totalBottles: number | null;
                      cases: number;
                      bottlesPerCase: number | null;
                    }) => i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12);
                    const gGoods = gItems.reduce(
                      (s, i) => s + bof(i) * (i.productCostPerBottle ?? 0),
                      0,
                    );
                    const gFreight = gItems.reduce((s, i) => s + (i.freightAllocated ?? 0), 0);
                    const gLanded = gItems.reduce((s, i) => s + (i.landedCostTotal ?? 0), 0);
                    const gBottles = gItems.reduce((s, i) => s + bof(i), 0);
                    const g75cl = gItems.reduce(
                      (s, i) => s + bof(i) * ((i.bottleSizeMl ?? 750) / 750),
                      0,
                    );
                    return (
                      <>
                        <dl className="space-y-2">
                          <div className="flex items-center justify-between">
                            <dt className="text-text-muted">Goods (product) cost</dt>
                            <dd className="tabular-nums">
                              {gGoods ? formatPrice(gGoods, 'USD') : '-'}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="text-text-muted">
                              Freight &amp; logistics (allocated from group)
                            </dt>
                            <dd className="tabular-nums">
                              {gFreight ? formatPrice(gFreight, 'USD') : '-'}
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-6 border-t border-border-muted pt-4">
                          <div className="flex items-center justify-between">
                            <Typography variant="headingSm">Total Landed Cost</Typography>
                            <Typography variant="headingMd">
                              {gLanded ? formatPrice(gLanded, 'USD') : '-'}
                            </Typography>
                          </div>
                          {gBottles ? (
                            <div className="mt-2 flex items-center justify-between">
                              <Typography variant="bodySm" colorRole="muted">
                                Freight / 75cl btl ({gBottles} bottles)
                              </Typography>
                              <Typography variant="headingSm" className="text-text-brand">
                                {formatPrice(g75cl ? gFreight / g75cl : 0, 'USD')}
                              </Typography>
                            </div>
                          ) : null}
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <>
                {/* Cost ledger — line-by-line invoice charges, grouped by document */}
                <div className="mb-6">
                  <Typography variant="labelSm" className="mb-2 block">
                    Cost ledger
                  </Typography>
                  {(shipment.costLines?.length ?? 0) > 0 && (
                    <div className="mb-3 space-y-3">
                      {(() => {
                        const lines = shipment.costLines ?? [];
                        const byDoc = new Map<string, typeof lines>();
                        for (const l of lines) {
                          const key = l.invoiceRef || l.vendor || l.sourceDocument || 'Manual entry';
                          const arr = byDoc.get(key) ?? [];
                          arr.push(l);
                          byDoc.set(key, arr);
                        }
                        return Array.from(byDoc.entries()).map(([doc, dLines], gi) => {
                          const subtotal = dLines.reduce((s, l) => s + l.amountUsd, 0);
                          const cur = dLines[0]?.currency ?? 'USD';
                          const fx = dLines[0]?.fxToUsd;
                          const vendor = dLines[0]?.vendor;
                          const tint = LEDGER_TINTS[gi % LEDGER_TINTS.length] ?? LEDGER_TINTS[0];
                          return (
                            <div
                              key={doc}
                              className={`overflow-hidden rounded-lg border border-l-4 ${tint.card} ${tint.accent}`}
                            >
                              <div className="flex items-center justify-between gap-3 px-3 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className={`mt-1 h-2 w-2 shrink-0 self-start rounded-full ${tint.dot}`}
                                  />
                                  <div className="min-w-0">
                                    <Typography variant="labelSm" className="truncate">
                                      {vendor || doc}
                                    </Typography>
                                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                                      <span className="truncate font-mono">{doc}</span>
                                      {cur !== 'USD' && (
                                        <span className="shrink-0">
                                          · {cur} @ {fx}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <Typography variant="labelSm" className="tabular-nums">
                                    {formatPrice(subtotal, 'USD')}
                                  </Typography>
                                  <Typography variant="bodyXs" colorRole="muted">
                                    {dLines.length} {dLines.length === 1 ? 'line' : 'lines'}
                                  </Typography>
                                </div>
                              </div>
                              <div className="divide-y divide-border-muted/60 border-t border-border-muted/50 bg-background-primary/40 px-3">
                                {dLines.map((l) => (
                                  <div
                                    key={l.id}
                                    className="flex items-center justify-between gap-3 py-1.5"
                                  >
                                    <div className="min-w-0">
                                      <Typography variant="bodySm" className="truncate">
                                        <span className="capitalize">{catLabel(l.category)}</span>
                                        {l.description ? ` · ${l.description}` : ''}
                                      </Typography>
                                      <Typography variant="bodyXs" colorRole="muted">
                                        {l.currency} {l.amount.toLocaleString()}
                                        {l.currency !== 'USD' ? ` @ ${l.fxToUsd}` : ''}
                                      </Typography>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Typography variant="labelSm">
                                        {formatPrice(l.amountUsd, 'USD')}
                                      </Typography>
                                      <button
                                        onClick={() => delCostLine({ id: l.id })}
                                        className="text-text-muted hover:text-red-500"
                                      >
                                        <IconTrash className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                  <div className="flex flex-wrap items-end gap-2 border-t border-border-muted pt-3">
                    <select
                      value={newLine.category}
                      onChange={(e) =>
                        setNewLine((l) => ({ ...l, category: e.target.value as ShipCostCategory }))
                      }
                      className={`${ledgerSelectCls} capitalize`}
                    >
                      {SHIP_COST_CATEGORIES.map((c) => (
                        <option key={c} value={c} className="capitalize">
                          {catLabel(c)}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Description"
                      value={newLine.description}
                      onChange={(e) => setNewLine((l) => ({ ...l, description: e.target.value }))}
                      className="min-w-[140px] flex-1"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={newLine.amount}
                      onChange={(e) => setNewLine((l) => ({ ...l, amount: e.target.value }))}
                      className={`${ledgerSelectCls} w-24 text-right`}
                    />
                    <select
                      value={newLine.currency}
                      onChange={(e) => setNewLine((l) => ({ ...l, currency: e.target.value }))}
                      className={ledgerSelectCls}
                    >
                      {['USD', 'GBP', 'EUR', 'AED', 'DKK'].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="FX→USD"
                      value={newLine.fxToUsd}
                      onChange={(e) => setNewLine((l) => ({ ...l, fxToUsd: e.target.value }))}
                      title="FX rate to USD"
                      className={`${ledgerSelectCls} w-20 text-right`}
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        const amt = Number(newLine.amount);
                        if (!amt) return;
                        addCostLine({
                          shipmentId,
                          category: newLine.category,
                          description: newLine.description.trim() || null,
                          amount: amt,
                          currency: newLine.currency,
                          fxToUsd: Number(newLine.fxToUsd) || 1,
                        });
                      }}
                      disabled={!newLine.amount || isAddingLine}
                    >
                      <ButtonContent iconLeft={isAddingLine ? IconLoader2 : IconPlus}>Add</ButtonContent>
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    [
                      { label: 'Freight', field: 'freightCostUsd' },
                      { label: 'Insurance', field: 'insuranceCostUsd' },
                      { label: 'Origin Handling', field: 'originHandlingUsd' },
                      { label: 'Destination Handling', field: 'destinationHandlingUsd' },
                    ],
                    [
                      { label: 'Customs Clearance', field: 'customsClearanceUsd' },
                      { label: 'Gov Fees', field: 'govFeesUsd' },
                      { label: 'Delivery', field: 'deliveryCostUsd' },
                      { label: 'Other', field: 'otherCostsUsd' },
                    ],
                  ].map((group, gi) => (
                    <dl key={gi} className="space-y-2">
                      {group.map(({ label, field }) => {
                        const value = (shipment as Record<string, unknown>)[field] as number | null;

                        return (
                          <div key={field} className="flex justify-between items-center">
                            <dt className="text-text-muted">{label}</dt>
                            <dd>
                              {editingCostField === field ? (
                                <form
                                  className="flex items-center gap-1"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    const parsed = parseFloat(editedCostValue);
                                    const val = isNaN(parsed) ? 0 : parsed;
                                    if (val !== (value ?? 0)) {
                                      updateShipment({ id: shipmentId, [field]: val });
                                    }
                                    setEditingCostField(null);
                                    setEditedCostValue('');
                                  }}
                                >
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">$</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editedCostValue}
                                      onChange={(e) => setEditedCostValue(e.target.value)}
                                      className="h-7 w-28 pl-5 text-right font-mono text-sm"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                          setEditingCostField(null);
                                          setEditedCostValue('');
                                        }
                                      }}
                                    />
                                  </div>
                                  <Button type="submit" variant="ghost" size="sm" disabled={isUpdatingShipment}>
                                    <Icon icon={IconCheck} size="sm" />
                                  </Button>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  className="cursor-pointer tabular-nums hover:text-text-brand transition-colors"
                                  onClick={() => {
                                    setEditingCostField(field);
                                    setEditedCostValue(value ? String(value) : '');
                                  }}
                                >
                                  {value ? formatPrice(value, 'USD') : '-'}
                                </button>
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  ))}
                </div>
                {/* Full breakdown — goods vs logistics, per 75cl / case / kg */}
                {(() => {
                  const sItems = shipment.items ?? [];
                  const bof = (i: {
                    totalBottles: number | null;
                    cases: number;
                    bottlesPerCase: number | null;
                  }) => i.totalBottles ?? i.cases * (i.bottlesPerCase ?? 12);
                  const goods = sItems.reduce((s, i) => s + bof(i) * (i.productCostPerBottle ?? 0), 0);
                  const logistics =
                    (shipment.freightCostUsd ?? 0) +
                    (shipment.insuranceCostUsd ?? 0) +
                    (shipment.originHandlingUsd ?? 0) +
                    (shipment.destinationHandlingUsd ?? 0) +
                    (shipment.customsClearanceUsd ?? 0) +
                    (shipment.govFeesUsd ?? 0) +
                    (shipment.deliveryCostUsd ?? 0) +
                    (shipment.otherCostsUsd ?? 0);
                  const eq75 = sItems.reduce(
                    (s, i) => s + bof(i) * ((i.bottleSizeMl ?? 750) / 750),
                    0,
                  );
                  const cases = sItems.reduce((s, i) => s + (i.cases ?? 0), 0);
                  const kg = shipment.totalWeightKg ?? 0;
                  const tiles = [
                    { v: formatPrice(goods, 'USD'), label: 'Goods (product) cost' },
                    { v: formatPrice(logistics, 'USD'), label: 'Logistics (freight etc.)' },
                    { v: formatPrice(goods + logistics, 'USD'), label: 'Total landed cost' },
                    {
                      v: eq75 && logistics ? formatPrice(logistics / eq75, 'USD') : '—',
                      label: 'Logistics / 75cl btl',
                    },
                    {
                      v: cases && logistics ? formatPrice(logistics / cases, 'USD') : '—',
                      label: 'Logistics / case',
                    },
                    {
                      v: kg && logistics ? `${formatPrice(logistics / kg, 'USD')}/kg` : '—',
                      label: 'Logistics / kg',
                    },
                  ];
                  return (
                    <div className="mt-6 flex flex-row flex-wrap items-center justify-around gap-4 border-t border-border-muted pt-6 text-center">
                      {tiles.map((t) => (
                        <div key={t.label}>
                          <Typography variant="headingSm">{t.v}</Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            {t.label}
                          </Typography>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipmentDetailPage;
