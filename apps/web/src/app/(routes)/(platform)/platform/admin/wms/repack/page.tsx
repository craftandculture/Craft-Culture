'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconBox,
  IconBoxOff,
  IconCheck,
  IconLoader2,
  IconMapPin,
  IconPackage,
  IconPrinter,
  IconRefresh,
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
import usePrint from '@/app/_wms/hooks/usePrint';
import useWmsApi from '@/app/_wms/hooks/useWmsApi';
import downloadZplFile from '@/app/_wms/utils/downloadZplFile';
import { generateBatchLabelsZpl } from '@/app/_wms/utils/generateLabelZpl';
import useTRPC from '@/lib/trpc/browser';

type WorkflowStep =
  | 'scan-source-bay'
  | 'select-stock'
  | 'select-config'
  | 'remove-case'
  | 'physical-repack'
  | 'scan-destination-bay'
  | 'success';

interface LocationInfo {
  id: string;
  locationCode: string;
  locationType: string;
}

interface StockItem {
  id: string;
  lwin18: string;
  productName: string;
  ownerName: string;
  quantityCases: number;
  availableCases: number;
  caseConfig: number;
  lotNumber?: string | null;
}

interface RepackResult {
  repackNumber: string;
  source: {
    productName: string;
    caseConfig: number;
    quantityCases: number;
  };
  target: {
    lwin18: string;
    productName: string;
    caseConfig: number;
    quantityCases: number;
    newCaseLabels: Array<{ barcode: string }>;
    packSize: string;
    vintage?: number | null;
    owner?: string | null;
    lotNumber?: string | null;
  };
}

// Step indicator component
const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => (
  <div className="flex items-center justify-center gap-1.5">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <div
        key={i}
        className={`h-1.5 rounded-full transition-all ${
          i < currentStep
            ? 'w-6 bg-emerald-500'
            : i === currentStep
              ? 'w-6 bg-blue-500'
              : 'w-1.5 bg-fill-tertiary'
        }`}
      />
    ))}
  </div>
);

// Map step to number for progress indicator
const getStepNumber = (step: WorkflowStep): number => {
  const stepMap: Record<WorkflowStep, number> = {
    'scan-source-bay': 0,
    'select-stock': 1,
    'select-config': 2,
    'remove-case': 3,
    'physical-repack': 4,
    'scan-destination-bay': 5,
    'success': 6,
  };
  return stepMap[step];
};

/**
 * WMS Repack - multi-step workflow for splitting cases
 *
 * Steps:
 * 1. Scan source bay
 * 2. Select stock to repack
 * 3. Select target case configuration
 * 4. Confirm removal from source bay
 * 5. Physical repack (operator opens case and repacks)
 * 6. Scan destination bay
 * 7. Success with label download
 */
