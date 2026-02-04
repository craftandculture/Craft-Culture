'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconBox,
  IconChevronRight,
  IconLoader2,
  IconPackage,
  IconShip,
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
 * WMS Receiving - list shipments ready to receive
 */
const WMSReceivePage = () => {
  const api = useTRPC();

  const { data: shipments, isLoading } = useQuery({
    ...api.wms.admin.receiving.getPendingShipments.queryOptions(),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-6">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-6">
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
          <div className="space-y-3">
            {shipments.map((shipment) => (
              <Link key={shipment.id} href={`/platform/admin/wms/receive/${shipment.id}`}>
                <Card className="cursor-pointer transition-colors hover:border-border-brand">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <Icon icon={IconShip} size="lg" className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Typography variant="headingSm">{shipment.shipmentNumber}</Typography>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            {shipment.status.replace('_', ' ')}
                          </span>
                        </div>
                        <Typography variant="bodySm" colorRole="muted">
                          {shipment.partnerName ?? 'Unknown Partner'} • {shipment.originCountry ?? 'Unknown'}
                        </Typography>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-text-muted">
                          <Icon icon={IconBox} size="sm" />
                          <Typography variant="bodySm">{shipment.totalCases ?? 0} cases</Typography>
                        </div>
                        <Typography variant="bodyXs" colorRole="muted">
                          {shipment.itemCount} products
                        </Typography>
                      </div>
                      <IconChevronRight className="h-5 w-5 text-text-muted" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
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
