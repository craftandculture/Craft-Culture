'use client';

import {
  IconLayoutList,
  IconLoader2,
  IconMapPin,
  IconPrinter,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import ZebraPrint from '@/app/_wms/components/ZebraPrint';
import type { BayTotemData } from '@/app/_wms/utils/generateBayTotemZpl';
import { generateBatchBayTotemsZpl } from '@/app/_wms/utils/generateBayTotemZpl';
import type { LocationLabelData } from '@/app/_wms/utils/generateLocationLabelZpl';
import { generateBatchLocationLabelsZpl } from '@/app/_wms/utils/generateLocationLabelZpl';
import useTRPC from '@/lib/trpc/browser';

/**
 * Inner component that uses useSearchParams
 */
const WMSDeviceLabelsContent = () => {
  const searchParams = useSearchParams();
  const deviceToken = searchParams.get('device_token');
  const api = useTRPC();

  const [activeTab, setActiveTab] = useState<'location' | 'totem'>('totem');
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [isPrintingToZebra, setIsPrintingToZebra] = useState(false);
  const [zebraConnected, setZebraConnected] = useState(false);

  // Store print function from ZebraPrint component
  const printFnRef = useRef<((zpl: string) => Promise<boolean>) | null>(null);

  const handlePrintReady = useCallback((printFn: (zpl: string) => Promise<boolean>) => {
    printFnRef.current = printFn;
  }, []);

  // Get location labels - pass device_token for auth
  const { data: locationLabelsData, isLoading: locationLabelsLoading, error: locationError } = useQuery({
    ...api.wms.device.labels.getLocationLabels.queryOptions({ deviceToken: deviceToken ?? '' }),
    enabled: !!deviceToken,
  });

  // Get bay totems - pass device_token for auth
  const { data: bayTotemsData, isLoading: bayTotemsLoading, error: totemError } = useQuery({
    ...api.wms.device.labels.getBayTotems.queryOptions({ deviceToken: deviceToken ?? '' }),
    enabled: !!deviceToken,
  });

  // Auto-select all on load for quick printing
  useEffect(() => {
    if (activeTab === 'totem' && bayTotemsData && selectedLabels.size === 0) {
      setSelectedLabels(new Set(bayTotemsData.totems.map((t) => `${t.aisle}-${t.bay}`)));
    } else if (activeTab === 'location' && locationLabelsData && selectedLabels.size === 0) {
      setSelectedLabels(new Set(locationLabelsData.locations.map((l) => l.id)));
    }
  }, [activeTab, bayTotemsData, locationLabelsData, selectedLabels.size]);

  const toggleSelectAll = () => {
    if (activeTab === 'location' && locationLabelsData) {
      if (selectedLabels.size === locationLabelsData.locations.length) {
        setSelectedLabels(new Set());
      } else {
        setSelectedLabels(new Set(locationLabelsData.locations.map((l) => l.id)));
      }
    } else if (activeTab === 'totem' && bayTotemsData) {
      if (selectedLabels.size === bayTotemsData.totems.length) {
        setSelectedLabels(new Set());
      } else {
        setSelectedLabels(new Set(bayTotemsData.totems.map((t) => `${t.aisle}-${t.bay}`)));
      }
    }
  };

  const toggleLabel = (id: string) => {
    const newSet = new Set(selectedLabels);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedLabels(newSet);
  };

  const handlePrintToZebra = async () => {
    if (selectedLabels.size === 0) return;

    setIsPrintingToZebra(true);

    try {
      let zpl = '';

      if (activeTab === 'location' && locationLabelsData) {
        const selectedLocations = locationLabelsData.locations.filter((loc) =>
          selectedLabels.has(loc.id),
        );

        const labelData: LocationLabelData[] = selectedLocations.map((loc) => ({
          barcode: loc.barcode,
          locationCode: loc.locationCode,
          aisle: loc.aisle,
          bay: loc.bay,
          level: loc.level,
          locationType: loc.locationType,
          requiresForklift: loc.requiresForklift,
        }));

        zpl = generateBatchLocationLabelsZpl(labelData);
      } else if (activeTab === 'totem' && bayTotemsData) {
        const selectedTotems = bayTotemsData.totems.filter((totem) =>
          selectedLabels.has(`${totem.aisle}-${totem.bay}`),
        );

        const totemData: BayTotemData[] = selectedTotems.map((totem) => ({
          aisle: totem.aisle,
          bay: totem.bay,
          levels: totem.levels,
        }));

        zpl = generateBatchBayTotemsZpl(totemData);
      }

      if (zpl) {
        // Try ZebraPrint component (EB.PrinterZebra or Web Bluetooth)
        if (printFnRef.current && zebraConnected) {
          const success = await printFnRef.current(zpl);
          if (success) {
            setSelectedLabels(new Set());
          }
        } else {
          // Fallback: use server-side download endpoint
          const zplBase64 = btoa(zpl);
          const downloadUrl = `/api/wms/print?device_token=${encodeURIComponent(deviceToken ?? '')}&zpl=${encodeURIComponent(zplBase64)}`;
          window.location.href = downloadUrl;
          alert('File downloaded. Open with Printer Setup Utility to print.');
        }
      }
    } finally {
      setIsPrintingToZebra(false);
    }
  };

  // Check for auth errors
  const authError = locationError || totemError;
  if (!deviceToken || authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-primary p-8">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Typography variant="headingLg" className="mb-4 text-red-600">
              Access Denied
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              {!deviceToken
                ? 'No device token provided. This page is for authorized warehouse devices only.'
                : `Authentication failed. Please contact support.`}
            </Typography>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = activeTab === 'location' ? locationLabelsLoading : bayTotemsLoading;

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Large Header for TC27 Screen */}
      <header className="sticky top-0 z-50 border-b border-border-primary bg-background-primary p-4">
        <div className="flex items-center justify-between gap-4">
          <Typography variant="headingLg" className="text-2xl">
            WMS Labels
          </Typography>
          <div className="flex items-center gap-3">
            <ZebraPrint onConnectionChange={setZebraConnected} onPrintReady={handlePrintReady} />
            <Button
              variant="primary"
              size="lg"
              onClick={handlePrintToZebra}
              disabled={selectedLabels.size === 0 || isPrintingToZebra}
              className="text-lg px-6 py-3"
            >
              <ButtonContent iconLeft={isPrintingToZebra ? IconLoader2 : IconPrinter}>
                {isPrintingToZebra
                  ? 'Printing...'
                  : `Print (${selectedLabels.size})`}
              </ButtonContent>
            </Button>
          </div>
        </div>

        {/* Large Tabs */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => { setActiveTab('totem'); setSelectedLabels(new Set()); }}
            className={`flex-1 rounded-lg px-6 py-4 text-lg font-medium transition-colors ${
              activeTab === 'totem'
                ? 'bg-fill-brand text-white'
                : 'bg-fill-secondary text-text-muted'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <Icon icon={IconLayoutList} size="md" />
              Bay Totems ({bayTotemsData?.totalTotems ?? 0})
            </div>
          </button>
          <button
            onClick={() => { setActiveTab('location'); setSelectedLabels(new Set()); }}
            className={`flex-1 rounded-lg px-6 py-4 text-lg font-medium transition-colors ${
              activeTab === 'location'
                ? 'bg-fill-brand text-white'
                : 'bg-fill-secondary text-text-muted'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <Icon icon={IconMapPin} size="md" />
              Locations ({locationLabelsData?.totalLabels ?? 0})
            </div>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="xl" />
          </div>
        ) : activeTab === 'totem' && bayTotemsData ? (
          <div className="space-y-4">
            {/* Select All */}
            <button
              onClick={toggleSelectAll}
              className="w-full rounded-lg bg-fill-secondary p-4 text-left text-lg font-medium"
            >
              {selectedLabels.size === bayTotemsData.totems.length
                ? '☑ Deselect All'
                : '☐ Select All'} ({bayTotemsData.totems.length} totems)
            </button>

            {/* Totems Grid - Large cards for touch */}
            <div className="grid grid-cols-2 gap-4">
              {bayTotemsData.totems.map((totem) => {
                const totemKey = `${totem.aisle}-${totem.bay}`;
                const isSelected = selectedLabels.has(totemKey);
                return (
                  <button
                    key={totemKey}
                    onClick={() => toggleLabel(totemKey)}
                    className={`rounded-xl p-6 text-left transition-all ${
                      isSelected
                        ? 'bg-fill-brand text-white ring-4 ring-border-brand'
                        : 'bg-fill-secondary hover:bg-fill-muted'
                    }`}
                  >
                    <Typography variant="headingLg" className="text-3xl text-center mb-2">
                      {totem.aisle}-{totem.bay}
                    </Typography>
                    <Typography variant="bodyMd" className={`text-center ${isSelected ? 'text-white/80' : 'text-text-muted'}`}>
                      {totem.levels.length} levels
                    </Typography>
                  </button>
                );
              })}
            </div>
          </div>
        ) : activeTab === 'location' && locationLabelsData ? (
          <div className="space-y-4">
            {/* Select All */}
            <button
              onClick={toggleSelectAll}
              className="w-full rounded-lg bg-fill-secondary p-4 text-left text-lg font-medium"
            >
              {selectedLabels.size === locationLabelsData.locations.length
                ? '☑ Deselect All'
                : '☐ Select All'} ({locationLabelsData.locations.length} locations)
            </button>

            {/* Locations Grid - Large cards for touch */}
            <div className="grid grid-cols-2 gap-4">
              {locationLabelsData.locations.map((location) => {
                const isSelected = selectedLabels.has(location.id);
                return (
                  <button
                    key={location.id}
                    onClick={() => toggleLabel(location.id)}
                    className={`rounded-xl p-6 text-left transition-all ${
                      isSelected
                        ? 'bg-fill-brand text-white ring-4 ring-border-brand'
                        : 'bg-fill-secondary hover:bg-fill-muted'
                    }`}
                  >
                    <Typography variant="headingLg" className="text-2xl text-center mb-2">
                      {location.aisle}-{location.bay}-{location.level}
                    </Typography>
                    <div className="flex items-center justify-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-sm uppercase ${
                        isSelected ? 'bg-white/20' : 'bg-fill-primary'
                      }`}>
                        {location.locationType}
                      </span>
                      {location.requiresForklift && (
                        <span className={`rounded-full px-3 py-1 text-sm ${
                          isSelected ? 'bg-amber-400/30 text-white' : 'bg-amber-100 text-amber-800'
                        }`}>
                          Forklift
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Typography variant="headingMd" className="mb-2">
                No Data Available
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                No labels found. Please create warehouse locations first.
              </Typography>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

/**
 * WMS Device Labels Page - wrapped in Suspense for useSearchParams
 */
const WMSDeviceLabelsPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background-primary">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="xl" />
        </div>
      }
    >
      <WMSDeviceLabelsContent />
    </Suspense>
  );
};

export default WMSDeviceLabelsPage;
