'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconBox,
  IconBoxOff,
  IconCheck,
  IconLoader2,
  IconMapPin,
  IconMinus,
  IconPackage,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useState } from 'react';

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
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

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

interface RepackTargetResult {
  lwin18: string;
  productName: string;
  caseConfig: number;
  quantityCases: number;
  newCaseLabels: Array<{ barcode: string }>;
  packSize: string;
  vintage?: number | null;
  owner?: string | null;
  lotNumber?: string | null;
}

interface RepackResult {
  repackNumber: string;
  source: {
    productName: string;
    caseConfig: number;
    quantityCases: number;
  };
  target: RepackTargetResult;
  target2?: RepackTargetResult | null;
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
 * 3. Select target case configuration (even or custom split)
 * 4. Confirm removal from source bay
 * 5. Physical repack (operator opens case and repacks)
 * 6. Scan destination bay
 * 7. Success with label download
 */
const WMSRepackPage = () => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const wmsApi = useWmsApi();
  const queryClient = useQueryClient();
  const { print } = usePrint();

  const [step, setStep] = useState<WorkflowStep>('scan-source-bay');
  const [sourceLocation, setSourceLocation] = useState<LocationInfo | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<LocationInfo | null>(null);
  const [stockAtLocation, setStockAtLocation] = useState<StockItem[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [targetCaseConfig, setTargetCaseConfig] = useState<number>(6);
  const [repackMode, setRepackMode] = useState<'even' | 'uneven'>('even');
  const [bottlesToRemove, setBottlesToRemove] = useState<number>(1);
  const [error, setError] = useState<string>('');
  const [isSourceScanning, setIsSourceScanning] = useState(false);
  const [repackResult, setRepackResult] = useState<RepackResult | null>(null);

  // Repack mutation
  const { mutate: executeRepack, isPending: isRepacking } = useMutation({
    ...api.wms.admin.operations.repack.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: [['wms', 'admin', 'stock']] });
      void queryClient.invalidateQueries({ queryKey: [['wms', 'admin', 'operations']] });
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
        target2: data.target2
          ? {
              lwin18: data.target2.lwin18,
              productName: data.target2.productName,
              caseConfig: data.target2.caseConfig,
              quantityCases: data.target2.quantityCases,
              newCaseLabels: data.target2.newCaseLabels,
              packSize: data.target2.packSize,
              vintage: data.target2.vintage,
              owner: data.target2.owner,
              lotNumber: data.target2.lotNumber,
            }
          : null,
      });
      setStep('success');
    },
    onError: (err) => {
      setError(err.message);
      // Go back to physical repack step on error
      setStep('physical-repack');
    },
  });

  const handleSourceLocationScan = useCallback(async (barcode: string) => {
    setError('');
    setIsSourceScanning(true);
    try {
      // Use cloud tRPC directly (not NUC) — repack mutation needs real Neon stock IDs
      const result = await trpcClient.wms.admin.operations.getLocationByBarcode.mutate({ barcode });
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
  }, [trpcClient]);

  const handleDestinationLocationScan = useCallback(async (barcode: string) => {
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
        if (repackMode === 'even') {
          executeRepack({
            mode: 'even',
            stockId: selectedStock.id,
            sourceQuantityCases: 1,
            targetCaseConfig,
            destinationLocationId: result.location.id,
          });
        } else {
          executeRepack({
            mode: 'uneven',
            stockId: selectedStock.id,
            sourceQuantityCases: 1,
            bottlesToRemove,
            destinationLocationId: result.location.id,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location not found');
    }
  }, [wmsApi, selectedStock, repackMode, targetCaseConfig, bottlesToRemove, executeRepack]);

  const handleSelectStock = useCallback((stock: StockItem) => {
    setSelectedStock(stock);
    // Default to half the source config, minimum 1
    const defaultTarget = Math.max(1, Math.floor(stock.caseConfig / 2));
    setTargetCaseConfig(defaultTarget);
    setBottlesToRemove(1);
    setRepackMode('even');
    setStep('select-config');
  }, []);

  const handleCaseScan = useCallback(async (barcode: string) => {
    setError('');
    const trimmed = barcode.trim();

    // Try direct LWIN18 match first (scanner reads raw LWIN18 from stock labels)
    let match = stockAtLocation.find((s) => s.lwin18 === trimmed);

    // Try CASE-{lwin18}-{sequence} format (case labels from receiving)
    if (!match && trimmed.startsWith('CASE-')) {
      const parts = trimmed.replace(/^CASE-/, '').split('-');
      const lwin18 = parts.slice(0, -1).join('-');
      match = stockAtLocation.find((s) => s.lwin18 === lwin18);
    }

    if (match) {
      handleSelectStock(match);
    } else {
      setError(`No repackable stock matching "${trimmed}" at this location`);
    }
  }, [stockAtLocation, handleSelectStock]);

  const handleReset = () => {
    setStep('scan-source-bay');
    setSourceLocation(null);
    setDestinationLocation(null);
    setStockAtLocation([]);
    setSelectedStock(null);
    setTargetCaseConfig(6);
    setRepackMode('even');
    setBottlesToRemove(1);
    setError('');
    setRepackResult(null);
  };

  // Print labels for repacked cases (both targets if uneven)
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

    if (repackResult.target2) {
      for (const label of repackResult.target2.newCaseLabels) {
        labelData.push({
          barcode: label.barcode,
          productName: repackResult.target2.productName,
          lwin18: repackResult.target2.lwin18,
          packSize: repackResult.target2.packSize,
          vintage: repackResult.target2.vintage ?? undefined,
          lotNumber: repackResult.target2.lotNumber ?? undefined,
          owner: repackResult.target2.owner ?? undefined,
        });
      }
    }

    const zpl = generateBatchLabelsZpl(labelData);
    const filename = `repack-${repackResult.repackNumber}-labels`;
    const printed = await print(zpl, '4x2');
    if (!printed) downloadZplFile(zpl, filename);
  };

  // Calculate target cases from source (even mode)
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

  // Total labels across both targets
  const getTotalLabels = () => {
    if (!repackResult) return 0;
    let count = repackResult.target.newCaseLabels.length;
    if (repackResult.target2) {
      count += repackResult.target2.newCaseLabels.length;
    }
    return count;
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
                  Scan a case barcode or tap to select
                </Typography>

                <div className="mb-4">
                  <ScanInput
                    label="Case barcode"
                    placeholder="CASE-..."
                    onScan={handleCaseScan}
                    error={error}
                  />
                </div>

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
                  Step 3: Select Split Type
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mb-4">
                  Choose how to split the case
                </Typography>

                {/* Mode toggle pills */}
                <div className="mb-4 flex rounded-lg bg-fill-secondary p-1">
                  <button
                    onClick={() => setRepackMode('even')}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      repackMode === 'even'
                        ? 'bg-fill-primary text-text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Even Split
                  </button>
                  <button
                    onClick={() => setRepackMode('uneven')}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      repackMode === 'uneven'
                        ? 'bg-fill-primary text-text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Custom Split
                  </button>
                </div>

                {repackMode === 'even' ? (
                  <>
                    {/* Even split: divisor grid */}
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
                  </>
                ) : (
                  <>
                    {/* Custom split: stepper */}
                    <div className="mb-4">
                      <Typography variant="bodyXs" colorRole="muted" className="mb-3 text-center">
                        How many bottles to remove?
                      </Typography>
                      <div className="flex items-center justify-center gap-4">
                        <button
                          onClick={() => setBottlesToRemove(Math.max(1, bottlesToRemove - 1))}
                          disabled={bottlesToRemove <= 1}
                          className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border-primary bg-fill-primary transition-colors hover:border-border-brand disabled:opacity-30"
                        >
                          <IconMinus className="h-5 w-5" />
                        </button>
                        <div className="flex h-12 w-24 items-center justify-center rounded-xl border-2 border-blue-600 bg-blue-50 text-lg font-bold dark:bg-blue-900/20">
                          {bottlesToRemove}
                        </div>
                        <button
                          onClick={() => setBottlesToRemove(Math.min(selectedStock.caseConfig - 1, bottlesToRemove + 1))}
                          disabled={bottlesToRemove >= selectedStock.caseConfig - 1}
                          className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border-primary bg-fill-primary transition-colors hover:border-border-brand disabled:opacity-30"
                        >
                          <IconPlus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg bg-fill-secondary p-4 text-center">
                      <Typography variant="bodyXs" colorRole="muted">
                        Result
                      </Typography>
                      <div className="flex items-center justify-center gap-2">
                        <Typography variant="bodySm">1x {selectedStock.caseConfig}-pack</Typography>
                        <Icon icon={IconArrowRight} size="sm" colorRole="muted" />
                        <div className="text-center">
                          <Typography variant="headingSm" className="text-emerald-600">
                            1x {bottlesToRemove}-pack + 1x {selectedStock.caseConfig - bottlesToRemove}-pack
                          </Typography>
                        </div>
                      </div>
                    </div>
                  </>
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
                disabled={repackMode === 'even' && getTargetCases() === 0}
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

                {repackMode === 'even' ? (
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
                ) : (
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
                      <div className="flex gap-3">
                        <div className="text-center">
                          <Icon icon={IconPackage} size="lg" className="mx-auto mb-1 text-emerald-600" />
                          <Typography variant="headingMd" className="text-emerald-600">1</Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            x {bottlesToRemove}-pack
                          </Typography>
                        </div>
                        <div className="flex items-center">
                          <Typography variant="bodySm" colorRole="muted">+</Typography>
                        </div>
                        <div className="text-center">
                          <Icon icon={IconPackage} size="lg" className="mx-auto mb-1 text-emerald-600" />
                          <Typography variant="headingMd" className="text-emerald-600">1</Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            x {selectedStock.caseConfig - bottlesToRemove}-pack
                          </Typography>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                  <Typography variant="bodyXs" className="text-amber-800 dark:text-amber-300">
                    {repackMode === 'even'
                      ? `Place ${targetCaseConfig} bottles into each new case`
                      : `Remove ${bottlesToRemove} bottle${bottlesToRemove > 1 ? 's' : ''} and place into a new case. Leave ${selectedStock.caseConfig - bottlesToRemove} in the original case.`}
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
                {repackMode === 'even' ? (
                  <Typography variant="headingSm" className="text-emerald-600">
                    {getTargetCases()}x {targetCaseConfig}-pack
                  </Typography>
                ) : (
                  <Typography variant="headingSm" className="text-emerald-600">
                    1x {bottlesToRemove}-pack + 1x {selectedStock.caseConfig - bottlesToRemove}-pack
                  </Typography>
                )}
                <Typography variant="bodyXs" colorRole="muted">
                  {selectedStock.productName}
                </Typography>
              </div>

              <ScanInput
                label="Destination bay barcode"
                placeholder="LOC-..."
                onScan={handleDestinationLocationScan}
                isLoading={isRepacking}
                error={error}
                disabled={isRepacking}
              />

              {isRepacking && (
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
                disabled={isRepacking}
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

                {repackResult.target2 ? (
                  // Uneven split: show both targets
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <Typography variant="headingSm">{repackResult.source.quantityCases}</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        x {repackResult.source.caseConfig}-pack
                      </Typography>
                    </div>
                    <Icon icon={IconArrowRight} size="md" colorRole="muted" />
                    <div className="flex gap-3">
                      <div className="text-center">
                        <Typography variant="headingSm" className="text-emerald-600">
                          {repackResult.target.quantityCases}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          x {repackResult.target.caseConfig}-pack
                        </Typography>
                      </div>
                      <div className="flex items-center">
                        <Typography variant="bodySm" colorRole="muted">+</Typography>
                      </div>
                      <div className="text-center">
                        <Typography variant="headingSm" className="text-emerald-600">
                          {repackResult.target2.quantityCases}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          x {repackResult.target2.caseConfig}-pack
                        </Typography>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Even split: single target
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
                )}

                <div className="mt-4">
                  <Typography variant="bodyXs" colorRole="muted">
                    Placed at
                  </Typography>
                  <LocationBadge locationCode={destinationLocation.locationCode} size="sm" />
                </div>
              </CardContent>
            </Card>

            {/* New Labels — Removed Portion */}
            <Card>
              <CardContent className="p-4">
                <Typography variant="headingSm" className="mb-1">
                  {repackResult.target2 ? 'Removed Portion' : 'New Case Labels'} ({repackResult.target.newCaseLabels.length})
                </Typography>
                {repackResult.target2 && (
                  <Typography variant="bodyXs" colorRole="muted" className="mb-2">
                    {repackResult.target.quantityCases}x {repackResult.target.caseConfig}-pack
                  </Typography>
                )}
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

            {/* New Labels — Remaining Portion (uneven only) */}
            {repackResult.target2 && (
              <Card>
                <CardContent className="p-4">
                  <Typography variant="headingSm" className="mb-1">
                    Remaining Portion ({repackResult.target2.newCaseLabels.length})
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-2">
                    {repackResult.target2.quantityCases}x {repackResult.target2.caseConfig}-pack
                  </Typography>
                  <div className="space-y-2">
                    {repackResult.target2.newCaseLabels.map((label) => (
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
            )}

            <Button
              variant="default"
              size="lg"
              className="w-full"
              onClick={handlePrintLabels}
            >
              <ButtonContent iconLeft={IconPrinter}>
                Print {getTotalLabels()} Labels
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