const WMSRepackPage = () => {
  const api = useTRPC();
  const wmsApi = useWmsApi();
  const queryClient = useQueryClient();
  const { print } = usePrint();

  const [step, setStep] = useState<WorkflowStep>('scan-source-bay');
  const [sourceLocation, setSourceLocation] = useState<LocationInfo | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<LocationInfo | null>(null);
  const [stockAtLocation, setStockAtLocation] = useState<StockItem[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [targetCaseConfig, setTargetCaseConfig] = useState<number>(6);
  const [error, setError] = useState<string>('');
  const [isSourceScanning, setIsSourceScanning] = useState(false);
  const [repackResult, setRepackResult] = useState<RepackResult | null>(null);

  // Repack mutation
  const repackMutation = useMutation({
    ...api.wms.admin.operations.repack.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      setRepackResult({
        repackNumber: data.repackNumber,
        source: {
          productName: data.source.productName,
          caseConfig: data.source.caseConfig,
          quantityCases: data.source.quantityCases,
        },
        target: {
          lwin18: data.target.lwin18,
          productName: data.target.productName,
          caseConfig: data.target.caseConfig,
          quantityCases: data.target.quantityCases,
          newCaseLabels: data.target.newCaseLabels,
          packSize: data.target.packSize,
          vintage: data.target.vintage,
          owner: data.target.owner,
          lotNumber: data.target.lotNumber,
        },
      });
      setStep('success');
    },
    onError: (err) => {
      setError(err.message);
      // Go back to physical repack step on error
      setStep('physical-repack');
    },
  });

  const handleSourceLocationScan = async (barcode: string) => {
    setError('');
    setIsSourceScanning(true);
    try {
      const result = await wmsApi.scanLocation(barcode);
      setSourceLocation({
        id: result.location.id,
        locationCode: result.location.locationCode,
        locationType: result.location.locationType,
      });

      // Filter stock to only items that can be repacked (>1 bottle per case)
      const repackableStock = result.stock.filter(
        (s) => s.caseConfig && s.caseConfig > 1 && s.availableCases > 0,
      );

      setStockAtLocation(repackableStock as StockItem[]);

      if (repackableStock.length === 0) {
        setError('No repackable stock at this location');
      } else {
        setStep('select-stock');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location not found');
    } finally {
      setIsSourceScanning(false);
    }
  };

  const handleDestinationLocationScan = async (barcode: string) => {
    setError('');
    try {
      const result = await wmsApi.scanLocation(barcode);
      setDestinationLocation({
        id: result.location.id,
        locationCode: result.location.locationCode,
        locationType: result.location.locationType,
      });

      // Execute the repack with the destination location
      if (selectedStock) {
        repackMutation.mutate({
          stockId: selectedStock.id,
          sourceQuantityCases: 1,
          targetCaseConfig,
          destinationLocationId: result.location.id,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location not found');
    }
  };

  const handleSelectStock = (stock: StockItem) => {
    setSelectedStock(stock);
    // Default to half the source config, minimum 1
    const defaultTarget = Math.max(1, Math.floor(stock.caseConfig / 2));
    setTargetCaseConfig(defaultTarget);
    setStep('select-config');
  };

  const handleReset = () => {
    setStep('scan-source-bay');
    setSourceLocation(null);
    setDestinationLocation(null);
    setStockAtLocation([]);
    setSelectedStock(null);
    setTargetCaseConfig(6);
    setError('');
    setRepackResult(null);
  };

  // Print labels for repacked cases
  const handlePrintLabels = async () => {
    if (!repackResult) return;

    const labelData = repackResult.target.newCaseLabels.map((label) => ({
      barcode: label.barcode,
      productName: repackResult.target.productName,
      lwin18: repackResult.target.lwin18,
      packSize: repackResult.target.packSize,
      vintage: repackResult.target.vintage ?? undefined,
      lotNumber: repackResult.target.lotNumber ?? undefined,
      owner: repackResult.target.owner ?? undefined,
    }));

    const zpl = generateBatchLabelsZpl(labelData);
    const filename = `repack-${repackResult.repackNumber}-labels`;
    const printed = await print(zpl, '4x2');
    if (!printed) downloadZplFile(zpl, filename);
  };

  // Calculate target cases from source
  const getTargetCases = () => {
    if (!selectedStock) return 0;
    const totalBottles = selectedStock.caseConfig;
    if (totalBottles % targetCaseConfig !== 0) return 0;
    return totalBottles / targetCaseConfig;
  };

  // Get valid target configs (must evenly divide source bottles)
  const getValidConfigs = () => {
    if (!selectedStock) return [];
    const sourceConfig = selectedStock.caseConfig;
    const configs: number[] = [];

    for (let i = 1; i < sourceConfig; i++) {
      if (sourceConfig % i === 0) {
        configs.push(i);
      }
    }

    return configs;
  };

  return (
    <div className="container mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl px-4 py-6">
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
              Repack Cases
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              Split into smaller configurations
            </Typography>
          </div>
        </div>

        {/* Progress indicator */}
        {step !== 'success' && (
          <StepIndicator currentStep={getStepNumber(step)} totalSteps={6} />
        )}

        {/* Step 1: Scan Source Bay */}
        {step === 'scan-source-bay' && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-6 text-center">
                <Icon icon={IconMapPin} size="xl" colorRole="muted" className="mx-auto mb-2" />
                <Typography variant="headingSm">Step 1: Scan Source Bay</Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Go to the bay and scan its barcode
                </Typography>
              </div>

              <ScanInput
                label="Location barcode"
                placeholder="LOC-..."
                onScan={handleSourceLocationScan}
                isLoading={isSourceScanning}
                error={error}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Stock */}
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
                      Source Bay
                    </Typography>
                    <LocationBadge locationCode={sourceLocation.locationCode} size="sm" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Typography variant="headingSm" className="mb-1">
                  Step 2: Select Case to Repack
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mb-4">
                  Choose which case to split
                </Typography>

                <div className="space-y-2">
                  {stockAtLocation.map((stock) => (
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
                          {stock.caseConfig}x per case
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

        {/* Step 3: Select Target Config */}
        {step === 'select-config' && selectedStock && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodyXs" colorRole="muted">
                  Source Case
                </Typography>
                <Typography variant="headingSm">{selectedStock.productName}</Typography>
                <Typography variant="bodySm" className="text-blue-600">
                  {selectedStock.caseConfig} bottles per case
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Typography variant="headingSm" className="mb-1">
                  Step 3: Select Target Size
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mb-4">
                  How many bottles per new case?
                </Typography>

                <div className="grid grid-cols-3 gap-2">
                  {getValidConfigs().map((config) => (
                    <button
                      key={config}
                      onClick={() => setTargetCaseConfig(config)}
                      className={`rounded-lg border-2 p-3 text-center transition-colors ${
                        targetCaseConfig === config
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-border-primary hover:border-border-brand'
                      }`}
                    >
                      <Typography variant="headingMd">{config}</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        bottles
                      </Typography>
                    </button>
                  ))}
                </div>

                {getTargetCases() > 0 && (
                  <div className="mt-4 rounded-lg bg-fill-secondary p-4 text-center">
                    <Typography variant="bodyXs" colorRole="muted">
                      Result
                    </Typography>
                    <div className="flex items-center justify-center gap-2">
                      <Typography variant="bodySm">1x {selectedStock.caseConfig}-pack</Typography>
                      <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
                      <Typography variant="headingSm" className="text-emerald-600">
                        {getTargetCases()}x {targetCaseConfig}-pack
                      </Typography>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep('select-stock')}>
                <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
              </Button>
              <Button
                variant="default"
                size="lg"
                className="flex-1"
                onClick={() => setStep('remove-case')}
                disabled={getTargetCases() === 0}
              >
                <ButtonContent iconLeft={IconArrowRight}>Continue</ButtonContent>
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Remove Case from Bay */}
        {step === 'remove-case' && selectedStock && sourceLocation && (
          <div className="space-y-4">
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-white">
                  <IconBoxOff className="h-8 w-8" />
                </div>
                <Typography variant="headingSm" className="mb-2">
                  Step 4: Remove Case from Bay
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mb-4">
                  Take the case from the shelf
                </Typography>

                <div className="rounded-lg bg-white p-4 dark:bg-fill-secondary">
                  <Typography variant="bodyXs" colorRole="muted">
                    Remove from
                  </Typography>
                  <LocationBadge locationCode={sourceLocation.locationCode} size="md" className="mb-2" />
                  <Typography variant="bodySm" className="font-medium">
                    {selectedStock.productName}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    1x {selectedStock.caseConfig}-pack
                  </Typography>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep('select-config')}>
                <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
              </Button>
              <Button
                variant="default"
                size="lg"
                className="flex-1"
                onClick={() => setStep('physical-repack')}
              >
                <ButtonContent iconLeft={IconCheck}>Case Removed</ButtonContent>
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Physical Repack */}
        {step === 'physical-repack' && selectedStock && (
          <div className="space-y-4">
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-white">
                  <IconRefresh className="h-8 w-8" />
                </div>
                <Typography variant="headingSm" className="mb-2">
                  Step 5: Repack the Case
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mb-4">
                  Open the case and repack the bottles
                </Typography>

                <div className="rounded-lg bg-white p-4 dark:bg-fill-secondary">
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <Icon icon={IconBox} size="lg" colorRole="muted" className="mx-auto mb-1" />
                      <Typography variant="headingMd">1</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        x {selectedStock.caseConfig}-pack
                      </Typography>
                    </div>
                    <Icon icon={IconArrowRight} size="lg" colorRole="muted" />
                    <div className="text-center">
                      <Icon icon={IconPackage} size="lg" className="mx-auto mb-1 text-emerald-600" />
                      <Typography variant="headingMd" className="text-emerald-600">
                        {getTargetCases()}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        x {targetCaseConfig}-pack
                      </Typography>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                  <Typography variant="bodyXs" className="text-amber-800 dark:text-amber-300">
                    Place {getTargetCases()} bottles into each new case
                  </Typography>
                </div>
              </CardContent>
            </Card>

            {error && (
              <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                <CardContent className="p-4">
                  <Typography variant="bodySm" className="text-red-600 dark:text-red-400">
                    {error}
                  </Typography>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep('remove-case')}>
                <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
              </Button>
              <Button
                variant="default"
                size="lg"
                className="flex-1"
                onClick={() => setStep('scan-destination-bay')}
              >
                <ButtonContent iconLeft={IconCheck}>Done Repacking</ButtonContent>
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Scan Destination Bay */}
        {step === 'scan-destination-bay' && selectedStock && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-6 text-center">
                <Icon icon={IconMapPin} size="xl" colorRole="muted" className="mx-auto mb-2" />
                <Typography variant="headingSm">Step 6: Scan Destination Bay</Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Where will you place the repacked cases?
                </Typography>
              </div>

              <div className="mb-4 rounded-lg bg-fill-secondary p-3 text-center">
                <Typography variant="bodyXs" colorRole="muted">
                  Placing
                </Typography>
                <Typography variant="headingSm" className="text-emerald-600">
                  {getTargetCases()}x {targetCaseConfig}-pack
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {selectedStock.productName}
                </Typography>
              </div>

              <ScanInput
                label="Destination bay barcode"
                placeholder="LOC-..."
                onScan={handleDestinationLocationScan}
                isLoading={repackMutation.isPending}
                error={error}
                disabled={repackMutation.isPending}
              />

              {repackMutation.isPending && (
                <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
                  <IconLoader2 className="h-5 w-5 animate-spin" />
                  <Typography variant="bodySm">Processing repack...</Typography>
                </div>
              )}

              <Button
                variant="outline"
                size="lg"
                className="mt-4 w-full"
                onClick={() => setStep('physical-repack')}
                disabled={repackMutation.isPending}
              >
                <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 7: Success */}
        {step === 'success' && repackResult && destinationLocation && (
          <div className="space-y-4">
            <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <IconCheck className="h-8 w-8" />
                </div>
                <Typography variant="headingMd" className="mb-2">
                  Repack Complete
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mb-4">
                  {repackResult.repackNumber}
                </Typography>

                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <Typography variant="headingSm">{repackResult.source.quantityCases}</Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      x {repackResult.source.caseConfig}-pack
                    </Typography>
                  </div>
                  <Icon icon={IconArrowRight} size="md" colorRole="muted" />
                  <div className="text-center">
                    <Typography variant="headingSm" className="text-emerald-600">
                      {repackResult.target.quantityCases}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      x {repackResult.target.caseConfig}-pack
                    </Typography>
                  </div>
                </div>

                <div className="mt-4">
                  <Typography variant="bodyXs" colorRole="muted">
                    Placed at
                  </Typography>
                  <LocationBadge locationCode={destinationLocation.locationCode} size="sm" />
                </div>
              </CardContent>
            </Card>

            {/* New Labels */}
            <Card>
              <CardContent className="p-4">
                <Typography variant="headingSm" className="mb-3">
                  New Case Labels ({repackResult.target.newCaseLabels.length})
                </Typography>
                <div className="space-y-2">
                  {repackResult.target.newCaseLabels.map((label) => (
                    <div
                      key={label.barcode}
                      className="rounded bg-fill-secondary p-2 font-mono text-xs"
                    >
                      {label.barcode}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button
              variant="default"
              size="lg"
              className="w-full"
              onClick={handlePrintLabels}
            >
              <ButtonContent iconLeft={IconPrinter}>
                Print {repackResult.target.newCaseLabels.length} Labels
              </ButtonContent>
            </Button>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" asChild>
                <Link href="/platform/admin/wms">Done</Link>
              </Button>
              <Button variant="outline" size="lg" className="flex-1" onClick={handleReset}>
                <ButtonContent iconLeft={IconPackage}>Repack More</ButtonContent>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSRepackPage;
