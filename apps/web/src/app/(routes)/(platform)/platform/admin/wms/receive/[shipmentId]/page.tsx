'use client';

import {
  IconAlertCircle,
  IconAlertTriangle,
  IconBarcode,
  IconCheck,
  IconChevronRight,
  IconCloudUpload,
  IconCopy,
  IconEdit,
  IconLoader2,
  IconMapPin,
  IconTool,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface ReceivedItem {
  id: string; // unique ID for this line (shipmentItemId or generated for added items)
  shipmentItemId: string | null; // null for manually added items
  baseItemId: string | null; // reference to original item for added variants
  productName: string;
  producer?: string | null;
  vintage?: number | null;
  lwin?: string | null;
  expectedCases: number;
  receivedCases: number;
  // Pack configuration
  expectedBottlesPerCase: number;
  expectedBottleSizeMl: number;
  receivedBottlesPerCase: number;
  receivedBottleSizeMl: number;
  packChanged: boolean;
  isAddedItem: boolean; // true if this was added manually (different pack variant)
  isChecked: boolean; // true if verified/checked off
  locationId?: string; // per-item location assignment
  expiryDate?: Date;
  notes?: string;
}

/**
 * Item row component for receiving - Mobile optimized for Zebra scanner (6" screen)
 */
interface ItemRowProps {
  item: ReceivedItem;
  shipmentItem: {
    id: string;
    productName: string;
    producer?: string | null;
    vintage?: number | null;
    lwin?: string | null;
    cases: number;
    bottlesPerCase?: number | null;
    bottleSizeMl?: number | null;
  };
  locations: Array<{ id: string; locationCode: string; locationType: string }>;
  isEditingPack: boolean;
  onToggleCheck: () => void;
  onUpdateCases: (cases: number) => void;
  onUpdatePackConfig: (bottlesPerCase: number, bottleSizeMl: number) => void;
  onUpdateLocation: (locationId: string) => void;
  onEditPack: () => void;
  onClosePack: () => void;
  onAddVariant?: () => void;
  onRemove?: () => void;
  isAddedVariant?: boolean;
}

const ItemRow = ({
  item,
  shipmentItem,
  locations,
  isEditingPack,
  onToggleCheck,
  onUpdateCases,
  onUpdatePackConfig,
  onUpdateLocation,
  onEditPack,
  onClosePack,
  onAddVariant,
  onRemove,
  isAddedVariant = false,
}: ItemRowProps) => {
  const variance = item.receivedCases - item.expectedCases;

  return (
    <div className={`flex flex-col gap-3 ${item.isChecked ? 'opacity-60' : ''}`}>
      {/* Top row: Checkbox + Product Name + Badge */}
      <div className="flex items-start gap-3">
        {/* Large touch-friendly checkbox (48px minimum) */}
        <button
          onClick={onToggleCheck}
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-colors active:scale-95 ${
            item.isChecked
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-border-primary bg-fill-secondary hover:border-border-brand'
          }`}
        >
          {item.isChecked && <IconCheck className="h-6 w-6" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <Typography variant="headingSm" className={`leading-tight ${item.isChecked ? 'line-through' : ''}`}>
              {item.productName}
            </Typography>
            {isAddedVariant && (
              <span className="flex-shrink-0 rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                Added
              </span>
            )}
          </div>
          <Typography variant="bodySm" colorRole="muted" className="mt-0.5">
            {item.producer && `${item.producer}`}
            {item.producer && item.vintage && ' • '}
            {item.vintage && `${item.vintage}`}
          </Typography>
          {/* Pack Config button - larger touch target */}
          <button
            className={`mt-2 flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors active:scale-95 ${
              item.packChanged
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-fill-secondary text-text-muted hover:bg-fill-tertiary'
            }`}
            onClick={onEditPack}
          >
            {item.receivedBottlesPerCase}×{item.receivedBottleSizeMl}ml
            <Icon icon={IconEdit} size="sm" />
          </button>
        </div>
      </div>

      {/* Pack editor - full width on mobile */}
      {isEditingPack && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-fill-secondary p-3">
          <select
            className="h-12 flex-1 rounded-lg border border-border-primary bg-fill-primary px-3 text-base"
            value={item.receivedBottlesPerCase}
            onChange={(e) => onUpdatePackConfig(parseInt(e.target.value), item.receivedBottleSizeMl)}
          >
            <option value={1}>1 bottle</option>
            <option value={3}>3 bottles</option>
            <option value={6}>6 bottles</option>
            <option value={12}>12 bottles</option>
            <option value={24}>24 bottles</option>
          </select>
          <span className="text-lg font-medium">×</span>
          <select
            className="h-12 flex-1 rounded-lg border border-border-primary bg-fill-primary px-3 text-base"
            value={item.receivedBottleSizeMl}
            onChange={(e) => onUpdatePackConfig(item.receivedBottlesPerCase, parseInt(e.target.value))}
          >
            <option value={375}>375ml</option>
            <option value={500}>500ml</option>
            <option value={750}>750ml</option>
            <option value={1500}>1.5L</option>
            <option value={3000}>3L</option>
          </select>
          <Button variant="primary" size="lg" className="h-12 px-4" onClick={onClosePack}>
            <Icon icon={IconCheck} size="md" />
          </Button>
        </div>
      )}

      {/* LWIN - hidden on very small screens, shown on tablets+ */}
      {item.lwin && (
        <Typography variant="bodyXs" className="hidden font-mono text-text-muted sm:block">
          {item.lwin}
        </Typography>
      )}

      {/* Pack changed indicator */}
      {item.packChanged && !isAddedVariant && (
        <div className="rounded-md bg-amber-50 p-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          Changed from {shipmentItem.bottlesPerCase}×{shipmentItem.bottleSizeMl}ml
        </div>
      )}

      {/* Quantity controls - large touch targets */}
      <div className="flex items-center gap-3">
        {/* Expected (for original items) */}
        {!isAddedVariant && (
          <div className="min-w-16 text-center">
            <Typography variant="bodyXs" colorRole="muted">
              Expected
            </Typography>
            <Typography variant="headingSm" className="text-blue-600">
              {item.expectedCases}
            </Typography>
          </div>
        )}

        {/* Quantity stepper - 48px touch targets */}
        <div className="flex flex-1 items-center justify-center gap-2">
          <button
            onClick={() => onUpdateCases(item.receivedCases - 1)}
            className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-border-primary bg-fill-secondary text-xl font-bold transition-colors hover:bg-fill-tertiary active:scale-95 active:bg-fill-tertiary"
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            className="h-14 w-20 rounded-lg border-2 border-border-primary bg-fill-primary text-center text-xl font-bold focus:border-border-brand focus:outline-none"
            value={item.receivedCases}
            onChange={(e) => onUpdateCases(parseInt(e.target.value) || 0)}
            min={0}
          />
          <button
            onClick={() => onUpdateCases(item.receivedCases + 1)}
            className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-border-primary bg-fill-secondary text-xl font-bold transition-colors hover:bg-fill-tertiary active:scale-95 active:bg-fill-tertiary"
          >
            +
          </button>
        </div>

        {/* Variance indicator */}
        {!isAddedVariant && variance !== 0 && (
          <div
            className={`min-w-14 rounded-lg px-3 py-2 text-center text-sm font-bold ${
              variance > 0
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}
          >
            {variance > 0 ? '+' : ''}
            {variance}
          </div>
        )}
      </div>

      {/* Location selector - per item */}
      <div className="flex items-center gap-2">
        <Icon icon={IconMapPin} size="sm" colorRole="muted" />
        <select
          className={`h-12 flex-1 rounded-lg border-2 bg-fill-primary px-3 text-base font-medium focus:border-border-brand focus:outline-none ${
            item.locationId ? 'border-emerald-500 text-emerald-700' : 'border-border-primary'
          }`}
          value={item.locationId || ''}
          onChange={(e) => onUpdateLocation(e.target.value)}
        >
          <option value="">Select location...</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.locationCode}
            </option>
          ))}
        </select>
      </div>

      {/* Action buttons row */}
      <div className="flex gap-2">
        {/* Add variant button (only for original items) */}
        {!isAddedVariant && onAddVariant && (
          <Button
            variant="outline"
            size="lg"
            className="h-12 flex-1"
            onClick={onAddVariant}
          >
            <ButtonContent iconLeft={IconCopy}>Add Pack Size</ButtonContent>
          </Button>
        )}
        {/* Remove button (only for added items) */}
        {isAddedVariant && onRemove && (
          <Button
            variant="outline"
            size="lg"
            className="h-12 flex-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            onClick={onRemove}
          >
            <ButtonContent iconLeft={IconTrash}>Remove</ButtonContent>
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * WMS Receive Shipment - enter received quantities
 */
const WMSReceiveShipmentPage = () => {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.shipmentId as string;
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [receivedItems, setReceivedItems] = useState<Map<string, ReceivedItem>>(new Map());
  const [notes, setNotes] = useState('');
  const [receivingLocationId, setReceivingLocationId] = useState<string>('');
  const [editingPackItemId, setEditingPackItemId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Track pending saves to debounce
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get shipment details
  const { data: shipment, isLoading: shipmentLoading } = useQuery({
    ...api.wms.admin.receiving.getShipmentForReceiving.queryOptions({ shipmentId }),
    enabled: !!shipmentId,
  });

  // Get saved draft from database
  const { data: savedDraft, isLoading: draftLoading } = useQuery({
    ...api.wms.admin.receiving.getDraft.queryOptions({ shipmentId }),
    enabled: !!shipmentId,
  });

  // Get locations (to select RECEIVING location)
  const { data: locations } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({}),
  });

  // Find RECEIVING location
  const receivingLocation = locations?.find((l) => l.locationType === 'receiving');

  // Save draft mutation
  const { mutate: saveDraftMutate } = useMutation({
    ...api.wms.admin.receiving.saveDraft.mutationOptions(),
    onSuccess: () => {
      setLastSaved(new Date());
      setIsSaving(false);
    },
    onError: () => {
      setIsSaving(false);
    },
  });

  // Delete draft mutation (used on complete)
  const { mutate: deleteDraftMutate } = useMutation({
    ...api.wms.admin.receiving.deleteDraft.mutationOptions(),
  });

  // Fix shipment data mutation
  const fixDataMutation = useMutation({
    ...api.logistics.admin.fixShipmentItemCases.mutationOptions(),
    onSuccess: () => {
      // Refetch shipment data and reset state
      void queryClient.invalidateQueries();
      setInitialized(false);
    },
  });

  // Save draft to database (debounced)
  const saveDraft = useCallback(() => {
    if (receivedItems.size === 0) return;

    // Cancel any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSaving(true);

    // Debounce: wait 1 second before saving
    saveTimeoutRef.current = setTimeout(() => {
      const items = Array.from(receivedItems.values()).map((item) => ({
        id: item.id,
        shipmentItemId: item.shipmentItemId,
        baseItemId: item.baseItemId,
        productName: item.productName,
        producer: item.producer,
        vintage: item.vintage,
        lwin: item.lwin,
        expectedCases: item.expectedCases,
        receivedCases: item.receivedCases,
        expectedBottlesPerCase: item.expectedBottlesPerCase,
        expectedBottleSizeMl: item.expectedBottleSizeMl,
        receivedBottlesPerCase: item.receivedBottlesPerCase,
        receivedBottleSizeMl: item.receivedBottleSizeMl,
        packChanged: item.packChanged,
        isAddedItem: item.isAddedItem,
        isChecked: item.isChecked,
        locationId: item.locationId,
        expiryDate: item.expiryDate?.toISOString(),
        notes: item.notes,
      }));

      saveDraftMutate({
        shipmentId,
        items,
        notes: notes || undefined,
      });
    }, 1000);
  }, [receivedItems, notes, shipmentId, saveDraftMutate]);

  // Save immediately (no debounce) - for checkbox changes
  const saveImmediately = useCallback(() => {
    if (receivedItems.size === 0) return;

    // Cancel any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSaving(true);

    const items = Array.from(receivedItems.values()).map((item) => ({
      id: item.id,
      shipmentItemId: item.shipmentItemId,
      baseItemId: item.baseItemId,
      productName: item.productName,
      producer: item.producer,
      vintage: item.vintage,
      lwin: item.lwin,
      expectedCases: item.expectedCases,
      receivedCases: item.receivedCases,
      expectedBottlesPerCase: item.expectedBottlesPerCase,
      expectedBottleSizeMl: item.expectedBottleSizeMl,
      receivedBottlesPerCase: item.receivedBottlesPerCase,
      receivedBottleSizeMl: item.receivedBottleSizeMl,
      packChanged: item.packChanged,
      isAddedItem: item.isAddedItem,
      isChecked: item.isChecked,
      locationId: item.locationId,
      expiryDate: item.expiryDate?.toISOString(),
      notes: item.notes,
    }));

    saveDraftMutate({
      shipmentId,
      items,
      notes: notes || undefined,
    });
  }, [receivedItems, notes, shipmentId, saveDraftMutate]);

  // Initialize from saved draft or shipment items
  useEffect(() => {
    if (!shipment?.items || initialized || draftLoading) return;

    // If there's a saved draft, load it
    if (savedDraft?.items) {
      const loadedItems = new Map<string, ReceivedItem>();
      savedDraft.items.forEach((item) => {
        loadedItems.set(item.id, {
          ...item,
          locationId: item.locationId ?? undefined,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
        });
      });
      setReceivedItems(loadedItems);
      setNotes(savedDraft.notes || '');
      if (savedDraft.lastModifiedAt) {
        setLastSaved(new Date(savedDraft.lastModifiedAt));
      }
      setInitialized(true);
      return;
    }

    // Initialize from shipment items (fresh start)
    const initial = new Map<string, ReceivedItem>();
    shipment.items.forEach((item) => {
      initial.set(item.id, {
        id: item.id,
        shipmentItemId: item.id,
        baseItemId: null,
        productName: item.productName,
        producer: item.producer,
        vintage: item.vintage,
        lwin: item.lwin,
        expectedCases: item.cases,
        receivedCases: item.cases,
        expectedBottlesPerCase: item.bottlesPerCase ?? 12,
        expectedBottleSizeMl: item.bottleSizeMl ?? 750,
        receivedBottlesPerCase: item.bottlesPerCase ?? 12,
        receivedBottleSizeMl: item.bottleSizeMl ?? 750,
        packChanged: false,
        isAddedItem: false,
        isChecked: false,
      });
    });
    setReceivedItems(initial);
    setInitialized(true);
  }, [shipment?.items, savedDraft, initialized, draftLoading]);

  // Set receiving location when locations load
  useEffect(() => {
    if (receivingLocation && !receivingLocationId) {
      setReceivingLocationId(receivingLocation.id);
    }
  }, [receivingLocation, receivingLocationId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const updateReceivedCases = (itemId: string, cases: number) => {
    const item = receivedItems.get(itemId);
    if (item) {
      const newMap = new Map(receivedItems.set(itemId, { ...item, receivedCases: Math.max(0, cases) }));
      setReceivedItems(newMap);
      saveDraft(); // Debounced save
    }
  };

  const updatePackConfig = (itemId: string, bottlesPerCase: number, bottleSizeMl: number) => {
    const item = receivedItems.get(itemId);
    if (item) {
      const packChanged =
        bottlesPerCase !== item.expectedBottlesPerCase || bottleSizeMl !== item.expectedBottleSizeMl;
      const newMap = new Map(
        receivedItems.set(itemId, {
          ...item,
          receivedBottlesPerCase: bottlesPerCase,
          receivedBottleSizeMl: bottleSizeMl,
          packChanged,
        }),
      );
      setReceivedItems(newMap);
      saveDraft(); // Debounced save
    }
  };

  const updateItemLocation = (itemId: string, locationId: string) => {
    const item = receivedItems.get(itemId);
    if (item) {
      const newMap = new Map(receivedItems.set(itemId, { ...item, locationId: locationId || undefined }));
      setReceivedItems(newMap);
      saveDraft(); // Debounced save
    }
  };

  const toggleChecked = (itemId: string) => {
    const item = receivedItems.get(itemId);
    if (item) {
      const newMap = new Map(receivedItems.set(itemId, { ...item, isChecked: !item.isChecked }));
      setReceivedItems(newMap);
      // Save immediately when checking off items (no debounce)
      setTimeout(() => saveImmediately(), 0);
    }
  };

  const addPackVariant = (baseItemId: string) => {
    const baseItem = receivedItems.get(baseItemId);
    if (!baseItem) return;

    const newId = `added-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newItem: ReceivedItem = {
      id: newId,
      shipmentItemId: null, // Not a shipment item
      baseItemId, // Reference to original
      productName: baseItem.productName,
      producer: baseItem.producer,
      vintage: baseItem.vintage,
      lwin: baseItem.lwin,
      expectedCases: 0, // No expectation for added items
      receivedCases: 1, // Default to 1
      expectedBottlesPerCase: baseItem.expectedBottlesPerCase,
      expectedBottleSizeMl: baseItem.expectedBottleSizeMl,
      receivedBottlesPerCase: 6, // Default to common variant
      receivedBottleSizeMl: baseItem.expectedBottleSizeMl,
      packChanged: true,
      isAddedItem: true,
      isChecked: false,
    };

    const newMap = new Map(receivedItems.set(newId, newItem));
    setReceivedItems(newMap);
    setEditingPackItemId(newId); // Open pack editor for new item
    saveDraft(); // Debounced save
  };

  const removeAddedItem = (itemId: string) => {
    const item = receivedItems.get(itemId);
    if (item?.isAddedItem) {
      const newMap = new Map(receivedItems);
      newMap.delete(itemId);
      setReceivedItems(newMap);
      saveDraft(); // Debounced save
    }
  };

  const receiveMutation = useMutation({
    ...api.wms.admin.receiving.receiveShipment.mutationOptions(),
    onSuccess: (data) => {
      // Delete draft from database on successful receive
      deleteDraftMutate({ shipmentId });
      void queryClient.invalidateQueries();
      // Redirect to labels page
      router.push(`/platform/admin/wms/labels?shipmentId=${shipmentId}&totalLabels=${data.totalCaseLabels}`);
    },
  });

  const handleReceive = () => {
    const itemsToReceive = Array.from(receivedItems.values()).filter((item) => item.receivedCases > 0);

    if (itemsToReceive.length === 0) {
      alert('No items to receive');
      return;
    }

    // Check all items have a location assigned
    const itemsWithoutLocation = itemsToReceive.filter((item) => !item.locationId);
    if (itemsWithoutLocation.length > 0) {
      alert(`${itemsWithoutLocation.length} item(s) need a location assigned. Please select a location for each item.`);
      return;
    }

    const items = itemsToReceive.map((item) => ({
      shipmentItemId: item.shipmentItemId ?? item.baseItemId ?? '', // Use baseItemId for added items
      expectedCases: item.expectedCases,
      receivedCases: item.receivedCases,
      receivedBottlesPerCase: item.receivedBottlesPerCase,
      receivedBottleSizeMl: item.receivedBottleSizeMl,
      packChanged: item.packChanged,
      isAddedItem: item.isAddedItem,
      productName: item.productName,
      producer: item.producer,
      vintage: item.vintage,
      locationId: item.locationId!, // Per-item location
      expiryDate: item.expiryDate,
      notes: item.notes,
    }));

    receiveMutation.mutate({
      shipmentId,
      receivingLocationId: items[0]?.locationId ?? '', // Fallback, but per-item is used
      items,
      notes: notes || undefined,
    });
  };

  if (shipmentLoading || draftLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="text-center">
          <Icon icon={IconLoader2} className="mx-auto animate-spin" colorRole="muted" size="xl" />
          <Typography variant="bodySm" colorRole="muted" className="mt-3">
            Loading shipment...
          </Typography>
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Icon icon={IconAlertCircle} size="xl" colorRole="muted" className="mx-auto mb-4" />
            <Typography variant="headingSm" className="mb-2">
              Shipment Not Found
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              The shipment could not be found or is not ready for receiving
            </Typography>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalExpected = shipment.items.reduce((sum, item) => sum + item.cases, 0);
  const allItems = Array.from(receivedItems.values());
  const totalReceived = allItems.reduce((sum, item) => sum + item.receivedCases, 0);
  const checkedCount = allItems.filter((item) => item.isChecked).length;
  const totalItems = allItems.length;
  const hasDiscrepancy = totalExpected !== totalReceived;
  const allChecked = checkedCount === totalItems && totalItems > 0;

  // Detect if data looks corrupted (bottles were put in cases field)
  // Check if total expected is suspiciously high (> 100 cases for most shipments)
  // AND all items have cases divisible by bottlesPerCase
  const suspiciouslyHighTotal = totalExpected > 100;
  const allItemsDivisible = shipment.items.every((item) => {
    const bottlesPerCase = item.bottlesPerCase ?? 12;
    if (bottlesPerCase <= 1) return true; // Can't detect for single bottle
    const possibleCases = item.cases / bottlesPerCase;
    return Number.isInteger(possibleCases) && possibleCases >= 1;
  });
  const dataLooksCorrupted = suspiciouslyHighTotal && allItemsDivisible;

  // Calculate what the corrected totals would be
  const correctedExpected = dataLooksCorrupted
    ? shipment.items.reduce((sum, item) => {
        const bottlesPerCase = item.bottlesPerCase ?? 12;
        return sum + Math.floor(item.cases / bottlesPerCase);
      }, 0)
    : totalExpected;

  // Group items by base product (original + added variants)
  const itemGroups = new Map<string, ReceivedItem[]>();
  allItems.forEach((item) => {
    const groupKey = item.baseItemId ?? item.id;
    const existing = itemGroups.get(groupKey) || [];
    existing.push(item);
    itemGroups.set(groupKey, existing);
  });

  return (
    <div className="min-h-screen bg-fill-secondary pb-32 sm:bg-fill-primary sm:pb-8">
      {/* Mobile Header - Sticky */}
      <div className="sticky top-0 z-10 bg-fill-primary p-4 shadow-sm sm:relative sm:shadow-none">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/platform/admin/wms/receive"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-fill-secondary text-text-muted hover:text-text-primary sm:hidden"
          >
            <IconChevronRight className="h-5 w-5 rotate-180" />
          </Link>
          <div className="min-w-0 flex-1">
            <Typography variant="headingMd" className="truncate sm:text-xl">
              {shipment.shipmentNumber}
            </Typography>
            <Typography variant="bodySm" colorRole="muted" className="truncate">
              {shipment.partnerName}
            </Typography>
          </div>
          {/* Save indicator */}
          {isSaving ? (
            <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <IconCloudUpload className="h-4 w-4 animate-pulse" />
              <span className="hidden sm:inline">Saving...</span>
            </span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <IconCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Saved</span>
            </span>
          ) : null}
        </div>

        {/* Desktop breadcrumb - hidden on mobile */}
        <div className="mt-2 hidden items-center gap-2 sm:flex">
          <Link href="/platform/admin/wms" className="text-text-muted hover:text-text-primary">
            <Typography variant="bodySm">WMS</Typography>
          </Link>
          <IconChevronRight className="h-4 w-4 text-text-muted" />
          <Link href="/platform/admin/wms/receive" className="text-text-muted hover:text-text-primary">
            <Typography variant="bodySm">Receiving</Typography>
          </Link>
          <IconChevronRight className="h-4 w-4 text-text-muted" />
          <Typography variant="bodySm">{shipment.shipmentNumber}</Typography>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:container sm:mx-auto sm:max-w-7xl sm:space-y-6 sm:px-6 sm:py-8">
        {/* Summary Cards - 2x2 grid on mobile, 4 cols on desktop */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <Card>
            <CardContent className="p-3 text-center sm:p-4">
              <Typography variant="bodyXs" colorRole="muted">
                Expected
              </Typography>
              <Typography variant="headingLg" className="text-2xl text-blue-600 sm:text-3xl">
                {totalExpected}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                cases
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center sm:p-4">
              <Typography variant="bodyXs" colorRole="muted">
                Received
              </Typography>
              <Typography
                variant="headingLg"
                className={`text-2xl sm:text-3xl ${hasDiscrepancy ? 'text-amber-600' : 'text-emerald-600'}`}
              >
                {totalReceived}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                cases
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center sm:p-4">
              <Typography variant="bodyXs" colorRole="muted">
                Variance
              </Typography>
              <Typography
                variant="headingLg"
                className={`text-2xl sm:text-3xl ${
                  totalReceived - totalExpected === 0
                    ? 'text-text-muted'
                    : totalReceived - totalExpected > 0
                      ? 'text-emerald-600'
                      : 'text-red-600'
                }`}
              >
                {totalReceived - totalExpected > 0 ? '+' : ''}
                {totalReceived - totalExpected}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                cases
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center sm:p-4">
              <Typography variant="bodyXs" colorRole="muted">
                Checked
              </Typography>
              <Typography
                variant="headingLg"
                className={`text-2xl sm:text-3xl ${allChecked ? 'text-emerald-600' : 'text-amber-600'}`}
              >
                {checkedCount}/{totalItems}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                items
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Data Correction Alert - Show if total > 100 to help fix extraction errors */}
        {totalExpected > 100 && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Icon icon={IconAlertTriangle} size="lg" className="flex-shrink-0 text-amber-600" />
                <div className="flex-1">
                  <Typography variant="headingSm" className="text-amber-800 dark:text-amber-200">
                    Data Extraction Error Detected
                  </Typography>
                  <Typography variant="bodySm" className="mt-1 text-amber-700 dark:text-amber-300">
                    It looks like bottle counts were incorrectly saved as case counts. Expected total should be{' '}
                    <strong>{correctedExpected} cases</strong>, not {totalExpected}.
                  </Typography>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="md"
                      className="border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                      onClick={() => fixDataMutation.mutate({ shipmentId, recalculateFromBottles: true })}
                      disabled={fixDataMutation.isPending}
                    >
                      <ButtonContent iconLeft={fixDataMutation.isPending ? IconLoader2 : IconTool}>
                        {fixDataMutation.isPending ? 'Fixing...' : 'Fix Data'}
                      </ButtonContent>
                    </Button>
                  </div>
                  {fixDataMutation.isError && (
                    <Typography variant="bodyXs" className="mt-2 text-red-600">
                      {fixDataMutation.error?.message ?? 'Failed to fix data'}
                    </Typography>
                  )}
                  {fixDataMutation.isSuccess && (
                    <Typography variant="bodyXs" className="mt-2 text-emerald-600">
                      Data fixed! Reloading...
                    </Typography>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Default Location (optional - applied to items without a location) */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Icon icon={IconMapPin} size="lg" colorRole="muted" />
              <div className="min-w-0 flex-1">
                <Typography variant="bodySm" colorRole="muted">
                  Default Location (optional)
                </Typography>
                <select
                  className="mt-1 h-12 w-full rounded-lg border-2 border-border-primary bg-fill-primary px-3 text-base font-medium focus:border-border-brand focus:outline-none"
                  value={receivingLocationId}
                  onChange={(e) => setReceivingLocationId(e.target.value)}
                >
                  <option value="">Select default...</option>
                  {locations?.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.locationCode} ({loc.locationType})
                    </option>
                  ))}
                </select>
              </div>
              {receivingLocationId && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    // Apply default to all items without a location
                    const newMap = new Map(receivedItems);
                    newMap.forEach((item, id) => {
                      if (!item.locationId) {
                        newMap.set(id, { ...item, locationId: receivingLocationId });
                      }
                    });
                    setReceivedItems(newMap);
                    saveDraft();
                  }}
                >
                  Apply to All
                </Button>
              )}
            </div>
            <Typography variant="bodyXs" className="mt-2 text-text-muted">
              Set location per item below, or select a default and click &quot;Apply to All&quot;
            </Typography>
          </CardContent>
        </Card>

        {/* Items to Receive */}
        <Card>
          <div className="p-4 pb-2">
            <CardTitle className="text-lg">Items to Receive</CardTitle>
            <Typography variant="bodySm" colorRole="muted">
              Tap checkbox to mark verified
            </Typography>
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-border-muted">
              {shipment.items.map((shipmentItem) => {
                // Get all items for this group (original + added variants)
                const groupItems = itemGroups.get(shipmentItem.id) || [];
                const originalItem = groupItems.find((i) => !i.isAddedItem);
                const addedItems = groupItems.filter((i) => i.isAddedItem);

                return (
                  <div key={shipmentItem.id} className="p-4">
                    {/* Original Item */}
                    {originalItem && (
                      <ItemRow
                        item={originalItem}
                        shipmentItem={shipmentItem}
                        locations={locations ?? []}
                        isEditingPack={editingPackItemId === originalItem.id}
                        onToggleCheck={() => toggleChecked(originalItem.id)}
                        onUpdateCases={(cases) => updateReceivedCases(originalItem.id, cases)}
                        onUpdatePackConfig={(bpc, bs) => updatePackConfig(originalItem.id, bpc, bs)}
                        onUpdateLocation={(locId) => updateItemLocation(originalItem.id, locId)}
                        onEditPack={() => setEditingPackItemId(originalItem.id)}
                        onClosePack={() => setEditingPackItemId(null)}
                        onAddVariant={() => addPackVariant(originalItem.id)}
                      />
                    )}

                    {/* Added Variants */}
                    {addedItems.map((addedItem) => (
                      <div key={addedItem.id} className="ml-4 mt-4 border-l-4 border-amber-300 pl-4 sm:ml-6">
                        <ItemRow
                          item={addedItem}
                          shipmentItem={shipmentItem}
                          locations={locations ?? []}
                          isEditingPack={editingPackItemId === addedItem.id}
                          onToggleCheck={() => toggleChecked(addedItem.id)}
                          onUpdateCases={(cases) => updateReceivedCases(addedItem.id, cases)}
                          onUpdatePackConfig={(bpc, bs) => updatePackConfig(addedItem.id, bpc, bs)}
                          onUpdateLocation={(locId) => updateItemLocation(addedItem.id, locId)}
                          onEditPack={() => setEditingPackItemId(addedItem.id)}
                          onClosePack={() => setEditingPackItemId(null)}
                          onRemove={() => removeAddedItem(addedItem.id)}
                          isAddedVariant
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Notes - collapsible on mobile */}
        <Card>
          <div className="p-4 pb-2">
            <CardTitle className="text-lg">Notes (Optional)</CardTitle>
          </div>
          <CardContent>
            <textarea
              className="w-full rounded-lg border-2 border-border-primary bg-fill-primary p-4 text-base focus:border-border-brand focus:outline-none"
              rows={2}
              placeholder="Add notes about discrepancies, damage, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Desktop Action Buttons - hidden on mobile (we have fixed footer) */}
        <div className="hidden items-center justify-end gap-3 sm:flex">
          <Button variant="outline" asChild>
            <Link href="/platform/admin/wms/receive">Cancel</Link>
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleReceive}
            disabled={receiveMutation.isPending || totalReceived === 0}
          >
            <ButtonContent iconLeft={receiveMutation.isPending ? IconLoader2 : IconBarcode}>
              {receiveMutation.isPending ? 'Receiving...' : `Receive & Print ${totalReceived} Labels`}
            </ButtonContent>
          </Button>
        </div>

        {/* Error Display */}
        {receiveMutation.isError && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Icon icon={IconAlertCircle} size="md" className="flex-shrink-0 text-red-600" />
                <Typography variant="bodySm" className="text-red-800 dark:text-red-300">
                  {receiveMutation.error?.message ?? 'Failed to receive shipment'}
                </Typography>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Fixed Bottom Action Bar - Mobile Only */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border-muted bg-fill-primary p-4 shadow-lg sm:hidden">
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="h-14 flex-1 text-base"
            asChild
          >
            <Link href="/platform/admin/wms/receive">Cancel</Link>
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="h-14 flex-[2] text-base"
            onClick={handleReceive}
            disabled={receiveMutation.isPending || totalReceived === 0}
          >
            <ButtonContent iconLeft={receiveMutation.isPending ? IconLoader2 : IconCheck}>
              {receiveMutation.isPending ? 'Processing...' : `Complete (${totalReceived})`}
            </ButtonContent>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WMSReceiveShipmentPage;
