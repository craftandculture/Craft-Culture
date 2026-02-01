'use client';

import {
  IconAlertCircle,
  IconBarcode,
  IconCheck,
  IconChevronRight,
  IconCloudUpload,
  IconCopy,
  IconEdit,
  IconLoader2,
  IconMinus,
  IconPlus,
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
import Input from '@/app/_ui/components/Input/Input';
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
  expiryDate?: Date;
  notes?: string;
}

/**
 * Item row component for receiving
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
  isEditingPack: boolean;
  onToggleCheck: () => void;
  onUpdateCases: (cases: number) => void;
  onUpdatePackConfig: (bottlesPerCase: number, bottleSizeMl: number) => void;
  onEditPack: () => void;
  onClosePack: () => void;
  onAddVariant?: () => void;
  onRemove?: () => void;
  isAddedVariant?: boolean;
}

const ItemRow = ({
  item,
  shipmentItem,
  isEditingPack,
  onToggleCheck,
  onUpdateCases,
  onUpdatePackConfig,
  onEditPack,
  onClosePack,
  onAddVariant,
  onRemove,
  isAddedVariant = false,
}: ItemRowProps) => {
  const variance = item.receivedCases - item.expectedCases;

  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-start ${item.isChecked ? 'opacity-60' : ''}`}>
      {/* Checkbox */}
      <div className="flex items-start pt-1">
        <button
          onClick={onToggleCheck}
          className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
            item.isChecked
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-border-primary hover:border-border-brand'
          }`}
        >
          {item.isChecked && <IconCheck className="h-3 w-3" />}
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <Typography variant="headingSm" className={`mb-1 ${item.isChecked ? 'line-through' : ''}`}>
            {item.productName}
          </Typography>
          {isAddedVariant && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              Added
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Typography variant="bodyXs" colorRole="muted">
            {item.producer && `${item.producer} • `}
            {item.vintage && `${item.vintage}`}
          </Typography>
          {/* Pack Config with Edit */}
          <div className="flex items-center gap-1">
            {isEditingPack ? (
              <div className="flex items-center gap-2 rounded-md bg-fill-secondary p-1">
                <select
                  className="rounded border border-border-primary bg-fill-primary px-2 py-1 text-xs"
                  value={item.receivedBottlesPerCase}
                  onChange={(e) => onUpdatePackConfig(parseInt(e.target.value), item.receivedBottleSizeMl)}
                >
                  <option value={1}>1</option>
                  <option value={3}>3</option>
                  <option value={6}>6</option>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                </select>
                <span className="text-xs">×</span>
                <select
                  className="rounded border border-border-primary bg-fill-primary px-2 py-1 text-xs"
                  value={item.receivedBottleSizeMl}
                  onChange={(e) => onUpdatePackConfig(item.receivedBottlesPerCase, parseInt(e.target.value))}
                >
                  <option value={375}>375ml</option>
                  <option value={500}>500ml</option>
                  <option value={750}>750ml</option>
                  <option value={1500}>1500ml</option>
                  <option value={3000}>3000ml</option>
                </select>
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onClosePack}>
                  <Icon icon={IconCheck} size="sm" />
                </Button>
              </div>
            ) : (
              <button
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-fill-secondary ${
                  item.packChanged
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'text-text-muted'
                }`}
                onClick={onEditPack}
              >
                {item.receivedBottlesPerCase}x{item.receivedBottleSizeMl}ml
                <Icon icon={IconEdit} size="xs" />
              </button>
            )}
          </div>
        </div>
        {/* LWIN */}
        {item.lwin && (
          <Typography variant="bodyXs" className="mt-1 font-mono text-text-muted">
            {item.lwin}
          </Typography>
        )}
        {/* Pack changed indicator */}
        {item.packChanged && !isAddedVariant && (
          <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
            <span>
              Originally: {shipmentItem.bottlesPerCase}x{shipmentItem.bottleSizeMl}ml → Now:{' '}
              {item.receivedBottlesPerCase}x{item.receivedBottleSizeMl}ml
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {!isAddedVariant && (
          <div className="text-right">
            <Typography variant="bodyXs" colorRole="muted">
              Expected
            </Typography>
            <Typography variant="bodySm" className="font-medium">
              {item.expectedCases} cases
            </Typography>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onUpdateCases(item.receivedCases - 1)}>
            <Icon icon={IconMinus} size="sm" />
          </Button>
          <Input
            type="number"
            className="w-20 text-center"
            value={item.receivedCases}
            onChange={(e) => onUpdateCases(parseInt(e.target.value) || 0)}
            min={0}
          />
          <Button variant="outline" size="sm" onClick={() => onUpdateCases(item.receivedCases + 1)}>
            <Icon icon={IconPlus} size="sm" />
          </Button>
        </div>
        {!isAddedVariant && variance !== 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              variance > 0
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}
          >
            {variance > 0 ? '+' : ''}
            {variance}
          </span>
        )}
        {/* Add variant button (only for original items) */}
        {!isAddedVariant && onAddVariant && (
          <Button variant="ghost" size="sm" onClick={onAddVariant} title="Add different pack size">
            <Icon icon={IconCopy} size="sm" />
          </Button>
        )}
        {/* Remove button (only for added items) */}
        {isAddedVariant && onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove} title="Remove">
            <Icon icon={IconTrash} size="sm" className="text-red-500" />
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
    if (!receivingLocationId) {
      alert('Please select a receiving location');
      return;
    }

    const items = Array.from(receivedItems.values())
      .filter((item) => item.receivedCases > 0)
      .map((item) => ({
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
        expiryDate: item.expiryDate,
        notes: item.notes,
      }));

    if (items.length === 0) {
      alert('No items to receive');
      return;
    }

    receiveMutation.mutate({
      shipmentId,
      receivingLocationId,
      items,
      notes: notes || undefined,
    });
  };

  if (shipmentLoading || draftLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
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

  // Group items by base product (original + added variants)
  const itemGroups = new Map<string, ReceivedItem[]>();
  allItems.forEach((item) => {
    const groupKey = item.baseItemId ?? item.id;
    const existing = itemGroups.get(groupKey) || [];
    existing.push(item);
    itemGroups.set(groupKey, existing);
  });

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
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
            <Typography variant="headingLg" className="mb-2">
              Receive: {shipment.shipmentNumber}
            </Typography>
            <div className="flex flex-wrap items-center gap-3">
              <Typography variant="bodyMd" colorRole="muted">
                {shipment.partnerName} • {shipment.originCountry ?? 'Unknown'} {shipment.originCity && `• ${shipment.originCity}`}
              </Typography>
              {isSaving ? (
                <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <IconCloudUpload className="h-3 w-3 animate-pulse" />
                  Saving...
                </span>
              ) : lastSaved ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <IconCheck className="h-3 w-3" />
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={saveImmediately}
              disabled={isSaving}
            >
              <ButtonContent iconLeft={isSaving ? IconLoader2 : IconCloudUpload}>
                {isSaving ? 'Saving...' : 'Save Now'}
              </ButtonContent>
            </Button>
            <Button
              variant="primary"
              onClick={handleReceive}
              disabled={receiveMutation.isPending || totalReceived === 0}
            >
              <ButtonContent iconLeft={receiveMutation.isPending ? IconLoader2 : IconCheck}>
                {receiveMutation.isPending ? 'Receiving...' : 'Complete Receiving'}
              </ButtonContent>
            </Button>
          </div>
        </div>

        {/* Summary Card */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Expected
              </Typography>
              <Typography variant="headingLg" className="text-blue-600">
                {totalExpected}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                cases
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Received
              </Typography>
              <Typography
                variant="headingLg"
                className={hasDiscrepancy ? 'text-amber-600' : 'text-emerald-600'}
              >
                {totalReceived}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                cases
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Variance
              </Typography>
              <Typography
                variant="headingLg"
                className={
                  totalReceived - totalExpected === 0
                    ? 'text-text-muted'
                    : totalReceived - totalExpected > 0
                      ? 'text-emerald-600'
                      : 'text-red-600'
                }
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
            <CardContent className="p-4 text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Checked
              </Typography>
              <Typography
                variant="headingLg"
                className={checkedCount === totalItems ? 'text-emerald-600' : 'text-amber-600'}
              >
                {checkedCount}/{totalItems}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                items
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Items to Receive */}
        <Card>
          <div className="p-4 pb-2">
            <CardTitle>Items to Receive</CardTitle>
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
                        isEditingPack={editingPackItemId === originalItem.id}
                        onToggleCheck={() => toggleChecked(originalItem.id)}
                        onUpdateCases={(cases) => updateReceivedCases(originalItem.id, cases)}
                        onUpdatePackConfig={(bpc, bs) => updatePackConfig(originalItem.id, bpc, bs)}
                        onEditPack={() => setEditingPackItemId(originalItem.id)}
                        onClosePack={() => setEditingPackItemId(null)}
                        onAddVariant={() => addPackVariant(originalItem.id)}
                      />
                    )}

                    {/* Added Variants */}
                    {addedItems.map((addedItem) => (
                      <div key={addedItem.id} className="ml-6 mt-3 border-l-2 border-amber-300 pl-4">
                        <ItemRow
                          item={addedItem}
                          shipmentItem={shipmentItem}
                          isEditingPack={editingPackItemId === addedItem.id}
                          onToggleCheck={() => toggleChecked(addedItem.id)}
                          onUpdateCases={(cases) => updateReceivedCases(addedItem.id, cases)}
                          onUpdatePackConfig={(bpc, bs) => updatePackConfig(addedItem.id, bpc, bs)}
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

        {/* Notes */}
        <Card>
          <div className="p-4 pb-2">
            <CardTitle>Receiving Notes</CardTitle>
          </div>
          <CardContent>
            <textarea
              className="w-full rounded-lg border border-border-primary bg-fill-primary p-3 text-sm focus:border-border-brand focus:outline-none"
              rows={3}
              placeholder="Add any notes about discrepancies, damage, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/platform/admin/wms/receive">Cancel</Link>
          </Button>
          <Button
            variant="primary"
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
              <div className="flex items-center gap-2">
                <Icon icon={IconAlertCircle} size="sm" className="text-red-600" />
                <Typography variant="bodySm" className="text-red-800 dark:text-red-300">
                  {receiveMutation.error?.message ?? 'Failed to receive shipment'}
                </Typography>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WMSReceiveShipmentPage;
