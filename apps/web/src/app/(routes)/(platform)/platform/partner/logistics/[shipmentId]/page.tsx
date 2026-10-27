'use client';

import {
  IconAlertCircle,
  IconArrowLeft,
  IconFileText,
  IconPackage,
  IconRefresh,
  IconTimeline,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import PartnerDocumentUpload from '@/app/_logistics/components/PartnerDocumentUpload';
import ShipmentStatusBadge from '@/app/_logistics/components/ShipmentStatusBadge';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import displayWineName from '@/app/_wms/utils/displayWineName';
import useTRPC from '@/lib/trpc/browser';

type TabType = 'overview' | 'items' | 'documents' | 'timeline';

/**
 * Partner shipment detail page
 */
const PartnerShipmentDetailPage = () => {
  const params = useParams();
  const shipmentId = params.shipmentId as string;
  const api = useTRPC();

  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const { data: shipment, isLoading, isError, isFetching, refetch } = useQuery({
    ...api.logistics.partner.getOne.queryOptions({ id: shipmentId }),
  });

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8" aria-busy="true">
        <div className="h-12 w-64 max-w-full animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-9 w-full animate-pulse rounded-lg bg-surface-muted" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border-muted bg-surface-primary px-4 py-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
            <IconAlertCircle size={22} />
          </div>
          <Typography variant="bodySm" className="font-medium">
            This shipment could not be loaded
          </Typography>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <IconRefresh size={14} />
            {isFetching ? 'Loading…' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Typography variant="headingSm">Shipment not found</Typography>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: typeof IconPackage }[] = [
    { id: 'overview', label: 'Overview', icon: IconFileText },
    { id: 'items', label: `Wines (${shipment.items?.length ?? 0})`, icon: IconPackage },
    { id: 'documents', label: `Documents (${shipment.documents?.length ?? 0})`, icon: IconFileText },
    { id: 'timeline', label: 'Timeline', icon: IconTimeline },
  ];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Link href="/platform/partner/logistics" aria-label="Back to shipments">
            <Button variant="ghost" size="sm">
              <Icon icon={IconArrowLeft} size="sm" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Typography variant="headingLg">{shipment.shipmentNumber}</Typography>
              <ShipmentStatusBadge status={shipment.status} />
            </div>
            <Typography variant="bodySm" colorRole="muted" className="truncate">
              {shipment.originCity ?? shipment.originCountry ?? '—'} →{' '}
              {shipment.destinationCity ?? shipment.destinationWarehouse ?? '—'}
            </Typography>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border-muted overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-text-primary text-text-primary'
                  : 'border-transparent text-text-muted hover:border-border-muted hover:text-text-primary'
              }`}
            >
              <Icon icon={tab.icon} size="sm" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Shipment details
                </Typography>
                <dl className="space-y-3">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Type</dt>
                    <dd className="capitalize">{shipment.type.replace('_', '-')}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Transport</dt>
                    <dd className="uppercase">{shipment.transportMode.replace('_', ' ')}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Carrier</dt>
                    <dd>{shipment.carrierName ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Container #</dt>
                    <dd className="font-mono">{shipment.containerNumber ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">BOL #</dt>
                    <dd className="font-mono">{shipment.blNumber ?? '—'}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Timeline
                </Typography>
                <dl className="space-y-3">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">ETD</dt>
                    <dd>{formatDate(shipment.etd)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">ATD</dt>
                    <dd>{formatDate(shipment.atd)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">ETA</dt>
                    <dd className="font-semibold text-text-primary">{formatDate(shipment.eta)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">ATA</dt>
                    <dd>{formatDate(shipment.ata)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Delivered</dt>
                    <dd>{formatDate(shipment.deliveredAt)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Cargo summary
                </Typography>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Total cases
                    </Typography>
                    <Typography variant="headingMd">{shipment.totalCases ?? 0}</Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Total bottles
                    </Typography>
                    <Typography variant="headingMd">{shipment.totalBottles ?? 0}</Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Weight (kg)
                    </Typography>
                    <Typography variant="headingMd">
                      {shipment.totalWeightKg?.toFixed(1) ?? '—'}
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>

            {shipment.partnerNotes && (
              <Card className="md:col-span-2">
                <CardContent className="p-6">
                  <Typography variant="headingSm" className="mb-2">
                    Notes
                  </Typography>
                  <Typography variant="bodyMd" colorRole="muted">
                    {shipment.partnerNotes}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'items' && (
          <Card>
            <CardContent className="p-6">
              <Typography variant="headingSm" className="mb-4">
                Wines
              </Typography>
              {!shipment.items?.length ? (
                <Typography variant="bodyMd" colorRole="muted" className="text-center py-8">
                  No wines in this shipment
                </Typography>
              ) : (
                <>
                <div className="divide-y divide-border-muted md:hidden">
                  {shipment.items.map((item) => (
                    <div key={item.id} className="py-3">
                      <Typography variant="bodySm" className="font-medium">
                        {displayWineName(item.productName ?? '', { keepVintage: true })}
                      </Typography>
                      {(item.producer ?? item.vintage) && (
                        <Typography variant="bodyXs" colorRole="muted">
                          {[item.producer, item.vintage].filter(Boolean).join(' · ')}
                        </Typography>
                      )}
                      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                        {item.cases} cases · {item.totalBottles ?? '—'} bottles
                        {item.grossWeightKg != null ? ` · ${item.grossWeightKg.toFixed(1)} kg` : ''}
                      </Typography>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-muted text-left text-xs uppercase text-text-muted">
                        <th className="pb-3 pr-4">Wine</th>
                        <th className="pb-3 pr-4 text-right">Cases</th>
                        <th className="pb-3 pr-4 text-right">Bottles</th>
                        <th className="pb-3 pr-4 text-right">Weight (kg)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-muted">
                      {shipment.items.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-surface-secondary/50">
                          <td className="py-3 pr-4">
                            <Typography variant="bodySm" className="font-medium">
                              {displayWineName(item.productName ?? '', { keepVintage: true })}
                            </Typography>
                            {item.producer && (
                              <Typography variant="bodyXs" colorRole="muted">
                                {item.producer}
                              </Typography>
                            )}
                            {item.vintage && (
                              <Typography variant="bodyXs" colorRole="muted">
                                {item.vintage}
                              </Typography>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right">{item.cases}</td>
                          <td className="py-3 pr-4 text-right">{item.totalBottles ?? '—'}</td>
                          <td className="py-3 pr-4 text-right">
                            {item.grossWeightKg?.toFixed(1) ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'documents' && (
          <Card>
            <CardContent className="p-6">
              <Typography variant="headingSm" className="mb-4">
                Documents
              </Typography>
              <PartnerDocumentUpload
                shipmentId={shipmentId}
                documents={shipment.documents ?? []}
                onUploadComplete={() => void refetch()}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'timeline' && (
          <Card>
            <CardContent className="p-6">
              <Typography variant="headingSm" className="mb-4">
                Activity timeline
              </Typography>
              {!shipment.activityLogs?.length ? (
                <Typography variant="bodyMd" colorRole="muted" className="text-center py-8">
                  No activity recorded yet
                </Typography>
              ) : (
                <div className="space-y-4">
                  {shipment.activityLogs.map((log, index) => (
                    <div key={log.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-text-primary" />
                        {index < shipment.activityLogs!.length - 1 && (
                          <div className="h-full w-px bg-border-muted" />
                        )}
                      </div>
                      <div className="pb-4">
                        <Typography variant="bodySm" className="font-medium capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </Typography>
                        {log.notes && (
                          <Typography variant="bodyXs" colorRole="muted">
                            {log.notes}
                          </Typography>
                        )}
                        <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </Typography>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PartnerShipmentDetailPage;
