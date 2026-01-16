'use client';

import {
  IconChevronRight,
  IconLoader2,
  IconPackage,
  IconPlane,
  IconShip,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

import ShipmentStatusBadge from '@/app/_logistics/components/ShipmentStatusBadge';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { logisticsTransportMode } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type TransportMode = (typeof logisticsTransportMode.enumValues)[number];

const transportIcons: Record<TransportMode, typeof IconShip> = {
  sea_fcl: IconShip,
  sea_lcl: IconShip,
  air: IconPlane,
  road: IconTruck,
};

/**
 * Partner logistics shipments list
 */
const PartnerLogisticsPage = () => {
  const api = useTRPC();

  const { data: shipments, isLoading } = useQuery({
    ...api.logistics.partner.getMany.queryOptions(),
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Icon icon={IconLoader2} className="animate-spin" size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Typography variant="headingLg">My Shipments</Typography>
          <Typography variant="bodyMd" colorRole="muted">
            Track your inbound and outbound shipments
          </Typography>
        </div>

        {/* Shipments List */}
        {!shipments?.length ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon icon={IconPackage} size="xl" className="mx-auto mb-4 text-text-muted" />
              <Typography variant="headingSm">No shipments yet</Typography>
              <Typography variant="bodyMd" colorRole="muted" className="mt-2">
                Your shipments will appear here once created
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {shipments.map((shipment) => {
              const TransportIcon = transportIcons[shipment.transportMode];
              return (
                <Link
                  key={shipment.id}
                  href={`/platform/partner/logistics/${shipment.id}`}
                  className="block"
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fill-brand/10">
                            <Icon icon={TransportIcon} size="md" className="text-text-brand" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Typography variant="bodySm" className="font-semibold">
                                {shipment.shipmentNumber}
                              </Typography>
                              <ShipmentStatusBadge status={shipment.status} />
                            </div>
                            <Typography variant="bodyXs" colorRole="muted">
                              {shipment.originCity ?? shipment.originCountry ?? 'Origin'} →{' '}
                              {shipment.destinationCity ?? shipment.destinationWarehouse ?? 'Destination'}
                            </Typography>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <Typography variant="bodyXs" colorRole="muted">
                              {shipment.items?.length ?? 0} items
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {shipment.totalCases ?? 0} cases
                            </Typography>
                          </div>
                          {shipment.eta && (
                            <div className="text-right">
                              <Typography variant="bodyXs" colorRole="muted">
                                ETA
                              </Typography>
                              <Typography variant="bodySm" className="font-medium">
                                {new Date(shipment.eta).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </Typography>
                            </div>
                          )}
                          <Icon icon={IconChevronRight} size="sm" className="text-text-muted" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Last updated */}
        {shipments?.length ? (
          <Typography variant="bodyXs" colorRole="muted" className="text-center">
            Last updated {formatDistanceToNow(new Date(), { addSuffix: true })}
          </Typography>
        ) : null}
      </div>
    </div>
  );
};

export default PartnerLogisticsPage;
