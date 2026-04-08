'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
  IconPackage,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  // Invalidate both cloud tRPC and local NUC pick queries
  const invalidatePickQueries = () => {
    void queryClient.invalidateQueries({ queryKey: [['wms', 'admin', 'picking']] });
    void queryClient.invalidateQueries({ queryKey: ['wms', 'pickList'] });
    void queryClient.invalidateQueries({ queryKey: ['wms', 'pickLists'] });
  };

  // Pick item mutation — routes through local NUC when available
  const pickItemMutation = useMutation({
    ...wmsApi.pickItemMutationOptions(),
    onSuccess: () => {
      invalidatePickQueries();
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
      invalidatePickQueries();
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
  const { mutateAsync: lookupLocation } = useMutation({
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
  const handleLocationScan = useCallback(async (barcode: string) => {
    setDuplicateScanError(null);

    // Check for duplicate scan
    if (scannedBarcodes.has(barcode.toUpperCase())) {
      setDuplicateScanError(`Barcode already scanned: ${barcode}`);
      return;
    }

    setIsLookingUpLocation(true);
    setLocationError(null);
    try {
      const result = await lookupLocation({ barcode });

      // Verify scanned location matches the suggested location
      if (pickingItem?.suggestedLocationId && result.location.id !== pickingItem.suggestedLocationId) {
        const suggestedCode = data?.items.find((i) => i.id === pickingItem.itemId)?.suggestedLocationCode;
        setLocationError(`Wrong bay — go to ${suggestedCode ?? 'suggested location'}`);
        return;
      }

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
  }, [scannedBarcodes, lookupLocation, pickingItem, data]);

  // Handle case barcode scan
  const handleCaseScan = useCallback((barcode: string) => {
    setDuplicateScanError(null);

    // Check for duplicate scan
    if (scannedBarcodes.has(barcode.toUpperCase())) {
      setDuplicateScanError(`Barcode already scanned: ${barcode}`);
      return;
    }

    if (!pickingItem) return;

    // Verify case barcode contains the item's LWIN
    // Case barcodes are formatted as CASE-{lwin18}-{seq} (e.g. CASE-1110487-2022-06-00750-001)
    // Also accept a raw LWIN18 scan or an LWIN18 embedded in any barcode format
    const normalizedScan = barcode.replace(/-/g, '').toLowerCase();
    const normalizedLwin = pickingItem.lwin18.replace(/-/g, '').toLowerCase();

    if (normalizedScan.includes(normalizedLwin) || normalizedLwin.includes(normalizedScan)) {
      setCaseVerified(true);
      setScannedBarcodes((prev) => new Set(prev).add(barcode.toUpperCase()));
    } else {
      toast.error('Wrong case — barcode does not match this product');
    }
  }, [scannedBarcodes, pickingItem]);

  // Get current unpicked item - sorted by location for optimal pick path
  const unpickedItems = useMemo(
    () =>
      (data?.items.filter((i) => !i.isPicked) ?? []).sort((a, b) => {
        const locA = a.suggestedLocationCode ?? 'ZZZ';
        const locB = b.suggestedLocationCode ?? 'ZZZ';
        return locA.localeCompare(locB);
      }),
    [data?.items],
  );
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
      <div className="px-4 py-6">
        <Typography variant="headingMd">Pick list not found</Typography>
      </div>
    );
  }

  const isComplete = data.status === 'completed';
  const allPicked = unpickedItems.length === 0;

  // Format case config badge text
  const formatCaseConfig = (item: { caseConfig: number | null; bottleSize: string | null }) => {
    if (!item.caseConfig) return null;
    return `${item.caseConfig}x${item.bottleSize ?? '75cl'}`;
  };

  return (
    <div className="mx-auto max-w-lg px-3 py-4 md:max-w-3xl md:px-4 lg:max-w-5xl">
      {/* Compact Header */}
      <div className="mb-3 flex items-center gap-3">
        <Link href="/platform/admin/wms/pick">
          <Button variant="ghost" className="h-10 w-10">
            <Icon icon={IconArrowLeft} size="sm" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Typography variant="headingSm" className="truncate">
              {data.pickListNumber}
            </Typography>
            <span className="shrink-0 rounded bg-fill-secondary px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
              {data.invoiceNumber ?? data.orderNumber}
            </span>
          </div>
          {/* Progress bar inline */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-fill-secondary">
              <div
                className="h-1.5 rounded-full bg-brand-600 transition-all"
                style={{ width: `${data.progress.percent}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-medium text-text-muted">
              {data.progress.pickedCases}/{data.progress.totalCases}
            </span>
          </div>
        </div>
        {!isComplete && (
          <Button
            variant="ghost"
            className="h-10 w-10 shrink-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <Icon icon={deleteMutation.isPending ? IconLoader2 : IconTrash} size="sm" />
          </Button>
        )}
      </div>

      {/* Completed State */}
      {isComplete && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Icon icon={IconCheck} size="lg" className="text-emerald-600" />
            </div>
            <Typography variant="headingSm" className="mb-1">
              Pick List Complete
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              All items have been picked.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* All Picked - Ready to Complete */}
      {allPicked && !isComplete && (
        <Card>
          <CardContent className="p-5 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Icon icon={IconCheck} size="lg" className="text-emerald-600" />
            </div>
            <Typography variant="headingSm" className="mb-1">
              All Items Picked
            </Typography>
            <Typography variant="bodyXs" colorRole="muted" className="mb-4">
              Ready to complete the pick list
            </Typography>
            <Button
              variant="default"
              className="h-12 w-full"
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

      {/* ── Pre-Pick: Current Item Card ── */}
      {!isComplete && !allPicked && !pickingItem && currentItem && (
        <div className="space-y-3">
          <Card className="border-2 border-brand-500">
            <CardContent className="p-0">
              {/* Item counter + location row */}
              <div className="flex items-center justify-between border-b border-border-primary px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-brand-600">
                    {currentItemIndex + 1}/{unpickedItems.length}
                  </span>
                  {formatCaseConfig(currentItem) && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {formatCaseConfig(currentItem)}
                    </span>
                  )}
                </div>
                {currentItem.suggestedLocationCode && (
                  <LocationBadge locationCode={currentItem.suggestedLocationCode} size="sm" />
                )}
              </div>

              {/* Product name */}
              <div className="px-4 pt-3 pb-2">
                <Typography variant="bodySm" className="font-semibold leading-tight">
                  {currentItem.productName}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 font-mono text-[11px]">
                  {currentItem.lwin18}
                </Typography>
              </div>

              {/* Quantity + Location — side by side */}
              <div className="grid grid-cols-2 gap-px bg-border-primary">
                <div className="bg-fill-secondary px-4 py-3 text-center">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    Pick Qty
                  </span>
                  <div className="text-3xl font-bold text-brand-600">
                    {currentItem.quantityCases}
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {currentItem.caseConfig ? `cases of ${currentItem.caseConfig}` : 'cases'}
                  </span>
                </div>
                <div className="bg-fill-secondary px-4 py-3 text-center">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    Bay
                  </span>
                  <div className="font-mono text-2xl font-bold text-text-primary">
                    {currentItem.suggestedLocationCode ?? '—'}
                  </div>
                  <span className="text-[10px] text-text-muted">
                    go to location
                  </span>
                </div>
              </div>

              {/* Start picking — embedded in card */}
              <div className="p-3">
                <Button variant="default" className="h-12 w-full text-base" onClick={startPicking}>
                  <ButtonContent iconLeft={IconPackage}>Start Picking</ButtonContent>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Prev / Skip navigation */}
          {unpickedItems.length > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-10"
                onClick={() => setCurrentItemIndex((prev) => prev - 1)}
                disabled={currentItemIndex === 0}
              >
                <Icon icon={IconChevronLeft} size="sm" />
                <span className="ml-1">Prev</span>
              </Button>
              <span className="text-xs text-text-muted">
                {currentItemIndex + 1} of {unpickedItems.length} remaining
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-10"
                onClick={() => setCurrentItemIndex((prev) => prev + 1)}
                disabled={currentItemIndex >= unpickedItems.length - 1}
              >
                <span className="mr-1">Skip</span>
                <Icon icon={IconChevronRight} size="sm" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Active Picking Flow ── */}
      {pickingItem && (
        <div className="space-y-3">
          {/* Picking header bar — product + qty + location */}
          <div className="flex items-start gap-3 rounded-lg bg-brand-50 p-3 dark:bg-brand-900/20">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Picking</span>
                {formatCaseConfig(currentItem ?? { caseConfig: null, bottleSize: null }) && (
                  <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    {formatCaseConfig(currentItem ?? { caseConfig: null, bottleSize: null })}
                  </span>
                )}
              </div>
              <Typography variant="bodySm" className="mt-0.5 font-semibold leading-tight">
                {pickingItem.productName}
              </Typography>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-2xl font-bold text-brand-600">{pickingItem.quantityNeeded}</div>
              <span className="text-[10px] text-text-muted">cases</span>
            </div>
          </div>

          {/* GO TO LOCATION — prominent only during location step */}
          {currentItem?.suggestedLocationCode && scanStep === 'location' && (
            <div className="rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-4 text-center dark:bg-amber-900/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Go to Bay
              </span>
              <div className="font-mono text-3xl font-bold text-amber-700 dark:text-amber-300">
                {currentItem.suggestedLocationCode}
              </div>
            </div>
          )}

          {/* No suggested location warning */}
          {!currentItem?.suggestedLocationCode && scanStep === 'location' && (
            <div className="rounded-lg border-2 border-red-400 bg-red-50 px-4 py-3 text-center dark:bg-red-900/20">
              <Typography variant="bodySm" className="font-semibold text-red-700 dark:text-red-300">
                No location found in system
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                Scan any bay where you find this product
              </Typography>
            </div>
          )}

          {/* Quantity adjuster */}
          <div className="flex items-center justify-between rounded-lg bg-fill-secondary px-4 py-2">
            <span className="text-xs font-medium text-text-muted">Qty</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="h-10 w-10 text-lg"
                onClick={() => setPickedQuantity((prev) => Math.max(1, prev - 1))}
                disabled={pickedQuantity <= 1}
              >
                -
              </Button>
              <span className="w-10 text-center text-xl font-bold">{pickedQuantity}</span>
              <Button
                variant="outline"
                className="h-10 w-10 text-lg"
                onClick={() => setPickedQuantity((prev) => prev + 1)}
              >
                +
              </Button>
            </div>
          </div>

          {/* Scan Steps — single card with two sections */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Step 1: Location */}
              <div className={`p-3 ${scanStep === 'location' ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      pickedLocationCode
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                    }`}>
                      {pickedLocationCode ? <Icon icon={IconCheck} size="xs" /> : '1'}
                    </span>
                    <span className="text-xs font-medium">Scan Bay</span>
                  </div>
                  {pickedLocationCode && (
                    <span className="text-xs font-semibold text-emerald-600">{pickedLocationCode}</span>
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
                ) : !pickedLocationCode ? (
                  <div className="rounded bg-fill-secondary px-3 py-2 text-center text-xs text-text-muted">
                    Scan location first
                  </div>
                ) : null}
              </div>

              {/* Divider */}
              <div className="border-t border-border-primary" />

              {/* Step 2: Case */}
              <div className={`p-3 ${scanStep === 'case' ? 'bg-brand-50/50 dark:bg-brand-900/10' : !pickedLocationCode ? 'opacity-40' : ''}`}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      caseVerified
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : scanStep === 'case'
                          ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                          : 'bg-fill-secondary text-text-muted'
                    }`}>
                      {caseVerified ? <Icon icon={IconCheck} size="xs" /> : '2'}
                    </span>
                    <span className="text-xs font-medium">Scan Case</span>
                  </div>
                  {caseVerified && (
                    <span className="text-xs font-semibold text-emerald-600">Verified</span>
                  )}
                </div>
                {scanStep === 'case' && !caseVerified ? (
                  <ScanInput
                    onScan={handleCaseScan}
                    placeholder="Scan case barcode..."
                    error={duplicateScanError && scanStep === 'case' ? duplicateScanError : undefined}
                    autoFocus
                  />
                ) : caseVerified ? null : (
                  <div className="rounded bg-fill-secondary px-3 py-2 text-center text-xs text-text-muted">
                    Complete step 1 first
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Confirm / Cancel */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-12 flex-1"
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
              className="h-12 flex-[2]"
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
            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 px-3 py-2 dark:bg-blue-900/10">
              <Typography variant="bodyXs" colorRole="muted">
                Next:
              </Typography>
              <Typography variant="bodyXs" className="font-semibold text-blue-600">
                {nextLocationHint}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="truncate">
                {nextItem?.productName?.substring(0, 25)}
              </Typography>
            </div>
          )}
        </div>
      )}

      {/* ── Items List ── */}
      {!pickingItem && data.items.length > 0 && (
        <div className="mt-4">
          <Typography variant="bodyXs" className="mb-2 font-semibold uppercase tracking-wider text-text-muted">
            All Items ({data.progress.pickedItems}/{data.progress.totalItems})
          </Typography>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {data.items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-3 py-2.5 ${
                    idx > 0 ? 'border-t border-border-primary' : ''
                  } ${item.isPicked ? 'bg-emerald-50/50 dark:bg-emerald-900/5' : ''}`}
                >
                  {/* Status indicator */}
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      item.isPicked
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                        : 'bg-fill-secondary text-text-muted'
                    }`}
                  >
                    {item.isPicked ? (
                      <Icon icon={IconCheck} size="xs" className="text-emerald-600" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  {/* Product info */}
                  <div className="min-w-0 flex-1">
                    <Typography variant="bodyXs" className={`truncate font-medium ${item.isPicked ? 'line-through opacity-60' : ''}`}>
                      {item.productName}
                    </Typography>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-text-muted">
                        {item.quantityCases}cs
                      </span>
                      {formatCaseConfig(item) && (
                        <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          {formatCaseConfig(item)}
                        </span>
                      )}
                      {item.suggestedLocationCode && (
                        <span className="rounded bg-fill-secondary px-1 py-px text-[10px] font-mono font-medium text-text-muted">
                          {item.suggestedLocationCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowDeleteModal(false)} />
          <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2">
            <Card>
              <CardContent className="p-5">
                <Typography variant="headingSm" className="mb-2">
                  Delete Pick List?
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="mb-4">
                  The order will be reset so you can release it again.
                </Typography>
                <div className="flex gap-3">
                  <Button variant="outline" className="h-12 flex-1" onClick={() => setShowDeleteModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    colorRole="danger"
                    className="h-12 flex-1"
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
  );
};

export default WMSPickListDetailPage;
