'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLoader2,
  IconPackage,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

type WorkflowStep = 'scan-case' | 'scan-location' | 'confirm' | 'success';

interface ScannedCase {
  barcode: string;
  productName: string;
  lwin18: string;
  lotNumber?: string | null;
  currentLocation?: {
    id: string;
    locationCode: string;
  } | null;
}

interface ScannedLocation {
  id: string;
  locationCode: string;
  locationType: string;
  requiresForklift?: boolean | null;
}

/**
 * WMS Put-Away - mobile workflow for moving cases from receiving to storage
 */
const WMSPutawayPage = () => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WorkflowStep>('scan-case');
  const [scannedCase, setScannedCase] = useState<ScannedCase | null>(null);
  const [scannedLocation, setScannedLocation] = useState<ScannedLocation | null>(null);
  const [error, setError] = useState<string>('');
  const [lastSuccess, setLastSuccess] = useState<{
    productName: string;
    locationCode: string;
  } | null>(null);

  // Get case by barcode
  const caseLookup = useQuery({
    ...api.wms.admin.operations.getCaseByBarcode.queryOptions({ barcode: '' }),
    enabled: false,
  });

  // Get location by barcode
  const locationLookup = useQuery({
    ...api.wms.admin.operations.getLocationByBarcode.queryOptions({ barcode: '' }),
    enabled: false,
  });

  // Put-away mutation
  const putawayMutation = useMutation({
    ...api.wms.admin.operations.putaway.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      setLastSuccess({
        productName: data.productName,
        locationCode: data.toLocation.locationCode,
      });
      setStep('success');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleCaseScan = async (barcode: string) => {
    setError('');
    try {
      const result = await trpcClient.wms.admin.operations.getCaseByBarcode.query({ barcode });
      setScannedCase({
        barcode: result.caseLabel.barcode,
        productName: result.caseLabel.productName,
        lwin18: result.caseLabel.lwin18,
        lotNumber: result.caseLabel.lotNumber,
        currentLocation: result.currentLocation,
      });
      setStep('scan-location');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Case not found');
    }
  };

  const handleLocationScan = async (barcode: string) => {
    setError('');
    try {
      const result = await trpcClient.wms.admin.operations.getLocationByBarcode.query({ barcode });
      setScannedLocation({
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
    if (!scannedCase || !scannedLocation) return;

    putawayMutation.mutate({
      caseBarcode: scannedCase.barcode,
      toLocationId: scannedLocation.id,
    });
  };

  const handleReset = () => {
    setStep('scan-case');
    setScannedCase(null);
    setScannedLocation(null);
    setError('');
    setLastSuccess(null);
  };

  const handleScanNext = () => {
    setStep('scan-case');
    setScannedCase(null);
    setScannedLocation(null);
    setError('');
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
              Put Away
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              Move cases from receiving to storage
            </Typography>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              step === 'scan-case'
                ? 'bg-blue-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}
          >
            {step === 'scan-case' ? '1' : <IconCheck className="h-4 w-4" />}
          </div>
          <div className="h-0.5 w-8 bg-border-muted" />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              step === 'scan-location'
                ? 'bg-blue-600 text-white'
                : step === 'confirm' || step === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-fill-secondary text-text-muted'
            }`}
          >
            {step === 'confirm' || step === 'success' ? (
              <IconCheck className="h-4 w-4" />
            ) : (
              '2'
            )}
          </div>
        </div>

        {/* Step: Scan Case */}
        {step === 'scan-case' && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-6 text-center">
                <Icon icon={IconPackage} size="xl" colorRole="muted" className="mx-auto mb-2" />
                <Typography variant="headingSm">Scan Case Barcode</Typography>
              </div>

              <ScanInput
                label="Case barcode"
                placeholder="CASE-..."
                onScan={handleCaseScan}
                isLoading={caseLookup.isFetching}
                error={error}
              />
            </CardContent>
          </Card>
        )}

        {/* Step: Scan Location */}
        {step === 'scan-location' && scannedCase && (
          <div className="space-y-4">
            {/* Scanned Case Info */}
            <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <IconCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <Typography variant="bodyXs" colorRole="muted">
                      Case Found
                    </Typography>
                    <Typography variant="headingSm">{scannedCase.productName}</Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Lot: {scannedCase.lotNumber ?? 'N/A'}
                    </Typography>
                    {scannedCase.currentLocation && (
                      <div className="mt-2">
                        <Typography variant="bodyXs" colorRole="muted">
                          Current Location:
                        </Typography>
                        <LocationBadge
                          locationCode={scannedCase.currentLocation.locationCode}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scan Destination */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-6 text-center">
                  <Typography variant="headingSm">Scan Destination</Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Scan the location barcode where you will store this case
                  </Typography>
                </div>

                <ScanInput
                  label="Location barcode"
                  placeholder="LOC-..."
                  onScan={handleLocationScan}
                  isLoading={locationLookup.isFetching}
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
        {step === 'confirm' && scannedCase && scannedLocation && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="mb-6 text-center">
                  <Typography variant="headingSm">Confirm Put Away</Typography>
                </div>

                <div className="space-y-4">
                  {/* Case */}
                  <div className="rounded-lg bg-fill-secondary p-4">
                    <Typography variant="bodyXs" colorRole="muted">
                      Case
                    </Typography>
                    <Typography variant="headingSm">{scannedCase.productName}</Typography>
                    <Typography variant="bodyXs" className="font-mono text-text-muted">
                      {scannedCase.barcode}
                    </Typography>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <Icon icon={IconArrowRight} size="lg" colorRole="muted" className="rotate-90" />
                  </div>

                  {/* Location */}
                  <div className="rounded-lg bg-fill-secondary p-4 text-center">
                    <Typography variant="bodyXs" colorRole="muted">
                      Destination
                    </Typography>
                    <LocationBadge
                      locationCode={scannedLocation.locationCode}
                      locationType={scannedLocation.locationType as 'rack' | 'floor' | 'receiving' | 'shipping'}
                      requiresForklift={scannedLocation.requiresForklift ?? false}
                      size="lg"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep('scan-location')}>
                <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={handleConfirm}
                disabled={putawayMutation.isPending}
              >
                <ButtonContent iconLeft={putawayMutation.isPending ? IconLoader2 : IconCheck}>
                  {putawayMutation.isPending ? 'Saving...' : 'Confirm'}
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
                  Put Away Complete
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  {lastSuccess.productName}
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  moved to
                </Typography>
                <LocationBadge locationCode={lastSuccess.locationCode} size="lg" />
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" asChild>
                <Link href="/platform/admin/wms">Done</Link>
              </Button>
              <Button variant="primary" size="lg" className="flex-1" onClick={handleScanNext}>
                <ButtonContent iconLeft={IconPackage}>Scan Next</ButtonContent>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSPutawayPage;
