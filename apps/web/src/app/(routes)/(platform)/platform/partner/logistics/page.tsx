'use client';

import {
  IconAlertCircle,
  IconChevronRight,
  IconPackage,
  IconPlane,
  IconRefresh,
  IconShip,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

import ShipmentStatusBadge from '@/app/_logistics/components/ShipmentStatusBadge';
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

  const {
    data: shipments,
    isLoading,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    ...api.logistics.partner.getMany.queryOptions(),
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Typography variant="headingLg">Shipments</Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1">
            Inbound and outbound shipments carrying your wine
          </Typography>
        </div>

        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] w-full animate-pulse rounded-xl border border-border-muted bg-surface-muted"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border-muted bg-surface-primary px-4 py-12 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
              <IconAlertCircle size={22} />
            </div>
            <Typography variant="bodySm" className="font-medium">
              Shipments could not be loaded
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
        ) : !shipments?.length ? (
          <div className="flex flex-col items-center rounded-xl border border-border-muted bg-surface-primary px-4 py-12 text-center shadow-sm">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
              <Icon icon={IconPackage} size="md" className="text-text-muted" />
            </div>
            <Typography variant="headingSm">No shipments yet</Typography>
            <Typography variant="bodySm" colorRole="muted" className="mt-1">
              Shipments carrying your wine appear here.
            </Typography>
          </div>
        ) : (
          <div className="space-y-2.5">
            {shipments.map((shipment) => {
              const TransportIcon = transportIcons[shipment.transportMode];
              const wines = shipment.items?.length ?? 0;
              return (
                <Link
                  key={shipment.id}
                  href={`/platform/partner/logistics/${shipment.id}`}
                  className="block rounded-xl border border-border-muted bg-surface-primary p-4 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                        <Icon icon={TransportIcon} size="md" className="text-text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Typography variant="bodySm" className="font-semibold">
                            {shipment.shipmentNumber}
                          </Typography>
                          <ShipmentStatusBadge status={shipment.status} />
                        </div>
                        <Typography variant="bodyXs" colorRole="muted" className="truncate">
                          {shipment.originCity ?? shipment.originCountry ?? '—'} →{' '}
                          {shipment.destinationCity ?? shipment.destinationWarehouse ?? '—'}
                        </Typography>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 pl-[52px] sm:justify-end sm:pl-0">
                      <div className="sm:text-right">
                        <Typography variant="bodyXs" colorRole="muted">
                          {wines} {wines === 1 ? 'wine' : 'wines'}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {shipment.totalCases ?? 0} cases
                        </Typography>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Typography variant="bodyXs" colorRole="muted">
                            ETA
                          </Typography>
                          <Typography variant="bodySm" className="font-medium">
                            {shipment.eta
                              ? new Date(shipment.eta).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                })
                              : '—'}
                          </Typography>
                        </div>
                        <Icon icon={IconChevronRight} size="sm" className="text-text-muted" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Last updated */}
        {shipments?.length && dataUpdatedAt ? (
          <Typography variant="bodyXs" colorRole="muted" className="text-center">
            Last updated {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}
          </Typography>
        ) : null}
      </div>
    </div>
  );
};

export default PartnerLogisticsPage;
