'use client';

import {
  IconAlertTriangle,
  IconAnchor,
  IconArrowRight,
  IconBox,
  IconChartBar,
  IconChevronRight,
  IconCloudDownload,
  IconCurrencyDollar,
  IconFileInvoice,
  IconFileText,
  IconLoader2,
  IconPackageImport,
  IconPlane,
  IconPlus,
  IconRefresh,
  IconShip,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';

import ShipmentStatusBadge from '@/app/_logistics/components/ShipmentStatusBadge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { logisticsTransportMode } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type TransportMode = (typeof logisticsTransportMode.enumValues)[number];

const transportModeIcons: Record<TransportMode, typeof IconShip> = {
  sea_fcl: IconShip,
  sea_lcl: IconAnchor,
  air: IconPlane,
  road: IconTruck,
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Logistics Dashboard - overview of shipments, compliance, costs, and quotes
 */
const LogisticsDashboardPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    ...api.logistics.admin.getDashboardMetrics.queryOptions(),
  });

  const { mutate: syncHillebrand, isPending: isSyncing } = useMutation({
    ...api.logistics.admin.syncHillebrand.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Synced ${result.created} new, ${result.updated} updated shipments`);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getDashboardMetrics']] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync with Hillebrand');
    },
  });

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  const metrics = data;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Typography variant="headingLg" className="mb-2">
              Logistics Dashboard
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Overview of shipments, documents, and costs
            </Typography>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/admin/logistics/tools/pdf-extract">
                <ButtonContent iconLeft={IconFileText}>PDF Tool</ButtonContent>
              </Link>
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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Icon icon={IconShip} size="md" className="text-blue-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Active Shipments
                  </Typography>
                  <Typography variant="headingMd" className="text-blue-600">
                    {metrics?.shipments.active ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Icon icon={IconPlane} size="md" className="text-purple-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    In Transit
                  </Typography>
                  <Typography variant="headingMd" className="text-purple-600">
                    {metrics?.shipments.inTransit ?? 0}
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
                    {metrics?.shipments.customsClearance ?? 0}
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
                    {metrics?.shipments.atWarehouse ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Section - Documents, Costs, Quotes */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Document Compliance */}
          <Card>
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Icon icon={IconFileText} size="sm" colorRole="muted" />
                  Document Compliance
                </CardTitle>
                <Link
                  href="/platform/admin/logistics/reports"
                  className="text-sm text-text-brand hover:underline"
                >
                  View Details
                </Link>
              </div>
            </div>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Typography variant="bodySm" colorRole="muted">
                    Compliance Rate
                  </Typography>
                  <Typography
                    variant="headingSm"
                    className={
                      (metrics?.documents.complianceRate ?? 100) >= 90
                        ? 'text-green-600'
                        : (metrics?.documents.complianceRate ?? 100) >= 70
                          ? 'text-orange-600'
                          : 'text-red-600'
                    }
                  >
                    {metrics?.documents.complianceRate ?? 100}%
                  </Typography>
                </div>
                <div className="h-2 rounded-full bg-surface-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (metrics?.documents.complianceRate ?? 100) >= 90
                        ? 'bg-green-500'
                        : (metrics?.documents.complianceRate ?? 100) >= 70
                          ? 'bg-orange-500'
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${metrics?.documents.complianceRate ?? 100}%` }}
                  />
                </div>
                <div className="flex gap-4 text-sm">
                  {(metrics?.documents.expiredCount ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-red-600">
                      <IconAlertTriangle className="h-4 w-4" />
                      <span>{metrics?.documents.expiredCount} expired</span>
                    </div>
                  )}
                  {(metrics?.documents.expiringCount ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-orange-600">
                      <IconAlertTriangle className="h-4 w-4" />
                      <span>{metrics?.documents.expiringCount} expiring</span>
                    </div>
                  )}
                  {(metrics?.documents.expiredCount ?? 0) === 0 &&
                    (metrics?.documents.expiringCount ?? 0) === 0 && (
                      <Typography variant="bodySm" colorRole="muted">
                        All documents up to date
                      </Typography>
                    )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Overview */}
          <Card>
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Icon icon={IconCurrencyDollar} size="sm" colorRole="muted" />
                  Costs (This Month)
                </CardTitle>
                <Link
                  href="/platform/admin/logistics/reports"
                  className="text-sm text-text-brand hover:underline"
                >
                  View Report
                </Link>
              </div>
            </div>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Typography variant="bodySm" colorRole="muted">
                    Freight Costs
                  </Typography>
                  <Typography variant="headingSm">
                    {formatCurrency(metrics?.costs.monthlyFreight ?? 0)}
                  </Typography>
                </div>
                <div className="flex items-center justify-between">
                  <Typography variant="bodySm" colorRole="muted">
                    Total Landed Cost
                  </Typography>
                  <Typography variant="headingSm" className="text-text-brand">
                    {formatCurrency(metrics?.costs.monthlyLanded ?? 0)}
                  </Typography>
                </div>
                <div className="h-px bg-border-primary" />
                <Typography variant="bodyXs" colorRole="muted">
                  {metrics?.shipments.recentActivityCount ?? 0} shipments in last 30 days
                </Typography>
              </div>
            </CardContent>
          </Card>

          {/* Quotes Summary */}
          <Card>
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Icon icon={IconFileInvoice} size="sm" colorRole="muted" />
                  Freight Quotes
                </CardTitle>
                <Link
                  href="/platform/admin/logistics/quotes"
                  className="text-sm text-text-brand hover:underline"
                >
                  View All
                </Link>
              </div>
            </div>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Typography variant="bodySm" colorRole="muted">
                    Pending Review
                  </Typography>
                  <Typography variant="headingSm" className="text-orange-600">
                    {metrics?.quotes.pendingCount ?? 0}
                  </Typography>
                </div>
                {(metrics?.quotes.expiringCount ?? 0) > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-orange-50 p-2 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                    <IconAlertTriangle className="h-4 w-4" />
                    <Typography variant="bodySm">
                      {metrics?.quotes.expiringCount} quotes expiring soon
                    </Typography>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/platform/admin/logistics/quotes/new">
                    <ButtonContent iconLeft={IconPlus}>New Quote</ButtonContent>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Shipments */}
        <Card>
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle>Recent Shipments</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/platform/admin/logistics/shipments">
                  <ButtonContent iconRight={IconArrowRight}>View All</ButtonContent>
                </Link>
              </Button>
            </div>
          </div>
          <CardContent className="p-0">
            {!metrics?.recentShipments || metrics.recentShipments.length === 0 ? (
              <div className="p-8 text-center">
                <Icon icon={IconShip} size="xl" className="mx-auto mb-4 text-text-muted" />
                <Typography variant="bodySm" colorRole="muted">
                  No shipments yet
                </Typography>
              </div>
            ) : (
              <div className="divide-y divide-border-primary">
                {metrics.recentShipments.map((shipment) => {
                  const ModeIcon = transportModeIcons[shipment.transportMode] ?? IconShip;

                  return (
                    <Link
                      key={shipment.id}
                      href={`/platform/admin/logistics/shipments/${shipment.id}`}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-surface-secondary transition-colors"
                    >
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
                          </div>
                          <Typography variant="headingSm" className="truncate">
                            {shipment.originCity ?? shipment.originCountry ?? 'Origin'} →{' '}
                            {shipment.destinationCity ?? shipment.destinationWarehouse ?? 'Destination'}
                          </Typography>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm text-text-muted">
                        <div className="hidden sm:block text-right">
                          <Typography variant="bodyXs" colorRole="muted">
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
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/platform/admin/logistics/shipments">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconShip} size="md" className="text-text-muted" />
                <div>
                  <Typography variant="headingSm">All Shipments</Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    View and manage shipments
                  </Typography>
                </div>
                <IconChevronRight className="ml-auto h-5 w-5 text-text-muted" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/logistics/quotes">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconFileInvoice} size="md" className="text-text-muted" />
                <div>
                  <Typography variant="headingSm">Freight Quotes</Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Compare forwarder quotes
                  </Typography>
                </div>
                <IconChevronRight className="ml-auto h-5 w-5 text-text-muted" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/logistics/reports">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconChartBar} size="md" className="text-text-muted" />
                <div>
                  <Typography variant="headingSm">Reports</Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Compliance and cost reports
                  </Typography>
                </div>
                <IconChevronRight className="ml-auto h-5 w-5 text-text-muted" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/logistics/tools/pdf-extract">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconFileText} size="md" className="text-text-muted" />
                <div>
                  <Typography variant="headingSm">PDF Extractor</Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    AI document extraction
                  </Typography>
                </div>
                <IconChevronRight className="ml-auto h-5 w-5 text-text-muted" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LogisticsDashboardPage;
