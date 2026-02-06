'use client';

import {
  IconArrowLeft,
  IconBarcode,
  IconCheck,
  IconLayoutList,
  IconLoader2,
  IconMapPin,
  IconPrinter,
  IconShip,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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
 * WMS Labels Page - view and print case labels and location labels
 */
const WMSLabelsPage = () => {
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get('shipmentId');
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'case' | 'location' | 'totem'>(shipmentId ? 'case' : 'totem');
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [isPrintingToZebra, setIsPrintingToZebra] = useState(false);
  const [zebraConnected, setZebraConnected] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Store print function from ZebraPrint component
  const printFnRef = useRef<((zpl: string) => Promise<boolean>) | null>(null);

  const handlePrintReady = useCallback((printFn: (zpl: string) => Promise<boolean>) => {
    printFnRef.current = printFn;
  }, []);

  // Detect mobile device for print button enablement
  useEffect(() => {
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setIsMobile(mobile);
  }, []);

  // Get case labels for a shipment
  const { data: caseLabelsData, isLoading: caseLabelsLoading } = useQuery({
    ...api.wms.admin.labels.getCaseLabels.queryOptions({ shipmentId: shipmentId ?? '' }),
    enabled: !!shipmentId,
  });

  // Get location labels
  const { data: locationLabelsData, isLoading: locationLabelsLoading } = useQuery({
    ...api.wms.admin.labels.getLocationLabels.queryOptions({}),
  });

  // Get bay totems
  const { data: bayTotemsData, isLoading: bayTotemsLoading } = useQuery({
    ...api.wms.admin.labels.getBayTotems.queryOptions({}),
  });

  const markPrintedMutation = useMutation({
    ...api.wms.admin.labels.markPrinted.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setSelectedLabels(new Set());
    },
  });

  const toggleSelectAll = () => {
    if (activeTab === 'case' && caseLabelsData) {
      if (selectedLabels.size === caseLabelsData.labels.length) {
        setSelectedLabels(new Set());
      } else {
        setSelectedLabels(new Set(caseLabelsData.labels.map((l) => l.id)));
      }
    } else if (activeTab === 'location' && locationLabelsData) {
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

  const handlePrint = () => {
    // Open print dialog
    window.print();
  };

  const handlePrintToZebra = async () => {
    if (selectedLabels.size === 0) return;

    setIsPrintingToZebra(true);

    try {
      let zpl = '';

      if (activeTab === 'location' && locationLabelsData) {
        // Filter to only selected locations
        const selectedLocations = locationLabelsData.locations.filter((loc) =>
          selectedLabels.has(loc.id),
        );

        // Generate ZPL for selected labels only
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
        // Filter to only selected totems
        const selectedTotems = bayTotemsData.totems.filter((totem) =>
          selectedLabels.has(`${totem.aisle}-${totem.bay}`),
        );

        // Generate ZPL for selected totems
        const totemData: BayTotemData[] = selectedTotems.map((totem) => ({
          aisle: totem.aisle,
          bay: totem.bay,
          levels: totem.levels,
        }));

        zpl = generateBatchBayTotemsZpl(totemData);
      }

      if (zpl) {
        // On mobile, directly use Web Share API
        if (isMobile) {
          try {
            // Use .txt extension and text/plain type for better Android compatibility
            const file = new File([zpl], `label-${Date.now()}.txt`, { type: 'text/plain' });

            if (navigator.canShare?.({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'Print Label',
              });
              setSelectedLabels(new Set());
            } else {
              // Fallback: try sharing just as text
              if (navigator.share) {
                await navigator.share({
                  title: 'Print Label',
                  text: zpl,
                });
                setSelectedLabels(new Set());
              } else {
                // Last resort: copy to clipboard
                await navigator.clipboard.writeText(zpl);
                alert('ZPL copied to clipboard. Paste in Printer Setup Utility.');
              }
            }
          } catch (err) {
            // User cancelled share - that's ok
            const message = err instanceof Error ? err.message : 'Share failed';
            if (!message.includes('abort') && !message.includes('cancel')) {
              // Try clipboard as fallback
              try {
                await navigator.clipboard.writeText(zpl);
                alert('Share failed. ZPL copied to clipboard instead. Paste in Printer Setup Utility.');
              } catch {
                alert(`Print error: ${message}`);
              }
            }
          }
        } else if (printFnRef.current) {
          // Desktop: use ZebraPrint component
          const success = await printFnRef.current(zpl);
          if (success) {
            setSelectedLabels(new Set());
          }
        }
      }
    } finally {
      setIsPrintingToZebra(false);
    }
  };

  const handleMarkPrinted = () => {
    if (selectedLabels.size > 0) {
      markPrintedMutation.mutate({ labelIds: Array.from(selectedLabels) });
    }
  };

  const isLoading =
    activeTab === 'case'
      ? caseLabelsLoading
      : activeTab === 'location'
        ? locationLabelsLoading
        : bayTotemsLoading;

  return (
    <div className="container mx-auto max-w-lg px-4 py-6">
      <div className="space-y-6 print:space-y-0">
        {/* Header - Hidden when printing */}
        <div className="flex flex-col gap-4 print:hidden sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/platform/admin/wms"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary"
            >
              <IconArrowLeft className="h-6 w-6" />
            </Link>
            <div className="min-w-0 flex-1">
              <Typography variant="headingLg" className="mb-1">
                Print Labels
              </Typography>
              <Typography variant="bodySm" colorRole="muted">
                Generate and print case labels and location labels
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zebra Printer Status */}
            <ZebraPrint onConnectionChange={setZebraConnected} onPrintReady={handlePrintReady} />

            {selectedLabels.size > 0 && activeTab === 'case' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkPrinted}
                disabled={markPrintedMutation.isPending}
              >
                <ButtonContent iconLeft={IconCheck}>Mark Printed ({selectedLabels.size})</ButtonContent>
              </Button>
            )}

            {/* Print to Zebra button for location labels and bay totems */}
            {(activeTab === 'location' || activeTab === 'totem') && (
              <Button
                variant="primary"
                onClick={handlePrintToZebra}
                disabled={selectedLabels.size === 0 || (!zebraConnected && !isMobile) || isPrintingToZebra}
              >
                <ButtonContent iconLeft={isPrintingToZebra ? IconLoader2 : IconPrinter}>
                  {isPrintingToZebra
                    ? 'Printing...'
                    : `Print to Zebra (${selectedLabels.size})`}
                </ButtonContent>
              </Button>
            )}

            {/* Browser print fallback */}
            <Button variant="outline" onClick={handlePrint} disabled={selectedLabels.size === 0}>
              <ButtonContent iconLeft={IconPrinter}>Browser Print</ButtonContent>
            </Button>
          </div>
        </div>

        {/* Tabs - Hidden when printing */}
        <div className="flex gap-2 border-b border-border-muted print:hidden">
          <button
            onClick={() => setActiveTab('case')}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'case'
                ? 'border-border-brand text-text-brand'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon icon={IconBarcode} size="sm" />
              Case Labels
              {caseLabelsData && ` (${caseLabelsData.totalLabels})`}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('location')}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'location'
                ? 'border-border-brand text-text-brand'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon icon={IconMapPin} size="sm" />
              Location Labels
              {locationLabelsData && ` (${locationLabelsData.totalLabels})`}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('totem')}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'totem'
                ? 'border-border-brand text-text-brand'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon icon={IconLayoutList} size="sm" />
              Bay Totems
              {bayTotemsData && ` (${bayTotemsData.totalTotems})`}
            </div>
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12 print:hidden">
            <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
          </div>
        ) : activeTab === 'case' ? (
          /* Case Labels */
          shipmentId && caseLabelsData ? (
            <div className="space-y-4">
              {/* Shipment Info - Hidden when printing */}
              <Card className="print:hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Icon icon={IconShip} size="md" className="text-blue-600" />
                    <div>
                      <Typography variant="headingSm">{caseLabelsData.shipmentNumber}</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {caseLabelsData.partnerName} • {caseLabelsData.originCountry}
                      </Typography>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Select All - Hidden when printing */}
              <div className="flex items-center justify-between print:hidden">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedLabels.size === caseLabelsData.labels.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border-primary"
                  />
                  <Typography variant="bodySm">Select All ({caseLabelsData.labels.length} labels)</Typography>
                </label>
              </div>

              {/* Labels Grid - Printable */}
              <div className="grid grid-cols-1 gap-4 print:grid-cols-2 print:gap-0 sm:grid-cols-2 lg:grid-cols-3">
                {caseLabelsData.labels.map((label) => (
                  <div
                    key={label.id}
                    className={`relative print:break-inside-avoid print:p-2 ${
                      selectedLabels.has(label.id) ? '' : 'print:hidden'
                    }`}
                  >
                    {/* Checkbox - Hidden when printing */}
                    <div className="absolute left-2 top-2 print:hidden">
                      <input
                        type="checkbox"
                        checked={selectedLabels.has(label.id)}
                        onChange={() => toggleLabel(label.id)}
                        className="h-4 w-4 rounded border-border-primary"
                      />
                    </div>
                    {/* Label Card */}
                    <Card
                      className={`cursor-pointer transition-colors print:border-2 print:border-black ${
                        selectedLabels.has(label.id)
                          ? 'border-border-brand ring-1 ring-border-brand'
                          : 'hover:border-border-muted'
                      }`}
                      onClick={() => toggleLabel(label.id)}
                    >
                      <CardContent className="p-4 print:p-2">
                        {/* Barcode placeholder - In production, use react-barcode */}
                        <div className="mb-2 flex h-12 items-center justify-center border border-dashed border-border-muted bg-fill-secondary font-mono text-xs print:h-16 print:border-solid">
                          |||||||||||||||||||||||
                        </div>
                        <Typography variant="bodyXs" className="mb-1 text-center font-mono">
                          {label.barcode}
                        </Typography>
                        <Typography variant="bodySm" className="mb-1 line-clamp-2 font-medium">
                          {label.productName}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          Lot: {label.lotNumber}
                        </Typography>
                        {label.printedAt && (
                          <Typography variant="bodyXs" className="text-emerald-600">
                            ✓ Printed
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Card className="print:hidden">
              <CardContent className="p-6 text-center">
                <Icon icon={IconBarcode} size="xl" colorRole="muted" className="mx-auto mb-4" />
                <Typography variant="headingSm" className="mb-2">
                  No Shipment Selected
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="mb-4">
                  Receive a shipment to generate case labels
                </Typography>
                <Button variant="outline" asChild>
                  <Link href="/platform/admin/wms/receive">
                    <ButtonContent iconLeft={IconShip}>View Shipments</ButtonContent>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        ) : activeTab === 'location' ? (
          /* Location Labels */
          locationLabelsData && locationLabelsData.locations.length > 0 ? (
            <div className="space-y-4">
              {/* Select All - Hidden when printing */}
              <div className="flex items-center justify-between print:hidden">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedLabels.size === locationLabelsData.locations.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border-primary"
                  />
                  <Typography variant="bodySm">
                    Select All ({locationLabelsData.locations.length} labels)
                  </Typography>
                </label>
              </div>

              {/* Labels Grid - Printable */}
              <div className="grid grid-cols-1 gap-4 print:grid-cols-2 print:gap-0 sm:grid-cols-2 lg:grid-cols-3">
                {locationLabelsData.locations.map((location) => (
                  <div
                    key={location.id}
                    className={`relative print:break-inside-avoid print:p-2 ${
                      selectedLabels.has(location.id) ? '' : 'print:hidden'
                    }`}
                  >
                    {/* Checkbox - Hidden when printing */}
                    <div className="absolute left-2 top-2 print:hidden">
                      <input
                        type="checkbox"
                        checked={selectedLabels.has(location.id)}
                        onChange={() => toggleLabel(location.id)}
                        className="h-4 w-4 rounded border-border-primary"
                      />
                    </div>
                    {/* Label Card */}
                    <Card
                      className={`cursor-pointer transition-colors print:border-2 print:border-black ${
                        selectedLabels.has(location.id)
                          ? 'border-border-brand ring-1 ring-border-brand'
                          : 'hover:border-border-muted'
                      }`}
                      onClick={() => toggleLabel(location.id)}
                    >
                      <CardContent className="p-4 print:p-2">
                        {/* Barcode placeholder */}
                        <div className="mb-2 flex h-12 items-center justify-center border border-dashed border-border-muted bg-fill-secondary font-mono text-xs print:h-16 print:border-solid">
                          |||||||||||||||||||||||
                        </div>
                        <Typography variant="bodyXs" className="mb-2 text-center font-mono">
                          {location.barcode}
                        </Typography>
                        <Typography variant="headingLg" className="mb-1 text-center">
                          {location.aisle} - {location.bay} - {location.level}
                        </Typography>
                        <div className="flex items-center justify-center gap-2">
                          <span className="rounded-full bg-fill-secondary px-2 py-0.5 text-xs uppercase">
                            {location.locationType}
                          </span>
                          {location.requiresForklift && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              Forklift
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Card className="print:hidden">
              <CardContent className="p-6 text-center">
                <Icon icon={IconMapPin} size="xl" colorRole="muted" className="mx-auto mb-4" />
                <Typography variant="headingSm" className="mb-2">
                  No Locations Found
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="mb-4">
                  Create warehouse locations first
                </Typography>
                <Button variant="outline" asChild>
                  <Link href="/platform/admin/wms/locations/new">
                    <ButtonContent iconLeft={IconMapPin}>Create Locations</ButtonContent>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        ) : (
          /* Bay Totems */
          bayTotemsData && bayTotemsData.totems.length > 0 ? (
            <div className="space-y-4">
              {/* Info banner */}
              <Card className="print:hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon icon={IconLayoutList} size="md" className="mt-0.5 text-blue-600" />
                    <div>
                      <Typography variant="headingSm">Bay Totem Labels</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        Vertical strips showing all levels for each bay. Mount at eye level (1.5m) on the upright column.
                        Uses 4&quot; x 6&quot; labels.
                      </Typography>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Select All - Hidden when printing */}
              <div className="flex items-center justify-between print:hidden">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedLabels.size === bayTotemsData.totems.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border-primary"
                  />
                  <Typography variant="bodySm">
                    Select All ({bayTotemsData.totems.length} bay totems)
                  </Typography>
                </label>
              </div>

              {/* Totems Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {bayTotemsData.totems.map((totem) => {
                  const totemKey = `${totem.aisle}-${totem.bay}`;
                  return (
                    <div key={totemKey} className="relative">
                      {/* Checkbox - Hidden when printing */}
                      <div className="absolute left-2 top-2 z-10 print:hidden">
                        <input
                          type="checkbox"
                          checked={selectedLabels.has(totemKey)}
                          onChange={() => toggleLabel(totemKey)}
                          className="h-4 w-4 rounded border-border-primary"
                        />
                      </div>
                      {/* Totem Card */}
                      <Card
                        className={`cursor-pointer transition-colors ${
                          selectedLabels.has(totemKey)
                            ? 'border-border-brand ring-1 ring-border-brand'
                            : 'hover:border-border-muted'
                        }`}
                        onClick={() => toggleLabel(totemKey)}
                      >
                        <CardContent className="p-4">
                          {/* Bay Header */}
                          <div className="mb-3 border-b border-border-muted pb-2">
                            <Typography variant="headingMd" className="text-center">
                              Bay {totem.aisle}-{totem.bay}
                            </Typography>
                          </div>

                          {/* Levels */}
                          <div className="space-y-2">
                            {totem.levels.map((level) => (
                              <div
                                key={level.level}
                                className="flex items-center justify-between rounded bg-fill-secondary px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex h-8 w-8 items-center justify-center rounded bg-fill-primary text-xs font-mono">
                                    QR
                                  </div>
                                  <div>
                                    <Typography variant="bodySm" className="font-medium">
                                      {totem.aisle}-{totem.bay}-{level.level}
                                    </Typography>
                                    <Typography variant="bodyXs" colorRole="muted">
                                      {parseInt(level.level, 10) === 0 ? 'Floor' : `Level ${parseInt(level.level, 10)}`}
                                    </Typography>
                                  </div>
                                </div>
                                {level.requiresForklift && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                    Forklift
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Footer */}
                          <Typography variant="bodyXs" colorRole="muted" className="mt-3 text-center">
                            {totem.levels.length} levels
                          </Typography>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card className="print:hidden">
              <CardContent className="p-6 text-center">
                <Icon icon={IconLayoutList} size="xl" colorRole="muted" className="mx-auto mb-4" />
                <Typography variant="headingSm" className="mb-2">
                  No Bay Totems Available
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="mb-4">
                  Create rack locations first to generate bay totems
                </Typography>
                <Button variant="outline" asChild>
                  <Link href="/platform/admin/wms/locations/new">
                    <ButtonContent iconLeft={IconMapPin}>Create Locations</ButtonContent>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:break-inside-avoid,
          .print\\:break-inside-avoid * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: 4in 2in;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default WMSLabelsPage;
