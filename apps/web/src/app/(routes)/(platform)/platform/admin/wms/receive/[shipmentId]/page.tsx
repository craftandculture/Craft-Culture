'use client';

import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconBan,
  IconCheck,
  IconChevronRight,
  IconCloudUpload,
  IconList,
  IconLoader2,
  IconMapPin,
  IconPlus,
  IconPrinter,
  IconSearch,
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
import PhotoCapture from '@/app/_wms/components/PhotoCapture';
import ScanInput from '@/app/_wms/components/ScanInput';
import type { ScanInputHandle } from '@/app/_wms/components/ScanInput';
import ZebraPrint, { useZebraPrint } from '@/app/_wms/components/ZebraPrint';
import downloadZplFile from '@/app/_wms/utils/downloadZplFile';
import useTRPC from '@/lib/trpc/browser';

interface LocationAssignment {
  locationId: string;
  locationCode: string;
  cases: number;
  labelsPrinted: boolean;
}

interface ReceivedItem {
  id: string;
  shipmentItemId: string | null;
  baseItemId: string | null;
  productName: string;
  producer?: string | null;
  vintage?: number | null;
  lwin?: string | null;
  supplierSku?: string | null; // Supplier's own reference code (e.g., W-codes from CRURATED)
  expectedCases: number;
  receivedCases: number;
  expectedBottlesPerCase: number;
  expectedBottleSizeMl: number;
  receivedBottlesPerCase: number;
  receivedBottleSizeMl: number;
  packChanged: boolean;
  isAddedItem: boolean;
  isVerified: boolean;
  /** Item was skipped during receiving (not found, 0 cases) */
  isSkipped?: boolean;
  locationAssignments: LocationAssignment[];
  totalLabelsPrinted: number;
  notes?: string;
  /** URLs of photos captured during receiving (e.g., case condition, labels) */
  photos?: string[];
}

type ProductPhase = 'verifying' | 'printing' | 'shelving' | 'complete';

/**
 * WMS Receive Shipment - Product-by-product receiving with integrated label printing
 *
 * Flow for each product:
 * 1. VERIFY: Find and count all cases of this product
 * 2. PRINT: Print labels for cases going to a specific bay
 * 3. SHELVE: Scan bay barcode and assign cases
 * 4. Repeat 2-3 if splitting across multiple bays
 * 5. Move to next product
 */
