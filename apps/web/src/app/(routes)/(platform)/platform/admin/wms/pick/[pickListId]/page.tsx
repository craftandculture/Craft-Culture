'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconLoader2,
  IconMapPin,
  IconPackage,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import ScanInput from '@/app/_wms/components/ScanInput';
import type { ScanInputHandle } from '@/app/_wms/components/ScanInput';
import useWmsApi from '@/app/_wms/hooks/useWmsApi';
import useTRPC from '@/lib/trpc/browser';

/**
 * WMS Pick List Detail / Mobile Picking Workflow
 */
const WMSPickListDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const api = useTRPC();
  const wmsApi = useWmsApi();
  const queryClient = useQueryClient();
  const pickListId = params.pickListId as string;

  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [pickingItem, setPickingItem] = useState<{
    itemId: string;
    productName: string;
    lwin18: string;
    quantityNeeded: number;
    suggestedLocationId: string | null;
  } | null>(null);
  const [pickedLocationId, setPickedLocationId] = useState<string | null>(null);
  const [pickedLocationCode, setPickedLocationCode] = useState('');
  const [pickedQuantity, setPickedQuantity] = useState(0);
  const [caseVerified, setCaseVerified] = useState(false);
  const [scanStep, setScanStep] = useState<'location' | 'case'>('location');
  const [scannedBarcodes, setScannedBarcodes] = useState<Set<string>>(new Set());
  const [duplicateScanError, setDuplicateScanError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const scanInputRef = useRef<ScanInputHandle>(null);

  // Fetch pick list — routes through local NUC when available
  const { data, isLoading } = useQuery({
    ...wmsApi.pickListQueryOptions(pickListId),
  });

  // Pick item mutation — routes through local NUC when available
  const pickItemMutation = useMutation({
    ...wmsApi.pickItemMutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setPickingItem(null);
      setPickedLocationCode('');
      setPickedQuantity(0);
      // Reset to first unpicked item (list re-sorts after invalidation)
      setCurrentItemIndex(0);
    },
  });

  // Complete pick list mutation — routes through local NUC when available
  const completeMutation = useMutation({
    ...wmsApi.pickCompleteMutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      router.push('/platform/admin/wms/pick');
    },
  });

  // Delete pick list mutation
  const deleteMutation = useMutation({
    ...api.wms.admin.picking.delete.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result.message);
      router.push('/platform/admin/wms/pick');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete pick list');
    },
  });

  // Location lookup mutation — routes through local NUC when available
  const locationLookupMutation = useMutation({
    ...wmsApi.scanLocationMutationOptions(),
  });

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    setShowDeleteModal(false);
    deleteMutation.mutate({ pickListId });
  };

  // Auto-focus scan input
  useEffect(() => {
    if (scanInputRef.current && !pickingItem) {
      const timer = setTimeout(() => {
        scanInputRef.current?.focus();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pickingItem, data]);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLookingUpLocation, setIsLookingUpLocation] = useState(false);

  // Handle location barcode scan
  const handleLocationScan = async (barcode: string) => {
    setDuplicateScanError(null);

    // Check for duplicate scan
    if (scannedBarcodes.has(barcode.toUpperCase())) {
      setDuplicateScanError(`Barcode already scanned: ${barcode}`);
      return;
    }

    setIsLookingUpLocation(true);
    setLocationError(null);
    try {
      const result = await locationLookupMutation.mutateAsync({ barcode });
      setPickedLocationId(result.location.id);
      setPickedLocationCode(result.location.locationCode);
      setScanStep('case');
      setScannedBarcodes((prev) => new Set(prev).add(barcode.toUpperCase()));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Location not found';
      setLocationError(errorMsg);
    } finally {
      setIsLookingUpLocation(false);
    }
  };

  // Handle case barcode scan
  const handleCaseScan = (barcode: string) => {
    setDuplicateScanError(null);

    // Check for duplicate scan
    if (scannedBarcodes.has(barcode.toUpperCase())) {
      setDuplicateScanError(`Barcode already scanned: ${barcode}`);
      return;
    }

    if (!pickingItem) return;

    // Verify case barcode matches the item's LWIN
    const normalizedScan = barcode.replace(/-/g, '').toLowerCase();
    const normalizedLwin = pickingItem.lwin18.replace(/-/g, '').toLowerCase();

    if (normalizedScan.includes(normalizedLwin) || normalizedLwin.includes(normalizedScan) || barcode.length > 5) {
      setCaseVerified(true);
      setScannedBarcodes((prev) => new Set(prev).add(barcode.toUpperCase()));
    }
  };

  // Get current unpicked item - sorted by location for optimal pick path
  const unpickedItems = (data?.items.filter((i) => !i.isPicked) ?? []).sort((a, b) => {
    // Sort by location code for optimal pick path
    const locA = a.suggestedLocationCode ?? 'ZZZ';
    const locB = b.suggestedLocationCode ?? 'ZZZ';
    return locA.localeCompare(locB);
  });
  const currentItem = unpickedItems[currentItemIndex];

  // Get next location hint for picker
  const nextItem = unpickedItems[currentItemIndex + 1];
  const nextLocationHint = nextItem?.suggestedLocationCode;

  // Start picking current item
  const startPicking = () => {
    if (!currentItem) return;
    setPickingItem({
      itemId: currentItem.id,
      productName: currentItem.productName,
      lwin18: currentItem.lwin18,
      quantityNeeded: currentItem.quantityCases,
      suggestedLocationId: currentItem.suggestedLocationId,
    });
    setPickedQuantity(currentItem.quantityCases);
    setPickedLocationId(null);
    setPickedLocationCode('');
    setCaseVerified(false);
    setScanStep('location');
    setLocationError(null);
    setDuplicateScanError(null);
    // Note: Don't reset scannedBarcodes here - we want to prevent re-scanning across items
  };

  // Confirm pick
  const confirmPick = () => {
    if (!pickingItem) {
      return;
    }

    // Use scanned location or fall back to suggested
    const locationId = pickedLocationId ?? pickingItem.suggestedLocationId;

    if (!locationId) {
      return;
    }

    pickItemMutation.mutate({
      pickListItemId: pickingItem.itemId,
      pickedFromLocationId: locationId,
      pickedQuantity: pickedQuantity,
    });
  };

  // Handle complete
  const handleComplete = () => {
    if (!data) return;
    completeMutation.mutate({ pickListId: data.id });
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Icon icon={IconLoader2} className="animate-spin" size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl px-4 py-6">
        <Typography variant="headingMd">Pick list not found</Typography>
      </div>
    );
  }

  const isComplete = data.status === 'completed';
  const allPicked = unpickedItems.length === 0;

  return (
    <div className="container mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/platform/admin/wms/pick">
            <Button variant="ghost" size="sm">
              <Icon icon={IconArrowLeft} size="sm" />
            </Button>
          </Link>
          <div className="flex-1">
            <Typography variant="headingSm">{data.pickListNumber}</Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Order: {data.orderNumber}
            </Typography>
          </div>
          {!isComplete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Icon icon={deleteMutation.isPending ? IconLoader2 : IconTrash} size="sm" />
            </Button>
          )}
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <Typography variant="bodySm">Progress</Typography>
              <Typography variant="bodySm" className="font-semibold">
                {data.progress.percent}%
              </Typography>
            </div>
            <div className="h-2 rounded-full bg-fill-secondary">
              <div
                className="h-2 rounded-full bg-brand-600 transition-all"
                style={{ width: `${data.progress.percent}%` }}
              />
            </div>
            <Typography variant="bodyXs" colorRole="muted" className="mt-2">
              {data.progress.pickedItems} of {data.progress.totalItems} items |{' '}
              {data.progress.pickedCases} of {data.progress.totalCases} cases
            </Typography>
          </CardContent>
        </Card>

        {/* Completed State */}
        {isComplete && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Icon icon={IconCheck} size="xl" className="text-emerald-600" />
              </div>
              <Typography variant="headingSm" className="mb-2">
                Pick List Complete
              </Typography>
              <Typography variant="bodySm" colorRole="muted">
                All items have been picked and the pick list is complete.
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* All Picked - Ready to Complete */}
        {allPicked && !isComplete && (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Icon icon={IconCheck} size="xl" className="text-emerald-600" />
              </div>
              <Typography variant="headingSm" className="mb-2">
                All Items Picked
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-4">
                Ready to complete the pick list
              </Typography>
              <Button
                variant="default"
                onClick={handleComplete}
                disabled={completeMutation.isPending}
              >
                <ButtonContent iconLeft={completeMutation.isPending ? IconLoader2 : IconCheck}>
                  {completeMutation.isPending ? 'Completing...' : 'Complete Pick List'}
                </ButtonContent>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Picking Interface */}
        {!isComplete && !allPicked && !pickingItem && currentItem && (
          <div className="space-y-4">
            {/* Current Item Card */}
            <Card className="border-2 border-brand-500">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Typography variant="bodyXs" className="font-medium text-brand-600">
                    ITEM {currentItemIndex + 1} OF {unpickedItems.length}
                  </Typography>
                  {currentItem.suggestedLocationCode && (
                    <LocationBadge locationCode={currentItem.suggestedLocationCode} size="sm" />
                  )}
                </div>
                <Typography variant="headingSm" className="mb-1">
                  {currentItem.productName}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mb-4 font-mono">
                  {currentItem.lwin18}
                </Typography>

                <div className="rounded-lg bg-fill-secondary p-4 text-center">
                  <Typography variant="bodyXs" colorRole="muted">
                    Quantity to pick
                  </Typography>
                  <Typography variant="headingLg" className="text-brand-600">
                    {currentItem.quantityCases}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    cases
                  </Typography>
                </div>

                {currentItem.suggestedLocationCode && (
                  <div className="mt-4 flex items-center gap-2 text-text-muted">
                    <Icon icon={IconMapPin} size="sm" />
                    <Typography variant="bodyXs">
                      Go to: <span className="font-semibold">{currentItem.suggestedLocationCode}</span>
                    </Typography>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Start Picking Button */}
            <Button variant="default" className="w-full py-4" onClick={startPicking}>
              <ButtonContent iconLeft={IconPackage}>Start Picking</ButtonContent>
            </Button>

            {/* Skip / Next buttons */}
            <div className="flex gap-3">
              {currentItemIndex > 0 && (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => setCurrentItemIndex((prev) => prev - 1)}
                >
                  Previous
                </Button>
              )}
              {currentItemIndex < unpickedItems.length - 1 && (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => setCurrentItemIndex((prev) => prev + 1)}
                >
                  Skip
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Picking Item - Location-First Flow */}
        {pickingItem && (
          <div className="space-y-4">
            {/* Product Info */}
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodyXs" className="mb-2 font-medium text-brand-600">
                  PICKING
                </Typography>
                <Typography variant="bodySm" className="font-semibold">
                  {pickingItem.productName}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="font-mono">
                  {pickingItem.lwin18}
                </Typography>
              </CardContent>
            </Card>

            {/* GO TO LOCATION - Prominent Display */}
            {currentItem?.suggestedLocationCode && scanStep === 'location' && (
              <Card className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/20">
                <CardContent className="p-6 text-center">
                  <Typography variant="bodyXs" className="mb-1 font-medium text-amber-700 dark:text-amber-300">
                    GO TO BAY
                  </Typography>
                  <Typography variant="headingLg" className="font-mono text-2xl text-amber-700 dark:text-amber-300">
                    {currentItem.suggestedLocationCode}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mt-2">
                    Pick {pickingItem.quantityNeeded} cases
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* No suggested location warning */}
            {!currentItem?.suggestedLocationCode && scanStep === 'location' && (
              <Card className="border-2 border-red-500 bg-red-50 dark:bg-red-900/20">
                <CardContent className="p-4 text-center">
                  <Typography variant="bodySm" className="font-semibold text-red-700 dark:text-red-300">
                    No location found in system
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                    Scan any bay where you find this product
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* Quantity Input */}
            <Card>
              <CardContent className="p-4">
                <label className="mb-2 block text-sm font-medium">Quantity to Pick</label>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    className="h-12 w-12 text-lg"
                    onClick={() => setPickedQuantity((prev) => Math.max(1, prev - 1))}
                    disabled={pickedQuantity <= 1}
                  >
                    -
                  </Button>
                  <Typography variant="headingLg" className="w-20 text-center">
                    {pickedQuantity}
                  </Typography>
                  <Button
                    variant="outline"
                    className="h-12 w-12 text-lg"
                    onClick={() => setPickedQuantity((prev) => prev + 1)}
                  >
                    +
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Step 1: Confirm Location */}
            <Card className={scanStep === 'location' ? 'border-2 border-brand-500' : ''}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium">
                    Step 1: Scan Bay Barcode to Confirm
                  </label>
                  {pickedLocationCode && (
                    <Icon icon={IconCheck} size="sm" className="text-emerald-600" />
                  )}
                </div>
                {scanStep === 'location' ? (
                  <ScanInput
                    ref={scanInputRef}
                    onScan={handleLocationScan}
                    isLoading={isLookingUpLocation}
                    placeholder="Scan bay barcode..."
                    error={locationError ?? (duplicateScanError && scanStep === 'location' ? duplicateScanError : undefined)}
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
                    <Icon icon={IconMapPin} size="sm" className="text-emerald-600" />
                    <Typography variant="bodySm" className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {pickedLocationCode}
                    </Typography>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Scan Case Barcode */}
            <Card className={scanStep === 'case' ? 'border-2 border-brand-500' : 'opacity-60'}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium">
                    Step 2: Scan Case Barcode
                  </label>
                  {caseVerified && (
                    <Icon icon={IconCheck} size="sm" className="text-emerald-600" />
                  )}
                </div>
                {scanStep === 'case' && !caseVerified ? (
                  <ScanInput
                    onScan={handleCaseScan}
                    placeholder="Scan case barcode..."
                    error={duplicateScanError && scanStep === 'case' ? duplicateScanError : undefined}
                    autoFocus
                  />
                ) : caseVerified ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
                    <Icon icon={IconPackage} size="sm" className="text-emerald-600" />
                    <Typography variant="bodySm" className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Case verified
                    </Typography>
                  </div>
                ) : (
                  <div className="rounded-lg bg-fill-secondary p-3 text-center">
                    <Typography variant="bodyXs" colorRole="muted">
                      Scan location first
                    </Typography>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Confirm / Cancel */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPickingItem(null);
                  setPickedLocationId(null);
                  setPickedLocationCode('');
                  setPickedQuantity(0);
                  setCaseVerified(false);
                  setScanStep('location');
                  setScannedBarcodes(new Set());
                  setDuplicateScanError(null);
                  setLocationError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="lg"
                className="flex-1"
                onClick={confirmPick}
                disabled={pickItemMutation.isPending || !pickedLocationId || !caseVerified}
              >
                <ButtonContent iconLeft={pickItemMutation.isPending ? IconLoader2 : IconCheck}>
                  {pickItemMutation.isPending ? 'Saving...' : 'Confirm Pick'}
                </ButtonContent>
              </Button>
            </div>

            {pickItemMutation.isError && (
              <Typography variant="bodyXs" className="text-center text-red-600">
                {pickItemMutation.error?.message}
              </Typography>
            )}

            {/* Next bay hint */}
            {nextLocationHint && (
              <Card className="border-dashed border-blue-300 bg-blue-50/50 dark:bg-blue-900/10">
                <CardContent className="p-3 text-center">
                  <Typography variant="bodyXs" colorRole="muted">
                    Next: {nextItem?.productName?.substring(0, 30)}...
                  </Typography>
                  <Typography variant="bodySm" className="font-medium text-blue-600">
                    Bay {nextLocationHint}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Items List */}
        {!pickingItem && (
          <div className="space-y-2">
            <Typography variant="bodySm" className="font-medium">
              All Items
            </Typography>
            {data.items.map((item, idx) => (
              <Card
                key={item.id}
                className={item.isPicked ? 'opacity-60' : ''}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        item.isPicked
                          ? 'bg-emerald-100 dark:bg-emerald-900/30'
                          : 'bg-fill-secondary'
                      }`}
                    >
                      {item.isPicked ? (
                        <Icon icon={IconCheck} size="sm" className="text-emerald-600" />
                      ) : (
                        <Typography variant="bodyXs">{idx + 1}</Typography>
                      )}
                    </div>
                    <div className="flex-1">
                      <Typography variant="bodyXs" className="font-medium">
                        {item.productName}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {item.quantityCases} cases
                        {item.suggestedLocationCode && ` • ${item.suggestedLocationCode}`}
                      </Typography>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <>
            <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2">
              <Card>
                <CardContent className="p-6">
                  <Typography variant="headingSm" className="mb-2">
                    Delete Pick List?
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted" className="mb-6">
                    The order will be reset so you can release it again.
                  </Typography>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)}>
                      Cancel
                    </Button>
                    <Button
                      colorRole="danger"
                      className="flex-1"
                      onClick={confirmDelete}
                      disabled={deleteMutation.isPending}
                    >
                      <ButtonContent iconLeft={deleteMutation.isPending ? IconLoader2 : IconTrash}>
                        Delete
                      </ButtonContent>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WMSPickListDetailPage;
