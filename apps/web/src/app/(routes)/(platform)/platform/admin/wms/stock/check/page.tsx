'use client';

import {
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconClipboardCheck,
  IconEdit,
  IconLoader2,
  IconMapPin,
  IconMinus,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
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
import useTRPC from '@/lib/trpc/browser';

type CheckMode = 'bay' | 'product';

interface StockItem {
  id: string;
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  bottleSize: number;
  caseConfig: number;
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
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onAdjustQty: (delta: number) => void;
  onSetQty: (qty: number) => void;
  onSetReason: (reason: string) => void;
  onSave: () => void;
}

const StockItemCard = ({
  item,
  isEditing,
  editingItem,
  adjustmentReason,
  isAdjusting,
  onStartEditing,
  onCancelEditing,
  onAdjustQty,
  onSetQty,
  onSetReason,
  onSave,
}: StockItemCardProps) => {
  return (
    <Card className={isEditing ? 'border-blue-500 ring-2 ring-blue-500/20' : ''}>
      <CardContent className="p-4">
        <div className="mb-3">
          <Typography variant="headingSm">{item.productName}</Typography>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
            {item.producer && <span>{item.producer}</span>}
            {item.vintage && <span>• {item.vintage}</span>}
            <span>
              • {item.caseConfig}x{item.bottleSize}ml
            </span>
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
            <Button variant="outline" size="sm" onClick={onStartEditing}>
              <ButtonContent iconLeft={IconEdit}>Edit Qty</ButtonContent>
            </Button>
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
                variant="primary"
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
  const queryClient = useQueryClient();
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
        toast.success(
          `Updated ${editingItem?.originalQty} → ${data.newQuantity} cases (${data.adjustment > 0 ? '+' : ''}${data.adjustment})`,
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

  // Handle barcode scan for bay mode
  const handleBayScan = useCallback(
    async (barcode: string) => {
      setScanError(null);

      try {
        const location = await lookupLocation({ barcode });
        setSelectedLocationId(location.id);
        setShowLocationList(false);
      } catch {
        setScanError(`Location not found: ${barcode}`);
      }
    },
    [lookupLocation],
  );

  // Handle barcode scan for product mode
  const handleProductScan = useCallback((barcode: string) => {
    setScanError(null);
    const lwin18 = extractLwin18FromBarcode(barcode);
    if (lwin18) {
      setSearchedLwin18(lwin18);
    } else {
      setScanError('Could not extract product code from barcode');
    }
  }, []);

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
              showKeyboard
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
              showKeyboard
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
                  <Typography variant="bodySm" colorRole="muted">
                    This location is empty
                  </Typography>
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
                      onStartEditing={() => startEditing(item)}
                      onCancelEditing={cancelEditing}
                      onAdjustQty={adjustQty}
                      onSetQty={setQty}
                      onSetReason={setAdjustmentReason}
                      onSave={saveAdjustment}
                    />
                  );
                })}
              </div>
            )}

            {!stockLoading && stockData.stock.length > 0 && !editingItem && (
              <Button variant="primary" size="lg" className="w-full" onClick={resetScan}>
                <ButtonContent iconLeft={IconCheck}>Done - Check Another Bay</ButtonContent>
              </Button>
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
                            • {product.caseConfig}x{product.bottleSize}ml
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
                        <Typography variant="headingXl" className="text-blue-600">
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
                          <div className="text-right">
                            <Typography variant="headingMd" className="text-blue-600">
                              {loc.quantityCases}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              cases
                            </Typography>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button variant="primary" size="lg" className="w-full" onClick={resetScan}>
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
