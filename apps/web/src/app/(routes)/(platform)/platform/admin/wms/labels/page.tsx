'use client';

import {
  IconBarcode,
  IconCheck,
  IconChevronRight,
  IconLoader2,
  IconMapPin,
  IconPrinter,
  IconShip,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * WMS Labels Page - view and print case labels and location labels
 */
const WMSLabelsPage = () => {
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get('shipmentId');
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'case' | 'location'>(shipmentId ? 'case' : 'location');
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());

  // Get case labels for a shipment
  const { data: caseLabelsData, isLoading: caseLabelsLoading } = useQuery({
    ...api.wms.admin.labels.getCaseLabels.queryOptions({ shipmentId: shipmentId ?? '' }),
    enabled: !!shipmentId,
  });

  // Get location labels
  const { data: locationLabelsData, isLoading: locationLabelsLoading } = useQuery({
    ...api.wms.admin.labels.getLocationLabels.queryOptions({}),
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

  const handleMarkPrinted = () => {
    if (selectedLabels.size > 0) {
      markPrintedMutation.mutate({ labelIds: Array.from(selectedLabels) });
    }
  };

  const isLoading = activeTab === 'case' ? caseLabelsLoading : locationLabelsLoading;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6 print:space-y-0">
        {/* Header - Hidden when printing */}
        <div className="flex flex-col gap-4 print:hidden sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link href="/platform/admin/wms" className="text-text-muted hover:text-text-primary">
                <Typography variant="bodySm">WMS</Typography>
              </Link>
              <IconChevronRight className="h-4 w-4 text-text-muted" />
              <Typography variant="bodySm">Labels</Typography>
            </div>
            <Typography variant="headingLg" className="mb-2">
              Print Labels
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Generate and print case labels and location labels
            </Typography>
          </div>
          <div className="flex items-center gap-2">
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
            <Button variant="primary" onClick={handlePrint} disabled={selectedLabels.size === 0}>
              <ButtonContent iconLeft={IconPrinter}>Print ({selectedLabels.size})</ButtonContent>
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
        ) : (
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
