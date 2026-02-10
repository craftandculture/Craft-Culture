'use client';

import {
  IconArrowLeft,
  IconBarcode,
  IconBox,
  IconCheck,
  IconForklift,
  IconLayoutGrid,
  IconLayoutList,
  IconLoader2,
  IconMapPin,
  IconPackages,
  IconPencil,
  IconPrinter,
  IconShip,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

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
 * WMS Labels Page - view and print case labels, location labels, and bay labels
 */
const WMSLabelsPage = () => {
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get('shipmentId');
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'case' | 'location' | 'bay' | 'totem'>(shipmentId ? 'case' : 'bay');
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [isPrintingToZebra, setIsPrintingToZebra] = useState(false);
  const [zebraConnected, setZebraConnected] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Bay editing state
  const [editingBay, setEditingBay] = useState<{ aisle: string; bay: string } | null>(null);
  const [editStorageMethod, setEditStorageMethod] = useState<'shelf' | 'pallet' | 'mixed'>('shelf');
  const [editForkliftFrom, setEditForkliftFrom] = useState('01');

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

  // Get bay details when editing
  const { data: bayDetails, isLoading: bayDetailsLoading } = useQuery({
    ...api.wms.admin.locations.getBayDetails.queryOptions({
      aisle: editingBay?.aisle || '',
      bay: editingBay?.bay || '',
    }),
    enabled: !!editingBay,
  });

  // Update edit form when bay details load
  useEffect(() => {
    if (bayDetails) {
      setEditStorageMethod((bayDetails.settings.storageMethod as 'shelf' | 'pallet' | 'mixed') || 'shelf');
      setEditForkliftFrom(bayDetails.settings.forkliftFromLevel || '01');
    }
  }, [bayDetails]);

  // Group bays by aisle for display
  const baysByAisle = useMemo(() => {
    if (!bayTotemsData) return new Map<string, typeof bayTotemsData.totems>();

    const grouped = new Map<string, typeof bayTotemsData.totems>();
    for (const totem of bayTotemsData.totems) {
      const aisleGroup = grouped.get(totem.aisle) || [];
      aisleGroup.push(totem);
      grouped.set(totem.aisle, aisleGroup);
    }
    return grouped;
  }, [bayTotemsData]);

  // Get list of aisles
  const aisles = useMemo(() => {
    return Array.from(baysByAisle.keys()).sort();
  }, [baysByAisle]);

  const markPrintedMutation = useMutation({
    ...api.wms.admin.labels.markPrinted.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setSelectedLabels(new Set());
    },
  });

  const updateBayMutation = useMutation({
    ...api.wms.admin.locations.updateBay.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Updated bay ${result.aisle}-${result.bay}`);
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.labels.getBayTotems.queryKey({}),
      });
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.locations.getBayDetails.queryKey({
          aisle: result.aisle,
          bay: result.bay,
        }),
      });
      setEditingBay(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update bay');
    },
  });

  const handleUpdateBay = () => {
    if (!editingBay) return;

    updateBayMutation.mutate({
      aisle: editingBay.aisle,
      bay: editingBay.bay,
      storageMethod: editStorageMethod,
      forkliftFromLevel: editForkliftFrom,
    });
  };

  const selectAllInAisle = (aisle: string) => {
    const bays = baysByAisle.get(aisle) || [];
    const bayKeys = bays.map((b) => `${b.aisle}-${b.bay}`);
    const allSelected = bayKeys.every((k) => selectedLabels.has(k));

    setSelectedLabels((prev) => {
      const newSet = new Set(prev);
      if (allSelected) {
        bayKeys.forEach((k) => newSet.delete(k));
      } else {
        bayKeys.forEach((k) => newSet.add(k));
      }
      return newSet;
    });
  };

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
    } else if ((activeTab === 'totem' || activeTab === 'bay') && bayTotemsData) {
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
      let labelCount = 0;

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
        labelCount = labelData.length;
      } else if (activeTab === 'bay' && bayTotemsData) {
        // Filter to only selected bays
        const selectedBays = bayTotemsData.totems.filter((totem) =>
          selectedLabels.has(`${totem.aisle}-${totem.bay}`),
        );

        // Generate HORIZONTAL location labels for each level in the selected bays
        const labelData: LocationLabelData[] = [];
        for (const bay of selectedBays) {
          for (const level of bay.levels) {
            labelData.push({
              barcode: level.barcode,
              locationCode: `${bay.aisle}-${bay.bay}-${level.level}`,
              aisle: bay.aisle,
              bay: bay.bay,
              level: level.level,
              locationType: 'rack',
              requiresForklift: level.requiresForklift,
            });
          }
        }

        zpl = generateBatchLocationLabelsZpl(labelData);
        labelCount = labelData.length;
      } else if (activeTab === 'totem' && bayTotemsData) {
        // Filter to only selected totems
        const selectedTotems = bayTotemsData.totems.filter((totem) =>
          selectedLabels.has(`${totem.aisle}-${totem.bay}`),
        );

        // Generate ZPL for bay totems (4x6 vertical)
        const totemData: BayTotemData[] = selectedTotems.map((totem) => ({
          aisle: totem.aisle,
          bay: totem.bay,
          levels: totem.levels,
        }));

        zpl = generateBatchBayTotemsZpl(totemData);
        labelCount = totemData.length;
      }

      if (zpl) {
        // On mobile, try to open file directly with Printer Setup Utility
        if (isMobile) {
          try {
            // Create blob with ZPL content
            const blob = new Blob([zpl], { type: 'application/vnd.zebra.zpl' });
            const fileUrl = URL.createObjectURL(blob);

            // Open the file URL - Android should show "Open with" dialog
            const newWindow = window.open(fileUrl, '_blank');

            if (!newWindow) {
              // Popup blocked, fall back to download
              const link = document.createElement('a');
              link.href = fileUrl;
              link.download = 'label.zpl';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.info('File downloaded. Open with Printer Setup Utility.');
            }

            setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
            toast.success(`Printed ${labelCount} location label(s)`);
            setSelectedLabels(new Set());
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Print failed';
            toast.error(`Error: ${message}`);
          }
        } else if (printFnRef.current) {
          // Desktop: use ZebraPrint component
          const success = await printFnRef.current(zpl);
          if (success) {
            toast.success(`Printed ${labelCount} location label(s)`);
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
        : bayTotemsLoading; // bay and totem use bayTotemsData

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

            {/* Print to Zebra button for location labels, bays, and totems */}
            {(activeTab === 'location' || activeTab === 'bay' || activeTab === 'totem') && (
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
            onClick={() => setActiveTab('bay')}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'bay'
                ? 'border-border-brand text-text-brand'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon icon={IconLayoutGrid} size="sm" />
              Bay Labels
              {bayTotemsData && ` (${bayTotemsData.totalTotems})`}
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
              Locations
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
              Totems (4x6)
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
        ) : activeTab === 'bay' ? (
          /* Bay Labels with Editing */
          bayTotemsData && bayTotemsData.totems.length > 0 ? (
            <div className="space-y-4">
              {/* Edit Bay Panel */}
              {editingBay && (
                <Card className="border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-900/20">
                  <div className="flex items-center justify-between border-b border-blue-200 p-4 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                      <Typography variant="headingMd">
                        Edit Bay {editingBay.aisle}-{editingBay.bay}
                      </Typography>
                    </div>
                    <button
                      onClick={() => setEditingBay(null)}
                      className="rounded-lg p-2 text-text-muted hover:bg-fill-secondary hover:text-text-primary"
                    >
                      <IconX className="h-5 w-5" />
                    </button>
                  </div>
                  <CardContent className="space-y-4 p-4">
                    {bayDetailsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" />
                      </div>
                    ) : (
                      <>
                        {/* Levels display */}
                        <div>
                          <Typography variant="labelMd" className="mb-2">
                            Levels ({bayDetails?.locations.length || 0})
                          </Typography>
                          <div className="flex flex-wrap gap-2">
                            {bayDetails?.locations.map((loc) => (
                              <div
                                key={loc.id}
                                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${
                                  loc.requiresForklift
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                    : 'bg-fill-secondary text-text-primary'
                                }`}
                              >
                                <span className="font-mono font-medium">{loc.level}</span>
                                {loc.requiresForklift && <IconForklift className="h-3.5 w-3.5" />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Storage Method */}
                        <div>
                          <Typography variant="labelMd" className="mb-2">
                            Storage Method
                          </Typography>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setEditStorageMethod('shelf')}
                              className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                                editStorageMethod === 'shelf'
                                  ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50'
                                  : 'border-border-primary bg-fill-primary hover:border-blue-300'
                              }`}
                            >
                              <Icon icon={IconBox} size="md" className={editStorageMethod === 'shelf' ? 'text-blue-600' : 'text-text-muted'} />
                              <span className={editStorageMethod === 'shelf' ? 'font-medium text-blue-700 dark:text-blue-300' : ''}>Shelf</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditStorageMethod('pallet')}
                              className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                                editStorageMethod === 'pallet'
                                  ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/50'
                                  : 'border-border-primary bg-fill-primary hover:border-purple-300'
                              }`}
                            >
                              <Icon icon={IconPackages} size="md" className={editStorageMethod === 'pallet' ? 'text-purple-600' : 'text-text-muted'} />
                              <span className={editStorageMethod === 'pallet' ? 'font-medium text-purple-700 dark:text-purple-300' : ''}>Pallet</span>
                            </button>
                          </div>
                        </div>

                        {/* Forklift From Level */}
                        <div>
                          <Typography variant="labelMd" className="mb-2">
                            Forklift Required From Level
                          </Typography>
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={editForkliftFrom}
                              onChange={(e) => setEditForkliftFrom(e.target.value)}
                              placeholder="01"
                              maxLength={2}
                              className="w-20 rounded-lg border border-border-primary bg-fill-primary px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                            <Typography variant="bodySm" colorRole="muted">
                              Level {editForkliftFrom} and above require forklift
                            </Typography>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-2">
                          <Button variant="outline" onClick={() => setEditingBay(null)}>
                            Cancel
                          </Button>
                          <Button onClick={handleUpdateBay} disabled={updateBayMutation.isPending}>
                            <ButtonContent iconLeft={updateBayMutation.isPending ? IconLoader2 : IconCheck}>
                              {updateBayMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </ButtonContent>
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Bays by Aisle */}
              {aisles.map((aisle) => {
                const bays = baysByAisle.get(aisle) || [];
                const bayKeys = bays.map((b) => `${b.aisle}-${b.bay}`);
                const allSelected = bayKeys.every((k) => selectedLabels.has(k));
                const someSelected = bayKeys.some((k) => selectedLabels.has(k));

                return (
                  <Card key={aisle}>
                    <div className="flex items-center justify-between border-b border-border-primary p-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => selectAllInAisle(aisle)}
                          className={`flex h-6 w-6 items-center justify-center rounded border-2 transition-colors ${
                            allSelected
                              ? 'border-brand-primary bg-brand-primary text-white'
                              : someSelected
                                ? 'border-brand-primary bg-brand-primary/20'
                                : 'border-border-primary hover:border-brand-primary'
                          }`}
                        >
                          {allSelected && <IconCheck className="h-4 w-4" />}
                        </button>
                        <Typography variant="headingMd">Aisle {aisle}</Typography>
                        <Typography variant="bodySm" colorRole="muted">
                          ({bays.length} bays)
                        </Typography>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                        {bays.map((totem) => {
                          const bayKey = `${totem.aisle}-${totem.bay}`;
                          const isSelected = selectedLabels.has(bayKey);
                          const isEditing = editingBay?.aisle === totem.aisle && editingBay?.bay === totem.bay;

                          return (
                            <div key={bayKey} className="group relative">
                              <button
                                onClick={() => toggleLabel(bayKey)}
                                className={`w-full rounded-lg border-2 p-3 text-center transition-colors ${
                                  isEditing
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                    : isSelected
                                      ? 'border-brand-primary bg-fill-brand-secondary'
                                      : 'border-border-primary hover:border-brand-primary'
                                }`}
                              >
                                <Typography variant="headingSm" className="font-mono">
                                  {totem.bay}
                                </Typography>
                                <Typography variant="bodyXs" colorRole="muted">
                                  {totem.levels.length} levels
                                </Typography>
                              </button>

                              {/* Edit button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingBay({ aisle: totem.aisle, bay: totem.bay });
                                }}
                                className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white opacity-0 shadow transition-opacity hover:bg-blue-600 group-hover:opacity-100"
                              >
                                <IconPencil className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Print Info */}
              <Card className="bg-fill-secondary print:hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon icon={IconPrinter} size="md" className="mt-0.5 text-text-muted" />
                    <div>
                      <Typography variant="labelMd">Horizontal Location Labels (4&quot; x 2&quot;)</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        Select bays to print individual location labels for each level. Labels are printed in horizontal format with QR codes.
                      </Typography>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="print:hidden">
              <CardContent className="p-6 text-center">
                <Icon icon={IconLayoutGrid} size="xl" colorRole="muted" className="mx-auto mb-4" />
                <Typography variant="headingSm" className="mb-2">
                  No Bays Found
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
        ) : activeTab === 'totem' ? (
          /* Bay Totems (4x6) */
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
        ) : null}
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
