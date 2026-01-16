'use client';

import {
  IconArrowLeft,
  IconFileText,
  IconLoader2,
  IconPackage,
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

  const { data: shipment, isLoading, refetch } = useQuery({
    ...api.logistics.partner.getOne.queryOptions({ id: shipmentId }),
  });

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Icon icon={IconLoader2} className="animate-spin" size="lg" />
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
    { id: 'items', label: `Items (${shipment.items?.length ?? 0})`, icon: IconPackage },
    { id: 'documents', label: `Documents (${shipment.documents?.length ?? 0})`, icon: IconFileText },
    { id: 'timeline', label: 'Timeline', icon: IconTimeline },
  ];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/platform/partner/logistics">
            <Button variant="ghost" size="sm">
              <Icon icon={IconArrowLeft} size="sm" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <Typography variant="headingLg">{shipment.shipmentNumber}</Typography>
              <ShipmentStatusBadge status={shipment.status} />
            </div>
            <Typography variant="bodyMd" colorRole="muted">
              {shipment.originCity ?? shipment.originCountry ?? 'Origin'} →{' '}
              {shipment.destinationCity ?? shipment.destinationWarehouse ?? 'Destination'}
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
                  ? 'border-border-brand text-text-brand'
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
                  Shipment Details
                </Typography>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Type</dt>
                    <dd className="capitalize">{shipment.type.replace('_', '-')}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Transport</dt>
                    <dd className="uppercase">{shipment.transportMode.replace('_', ' ')}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Carrier</dt>
                    <dd>{shipment.carrierName ?? '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Container #</dt>
                    <dd className="font-mono">{shipment.containerNumber ?? '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">BOL #</dt>
                    <dd className="font-mono">{shipment.blNumber ?? '-'}</dd>
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
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ETD</dt>
                    <dd>{formatDate(shipment.etd)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ATD</dt>
                    <dd>{formatDate(shipment.atd)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ETA</dt>
                    <dd className="font-semibold text-text-brand">{formatDate(shipment.eta)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">ATA</dt>
                    <dd>{formatDate(shipment.ata)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Delivered</dt>
                    <dd>{formatDate(shipment.deliveredAt)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Cargo Summary
                </Typography>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Total Cases
                    </Typography>
                    <Typography variant="headingMd">{shipment.totalCases ?? 0}</Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Total Bottles
                    </Typography>
                    <Typography variant="headingMd">{shipment.totalBottles ?? 0}</Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Weight (kg)
                    </Typography>
                    <Typography variant="headingMd">
                      {shipment.totalWeightKg?.toFixed(1) ?? '-'}
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
                Items
              </Typography>
              {!shipment.items?.length ? (
                <Typography variant="bodyMd" colorRole="muted" className="text-center py-8">
                  No items in this shipment
                </Typography>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-muted text-left text-xs uppercase text-text-muted">
                        <th className="pb-3 pr-4">Product</th>
                        <th className="pb-3 pr-4 text-right">Cases</th>
                        <th className="pb-3 pr-4 text-right">Bottles</th>
                        <th className="pb-3 pr-4 text-right">Weight (kg)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-muted">
                      {shipment.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 pr-4">
                            <Typography variant="bodySm" className="font-medium">
                              {item.productName}
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
                          <td className="py-3 pr-4 text-right">{item.totalBottles ?? '-'}</td>
                          <td className="py-3 pr-4 text-right">
                            {item.grossWeightKg?.toFixed(1) ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                Activity Timeline
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
                        <div className="h-3 w-3 rounded-full bg-fill-brand" />
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
