'use client';

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconChartBar,
  IconCheck,
  IconClock,
  IconCurrencyDollar,
  IconFileCheck,
  IconFileX,
  IconLoader2,
  IconPackage,
  IconPlane,
  IconReceipt,
  IconShip,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const transportModeLabels: Record<string, string> = {
  sea_fcl: 'Sea (FCL)',
  sea_lcl: 'Sea (LCL)',
  air: 'Air',
  road: 'Road',
};

const transportModeIcons: Record<string, typeof IconShip> = {
  sea_fcl: IconShip,
  sea_lcl: IconShip,
  air: IconPlane,
  road: IconTruck,
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  booked: 'Booked',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  arrived_port: 'Arrived Port',
  customs_clearance: 'Customs',
  cleared: 'Cleared',
  at_warehouse: 'At Warehouse',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Logistics Reports Dashboard
 *
 * Comprehensive reporting for shipments, costs, and compliance
 */
const LogisticsReportsPage = () => {
  const api = useTRPC();

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    ...api.logistics.admin.getReportMetrics.queryOptions(),
  });

  const { data: compliance, isLoading: complianceLoading } = useQuery({
    ...api.logistics.admin.getDocumentCompliance.queryOptions({ filter: 'all' }),
  });

  const isLoading = metricsLoading || complianceLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/platform/admin/logistics">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <div>
              <Typography variant="headingLg" className="mb-2">
                Logistics Reports
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                Analytics and insights for your logistics operations
              </Typography>
            </div>
          </div>
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Icon icon={IconPackage} size="md" className="text-blue-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Total Shipments
                  </Typography>
                  <Typography variant="headingMd" className="text-blue-600">
                    {metrics?.shipments.total ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Icon icon={IconFileCheck} size="md" className="text-green-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Doc Compliance
                  </Typography>
                  <Typography variant="headingMd" className="text-green-600">
                    {metrics?.documents.complianceRate ?? 100}%
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Icon icon={IconReceipt} size="md" className="text-purple-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Open Invoices
                  </Typography>
                  <Typography variant="headingMd" className="text-purple-600">
                    {metrics?.invoices.totalCount ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Icon icon={IconCurrencyDollar} size="md" className="text-orange-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Total Costs
                  </Typography>
                  <Typography variant="headingMd" className="text-orange-600">
                    {formatCurrency(metrics?.costs.total ?? 0)}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Shipments by Status */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Icon icon={IconChartBar} size="sm" colorRole="muted" />
                <Typography variant="headingSm">Shipments by Status</Typography>
              </div>
              <div className="space-y-3">
                {Object.entries(metrics?.shipments.byStatus ?? {}).map(([status, count]) => {
                  const total = metrics?.shipments.total ?? 1;
                  const percentage = Math.round((count / total) * 100);
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <Typography variant="bodySm">{statusLabels[status] ?? status}</Typography>
                        <Typography variant="bodySm" className="font-medium">
                          {count}
                        </Typography>
                      </div>
                      <div className="h-2 w-full rounded-full bg-surface-secondary">
                        <div
                          className="h-2 rounded-full bg-brand-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(metrics?.shipments.byStatus ?? {}).length === 0 && (
                  <Typography variant="bodySm" colorRole="muted">
                    No shipment data available
                  </Typography>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipments by Transport Mode */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Icon icon={IconShip} size="sm" colorRole="muted" />
                <Typography variant="headingSm">By Transport Mode</Typography>
              </div>
              <div className="space-y-4">
                {Object.entries(metrics?.shipments.byTransportMode ?? {}).map(([mode, count]) => {
                  const ModeIcon = transportModeIcons[mode] ?? IconShip;
                  return (
                    <div key={mode} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-secondary">
                          <Icon icon={ModeIcon} size="sm" colorRole="muted" />
                        </div>
                        <Typography variant="bodySm">
                          {transportModeLabels[mode] ?? mode}
                        </Typography>
                      </div>
                      <Typography variant="headingSm">{count}</Typography>
                    </div>
                  );
                })}
                {Object.keys(metrics?.shipments.byTransportMode ?? {}).length === 0 && (
                  <Typography variant="bodySm" colorRole="muted">
                    No transport data available
                  </Typography>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost Breakdown */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon icon={IconCurrencyDollar} size="sm" colorRole="muted" />
              <Typography variant="headingSm">Cost Breakdown</Typography>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 rounded-lg bg-surface-secondary">
                <Typography variant="bodyXs" colorRole="muted">
                  Freight
                </Typography>
                <Typography variant="headingMd">
                  {formatCurrency(metrics?.costs.freight ?? 0)}
                </Typography>
              </div>
              <div className="p-4 rounded-lg bg-surface-secondary">
                <Typography variant="bodyXs" colorRole="muted">
                  Insurance
                </Typography>
                <Typography variant="headingMd">
                  {formatCurrency(metrics?.costs.insurance ?? 0)}
                </Typography>
              </div>
              <div className="p-4 rounded-lg bg-surface-secondary">
                <Typography variant="bodyXs" colorRole="muted">
                  Handling
                </Typography>
                <Typography variant="headingMd">
                  {formatCurrency(metrics?.costs.handling ?? 0)}
                </Typography>
              </div>
              <div className="p-4 rounded-lg bg-surface-secondary">
                <Typography variant="bodyXs" colorRole="muted">
                  Customs
                </Typography>
                <Typography variant="headingMd">
                  {formatCurrency(metrics?.costs.customs ?? 0)}
                </Typography>
              </div>
              <div className="p-4 rounded-lg bg-surface-secondary">
                <Typography variant="bodyXs" colorRole="muted">
                  Government Fees
                </Typography>
                <Typography variant="headingMd">
                  {formatCurrency(metrics?.costs.governmentFees ?? 0)}
                </Typography>
              </div>
              <div className="p-4 rounded-lg bg-surface-secondary">
                <Typography variant="bodyXs" colorRole="muted">
                  Delivery
                </Typography>
                <Typography variant="headingMd">
                  {formatCurrency(metrics?.costs.delivery ?? 0)}
                </Typography>
              </div>
              <div className="p-4 rounded-lg bg-surface-secondary">
                <Typography variant="bodyXs" colorRole="muted">
                  Other
                </Typography>
                <Typography variant="headingMd">
                  {formatCurrency(metrics?.costs.other ?? 0)}
                </Typography>
              </div>
              <div className="p-4 rounded-lg bg-brand-primary/10">
                <Typography variant="bodyXs" colorRole="muted">
                  Total
                </Typography>
                <Typography variant="headingMd" className="text-brand-primary">
                  {formatCurrency(metrics?.costs.total ?? 0)}
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Compliance Summary */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon icon={IconFileCheck} size="sm" colorRole="muted" />
                <Typography variant="headingSm">Document Compliance</Typography>
              </div>
              <Link
                href="/platform/admin/logistics/reports/compliance"
                className="text-sm text-brand-primary hover:underline"
              >
                View Details →
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                  <Icon icon={IconCheck} size="sm" className="text-green-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Compliant
                  </Typography>
                  <Typography variant="headingMd" className="text-green-600">
                    {compliance?.summary.compliantCount ?? 0}
                  </Typography>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/40">
                  <Icon icon={IconAlertTriangle} size="sm" className="text-yellow-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Warning
                  </Typography>
                  <Typography variant="headingMd" className="text-yellow-600">
                    {compliance?.summary.warningCount ?? 0}
                  </Typography>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                  <Icon icon={IconFileX} size="sm" className="text-red-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Critical
                  </Typography>
                  <Typography variant="headingMd" className="text-red-600">
                    {compliance?.summary.criticalCount ?? 0}
                  </Typography>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40">
                  <Icon icon={IconClock} size="sm" className="text-orange-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Expiring Soon
                  </Typography>
                  <Typography variant="headingMd" className="text-orange-600">
                    {compliance?.summary.totalExpiringDocs ?? 0}
                  </Typography>
                </div>
              </div>
            </div>

            {/* Critical Shipments List */}
            {(compliance?.shipments.filter((s) => s.complianceStatus === 'critical').length ?? 0) >
              0 && (
              <div>
                <Typography variant="bodySm" className="font-medium mb-3">
                  Shipments Requiring Attention
                </Typography>
                <div className="space-y-2">
                  {compliance?.shipments
                    .filter((s) => s.complianceStatus === 'critical')
                    .slice(0, 5)
                    .map((shipment) => (
                      <Link
                        key={shipment.shipmentId}
                        href={`/platform/admin/logistics/shipments/${shipment.shipmentId}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                      >
                        <div>
                          <Typography variant="bodySm" className="font-medium">
                            {shipment.shipmentNumber}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            {shipment.route}
                          </Typography>
                        </div>
                        <div className="text-right">
                          <Typography variant="bodyXs" className="text-red-600">
                            {shipment.missingDocuments.length} missing
                          </Typography>
                          {shipment.expiredDocuments.length > 0 && (
                            <Typography variant="bodyXs" className="text-red-600">
                              {shipment.expiredDocuments.length} expired
                            </Typography>
                          )}
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Summary */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon icon={IconReceipt} size="sm" colorRole="muted" />
              <Typography variant="headingSm">Invoice Summary</Typography>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(metrics?.invoices.byStatus ?? {}).map(([status, data]) => (
                <div key={status} className="p-4 rounded-lg bg-surface-secondary">
                  <Typography variant="bodyXs" colorRole="muted" className="capitalize">
                    {status}
                  </Typography>
                  <Typography variant="headingMd">{data.count}</Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {formatCurrency(data.openAmount)} open
                  </Typography>
                </div>
              ))}
              {Object.keys(metrics?.invoices.byStatus ?? {}).length === 0 && (
                <Typography variant="bodySm" colorRole="muted">
                  No invoice data available
                </Typography>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/platform/admin/logistics/reports/landed-cost">
            <Card className="cursor-pointer transition-colors hover:border-brand-primary">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                    <Icon icon={IconCurrencyDollar} size="lg" className="text-purple-600" />
                  </div>
                  <div>
                    <Typography variant="headingSm">Landed Cost Report</Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      Detailed cost analysis by shipment
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/logistics/reports/compliance">
            <Card className="cursor-pointer transition-colors hover:border-brand-primary">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                    <Icon icon={IconFileCheck} size="lg" className="text-green-600" />
                  </div>
                  <div>
                    <Typography variant="headingSm">Compliance Report</Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      Document status by shipment
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/logistics">
            <Card className="cursor-pointer transition-colors hover:border-brand-primary">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                    <Icon icon={IconPackage} size="lg" className="text-blue-600" />
                  </div>
                  <div>
                    <Typography variant="headingSm">All Shipments</Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      View and manage shipments
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LogisticsReportsPage;