const WMSReceiveShipmentPage = () => {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.shipmentId as string;
  const api = useTRPC();
  const queryClient = useQueryClient();

  // View mode: 'list' shows all products with search, 'detail' shows single product
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  // Product navigation
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [productPhase, setProductPhase] = useState<ProductPhase>('verifying');

  // Receiving state
  const [receivedItems, setReceivedItems] = useState<Map<string, ReceivedItem>>(new Map());
  const [notes, setNotes] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Current bay assignment state (for the current product)
  const [pendingCases, setPendingCases] = useState(0);
  const [scannedLocationCode, setScannedLocationCode] = useState<string | null>(null);
  const [scannedLocationId, setScannedLocationId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanInputRef = useRef<ScanInputHandle>(null);
  const { print: wifiPrint, isConnected: isPrinterConnected } = useZebraPrint();

  // Get shipment details
  const { data: shipment, isLoading: shipmentLoading } = useQuery({
    ...api.wms.admin.receiving.getShipmentForReceiving.queryOptions({ shipmentId }),
    enabled: !!shipmentId,
  });

  // Get saved draft
  const { data: savedDraft, isLoading: draftLoading } = useQuery({
    ...api.wms.admin.receiving.getDraft.queryOptions({ shipmentId }),
    enabled: !!shipmentId,
  });

  // Get locations
  const { data: locations } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({}),
  });

  // Location lookup by barcode
  const locationLookupMutation = useMutation({
    ...api.wms.admin.operations.getLocationByBarcode.mutationOptions(),
  });

  // Create case labels
  const createLabelsMutation = useMutation({
    ...api.wms.admin.labels.createCaseLabels.mutationOptions(),
  });

  // Upload receiving photo
  const uploadPhotoMutation = useMutation({
    ...api.wms.admin.receiving.uploadPhoto.mutationOptions(),
  });

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

  // Delete draft mutation
  const { mutate: deleteDraftMutate, isPending: isDeletingDraft } = useMutation({
    ...api.wms.admin.receiving.deleteDraft.mutationOptions(),
    onSuccess: () => {
      setReceivedItems(new Map());
      setInitialized(false);
      setLastSaved(null);
      setCurrentProductIndex(0);
      setProductPhase('verifying');
      void queryClient.invalidateQueries();
    },
  });

  // Complete receiving mutation
  const receiveMutation = useMutation({
    ...api.wms.admin.receiving.receiveShipment.mutationOptions(),
    onSuccess: () => {
      deleteDraftMutate({ shipmentId });
      void queryClient.invalidateQueries();
      router.push('/platform/admin/wms/receive');
    },
  });

  // Save draft (debounced)
  const saveDraft = useCallback(() => {
    if (receivedItems.size === 0) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSaving(true);

    saveTimeoutRef.current = setTimeout(() => {
      const items = Array.from(receivedItems.values()).map((item) => ({
        id: item.id,
        shipmentItemId: item.shipmentItemId,
        baseItemId: item.baseItemId,
        productName: item.productName,
        producer: item.producer,
        vintage: item.vintage,
        lwin: item.lwin,
        supplierSku: item.supplierSku,
        expectedCases: item.expectedCases,
        receivedCases: item.receivedCases,
        expectedBottlesPerCase: item.expectedBottlesPerCase,
        expectedBottleSizeMl: item.expectedBottleSizeMl,
        receivedBottlesPerCase: item.receivedBottlesPerCase,
        receivedBottleSizeMl: item.receivedBottleSizeMl,
        packChanged: item.packChanged,
        isAddedItem: item.isAddedItem,
        isChecked: item.isVerified,
        locationId: item.locationAssignments[0]?.locationId,
        notes: item.notes,
        photos: item.photos,
      }));

      saveDraftMutate({
        shipmentId,
        items,
        notes: notes || undefined,
      });
    }, 1000);
  }, [receivedItems, notes, shipmentId, saveDraftMutate]);

  // Get current item - defined early so it can be used in effects
  const getCurrentItem = useCallback((): ReceivedItem | undefined => {
    if (!shipment?.items) return undefined;
    const itemId = shipment.items[currentProductIndex]?.id;
    return itemId ? receivedItems.get(itemId) : undefined;
  }, [shipment?.items, currentProductIndex, receivedItems]);

  // Initialize from draft or shipment
  useEffect(() => {
    if (!shipment?.items || initialized || draftLoading) return;

    if (savedDraft?.items) {
      const loadedItems = new Map<string, ReceivedItem>();
      savedDraft.items.forEach((item) => {
        loadedItems.set(item.id, {
          ...item,
          isVerified: item.isChecked,
          locationAssignments: item.locationId
            ? [{ locationId: item.locationId, locationCode: '', cases: item.receivedCases, labelsPrinted: true }]
            : [],
          totalLabelsPrinted: item.isChecked ? item.receivedCases : 0,
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
        supplierSku: item.supplierSku,
        expectedCases: item.cases,
        receivedCases: item.cases,
        expectedBottlesPerCase: item.bottlesPerCase ?? 12,
        expectedBottleSizeMl: item.bottleSizeMl ?? 750,
        receivedBottlesPerCase: item.bottlesPerCase ?? 12,
        receivedBottleSizeMl: item.bottleSizeMl ?? 750,
        packChanged: false,
        isAddedItem: false,
        isVerified: false,
        locationAssignments: [],
        totalLabelsPrinted: 0,
        photos: [],
      });
    });
    setReceivedItems(initial);
    setInitialized(true);
  }, [shipment?.items, savedDraft, initialized, draftLoading]);

  // Reset pending cases when product changes
  useEffect(() => {
    const currentItem = getCurrentItem();
    if (currentItem) {
      const assignedCases = currentItem.locationAssignments.reduce((sum, a) => sum + a.cases, 0);
      setPendingCases(currentItem.receivedCases - assignedCases);
    }
    setScannedLocationCode(null);
    setScannedLocationId(null);
    setScanError(null);
    setPrintError(null);
  }, [currentProductIndex, getCurrentItem]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-focus scan input when entering printing phase
  useEffect(() => {
    if (productPhase === 'printing' && scanInputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
    }
  }, [productPhase]);

  // Update received cases
  const updateReceivedCases = (cases: number) => {
    const currentItem = getCurrentItem();
    if (!currentItem) return;

    const newCases = Math.max(0, cases);
    const newMap = new Map(receivedItems.set(currentItem.id, { ...currentItem, receivedCases: newCases }));
    setReceivedItems(newMap);

    const assignedCases = currentItem.locationAssignments.reduce((sum, a) => sum + a.cases, 0);
    setPendingCases(newCases - assignedCases);
    saveDraft();
  };

  // Mark as verified and move to printing phase
  const handleVerify = () => {
    const currentItem = getCurrentItem();
    if (!currentItem) return;

    const newMap = new Map(receivedItems.set(currentItem.id, { ...currentItem, isVerified: true }));
    setReceivedItems(newMap);
    saveDraft();
    setProductPhase('printing');
  };

  // Update photos for current item
  const updatePhotos = (photos: string[]) => {
    const currentItem = getCurrentItem();
    if (!currentItem) return;

    const newMap = new Map(receivedItems.set(currentItem.id, { ...currentItem, photos }));
    setReceivedItems(newMap);
    saveDraft();
  };

  // Update notes for current item
  const updateItemNotes = (itemNotes: string) => {
    const currentItem = getCurrentItem();
    if (!currentItem) return;

    const newMap = new Map(receivedItems.set(currentItem.id, { ...currentItem, notes: itemNotes }));
    setReceivedItems(newMap);
    saveDraft();
  };

  // Upload a photo and return the URL
  const handleUploadPhoto = async (file: string, filename: string, fileType: string) => {
    const currentItem = getCurrentItem();
    if (!currentItem) throw new Error('No item selected');

    const result = await uploadPhotoMutation.mutateAsync({
      shipmentId,
      itemId: currentItem.id,
      file,
      filename,
      fileType: fileType as 'image/png' | 'image/jpeg' | 'image/jpg' | 'image/webp',
    });
    return result.url;
  };

  // Handle bay barcode scan
  const handleBarcodeScan = async (barcode: string) => {
    setScanError(null);
    setScannedLocationCode(null);
    setScannedLocationId(null);

    try {
      const result = await locationLookupMutation.mutateAsync({ barcode });
      if (result?.location) {
        // Check if this location is already assigned to current item
        const currentItem = getCurrentItem();
        if (currentItem) {
          const alreadyAssigned = currentItem.locationAssignments.some(
            (a) => a.locationId === result.location.id,
          );
          if (alreadyAssigned) {
            setScanError(`Location ${result.location.locationCode} already assigned to this product`);
            return;
          }
        }
        setScannedLocationCode(result.location.locationCode);
        setScannedLocationId(result.location.id);
      } else {
        setScanError('Location not found');
      }
    } catch {
      setScanError('Invalid barcode or location not found');
    }
  };

  // Print labels for pending cases at scanned location (WiFi direct or file download fallback)
  const handlePrintLabels = async () => {
    const currentItem = getCurrentItem();
    if (!currentItem || !scannedLocationId || pendingCases <= 0) return;

    setIsPrinting(true);
    setPrintError(null);

    try {
      // Generate LWIN-18 from item data
      const lwin18 = currentItem.lwin || `${currentItem.productName.replace(/\s+/g, '-').slice(0, 20)}`;
      // Strip any non-numeric characters from bottle size (in case it includes "ml")
      const bottleSize = String(currentItem.receivedBottleSizeMl).replace(/\D/g, '');
      const packSize = `${currentItem.receivedBottlesPerCase}x${bottleSize}ml`;

      // Create labels in database and get ZPL
      const result = await createLabelsMutation.mutateAsync({
        shipmentId,
        productName: currentItem.productName,
        lwin18,
        packSize,
        vintage: currentItem.vintage ?? undefined,
        lotNumber: new Date().toISOString().split('T')[0],
        locationId: scannedLocationId,
        owner: shipment?.partnerName ?? undefined,
        quantity: pendingCases,
      });

      // Print labels: try WiFi first, fall back to file download
      if (result.zpl) {
        if (isPrinterConnected()) {
          const printed = await wifiPrint(result.zpl);
          if (!printed) {
            // WiFi print failed, fall back to download
            const filename = `labels-${currentItem.productName.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30)}-${scannedLocationCode}`;
            downloadZplFile(result.zpl, filename);
          }
        } else {
          const filename = `labels-${currentItem.productName.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30)}-${scannedLocationCode}`;
          downloadZplFile(result.zpl, filename);
        }
      }

      // Update item with new location assignment
      const newAssignment: LocationAssignment = {
        locationId: scannedLocationId,
        locationCode: scannedLocationCode || '',
        cases: pendingCases,
        labelsPrinted: true,
      };

      const updatedItem = {
        ...currentItem,
        locationAssignments: [...currentItem.locationAssignments, newAssignment],
        totalLabelsPrinted: currentItem.totalLabelsPrinted + pendingCases,
      };

      const newMap = new Map(receivedItems.set(currentItem.id, updatedItem));
      setReceivedItems(newMap);

      // Reset state
      setPendingCases(0);
      setScannedLocationCode(null);
      setScannedLocationId(null);
      setProductPhase('shelving');
      saveDraft();
      // Scroll to top after labels printed
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Failed to create labels');
    } finally {
      setIsPrinting(false);
    }
  };

  // Remove a location assignment
  const removeLocationAssignment = (assignmentIndex: number) => {
    const currentItem = getCurrentItem();
    if (!currentItem) return;

    const assignment = currentItem.locationAssignments[assignmentIndex];
    if (!assignment) return;

    const newAssignments = currentItem.locationAssignments.filter((_, i) => i !== assignmentIndex);
    const updatedItem = {
      ...currentItem,
      locationAssignments: newAssignments,
      totalLabelsPrinted: currentItem.totalLabelsPrinted - assignment.cases,
    };

    const newMap = new Map(receivedItems.set(currentItem.id, updatedItem));
    setReceivedItems(newMap);
    setPendingCases(pendingCases + assignment.cases);
    setProductPhase('printing');
    saveDraft();
  };

  // Move to next incomplete product (skip completed/skipped ones)
  const handleNextProduct = () => {
    if (!shipment?.items) return;

    // Find next incomplete product
    for (let i = currentProductIndex + 1; i < shipment.items.length; i++) {
      const item = shipment.items[i];
      if (!item) continue;
      const receivedItem = receivedItems.get(item.id);
      const isComplete =
        receivedItem &&
        (receivedItem.isSkipped ||
          (receivedItem.locationAssignments.length > 0 &&
            receivedItem.locationAssignments.reduce((sum, a) => sum + a.cases, 0) >= receivedItem.receivedCases));
      if (!isComplete) {
        setCurrentProductIndex(i);
        setProductPhase('verifying');
        return;
      }
    }

    // If no incomplete found after current, check from beginning
    for (let i = 0; i < currentProductIndex; i++) {
      const item = shipment.items[i];
      if (!item) continue;
      const receivedItem = receivedItems.get(item.id);
      const isComplete =
        receivedItem &&
        (receivedItem.isSkipped ||
          (receivedItem.locationAssignments.length > 0 &&
            receivedItem.locationAssignments.reduce((sum, a) => sum + a.cases, 0) >= receivedItem.receivedCases));
      if (!isComplete) {
        setCurrentProductIndex(i);
        setProductPhase('verifying');
        return;
      }
    }

    // All complete - go back to list view
    setViewMode('list');
  };

  // Skip item (not found / 0 cases) and move to next product
  const handleSkipItem = () => {
    const currentItem = getCurrentItem();
    if (!currentItem) return;

    // Mark as skipped with 0 cases and add note
    const newMap = new Map(
      receivedItems.set(currentItem.id, {
        ...currentItem,
        isSkipped: true,
        receivedCases: 0,
        notes: currentItem.notes
          ? `${currentItem.notes}\n[SKIPPED - Item not found during receiving]`
          : '[SKIPPED - Item not found during receiving]',
      }),
    );
    setReceivedItems(newMap);
    saveDraft();

    // Move to next product
    handleNextProduct();
  };

  // Complete all receiving
  const handleCompleteReceiving = () => {
    const itemsToReceive = Array.from(receivedItems.values()).filter(
      (item) => item.receivedCases > 0 && item.locationAssignments.length > 0,
    );

    if (itemsToReceive.length === 0) {
      alert('No items ready to receive. Each product needs at least one bay assignment.');
      return;
    }

    // Convert to receive format - use first location assignment for now
    // TODO: Support multiple locations per item in receiveShipment
    const items = itemsToReceive.map((item) => ({
      shipmentItemId: item.shipmentItemId ?? item.baseItemId ?? '',
      expectedCases: item.expectedCases,
      receivedCases: item.receivedCases,
      receivedBottlesPerCase: item.receivedBottlesPerCase,
      receivedBottleSizeMl: item.receivedBottleSizeMl,
      packChanged: item.packChanged,
      isAddedItem: item.isAddedItem,
      productName: item.productName,
      producer: item.producer,
      vintage: item.vintage,
      lwin: item.lwin,
      supplierSku: item.supplierSku,
      locationId: item.locationAssignments[0]?.locationId ?? '',
      notes: item.notes,
    }));

    receiveMutation.mutate({
      shipmentId,
      receivingLocationId: items[0]?.locationId ?? '',
      items,
      notes: notes || undefined,
    });
  };

  // Reset handler
  const handleReset = () => {
    if (confirm('Clear all progress and start fresh? This cannot be undone.')) {
      deleteDraftMutate({ shipmentId });
    }
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

  const currentItem = getCurrentItem();
  const totalProducts = shipment.items.length;
  const completedProducts = Array.from(receivedItems.values()).filter(
    (item) => item.locationAssignments.length > 0 && item.locationAssignments.reduce((sum, a) => sum + a.cases, 0) >= item.receivedCases,
  ).length;
  const progressPercent = Math.round((completedProducts / totalProducts) * 100);
  const allComplete = completedProducts === totalProducts;

  // Filter products by search term
  const filteredProducts = shipment.items
    .map((item, index) => ({
      item,
      index,
      receivedItem: receivedItems.get(item.id),
    }))
    .filter(({ item, receivedItem }) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        item.productName.toLowerCase().includes(search) ||
        item.producer?.toLowerCase().includes(search) ||
        item.lwin?.toLowerCase().includes(search) ||
        receivedItem?.lwin?.toLowerCase().includes(search)
      );
    });

  // Select a product from the list
  const selectProduct = (index: number) => {
    // Blur any focused element to prevent keyboard from staying open
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setCurrentProductIndex(index);
    setProductPhase('verifying');
    setViewMode('detail');
    // Scroll to top after React renders the detail view
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  };

  // Go back to list view
  const backToList = () => {
    setViewMode('list');
    setSearchTerm('');
  };

  return (
    <div className="min-h-screen bg-fill-secondary pb-32 sm:bg-fill-primary sm:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-fill-primary p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/platform/admin/wms/receive"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-fill-secondary text-text-muted hover:text-text-primary"
          >
            <IconChevronRight className="h-5 w-5 rotate-180" />
          </Link>
          <div className="min-w-0 flex-1">
            <Typography variant="headingMd" className="truncate">
              {shipment.shipmentNumber}
            </Typography>
            <Typography variant="bodySm" colorRole="muted" className="truncate">
              {shipment.partnerName}
            </Typography>
          </div>
          {/* Save/status indicators */}
          {isSaving ? (
            <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <IconCloudUpload className="h-4 w-4 animate-pulse" />
            </span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <IconCheck className="h-4 w-4" />
            </span>
          ) : null}
          {lastSaved && (
            <button
              onClick={handleReset}
              disabled={isDeletingDraft}
              className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
            >
              Reset
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <Typography variant="bodyXs" colorRole="muted">
              Progress: {completedProducts}/{totalProducts} products
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              {progressPercent}%
            </Typography>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fill-tertiary">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Zebra Printer Status */}
      <div className="p-4 pt-2">
        <ZebraPrint />
      </div>

      <div className="space-y-4 p-4 pt-0">
        {/* List View - Search and select products */}
        {viewMode === 'list' && (
          <>
            {/* Search bar */}
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                inputMode="none"
                placeholder="Search products by name, producer, or LWIN..."
                className="h-12 w-full rounded-lg border-2 border-border-primary bg-fill-primary pl-10 pr-4 text-base focus:border-border-brand focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Product list */}
            <div className="space-y-2">
              {filteredProducts.length === 0 ? (
                <div className="rounded-lg bg-fill-secondary p-8 text-center">
                  <Typography variant="bodySm" colorRole="muted">
                    {searchTerm ? 'No products match your search' : 'No products in shipment'}
                  </Typography>
                </div>
              ) : (
                filteredProducts.map(({ item, index, receivedItem }) => {
                  const isSkipped = receivedItem?.isSkipped;
                  const isComplete =
                    receivedItem &&
                    (receivedItem.isSkipped ||
                      (receivedItem.locationAssignments.length > 0 &&
                        receivedItem.locationAssignments.reduce((sum, a) => sum + a.cases, 0) >=
                          receivedItem.receivedCases));
                  const isVerified = receivedItem?.isVerified;

                  return (
                    <button
                      key={item.id}
                      onClick={() => selectProduct(index)}
                      className="w-full rounded-lg border-2 border-border-primary bg-fill-primary p-4 text-left transition-colors hover:border-border-brand hover:bg-fill-secondary"
                    >
                      {/* Top row: Status badge and case count */}
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isSkipped ? (
                            <span className="flex items-center gap-1 rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              <IconBan className="h-3 w-3" />
                              Skipped
                            </span>
                          ) : isComplete ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <IconCheck className="h-3 w-3" />
                              Done
                            </span>
                          ) : isVerified ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Verified
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              Pending
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {receivedItem?.receivedCases ?? item.cases} cases
                          </span>
                          <IconChevronRight className="h-5 w-5 text-text-muted" />
                        </div>
                      </div>

                      {/* Product name - full width, no truncation */}
                      <Typography variant="bodySm" className="font-semibold leading-tight">
                        {item.productName}
                      </Typography>

                      {/* Producer and vintage */}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {item.producer && (
                          <Typography variant="bodyXs" colorRole="muted">
                            {item.producer}
                          </Typography>
                        )}
                        {item.vintage && (
                          <Typography variant="bodyXs" colorRole="muted">
                            • {item.vintage}
                          </Typography>
                        )}
                      </div>

                      {/* Pack size and expected cases */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-fill-tertiary px-1.5 py-0.5 text-xs font-medium">
                          {item.bottlesPerCase ?? 12}×{item.bottleSizeMl ?? 750}ml
                        </span>
                        {item.lwin && (
                          <span className="font-mono text-xs text-text-muted">
                            {item.lwin}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Complete Receiving button at bottom of list */}
            {allComplete && (
              <Button
                variant="default"
                size="lg"
                className="h-14 w-full text-lg"
                onClick={handleCompleteReceiving}
                disabled={receiveMutation.isPending}
              >
                <ButtonContent iconLeft={receiveMutation.isPending ? IconLoader2 : IconCheck}>
                  {receiveMutation.isPending ? 'Completing...' : 'Complete Receiving'}
                </ButtonContent>
              </Button>
            )}
          </>
        )}

        {/* Detail View - Single product verification */}
        {viewMode === 'detail' && (
          <>
            {/* Back to list button */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="md" onClick={backToList}>
                <ButtonContent iconLeft={IconList}>All Products</ButtonContent>
              </Button>
              <Typography variant="bodySm" colorRole="muted">
                {currentProductIndex + 1} of {totalProducts}
              </Typography>
            </div>

            {/* Current Product Card */}
            {currentItem && (
              <Card>
                <CardContent className="p-4">
                  {/* Product Info */}
                  <div className="mb-4">
                    <Typography variant="headingMd" className="leading-tight">
                      {currentItem.productName}
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted" className="mt-1">
                      {currentItem.producer && `${currentItem.producer}`}
                      {currentItem.producer && currentItem.vintage && ' • '}
                      {currentItem.vintage && `${currentItem.vintage}`}
                    </Typography>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-fill-secondary px-2 py-1 text-sm font-medium">
                        {currentItem.receivedBottlesPerCase}×{currentItem.receivedBottleSizeMl}ml
                  </span>
                  {currentItem.supplierSku && (
                    <span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      SKU: {currentItem.supplierSku}
                    </span>
                  )}
                  {currentItem.lwin ? (
                    <span className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <IconCheck className="h-3 w-3" />
                      LWIN: {currentItem.lwin}
                    </span>
                  ) : (
                    <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      LWIN not mapped
                    </span>
                  )}
                </div>
              </div>

              {/* Phase: Verifying */}
              {productPhase === 'verifying' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                    <Typography variant="headingSm" className="text-blue-800 dark:text-blue-200">
                      Step 1: Find & Count
                    </Typography>
                    <Typography variant="bodySm" className="mt-1 text-blue-700 dark:text-blue-300">
                      Locate all cases of this product and verify the count
                    </Typography>
                  </div>

                  {/* Quantity control */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Typography variant="bodyXs" colorRole="muted">
                        Expected
                      </Typography>
                      <Typography variant="headingLg" className="text-blue-600">
                        {currentItem.expectedCases}
                      </Typography>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateReceivedCases(currentItem.receivedCases - 1)}
                        className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-border-primary bg-fill-secondary text-xl font-bold"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="h-14 w-20 rounded-lg border-2 border-border-primary bg-fill-primary text-center text-xl font-bold focus:border-border-brand focus:outline-none"
                        value={currentItem.receivedCases}
                        onChange={(e) => updateReceivedCases(parseInt(e.target.value) || 0)}
                        min={0}
                      />
                      <button
                        onClick={() => updateReceivedCases(currentItem.receivedCases + 1)}
                        className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-border-primary bg-fill-secondary text-xl font-bold"
                      >
                        +
                      </button>
                    </div>

                    <div>
                      <Typography variant="bodyXs" colorRole="muted">
                        Found
                      </Typography>
                      <Typography
                        variant="headingLg"
                        className={currentItem.receivedCases === currentItem.expectedCases ? 'text-emerald-600' : 'text-amber-600'}
                      >
                        {currentItem.receivedCases}
                      </Typography>
                    </div>
                  </div>

                  {/* Variance warning */}
                  {currentItem.receivedCases !== currentItem.expectedCases && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                      <Icon icon={IconAlertTriangle} className="text-amber-600" />
                      <Typography variant="bodySm" className="text-amber-800 dark:text-amber-300">
                        Variance: {currentItem.receivedCases - currentItem.expectedCases > 0 ? '+' : ''}
                        {currentItem.receivedCases - currentItem.expectedCases} cases
                      </Typography>
                    </div>
                  )}

                  {/* Photo capture */}
                  <div className="rounded-lg border border-border-secondary p-3">
                    <Typography variant="bodyXs" colorRole="muted" className="mb-2">
                      Photos (optional) - document case condition or labels
                    </Typography>
                    <PhotoCapture
                      photos={currentItem.photos ?? []}
                      onPhotosChange={updatePhotos}
                      onUpload={handleUploadPhoto}
                      maxPhotos={5}
                    />
                  </div>

                  <Button
                    variant="default"
                    size="lg"
                    className="h-14 w-full text-lg"
                    onClick={handleVerify}
                    disabled={currentItem.receivedCases === 0}
                  >
                    <ButtonContent iconLeft={IconCheck}>
                      Verified - {currentItem.receivedCases} Cases Found
                    </ButtonContent>
                  </Button>

                  {/* Skip button - shows when 0 cases entered */}
                  {currentItem.receivedCases === 0 && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                      <Typography variant="bodySm" className="mb-2 text-amber-800 dark:text-amber-200">
                        Can&apos;t verify with 0 cases. Skip this item if not found.
                      </Typography>
                      <Button
                        variant="outline"
                        size="md"
                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
                        onClick={handleSkipItem}
                      >
                        <ButtonContent iconLeft={IconBan}>Skip - Item Not Found</ButtonContent>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Phase: Printing / Shelving */}
              {(productPhase === 'printing' || productPhase === 'shelving') && (
                <div className="space-y-4">
                  {/* Already assigned locations */}
                  {currentItem.locationAssignments.length > 0 && (
                    <div className="space-y-2">
                      <Typography variant="headingSm">Assigned Bays</Typography>
                      {currentItem.locationAssignments.map((assignment, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20"
                        >
                          <div className="flex items-center gap-3">
                            <Icon icon={IconMapPin} className="text-emerald-600" />
                            <div>
                              <Typography variant="headingSm" className="text-emerald-800 dark:text-emerald-200">
                                {assignment.locationCode}
                              </Typography>
                              <Typography variant="bodyXs" className="text-emerald-700 dark:text-emerald-300">
                                {assignment.cases} cases • Labels printed
                              </Typography>
                            </div>
                          </div>
                          <button
                            onClick={() => removeLocationAssignment(index)}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                          >
                            <IconTrash className="h-5 w-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Remaining cases to assign */}
                  {pendingCases > 0 && (
                    <>
                      <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
                        <Typography variant="headingSm" className="text-amber-800 dark:text-amber-200">
                          {productPhase === 'printing' ? 'Step 2: Print Labels' : 'Step 3: Place on Shelf'}
                        </Typography>
                        <Typography variant="bodySm" className="mt-1 text-amber-700 dark:text-amber-300">
                          {pendingCases} cases remaining to assign
                        </Typography>
                      </div>

                      {/* Scan bay barcode */}
                      <ScanInput
                        ref={scanInputRef}
                        label="Scan Bay Barcode"
                        placeholder="LOC-A-01-02"
                        onScan={handleBarcodeScan}
                        isLoading={locationLookupMutation.isPending}
                        error={scanError || undefined}
                        success={scannedLocationCode ? `✓ ${scannedLocationCode}` : undefined}
                        autoFocus={false}
                      />

                      {/* Manual bay selection */}
                      <div className="flex items-center gap-2">
                        <Typography variant="bodySm" colorRole="muted">
                          Or select:
                        </Typography>
                        <select
                          className="h-12 flex-1 rounded-lg border-2 border-border-primary bg-fill-primary px-3 text-base"
                          value={scannedLocationId || ''}
                          onChange={(e) => {
                            const loc = locations?.find((l) => l.id === e.target.value);
                            if (loc) {
                              setScannedLocationId(loc.id);
                              setScannedLocationCode(loc.locationCode);
                              setScanError(null);
                            }
                          }}
                        >
                          <option value="">Select bay...</option>
                          {locations?.filter((l) => l.locationType === 'rack').map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.locationCode}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Print labels button (WiFi direct or file download fallback) */}
                      {scannedLocationId && (
                        <Button
                          variant="default"
                          size="lg"
                          className="h-14 w-full text-lg"
                          onClick={handlePrintLabels}
                          disabled={isPrinting || pendingCases === 0}
                        >
                          <ButtonContent iconLeft={isPrinting ? IconLoader2 : IconPrinter}>
                            {isPrinting ? 'Printing...' : `Print ${pendingCases} Labels → ${scannedLocationCode}`}
                          </ButtonContent>
                        </Button>
                      )}

                      {printError && (
                        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                          <Icon icon={IconAlertCircle} className="text-red-600" />
                          <Typography variant="bodySm" className="text-red-800 dark:text-red-300">
                            {printError}
                          </Typography>
                        </div>
                      )}
                    </>
                  )}

                  {/* All cases assigned - ready for next */}
                  {pendingCases === 0 && currentItem.locationAssignments.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 rounded-lg bg-emerald-100 p-4 dark:bg-emerald-900/30">
                        <Icon icon={IconCheck} size="lg" className="text-emerald-600" />
                        <div>
                          <Typography variant="headingSm" className="text-emerald-800 dark:text-emerald-200">
                            All {currentItem.receivedCases} Cases Assigned
                          </Typography>
                          <Typography variant="bodyXs" className="text-emerald-700 dark:text-emerald-300">
                            Labels printed and bays assigned
                          </Typography>
                        </div>
                      </div>

                      {/* Add another bay button */}
                      <Button
                        variant="outline"
                        size="md"
                        className="w-full"
                        onClick={() => {
                          setProductPhase('printing');
                          setScannedLocationCode(null);
                          setScannedLocationId(null);
                        }}
                      >
                        <ButtonContent iconLeft={IconPlus}>Add Another Bay (Split)</ButtonContent>
                      </Button>

                      {currentProductIndex < totalProducts - 1 ? (
                        <Button
                          variant="default"
                          size="lg"
                          className="h-14 w-full text-lg"
                          onClick={handleNextProduct}
                        >
                          <ButtonContent iconRight={IconArrowRight}>Next Product</ButtonContent>
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="lg"
                          className="h-14 w-full text-lg"
                          onClick={handleCompleteReceiving}
                          disabled={receiveMutation.isPending || !allComplete}
                        >
                          <ButtonContent iconLeft={receiveMutation.isPending ? IconLoader2 : IconCheck}>
                            {receiveMutation.isPending ? 'Completing...' : 'Complete Receiving'}
                          </ButtonContent>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Already verified badge */}
              {currentItem.isVerified && productPhase === 'verifying' && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
                  <Icon icon={IconCheck} className="text-emerald-600" />
                  <Typography variant="bodySm" className="text-emerald-800 dark:text-emerald-300">
                    Already verified. Tap to continue to labeling.
                  </Typography>
                  <Button variant="outline" size="sm" onClick={() => setProductPhase('printing')}>
                    Continue
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

            {/* Notes - per item, in detail view */}
            {currentItem && (
              <Card>
                <CardContent className="p-4">
                  <CardTitle className="mb-2 text-base">Notes for this product (Optional)</CardTitle>
                  <textarea
                    className="w-full rounded-lg border-2 border-border-primary bg-fill-primary p-3 text-base focus:border-border-brand focus:outline-none"
                    rows={2}
                    placeholder="Add notes about discrepancies, damage, etc."
                    value={currentItem.notes ?? ''}
                    onChange={(e) => updateItemNotes(e.target.value)}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Summary when all complete - shown in both views */}
        {allComplete && (
          <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Icon icon={IconCheck} size="lg" className="text-emerald-600" />
                <div className="flex-1">
                  <Typography variant="headingSm" className="text-emerald-800 dark:text-emerald-200">
                    All Products Received
                  </Typography>
                  <Typography variant="bodySm" className="mt-1 text-emerald-700 dark:text-emerald-300">
                    {completedProducts} products with{' '}
                    {Array.from(receivedItems.values()).reduce((sum, item) => sum + item.receivedCases, 0)} total cases
                  </Typography>
                  <Button
                    variant="default"
                    size="lg"
                    className="mt-4 h-14 w-full text-lg"
                    onClick={handleCompleteReceiving}
                    disabled={receiveMutation.isPending}
                  >
                    <ButtonContent iconLeft={receiveMutation.isPending ? IconLoader2 : IconCheck}>
                      {receiveMutation.isPending ? 'Completing...' : 'Complete Receiving'}
                    </ButtonContent>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

    </div>
  );
};

export default WMSReceiveShipmentPage;
