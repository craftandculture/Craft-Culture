'use client';

import {
  IconArrowRight,
  IconCheck,
  IconChevronRight,
  IconLoader2,
  IconMapPin,
  IconPackage,
  IconPrinter,
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

type WorkflowStep = 'scan-location' | 'select-stock' | 'select-config' | 'confirm' | 'success';

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
    productName: string;
    caseConfig: number;
    quantityCases: number;
    newCaseLabels: Array<{ barcode: string }>;
  };
}

/**
 * WMS Repack - workflow for splitting cases (e.g., 12-pack to 6-pack)
 */
const WMSRepackPage = () => {
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WorkflowStep>('scan-location');
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [stockAtLocation, setStockAtLocation] = useState<StockItem[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [targetCaseConfig, setTargetCaseConfig] = useState<number>(6);
  const [error, setError] = useState<string>('');
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
          productName: data.target.productName,
          caseConfig: data.target.caseConfig,
          quantityCases: data.target.quantityCases,
          newCaseLabels: data.target.newCaseLabels,
        },
      });
      setStep('success');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleLocationScan = async (barcode: string) => {
    setError('');
    try {
      const result = await trpcClient.wms.admin.operations.getLocationByBarcode.query({ barcode });
      setLocation({
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
    }
  };

  const handleSelectStock = (stock: StockItem) => {
    setSelectedStock(stock);
    // Default to half the source config, minimum 1
    const defaultTarget = Math.max(1, Math.floor(stock.caseConfig / 2));
    setTargetCaseConfig(defaultTarget);
    setStep('select-config');
  };

  const handleConfirm = () => {
    if (!selectedStock) return;

    repackMutation.mutate({
      stockId: selectedStock.id,
      sourceQuantityCases: 1, // Repack one case at a time
      targetCaseConfig,
    });
  };

  const handleReset = () => {
    setStep('scan-location');
    setLocation(null);
    setStockAtLocation([]);
    setSelectedStock(null);
    setTargetCaseConfig(6);
    setError('');
    setRepackResult(null);
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
    <div className="container mx-auto max-w-lg px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Link href="/platform/admin/wms" className="text-text-muted hover:text-text-primary">
              <Typography variant="bodySm">WMS</Typography>
            </Link>
            <IconChevronRight className="h-4 w-4 text-text-muted" />
            <Typography variant="bodySm">Repack</Typography>
          </div>
          <Typography variant="headingLg" className="mb-1">
            Repack Cases
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Split cases into smaller configurations
          </Typography>
        </div>

        {/* Step: Scan Location */}
        {step === 'scan-location' && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-6 text-center">
                <Icon icon={IconMapPin} size="xl" colorRole="muted" className="mx-auto mb-2" />
                <Typography variant="headingSm">Scan Location</Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Scan the location with stock to repack
                </Typography>
              </div>

              <ScanInput
                label="Location barcode"
                placeholder="LOC-..."
                onScan={handleLocationScan}
                error={error}
              />
            </CardContent>
          </Card>
        )}

        {/* Step: Select Stock */}
        {step === 'select-stock' && location && (
          <div className="space-y-4">
            <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <IconCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Location
                    </Typography>
                    <LocationBadge locationCode={location.locationCode} size="sm" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Typography variant="headingSm" className="mb-4">
                  Select Stock to Repack
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

            <Button variant="outline" className="w-full" onClick={handleReset}>
              <ButtonContent iconLeft={IconX}>Cancel</ButtonContent>
            </Button>
          </div>
        )}

        {/* Step: Select Target Config */}
        {step === 'select-config' && selectedStock && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodyXs" colorRole="muted">
                  Source
                </Typography>
                <Typography variant="headingSm">{selectedStock.productName}</Typography>
                <Typography variant="bodySm" className="text-blue-600">
                  {selectedStock.caseConfig} bottles per case
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Typography variant="headingSm" className="mb-4">
                  Select Target Configuration
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
              <Button variant="outline" className="flex-1" onClick={() => setStep('select-stock')}>
                <ButtonContent iconLeft={IconX}>Back</ButtonContent>
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => setStep('confirm')}
                disabled={getTargetCases() === 0}
              >
                <ButtonContent iconLeft={IconArrowRight}>Continue</ButtonContent>
              </Button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && selectedStock && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="mb-6 text-center">
                  <Typography variant="headingSm">Confirm Repack</Typography>
                </div>

                <div className="space-y-4">
                  {/* Product */}
                  <div className="rounded-lg bg-fill-secondary p-4 text-center">
                    <Typography variant="headingSm">{selectedStock.productName}</Typography>
                  </div>

                  {/* Conversion */}
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border-primary p-4">
                    <div className="text-center">
                      <Typography variant="headingLg">1</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        x {selectedStock.caseConfig}-pack
                      </Typography>
                    </div>
                    <Icon icon={IconArrowRight} size="lg" colorRole="muted" />
                    <div className="text-center">
                      <Typography variant="headingLg" className="text-emerald-600">
                        {getTargetCases()}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        x {targetCaseConfig}-pack
                      </Typography>
                    </div>
                  </div>

                  <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                    <Typography variant="bodyXs" className="text-amber-800 dark:text-amber-300">
                      {getTargetCases()} new case labels will be generated
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep('select-config')}
              >
                <ButtonContent iconLeft={IconX}>Back</ButtonContent>
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleConfirm}
                disabled={repackMutation.isPending}
              >
                <ButtonContent iconLeft={repackMutation.isPending ? IconLoader2 : IconCheck}>
                  {repackMutation.isPending ? 'Processing...' : 'Confirm Repack'}
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
        {step === 'success' && repackResult && (
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

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/platform/admin/wms">Done</Link>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/platform/admin/wms/labels">
                  <ButtonContent iconLeft={IconPrinter}>Print Labels</ButtonContent>
                </Link>
              </Button>
            </div>

            <Button variant="primary" className="w-full" onClick={handleReset}>
              <ButtonContent iconLeft={IconPackage}>Repack More</ButtonContent>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSRepackPage;
