'use client';

import {
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardCheck,
  IconEdit,
  IconLoader2,
  IconMapPin,
  IconMinus,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconTransfer,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import OwnerBadge from '@/app/_wms/components/OwnerBadge';
import ScanInput from '@/app/_wms/components/ScanInput';
import type { ScanInputHandle } from '@/app/_wms/components/ScanInput';
import downloadZplFile from '@/app/_wms/utils/downloadZplFile';
import wifiPrint from '@/app/_wms/utils/wifiPrint';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

type CheckMode = 'bay' | 'product';

interface StockItem {
  id: string;
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  bottleSize: string | null;
  caseConfig: number | null;
  quantityCases: number;
  reservedCases: number | null;
  availableCases: number;
  lotNumber: string | null;
  ownerId: string | null;
  ownerName: string | null;
  expiryDate: Date | null;
  isPerishable: boolean | null;
}

interface EditingItem {
  stockId: string;
  originalQty: number;
  newQty: number;
}

/**
 * Parse a location code into its components
 * Format: A-01-02 (Aisle-Bay-Level)
 */
const parseLocationCode = (code: string): { aisle: string; bay: string; level: string } | null => {
  const parts = code.split('-');
  if (parts.length !== 3) return null;
  return { aisle: parts[0] ?? '', bay: parts[1] ?? '', level: parts[2] ?? '' };
};

/**
 * Get adjacent location codes for quick navigation
 */
const getAdjacentLocations = (code: string): { prev: string | null; next: string | null; up: string | null; down: string | null } => {
  const parsed = parseLocationCode(code);
  if (!parsed) return { prev: null, next: null, up: null, down: null };

  const { aisle, bay, level } = parsed;
  const bayNum = parseInt(bay, 10);
  const levelNum = parseInt(level, 10);

  const formatPart = (num: number) => String(num).padStart(2, '0');

  return {
    prev: bayNum > 1 ? `${aisle}-${formatPart(bayNum - 1)}-${level}` : null,
    next: `${aisle}-${formatPart(bayNum + 1)}-${level}`,
    up: `${aisle}-${bay}-${formatPart(levelNum + 1)}`,
    down: levelNum > 0 ? `${aisle}-${bay}-${formatPart(levelNum - 1)}` : null,
  };
};

/**
 * Extract lwin18 from a case barcode
 * Case barcode format: CASE-{lwin18}-{sequence}
 * Example: CASE-1002720201500600750-001 → 1002720201500600750
 */
const extractLwin18FromBarcode = (barcode: string): string | null => {
  // Check if it's a case barcode
  if (barcode.startsWith('CASE-')) {
    const parts = barcode.split('-');
    // CASE-{lwin18}-{seq} has at least 3 parts
    if (parts.length >= 3) {
      // lwin18 is the middle part (could have multiple segments if lwin has dashes)
      // Join everything except first (CASE) and last (sequence) parts
      const lwin18 = parts.slice(1, -1).join('-');
      return lwin18;
    }
  }
  // If not a case barcode, assume it's a raw lwin18/SKU
  return barcode;
};

/**
 * Stock item card with edit functionality
 */
interface StockItemCardProps {
  item: StockItem;
  isEditing: boolean;
  editingItem: EditingItem | null;
  adjustmentReason: string;
  isAdjusting: boolean;
  isPrinting: boolean;
  isPrintingStockLabel: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onAdjustQty: (delta: number) => void;
  onSetQty: (qty: number) => void;
  onSetReason: (reason: string) => void;
  onSave: () => void;
  onPrintLabels: () => void;
  onPrintStockLabel: () => void;
}

const StockItemCard = ({
  item,
  isEditing,
  editingItem,
  adjustmentReason,
  isAdjusting,
  isPrinting,
  isPrintingStockLabel,
  onStartEditing,
  onCancelEditing,
  onAdjustQty,
  onSetQty,
  onSetReason,
  onSave,
  onPrintLabels,
  onPrintStockLabel,
}: StockItemCardProps) => {
  return (
    <Card className={isEditing ? 'border-blue-500 ring-2 ring-blue-500/20' : ''}>
      <CardContent className="p-4">
        <div className="mb-3">
          <Typography variant="headingSm">{item.productName}</Typography>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
            {item.producer && <span>{item.producer}</span>}
            {item.vintage && <span>• {item.vintage}</span>}
            {item.caseConfig && item.bottleSize && (
              <span>
                • {item.caseConfig}x{String(item.bottleSize).replace(/\D/g, '')}ml
              </span>
            )}
          </div>
          <Typography variant="bodyXs" colorRole="muted" className="mt-1 font-mono">
            {item.lwin18}
          </Typography>
          {item.ownerName && (
            <div className="mt-2">
              <OwnerBadge ownerName={item.ownerName} size="sm" />
            </div>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center justify-between">
            <div>
              <Typography variant="headingLg" className="text-blue-600">
                {item.quantityCases}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                cases in system
              </Typography>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onPrintLabels}
                disabled={isPrinting}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-primary text-text-muted transition-colors hover:bg-fill-secondary hover:text-text-primary disabled:opacity-50"
                title="Reprint case labels"
              >
                {isPrinting ? (
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <IconPrinter className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={onPrintStockLabel}
                disabled={isPrintingStockLabel}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-300 text-indigo-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                title="Print stock label"
              >
                {isPrintingStockLabel ? (
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <IconPrinter className="h-4 w-4" />
                )}
              </button>
              <Button variant="outline" size="sm" onClick={onStartEditing}>
                <ButtonContent iconLeft={IconEdit}>Edit Qty</ButtonContent>
              </Button>
            </div>
          </div>
        )}

        {isEditing && editingItem && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => onAdjustQty(-1)}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600 transition-colors hover:bg-red-200 active:bg-red-300 dark:bg-red-900/30 dark:hover:bg-red-900/50"
              >
                <IconMinus className="h-6 w-6" />
              </button>

              <input
                type="number"
                value={editingItem.newQty}
                onChange={(e) => onSetQty(parseInt(e.target.value, 10) || 0)}
                className="w-20 rounded-lg border-2 border-border-primary bg-fill-primary px-2 py-3 text-center text-2xl font-bold focus:border-blue-500 focus:outline-none"
                min={0}
              />

              <button
                type="button"
                onClick={() => onAdjustQty(1)}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition-colors hover:bg-emerald-200 active:bg-emerald-300 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50"
              >
                <IconPlus className="h-6 w-6" />
              </button>
            </div>

            {editingItem.newQty !== editingItem.originalQty && (
              <Typography
                variant="bodySm"
                className={`text-center ${
                  editingItem.newQty > editingItem.originalQty
                    ? 'text-emerald-600'
                    : 'text-red-600'
                }`}
              >
                {editingItem.newQty > editingItem.originalQty ? '+' : ''}
                {editingItem.newQty - editingItem.originalQty} from {editingItem.originalQty}
              </Typography>
            )}

            <input
              type="text"
              placeholder="Reason (optional)"
              value={adjustmentReason}
              onChange={(e) => onSetReason(e.target.value)}
              className="w-full rounded-lg border border-border-primary bg-fill-primary px-3 py-2 text-sm focus:border-border-brand focus:outline-none"
            />

            <div className="flex gap-2">
              <Button variant="outline" size="md" className="flex-1" onClick={onCancelEditing}>
                <ButtonContent iconLeft={IconX}>Cancel</ButtonContent>
              </Button>
              <Button
                variant="default"
                size="md"
                className="flex-1"
                onClick={onSave}
                disabled={isAdjusting}
              >
                <ButtonContent iconLeft={isAdjusting ? IconLoader2 : IconCheck}>
                  {isAdjusting ? 'Saving...' : 'Save'}
                </ButtonContent>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Stock Check / Cycle Count page
 *
 * Two modes:
 * 1. By Bay - Scan a location to check all stock in that bay
 * 2. By Product - Scan a case barcode to see total stock across all locations
 */
const StockCheckPage = () => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const scanInputRef = useRef<ScanInputHandle>(null);

  // Mode selection
  const [mode, setMode] = useState<CheckMode>('bay');

  // Bay mode state
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [showLocationList, setShowLocationList] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');

  // Product mode state
  const [searchedLwin18, setSearchedLwin18] = useState<string | null>(null);

  // Shared state
  const [scanError, setScanError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Fetch locations for selection
  const { data: locations, isLoading: locationsLoading } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({ isActive: true }),
    enabled: showLocationList,
  });

  // Lookup location by barcode
  const { mutateAsync: lookupLocation, isPending: isLookingUp } = useMutation(
    api.wms.admin.operations.getLocationByBarcode.mutationOptions(),
  );

  // Get stock at selected location (bay mode)
  const { data: stockData, isLoading: stockLoading } = useQuery({
    ...api.wms.admin.operations.getStockAtLocation.queryOptions({
      locationId: selectedLocationId!,
    }),
    enabled: mode === 'bay' && !!selectedLocationId,
  });

  // Get stock by product (product mode)
  const { data: productStockData, isLoading: productStockLoading } = useQuery({
    ...api.wms.admin.stock.getByProduct.queryOptions({
      search: searchedLwin18!,
      limit: 1,
    }),
    enabled: mode === 'product' && !!searchedLwin18,
  });

  // Adjust stock quantity mutation
  const { mutate: adjustQuantity, isPending: isAdjusting } = useMutation({
    ...api.wms.admin.stock.adjustQuantity.mutationOptions(),
    onSuccess: (data) => {
      if (data.noChange) {
        toast.info('No change - quantity was already correct');
      } else {
        const adj = data.adjustment ?? 0;
        toast.success(
          `Updated ${editingItem?.originalQty} → ${data.newQuantity} cases (${adj > 0 ? '+' : ''}${adj})`,
        );
      }
      setEditingItem(null);
      setAdjustmentReason('');
      // Refetch stock data
      void queryClient.invalidateQueries({ queryKey: ['wms', 'admin', 'operations', 'getStockAtLocation'] });
      void queryClient.invalidateQueries({ queryKey: ['wms', 'admin', 'stock', 'getByProduct'] });
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Reprint case labels mutation
  const [printingStockId, setPrintingStockId] = useState<string | null>(null);
  const { mutate: reprintLabels } = useMutation({
    ...api.wms.admin.labels.reprintCaseLabels.mutationOptions(),
    onSuccess: async (data) => {
      setPrintingStockId(null);
      if (!data.success) {
        toast.error(data.error || 'Failed to generate labels');
        return;
      }
      // Print via WiFi, fall back to file download
      const printed = await wifiPrint(data.zpl);
      if (!printed) {
        downloadZplFile(data.zpl, `reprint-labels-${data.quantity}`);
      }
      toast.success(`Printed ${data.quantity} label${data.quantity !== 1 ? 's' : ''}`);
    },
    onError: (error) => {
      setPrintingStockId(null);
      toast.error(`Failed to reprint labels: ${error.message}`);
    },
  });

  // Handle print case labels for a stock item
  const handlePrintLabels = useCallback((stockId: string) => {
    setPrintingStockId(stockId);
    reprintLabels({ stockId });
  }, [reprintLabels]);

  // Print stock summary label mutation
  const [printingStockLabelId, setPrintingStockLabelId] = useState<string | null>(null);
  const { mutate: printStockLabel } = useMutation({
    ...api.wms.admin.labels.printStockLabel.mutationOptions(),
    onSuccess: async (data) => {
      setPrintingStockLabelId(null);
      if (!data.success) {
        toast.error(data.error || 'Failed to generate label');
        return;
      }
      const printed = await wifiPrint(data.zpl);
      if (!printed) {
        downloadZplFile(data.zpl, `stock-label-${data.quantityCases}cs`);
      }
      toast.success(`Printed stock label: ${data.quantityCases} cases`);
    },
    onError: (error) => {
      setPrintingStockLabelId(null);
      toast.error(`Failed to print stock label: ${error.message}`);
    },
  });

  // Handle print stock label for a stock item
  const handlePrintStockLabel = useCallback((stockId: string) => {
    setPrintingStockLabelId(stockId);
    printStockLabel({ stockId });
  }, [printStockLabel]);

  // Handle barcode scan for bay mode
  const handleBayScan = useCallback(
    async (barcode: string) => {
      setScanError(null);

      // Check if it's a pallet barcode - redirect to pallet detail page
      if (barcode.startsWith('PALLET')) {
        try {
          const result = await trpcClient.wms.admin.pallets.getByBarcode.query({ barcode });
          if (result.pallet) {
            router.push(`/platform/admin/wms/pallets/${result.pallet.id}`);
            return;
          }
        } catch {
          setScanError(`Pallet not found: ${barcode}`);
          return;
        }
      }

      try {
        const result = await lookupLocation({ barcode });
        setSelectedLocationId(result.location.id);
        setShowLocationList(false);
      } catch {
        setScanError(`Location not found: ${barcode}`);
      }
    },
    [lookupLocation, trpcClient, router],
  );

  // Handle barcode scan for product mode
  const handleProductScan = useCallback(
    async (barcode: string) => {
      setScanError(null);

      // Check if it's a pallet barcode - redirect to pallet detail page
      if (barcode.startsWith('PALLET')) {
        try {
          const result = await trpcClient.wms.admin.pallets.getByBarcode.query({ barcode });
          if (result.pallet) {
            router.push(`/platform/admin/wms/pallets/${result.pallet.id}`);
            return;
          }
        } catch {
          setScanError(`Pallet not found: ${barcode}`);
          return;
        }
      }

      const lwin18 = extractLwin18FromBarcode(barcode);
      if (lwin18) {
        setSearchedLwin18(lwin18);
      } else {
        setScanError('Could not extract product code from barcode');
      }
    },
    [trpcClient, router],
  );

  // Handle location selection from list
  const handleSelectLocation = useCallback((locationId: string) => {
    setSelectedLocationId(locationId);
    setShowLocationList(false);
  }, []);

  // Start editing a stock item
  const startEditing = useCallback((item: StockItem) => {
    setEditingItem({
      stockId: item.id,
      originalQty: item.quantityCases,
      newQty: item.quantityCases,
    });
    setAdjustmentReason('');
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingItem(null);
    setAdjustmentReason('');
  }, []);

  // Adjust quantity in edit mode
  const adjustQty = useCallback((delta: number) => {
    setEditingItem((prev) => {
      if (!prev) return null;
      return { ...prev, newQty: Math.max(0, prev.newQty + delta) };
    });
  }, []);

  // Set quantity directly
  const setQty = useCallback((qty: number) => {
    setEditingItem((prev) => {
      if (!prev) return null;
      return { ...prev, newQty: Math.max(0, qty) };
    });
  }, []);

  // Save the adjustment
  const saveAdjustment = useCallback(() => {
    if (!editingItem) return;

    const reason =
      adjustmentReason.trim() ||
      `Cycle count: was ${editingItem.originalQty}, now ${editingItem.newQty}`;

    adjustQuantity({
      stockId: editingItem.stockId,
      newQuantity: editingItem.newQty,
      reason,
    });
  }, [editingItem, adjustmentReason, adjustQuantity]);

  // Reset to scan again
  const resetScan = useCallback(() => {
    setSelectedLocationId(null);
    setSearchedLwin18(null);
    setEditingItem(null);
    setAdjustmentReason('');
    setScanError(null);
    setTimeout(() => scanInputRef.current?.focus(), 100);
  }, []);

  // Switch mode
  const switchMode = useCallback((newMode: CheckMode) => {
    setMode(newMode);
    setSelectedLocationId(null);
    setSearchedLwin18(null);
    setEditingItem(null);
    setAdjustmentReason('');
    setScanError(null);
    setShowLocationList(false);
  }, []);

  // Filter locations for search
  const filteredLocations =
    locations?.filter(
      (loc) =>
        loc.locationCode.toLowerCase().includes(locationSearch.toLowerCase()) ||
        (loc.locationType && loc.locationType.toLowerCase().includes(locationSearch.toLowerCase())),
    ) ?? [];

  // Get the product from search results
  const product = productStockData?.products[0];

  // Determine if we're showing results
  const showingBayResults = mode === 'bay' && selectedLocationId && stockData;
  const showingProductResults = mode === 'product' && searchedLwin18 && productStockData;

  return (
    <div className="container mx-auto max-w-lg px-4 py-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link
            href="/platform/admin/wms/stock"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary"
          >
            <IconArrowLeft className="h-6 w-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <Typography variant="headingLg" className="mb-1">
              Stock Check
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              {mode === 'bay' ? 'Scan a bay to check stock' : 'Scan a case to see total stock'}
            </Typography>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 rounded-lg bg-fill-secondary p-1">
          <button
            onClick={() => switchMode('bay')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'bay'
                ? 'bg-fill-primary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Icon icon={IconMapPin} size="sm" />
            <span>By Bay</span>
          </button>
          <button
            onClick={() => switchMode('product')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'product'
                ? 'bg-fill-primary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Icon icon={IconBox} size="sm" />
            <span>By Product</span>
          </button>
        </div>

        {/* Bay Mode - Selection Phase */}
        {mode === 'bay' && !selectedLocationId && (
          <div className="space-y-4">
            <ScanInput
              ref={scanInputRef}
              label="Scan bay barcode"
              placeholder="LOC-A-01-02..."
              onScan={handleBayScan}
              isLoading={isLookingUp}
              error={scanError ?? undefined}
              showKeyboard={false}
            />

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border-primary" />
              <Typography variant="bodyXs" colorRole="muted">
                OR
              </Typography>
              <div className="h-px flex-1 bg-border-primary" />
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setShowLocationList(!showLocationList)}
            >
              <ButtonContent iconLeft={IconMapPin}>
                {showLocationList ? 'Hide Location List' : 'Select from List'}
              </ButtonContent>
            </Button>

            {showLocationList && (
              <Card>
                <CardContent className="p-4">
                  <div className="relative mb-4">
                    <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search locations..."
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      className="w-full rounded-lg border border-border-primary bg-fill-primary py-2 pl-10 pr-4 text-sm focus:border-border-brand focus:outline-none"
                    />
                  </div>

                  {locationsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" />
                    </div>
                  ) : filteredLocations.length === 0 ? (
                    <Typography variant="bodySm" colorRole="muted" className="py-4 text-center">
                      No locations found
                    </Typography>
                  ) : (
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {filteredLocations.map((loc) => (
                        <button
                          key={loc.id}
                          onClick={() => handleSelectLocation(loc.id)}
                          className="flex w-full items-center justify-between rounded-lg border border-border-primary p-3 text-left transition-colors hover:border-border-brand hover:bg-fill-secondary"
                        >
                          <LocationBadge
                            locationCode={loc.locationCode}
                            locationType={loc.locationType as 'rack' | 'floor' | 'receiving' | 'shipping'}
                            size="md"
                          />
                          <div className="text-right">
                            <Typography variant="headingSm" className="text-blue-600">
                              {loc.totalCases ?? 0}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              cases
                            </Typography>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Product Mode - Selection Phase */}
        {mode === 'product' && !searchedLwin18 && (
          <div className="space-y-4">
            <ScanInput
              ref={scanInputRef}
              label="Scan case barcode or enter SKU"
              placeholder="CASE-1002720... or 1002720..."
              onScan={handleProductScan}
              error={scanError ?? undefined}
              showKeyboard={false}
            />

            <Typography variant="bodyXs" colorRole="muted" className="text-center">
              Scan any case to see total stock of that product across all locations
            </Typography>
          </div>
        )}

        {/* Bay Mode - Results */}
        {showingBayResults && (
          <div className="space-y-4">
            <Card className="bg-fill-secondary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <LocationBadge
                      locationCode={stockData.location.locationCode}
                      locationType={stockData.location.locationType as 'rack' | 'floor' | 'receiving' | 'shipping'}
                      size="lg"
                    />
                    <Typography variant="bodySm" colorRole="muted" className="mt-1">
                      {stockData.stock.length} product{stockData.stock.length !== 1 ? 's' : ''} •{' '}
                      {stockData.totalCases} total cases
                    </Typography>
                  </div>
                  <Button variant="outline" size="sm" onClick={resetScan}>
                    <ButtonContent iconLeft={IconX}>Change</ButtonContent>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {stockLoading && (
              <div className="flex items-center justify-center py-8">
                <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
              </div>
            )}

            {!stockLoading && stockData.stock.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Icon icon={IconClipboardCheck} size="xl" colorRole="muted" className="mx-auto mb-4" />
                  <Typography variant="headingSm" className="mb-2">
                    No Stock
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted" className="mb-4">
                    This location is empty
                  </Typography>
                  <Link href={`/platform/admin/wms/transfer?to=${stockData.location.locationCode}`}>
                    <Button variant="outline" size="md">
                      <ButtonContent iconLeft={IconTransfer}>Transfer Stock Here</ButtonContent>
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {!stockLoading && stockData.stock.length > 0 && (
              <div className="space-y-3">
                {stockData.stock.map((item) => {
                  const isEditing = editingItem?.stockId === item.id;
                  return (
                    <StockItemCard
                      key={item.id}
                      item={item}
                      isEditing={isEditing}
                      editingItem={editingItem}
                      adjustmentReason={adjustmentReason}
                      isAdjusting={isAdjusting}
                      isPrinting={printingStockId === item.id}
                      isPrintingStockLabel={printingStockLabelId === item.id}
                      onStartEditing={() => startEditing(item)}
                      onCancelEditing={cancelEditing}
                      onAdjustQty={adjustQty}
                      onSetQty={setQty}
                      onSetReason={setAdjustmentReason}
                      onSave={saveAdjustment}
                      onPrintLabels={() => handlePrintLabels(item.id)}
                      onPrintStockLabel={() => handlePrintStockLabel(item.id)}
                    />
                  );
                })}
              </div>
            )}

            {!stockLoading && !editingItem && (
              <>
                {/* Quick Location Navigation */}
                {stockData.location.locationCode && (() => {
                  const adjacent = getAdjacentLocations(stockData.location.locationCode);
                  return (
                    <Card>
                      <CardContent className="p-3">
                        <Typography variant="bodyXs" colorRole="muted" className="mb-2 text-center">
                          Quick Navigate
                        </Typography>
                        <div className="grid grid-cols-3 gap-2">
                          {/* Previous Bay */}
                          <button
                            onClick={() => adjacent.prev && handleBayScan(`LOC-${adjacent.prev}`)}
                            disabled={!adjacent.prev}
                            className="flex h-10 items-center justify-center gap-1 rounded-lg border border-border-primary bg-fill-primary text-sm transition-colors hover:bg-fill-secondary disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <IconChevronLeft className="h-4 w-4" />
                            {adjacent.prev || '--'}
                          </button>

                          {/* Current (shows up/down) */}
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => adjacent.up && handleBayScan(`LOC-${adjacent.up}`)}
                              disabled={!adjacent.up}
                              className="flex h-4 items-center justify-center rounded border border-border-primary bg-fill-primary text-xs transition-colors hover:bg-fill-secondary disabled:opacity-30"
                            >
                              ▲ {adjacent.up?.split('-')[2] || ''}
                            </button>
                            <button
                              onClick={() => adjacent.down && handleBayScan(`LOC-${adjacent.down}`)}
                              disabled={!adjacent.down}
                              className="flex h-4 items-center justify-center rounded border border-border-primary bg-fill-primary text-xs transition-colors hover:bg-fill-secondary disabled:opacity-30"
                            >
                              ▼ {adjacent.down?.split('-')[2] || ''}
                            </button>
                          </div>

                          {/* Next Bay */}
                          <button
                            onClick={() => adjacent.next && handleBayScan(`LOC-${adjacent.next}`)}
                            disabled={!adjacent.next}
                            className="flex h-10 items-center justify-center gap-1 rounded-lg border border-border-primary bg-fill-primary text-sm transition-colors hover:bg-fill-secondary disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            {adjacent.next || '--'}
                            <IconChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                <Button variant="default" size="lg" className="w-full" onClick={resetScan}>
                  <ButtonContent iconLeft={IconCheck}>Done - Check Another Bay</ButtonContent>
                </Button>
              </>
            )}
          </div>
        )}

        {/* Product Mode - Results */}
        {showingProductResults && (
          <div className="space-y-4">
            {productStockLoading && (
              <div className="flex items-center justify-center py-8">
                <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
              </div>
            )}

            {!productStockLoading && !product && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Icon icon={IconBox} size="xl" colorRole="muted" className="mx-auto mb-4" />
                  <Typography variant="headingSm" className="mb-2">
                    Product Not Found
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    No stock found for: {searchedLwin18}
                  </Typography>
                  <Button variant="outline" size="md" className="mt-4" onClick={resetScan}>
                    <ButtonContent iconLeft={IconSearch}>Search Again</ButtonContent>
                  </Button>
                </CardContent>
              </Card>
            )}

            {!productStockLoading && product && (
              <>
                {/* Product Header */}
                <Card className="bg-fill-secondary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Typography variant="headingSm">{product.productName}</Typography>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                          {product.producer && <span>{product.producer}</span>}
                          {product.vintage && <span>• {product.vintage}</span>}
                          <span>
                            • {product.caseConfig}x{String(product.bottleSize).replace(/\D/g, '')}ml
                          </span>
                        </div>
                        <Typography variant="bodyXs" colorRole="muted" className="mt-1 font-mono">
                          {product.lwin18}
                        </Typography>
                      </div>
                      <Button variant="outline" size="sm" onClick={resetScan}>
                        <ButtonContent iconLeft={IconX}>Change</ButtonContent>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Stock Summary */}
                <Card className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Typography variant="bodyXs" colorRole="muted">
                          TOTAL STOCK (ALL LOCATIONS)
                        </Typography>
                        <Typography variant="headingLg" className="text-2xl text-blue-600">
                          {product.totalCases} cases
                        </Typography>
                        <Typography variant="bodySm" colorRole="muted">
                          {product.totalBottles} bottles across {product.locationCount} location
                          {product.locationCount !== 1 ? 's' : ''}
                        </Typography>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Location Breakdown */}
                <Typography variant="headingSm" className="pt-2">
                  By Location
                </Typography>

                <div className="space-y-3">
                  {product.locations.map((loc, idx) => (
                    <Card key={`${loc.locationId}-${idx}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <LocationBadge
                              locationCode={loc.locationCode}
                              locationType={loc.locationType as 'rack' | 'floor' | 'receiving' | 'shipping'}
                              size="md"
                            />
                            {loc.ownerName && (
                              <OwnerBadge ownerName={loc.ownerName} size="sm" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePrintLabels(loc.stockId)}
                              disabled={printingStockId === loc.stockId}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-primary text-text-muted transition-colors hover:bg-fill-secondary hover:text-text-primary disabled:opacity-50"
                              title="Print case labels"
                            >
                              {printingStockId === loc.stockId ? (
                                <IconLoader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <IconPrinter className="h-4 w-4" />
                              )}
                            </button>
                            <div className="text-right">
                              <Typography variant="headingMd" className="text-blue-600">
                                {loc.quantityCases}
                              </Typography>
                              <Typography variant="bodyXs" colorRole="muted">
                                cases
                              </Typography>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button variant="default" size="lg" className="w-full" onClick={resetScan}>
                  <ButtonContent iconLeft={IconCheck}>Done - Check Another Product</ButtonContent>
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockCheckPage;
