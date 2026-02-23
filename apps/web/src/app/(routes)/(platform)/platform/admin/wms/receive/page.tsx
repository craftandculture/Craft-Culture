'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconBox,
  IconChevronRight,
  IconLoader2,
  IconPackage,
  IconPlane,
  IconShip,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Get icon and colors based on transport mode
 */
const getTransportConfig = (mode: string) => {
  switch (mode) {
    case 'air':
      return {
        icon: IconPlane,
        bgClass: 'bg-sky-100 dark:bg-sky-900/30',
        iconClass: 'text-sky-600',
      };
    case 'road':
      return {
        icon: IconTruck,
        bgClass: 'bg-orange-100 dark:bg-orange-900/30',
        iconClass: 'text-orange-600',
      };
    case 'sea_fcl':
    case 'sea_lcl':
    default:
      return {
        icon: IconShip,
        bgClass: 'bg-blue-100 dark:bg-blue-900/30',
        iconClass: 'text-blue-600',
      };
  }
};

/**
 * Get status badge styling based on shipment status
 */
const getStatusConfig = (status: string) => {
  switch (status) {
    case 'at_warehouse':
      return {
        bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
        textClass: 'text-emerald-800 dark:text-emerald-300',
        label: 'At Warehouse',
      };
    case 'cleared':
      return {
        bgClass: 'bg-blue-100 dark:bg-blue-900/30',
        textClass: 'text-blue-800 dark:text-blue-300',
        label: 'Cleared',
      };
    case 'customs_clearance':
      return {
        bgClass: 'bg-amber-100 dark:bg-amber-900/30',
        textClass: 'text-amber-800 dark:text-amber-300',
        label: 'In Clearance',
      };
    case 'arrived_port':
      return {
        bgClass: 'bg-amber-100 dark:bg-amber-900/30',
        textClass: 'text-amber-800 dark:text-amber-300',
        label: 'Arrived Port',
      };
    default:
      return {
        bgClass: 'bg-gray-100 dark:bg-gray-900/30',
        textClass: 'text-gray-800 dark:text-gray-300',
        label: status.replace('_', ' '),
      };
  }
};

/**
 * WMS Receiving - list shipments ready to receive
 */
const WMSReceivePage = () => {
  const api = useTRPC();

  const { data: shipments, isLoading } = useQuery({
    ...api.wms.admin.receiving.getPendingShipments.queryOptions(),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl px-4 py-6">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl px-4 py-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link
            href="/platform/admin/wms"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary"
          >
            <IconArrowLeft className="h-6 w-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <Typography variant="headingLg" className="mb-1">
              Receive
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              Shipments ready to receive
            </Typography>
          </div>
        </div>

        {/* Pending Shipments */}
        {shipments && shipments.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {shipments.map((shipment) => {
              const transportConfig = getTransportConfig(shipment.transportMode);
              const statusConfig = getStatusConfig(shipment.status);
              const TransportIcon = transportConfig.icon;

              return (
                <Link key={shipment.id} href={`/platform/admin/wms/receive/${shipment.id}`}>
                  <Card className="cursor-pointer transition-colors hover:border-border-brand">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Transport Icon */}
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${transportConfig.bgClass}`}
                        >
                          <Icon icon={TransportIcon} size="lg" className={transportConfig.iconClass} />
                        </div>

                        {/* Shipment Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Typography variant="headingSm">{shipment.shipmentNumber}</Typography>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.bgClass} ${statusConfig.textClass}`}
                            >
                              {statusConfig.label}
                            </span>
                          </div>
                          <Typography variant="bodySm" colorRole="muted" className="truncate">
                            {shipment.partnerName ?? 'Unknown Partner'} • {shipment.originCountry ?? 'Unknown'}
                          </Typography>
                          {/* Destination info */}
                          {(shipment.destinationCountry || shipment.destinationCity) && (
                            <Typography variant="bodyXs" colorRole="muted" className="truncate">
                              → {shipment.destinationCity ?? ''}{' '}
                              {shipment.destinationCountry ?? ''}
                            </Typography>
                          )}
                        </div>

                        {/* Cases & Products */}
                        <div className="shrink-0 text-right">
                          <div className="flex items-center justify-end gap-1 text-text-muted">
                            <Icon icon={IconBox} size="sm" />
                            <Typography variant="bodySm">{shipment.totalCases ?? 0} cases</Typography>
                          </div>
                          <Typography variant="bodyXs" colorRole="muted">
                            {shipment.itemCount} products
                          </Typography>
                        </div>

                        <IconChevronRight className="h-5 w-5 shrink-0 text-text-muted" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <Icon icon={IconPackage} size="xl" colorRole="muted" className="mx-auto mb-4" />
              <Typography variant="headingSm" className="mb-2">
                No Shipments Ready
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-4">
                Shipments will appear here when they arrive at the warehouse
              </Typography>
              <Button variant="outline" asChild>
                <Link href="/platform/admin/logistics">
                  <ButtonContent iconLeft={IconArrowRight}>View Logistics</ButtonContent>
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WMSReceivePage;
