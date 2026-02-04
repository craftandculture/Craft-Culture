'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLoader2,
  IconMapPin,
  IconMinus,
  IconPlus,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import ScanInput from '@/app/_wms/components/ScanInput';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

type WorkflowStep = 'scan-source' | 'select-stock' | 'scan-dest' | 'confirm' | 'success';

interface LocationInfo {
  id: string;
  locationCode: string;
  locationType: string;
  requiresForklift?: boolean | null;
}

interface StockItem {
  id: string;
  lwin18: string;
  productName: string;
  ownerName: string;
  quantityCases: number;
  availableCases: number;
  lotNumber?: string | null;
}

/**
 * WMS Transfer - mobile workflow for moving stock between locations
 */
const WMSTransferPage = () => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WorkflowStep>('scan-source');
  const [sourceLocation, setSourceLocation] = useState<LocationInfo | null>(null);
  const [stockAtSource, setStockAtSource] = useState<StockItem[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [destLocation, setDestLocation] = useState<LocationInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [lastSuccess, setLastSuccess] = useState<{
    productName: string;
    quantity: number;
    fromLocation: string;
    toLocation: string;
  } | null>(null);

  // Transfer mutation
  const transferMutation = useMutation({
    ...api.wms.admin.operations.transfer.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      setLastSuccess({
        productName: data.productName,
        quantity: data.quantityCases,
        fromLocation: data.fromLocation.locationCode,
        toLocation: data.toLocation.locationCode,
      });
      setStep('success');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSourceScan = async (barcode: string) => {
    setError('');
    try {
      const result = await trpcClient.wms.admin.operations.getLocationByBarcode.query({ barcode });
      setSourceLocation({
        id: result.location.id,
        locationCode: result.location.locationCode,
        locationType: result.location.locationType,
        requiresForklift: result.location.requiresForklift,
      });
      setStockAtSource(result.stock);

      if (result.stock.length === 0) {
        setError('No stock at this location');
      } else if (result.stock.length === 1 && result.stock[0]) {
        // Auto-select if only one stock item
        setSelectedStock(result.stock[0]);
        setTransferQuantity(Math.min(1, result.stock[0].availableCases));
        setStep('scan-dest');
      } else {
        setStep('select-stock');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location not found');
    }
  };

  const handleSelectStock = (stock: StockItem) => {
    setSelectedStock(stock);
    setTransferQuantity(Math.min(1, stock.availableCases));
    setStep('scan-dest');
  };

  const handleDestScan = async (barcode: string) => {
    setError('');
    try {
      const result = await trpcClient.wms.admin.operations.getLocationByBarcode.query({ barcode });

      if (result.location.id === sourceLocation?.id) {
        setError('Destination cannot be the same as source');
        return;
      }

      setDestLocation({
        id: result.location.id,
        locationCode: result.location.locationCode,
        locationType: result.location.locationType,
        requiresForklift: result.location.requiresForklift,
      });
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location not found');
    }
  };

  const handleConfirm = () => {
    if (!selectedStock || !destLocation) return;

    transferMutation.mutate({
      stockId: selectedStock.id,
      quantityCases: transferQuantity,
      toLocationId: destLocation.id,
    });
  };

  const handleReset = () => {
    setStep('scan-source');
    setSourceLocation(null);
    setStockAtSource([]);
    setSelectedStock(null);
    setTransferQuantity(1);
    setDestLocation(null);
    setError('');
    setLastSuccess(null);
  };

  const handleScanNext = () => {
    handleReset();
  };

  const adjustQuantity = (delta: number) => {
    if (!selectedStock) return;
    const newQty = Math.max(1, Math.min(selectedStock.availableCases, transferQuantity + delta));
    setTransferQuantity(newQty);
  };

  return (
    <div className="container mx-auto max-w-lg px-4 py-6">
      <div className="space-y-6">
        {/* Header with large back button */}
        <div className="flex items-start gap-3">
          <Link
            href="/platform/admin/wms"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary"
          >
            <IconArrowLeft className="h-6 w-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <Typography variant="headingLg" className="mb-1">
              Transfer Stock
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              Move stock between locations
            </Typography>
          </div>
        </div>

        {/* Step: Scan Source Location */}
        {step === 'scan-source' && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-6 text-center">
                <Icon icon={IconMapPin} size="xl" colorRole="muted" className="mx-auto mb-2" />
                <Typography variant="headingSm">Scan Source Location</Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Scan the location you want to transfer stock from
                </Typography>
              </div>

              <ScanInput
                label="Source location barcode"
                placeholder="LOC-..."
                onScan={handleSourceScan}
                error={error}
              />
            </CardContent>
          </Card>
        )}

        {/* Step: Select Stock */}
        {step === 'select-stock' && sourceLocation && (
          <div className="space-y-4">
            <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <IconCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Source Location
                    </Typography>
                    <LocationBadge
                      locationCode={sourceLocation.locationCode}
                      locationType={sourceLocation.locationType as 'rack' | 'floor' | 'receiving' | 'shipping'}
                      size="sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Typography variant="headingSm" className="mb-4">
                  Select Stock to Transfer
                </Typography>

                <div className="space-y-2">
                  {stockAtSource.map((stock) => (
                    <button
                      key={stock.id}
                      onClick={() => handleSelectStock(stock)}
                      className="w-full rounded-lg border border-border-primary bg-fill-primary p-3 text-left transition-colors hover:border-border-brand"
                    >
                      <Typography variant="bodySm" className="font-medium">
                        {stock.productName}
                      </Typography>
                      <div className="mt-1 flex items-center justify-between">
                        <Typography variant="bodyXs" colorRole="muted">
                          {stock.ownerName}
                        </Typography>
                        <Typography variant="bodySm" className="font-medium text-blue-600">
                          {stock.availableCases} avail
                        </Typography>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button variant="outline" size="lg" className="w-full" onClick={handleReset}>
              <ButtonContent iconLeft={IconX}>Cancel</ButtonContent>
            </Button>
          </div>
        )}

        {/* Step: Scan Destination */}
        {step === 'scan-dest' && sourceLocation && selectedStock && (
          <div className="space-y-4">
            {/* Source Info */}
            <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <IconCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <Typography variant="bodyXs" colorRole="muted">
                      Moving from {sourceLocation.locationCode}
                    </Typography>
                    <Typography variant="headingSm">{selectedStock.productName}</Typography>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quantity Selector */}
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodySm" className="mb-3 text-center">
                  Quantity to transfer
                </Typography>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => adjustQuantity(-1)}
                    disabled={transferQuantity <= 1}
                  >
                    <Icon icon={IconMinus} />
                  </Button>
                  <div className="min-w-[80px] text-center">
                    <Typography variant="headingLg">{transferQuantity}</Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      of {selectedStock.availableCases}
                    </Typography>
                  </div>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => adjustQuantity(1)}
                    disabled={transferQuantity >= selectedStock.availableCases}
                  >
                    <Icon icon={IconPlus} />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Scan Destination */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 text-center">
                  <Typography variant="headingSm">Scan Destination</Typography>
                </div>

                <ScanInput
                  label="Destination location barcode"
                  placeholder="LOC-..."
                  onScan={handleDestScan}
                  error={error}
                />
              </CardContent>
            </Card>

            <Button variant="outline" size="lg" className="w-full" onClick={handleReset}>
              <ButtonContent iconLeft={IconX}>Cancel</ButtonContent>
            </Button>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && sourceLocation && selectedStock && destLocation && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="mb-6 text-center">
                  <Typography variant="headingSm">Confirm Transfer</Typography>
                </div>

                <div className="space-y-4">
                  {/* Product */}
                  <div className="rounded-lg bg-fill-secondary p-4 text-center">
                    <Typography variant="headingSm">{selectedStock.productName}</Typography>
                    <Typography variant="headingLg" className="text-blue-600">
                      {transferQuantity} {transferQuantity === 1 ? 'case' : 'cases'}
                    </Typography>
                  </div>

                  {/* From/To */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 text-center">
                      <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                        From
                      </Typography>
                      <LocationBadge locationCode={sourceLocation.locationCode} size="md" />
                    </div>
                    <Icon icon={IconArrowRight} size="lg" colorRole="muted" />
                    <div className="flex-1 text-center">
                      <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                        To
                      </Typography>
                      <LocationBadge locationCode={destLocation.locationCode} size="md" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep('scan-dest')}>
                <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={handleConfirm}
                disabled={transferMutation.isPending}
              >
                <ButtonContent iconLeft={transferMutation.isPending ? IconLoader2 : IconCheck}>
                  {transferMutation.isPending ? 'Saving...' : 'Confirm'}
                </ButtonContent>
              </Button>
            </div>

            {error && (
              <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                <CardContent className="p-4">
                  <Typography variant="bodySm" className="text-red-600 dark:text-red-400">
                    {error}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && lastSuccess && (
          <div className="space-y-4">
            <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <IconCheck className="h-8 w-8" />
                </div>
                <Typography variant="headingMd" className="mb-2">
                  Transfer Complete
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  {lastSuccess.quantity} {lastSuccess.quantity === 1 ? 'case' : 'cases'} of
                </Typography>
                <Typography variant="bodySm" className="font-medium">
                  {lastSuccess.productName}
                </Typography>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <LocationBadge locationCode={lastSuccess.fromLocation} size="sm" />
                  <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
                  <LocationBadge locationCode={lastSuccess.toLocation} size="sm" />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" asChild>
                <Link href="/platform/admin/wms">Done</Link>
              </Button>
              <Button variant="primary" size="lg" className="flex-1" onClick={handleScanNext}>
                <ButtonContent iconLeft={IconMapPin}>Transfer More</ButtonContent>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSTransferPage;
