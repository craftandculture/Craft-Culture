'use client';

import {
  IconAnchor,
  IconBox,
  IconChevronRight,
  IconCloudDownload,
  IconLoader2,
  IconPackageExport,
  IconPackageImport,
  IconPlane,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShip,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import ShipmentStatusBadge from '@/app/_logistics/components/ShipmentStatusBadge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { logisticsShipmentStatus, logisticsShipmentType, logisticsTransportMode } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type ShipmentStatus = (typeof logisticsShipmentStatus.enumValues)[number];
type ShipmentType = (typeof logisticsShipmentType.enumValues)[number];
type TransportMode = (typeof logisticsTransportMode.enumValues)[number];

const statusOptions: { value: ShipmentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'booked', label: 'Booked' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'arrived_port', label: 'Arrived Port' },
  { value: 'customs_clearance', label: 'Customs' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'at_warehouse', label: 'At Warehouse' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const typeOptions: { value: ShipmentType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 're_export', label: 'Re-Export' },
];

const transportModeIcons: Record<TransportMode, typeof IconShip> = {
  sea_fcl: IconShip,
  sea_lcl: IconAnchor,
  air: IconPlane,
  road: IconTruck,
};

const transportModeLabels: Record<TransportMode, string> = {
  sea_fcl: 'Sea (FCL)',
  sea_lcl: 'Sea (LCL)',
  air: 'Air',
  road: 'Road',
};

/**
 * Shipments list page with search and filters
 */
const ShipmentsListPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ShipmentType | 'all'>('all');

  const { data, isLoading, refetch, isFetching } = useQuery({
    ...api.logistics.admin.getMany.queryOptions({
      limit: 50,
      search: searchQuery || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
    }),
  });

  const { mutate: syncHillebrand, isPending: isSyncing } = useMutation({
    ...api.logistics.admin.syncHillebrand.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Synced ${result.created} new, ${result.updated} updated shipments`);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getMany']] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync with Hillebrand');
    },
  });

  const shipments = data?.data ?? [];
  const totalCount = data?.meta.totalCount ?? 0;

  const statusCounts = shipments.reduce(
    (acc, s) => {
      if (s.status === 'in_transit') acc.inTransit++;
      else if (s.status === 'customs_clearance') acc.customs++;
      else if (s.status === 'at_warehouse') acc.warehouse++;
      else if (s.status === 'delivered') acc.delivered++;
      return acc;
    },
    { inTransit: 0, customs: 0, warehouse: 0, delivered: 0 },
  );

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
              <Link href="/platform/admin/logistics" className="hover:text-text-primary">
                Logistics
              </Link>
              <span>/</span>
              <span>Shipments</span>
            </div>
            <Typography variant="headingLg" className="mb-2">
              All Shipments
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Track and manage all logistics shipments
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncHillebrand()}
              disabled={isSyncing}
              title="Sync shipments from Hillebrand"
            >
              <Icon
                icon={IconCloudDownload}
                size="sm"
                className={isSyncing ? 'animate-pulse' : ''}
              />
              <span className="hidden sm:inline ml-1">Hillebrand</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <Icon
                icon={IconRefresh}
                size="sm"
                className={isFetching ? 'animate-spin' : ''}
              />
            </Button>
            <Button asChild>
              <Link href="/platform/admin/logistics/shipments/new">
                <ButtonContent iconLeft={IconPlus}>New Shipment</ButtonContent>
              </Link>
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Icon icon={IconShip} size="md" className="text-purple-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    In Transit
                  </Typography>
                  <Typography variant="headingMd" className="text-purple-600">
                    {statusCounts.inTransit}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Icon icon={IconBox} size="md" className="text-orange-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Customs
                  </Typography>
                  <Typography variant="headingMd" className="text-orange-600">
                    {statusCounts.customs}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <Icon icon={IconPackageImport} size="md" className="text-emerald-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    At Warehouse
                  </Typography>
                  <Typography variant="headingMd" className="text-emerald-600">
                    {statusCounts.warehouse}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Icon icon={IconPackageExport} size="md" className="text-green-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Delivered
                  </Typography>
                  <Typography variant="headingMd" className="text-green-600">
                    {statusCounts.delivered}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Icon
                  icon={IconSearch}
                  size="sm"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <Input
                  placeholder="Search by shipment number, carrier, or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as ShipmentStatus | 'all')}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={typeFilter}
                  onValueChange={(v) => setTypeFilter(v as ShipmentType | 'all')}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Typography variant="bodySm" className="mt-3 text-text-muted">
              {isLoading ? 'Loading...' : `${totalCount} shipments found`}
            </Typography>
          </CardContent>
        </Card>

        {/* Shipments List */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
            </CardContent>
          </Card>
        ) : shipments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon icon={IconShip} size="xl" className="mx-auto mb-4 text-text-muted" />
              <Typography variant="headingSm" className="mb-2">
                No Shipments Found
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'No shipments match your filters. Try adjusting your search.'
                  : 'No shipments have been created yet.'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {shipments.map((shipment) => {
              const ModeIcon = transportModeIcons[shipment.transportMode] ?? IconShip;

              return (
                <Link
                  key={shipment.id}
                  href={`/platform/admin/logistics/shipments/${shipment.id}`}
                  className="block"
                >
                  <Card className="cursor-pointer transition-colors hover:border-border-brand">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-secondary">
                            <Icon icon={ModeIcon} size="md" className="text-text-muted" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <Typography variant="bodySm" className="font-mono text-text-muted">
                                {shipment.shipmentNumber}
                              </Typography>
                              <ShipmentStatusBadge status={shipment.status} />
                              <span className="text-xs text-text-muted capitalize">
                                {shipment.type.replace('_', '-')}
                              </span>
                            </div>
                            <Typography variant="headingSm" className="truncate">
                              {shipment.originCity ?? shipment.originCountry ?? 'Origin'} →{' '}
                              {shipment.destinationCity ?? shipment.destinationWarehouse ?? 'Destination'}
                            </Typography>
                            {shipment.carrierName && (
                              <Typography variant="bodySm" colorRole="muted">
                                {shipment.carrierName}
                                {shipment.containerNumber && ` · ${shipment.containerNumber}`}
                              </Typography>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-text-muted">
                          <div className="hidden sm:block text-right">
                            <Typography variant="bodyXs" colorRole="muted">
                              {transportModeLabels[shipment.transportMode]}
                            </Typography>
                            <Typography variant="bodySm">
                              {shipment.totalCases ?? 0} cases
                            </Typography>
                          </div>
                          {shipment.eta && (
                            <div className="hidden md:block text-right">
                              <Typography variant="bodyXs" colorRole="muted">
                                ETA
                              </Typography>
                              <Typography variant="bodySm">
                                {formatDate(shipment.eta)}
                              </Typography>
                            </div>
                          )}
                          <div className="hidden lg:block text-right text-xs">
                            {formatDistanceToNow(new Date(shipment.createdAt), { addSuffix: true })}
                          </div>
                          <IconChevronRight className="h-5 w-5 shrink-0" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipmentsListPage;
