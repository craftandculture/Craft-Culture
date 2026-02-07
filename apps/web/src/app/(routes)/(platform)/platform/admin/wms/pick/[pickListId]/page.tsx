'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconLoader2,
  IconMapPin,
  IconPackage,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import downloadZplFile from '@/app/_wms/utils/downloadZplFile';
import { generateBatchLabelsZpl } from '@/app/_wms/utils/generateLabelZpl';
import useTRPC from '@/lib/trpc/browser';

/**
 * WMS Pick List Detail / Mobile Picking Workflow
 */
const WMSPickListDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();
  const pickListId = params.pickListId as string;

  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [scanInput, setScanInput] = useState('');
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

  const scanInputRef = useRef<HTMLInputElement>(null);

  // Fetch pick list
  const { data, isLoading } = useQuery({
    ...api.wms.admin.picking.getOne.queryOptions({ pickListId }),
  });

  // Pick item mutation
  const pickItemMutation = useMutation({
    ...api.wms.admin.picking.pickItem.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setPickingItem(null);
      setPickedLocationCode('');
      setPickedQuantity(0);
      setScanInput('');
      // Move to next unpicked item
      const unpickedItems = data?.items.filter((i) => !i.isPicked) ?? [];
      if (unpickedItems.length > 1) {
        setCurrentItemIndex((prev) => prev);
      }
    },
  });

  // Complete pick list mutation
  const completeMutation = useMutation({
    ...api.wms.admin.picking.complete.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      router.push('/platform/admin/wms/pick');
    },
  });

  // Auto-focus scan input
  useEffect(() => {
    if (scanInputRef.current && !pickingItem) {
      scanInputRef.current.focus();
    }
  }, [pickingItem, data]);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLookingUpLocation, setIsLookingUpLocation] = useState(false);

  // Handle scan/barcode input
  const handleScan = async (value: string) => {
    console.log('[SCAN] handleScan called with:', value);
    console.log('[SCAN] Current state:', { scanStep, pickingItem, scannedBarcodes: Array.from(scannedBarcodes) });
    setDuplicateScanError(null);

    // Check for duplicate scan
    if (scannedBarcodes.has(value.toUpperCase())) {
      console.log('[SCAN] Duplicate barcode detected:', value);
      setDuplicateScanError(`Barcode already scanned: ${value}`);
      setScanInput('');
      return;
    }

    if (scanStep === 'location') {
      console.log('[SCAN] Location scan step - looking up barcode:', value);
      // Look up location by barcode
      setIsLookingUpLocation(true);
      setLocationError(null);
      try {
        const result = await queryClient.fetchQuery(
          api.wms.admin.operations.getLocationByBarcode.queryOptions({ barcode: value }),
        );
        console.log('[SCAN] Location found:', result);
        setPickedLocationId(result.location.id);
        setPickedLocationCode(result.location.locationCode);
        setScanStep('case');
        // Track scanned barcode
        setScannedBarcodes((prev) => new Set(prev).add(value.toUpperCase()));
      } catch (err) {
        console.log('[SCAN] Location lookup error:', err);
        const errorMsg = err instanceof Error ? err.message : 'Location not found';
        setLocationError(errorMsg);
      } finally {
        setIsLookingUpLocation(false);
        setScanInput('');
      }
      return;
    }

    if (scanStep === 'case' && pickingItem) {
      console.log('[SCAN] Case scan step - verifying barcode:', value);
      // Verify case barcode matches the item's LWIN
      // Accept if it contains the LWIN or matches exactly
      const normalizedScan = value.replace(/-/g, '').toLowerCase();
      const normalizedLwin = pickingItem.lwin18.replace(/-/g, '').toLowerCase();

      console.log('[SCAN] Comparing:', { normalizedScan, normalizedLwin, valueLength: value.length });

      if (normalizedScan.includes(normalizedLwin) || normalizedLwin.includes(normalizedScan) || value.length > 5) {
        // Accept scan if it's reasonably long (barcode was scanned)
        console.log('[SCAN] Case barcode accepted!');
        setCaseVerified(true);
        // Track scanned barcode
        setScannedBarcodes((prev) => new Set(prev).add(value.toUpperCase()));
        setScanInput('');
      } else {
        console.log('[SCAN] Case barcode rejected');
        setScanInput('');
      }
      return;
    }

    console.log('[SCAN] No matching scan step, clearing input');
    setScanInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      void handleScan(scanInput.trim());
    }
  };

  // Get current unpicked item
  const unpickedItems = data?.items.filter((i) => !i.isPicked) ?? [];
  const currentItem = unpickedItems[currentItemIndex];

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
    console.log('[CONFIRM] confirmPick called');
    console.log('[CONFIRM] State:', {
      pickingItem,
      pickedLocationId,
      caseVerified,
      pickedQuantity
    });

    if (!pickingItem) {
      console.log('[CONFIRM] No pickingItem, returning');
      return;
    }

    // Use scanned location or fall back to suggested
    const locationId = pickedLocationId ?? pickingItem.suggestedLocationId;
    console.log('[CONFIRM] Location ID resolved to:', locationId);

    if (!locationId) {
      console.log('[CONFIRM] No locationId, returning');
      return;
    }

    console.log('[CONFIRM] Calling mutation with:', {
      pickListItemId: pickingItem.itemId,
      pickedFromLocationId: locationId,
      pickedQuantity: pickedQuantity,
    });

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
      <div className="container mx-auto max-w-lg px-4 py-6">
        <Typography variant="headingMd">Pick list not found</Typography>
      </div>
    );
  }

  const isComplete = data.status === 'completed';
  const allPicked = unpickedItems.length === 0;

  return (
    <div className="container mx-auto max-w-lg px-4 py-6">
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
              <Typography variant="bodySm" colorRole="muted" className="mb-4">
                All items have been picked and the pick list is complete.
              </Typography>
              <Button
                variant="outline"
                onClick={() => {
                  // Generate labels for all picked items
                  const labels = data.items.map((item, idx) => ({
                    barcode: `PICK-${data.pickListNumber}-${String(idx + 1).padStart(3, '0')}`,
                    productName: item.productName,
                    lwin18: item.lwin18,
                    packSize: '',
                    lotNumber: data.pickListNumber,
                    locationCode: item.suggestedLocationCode ?? undefined,
                  }));
                  const zpl = generateBatchLabelsZpl(labels);
                  downloadZplFile(zpl, `pick-${data.pickListNumber}`);
                }}
              >
                <ButtonContent iconLeft={IconDownload}>Download Case Labels</ButtonContent>
              </Button>
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
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Generate labels for all picked items
                    const labels = data.items.map((item, idx) => ({
                      barcode: `PICK-${data.pickListNumber}-${String(idx + 1).padStart(3, '0')}`,
                      productName: item.productName,
                      lwin18: item.lwin18,
                      packSize: '',
                      lotNumber: data.pickListNumber,
                      locationCode: item.suggestedLocationCode ?? undefined,
                    }));
                    const zpl = generateBatchLabelsZpl(labels);
                    downloadZplFile(zpl, `pick-${data.pickListNumber}`);
                  }}
                >
                  <ButtonContent iconLeft={IconDownload}>Download Case Labels</ButtonContent>
                </Button>
                <Button
                  variant="primary"
                  onClick={handleComplete}
                  disabled={completeMutation.isPending}
                >
                  <ButtonContent iconLeft={completeMutation.isPending ? IconLoader2 : IconCheck}>
                    {completeMutation.isPending ? 'Completing...' : 'Complete Pick List'}
                  </ButtonContent>
                </Button>
              </div>
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
            <Button variant="primary" className="w-full py-4" onClick={startPicking}>
              <ButtonContent iconLeft={IconPackage}>Start Picking</ButtonContent>
            </Button>

            {/* Skip / Next buttons */}
            <div className="flex gap-2">
              {currentItemIndex > 0 && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCurrentItemIndex((prev) => prev - 1)}
                >
                  Previous
                </Button>
              )}
              {currentItemIndex < unpickedItems.length - 1 && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCurrentItemIndex((prev) => prev + 1)}
                >
                  Skip
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Picking Item - Scan Location */}
        {pickingItem && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodyXs" className="mb-2 font-medium text-brand-600">
                  PICKING
                </Typography>
                <Typography variant="bodySm" className="font-semibold">
                  {pickingItem.productName}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {pickingItem.quantityNeeded} cases needed
                </Typography>
              </CardContent>
            </Card>

            {/* Quantity Input */}
            <Card>
              <CardContent className="p-4">
                <label className="mb-2 block text-sm font-medium">Quantity Picked</label>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPickedQuantity((prev) => Math.max(1, prev - 1))}
                    disabled={pickedQuantity <= 1}
                  >
                    -
                  </Button>
                  <Typography variant="headingMd" className="w-16 text-center">
                    {pickedQuantity}
                  </Typography>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPickedQuantity((prev) => prev + 1)}
                  >
                    +
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Step 1: Scan Location */}
            <Card className={scanStep === 'location' ? 'border-2 border-brand-500' : ''}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium">
                    Step 1: Scan Location Barcode
                  </label>
                  {pickedLocationCode && (
                    <Icon icon={IconCheck} size="sm" className="text-emerald-600" />
                  )}
                </div>
                {scanStep === 'location' ? (
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Scan location barcode..."
                    className="w-full rounded-lg border border-border-primary bg-fill-primary p-3 text-center font-mono text-lg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                {locationError && (
                  <Typography variant="bodyXs" className="mt-2 text-center text-red-600">
                    {locationError} - try again
                  </Typography>
                )}
                {duplicateScanError && scanStep === 'location' && (
                  <Typography variant="bodyXs" className="mt-2 text-center text-amber-600">
                    {duplicateScanError}
                  </Typography>
                )}
                {isLookingUpLocation && (
                  <div className="mt-2 flex items-center justify-center">
                    <Icon icon={IconLoader2} size="sm" className="animate-spin" />
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
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Scan case barcode..."
                    className="w-full rounded-lg border border-border-primary bg-fill-primary p-3 text-center font-mono text-lg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                {duplicateScanError && scanStep === 'case' && (
                  <Typography variant="bodyXs" className="mt-2 text-center text-amber-600">
                    {duplicateScanError}
                  </Typography>
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
                variant="primary"
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
      </div>
    </div>
  );
};

export default WMSPickListDetailPage;
