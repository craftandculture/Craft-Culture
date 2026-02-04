'use client';

import {
  IconAlertTriangle,
  IconArrowRight,
  IconBarcode,
  IconBox,
  IconBuildingWarehouse,
  IconMapPin,
  IconPackage,
  IconPackages,
  IconPlus,
  IconTransfer,
  IconTruck,
  IconUserDollar,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import MovementTypeBadge from '@/app/_wms/components/MovementTypeBadge';
import useTRPC from '@/lib/trpc/browser';

/**
 * WMS Dashboard content component - renders the dashboard UI
 * Data is prefetched on the server and hydrated here
 */
const WMSDashboardContent = () => {
  const api = useTRPC();

  // Fetch comprehensive overview (will use prefetched data)
  const { data: overview } = useQuery({
    ...api.wms.admin.stock.getOverview.queryOptions({}),
  });

  // Fetch recent movements (will use prefetched data)
  const { data: movements } = useQuery({
    ...api.wms.admin.stock.getMovements.queryOptions({ limit: 5 }),
  });

  // Fetch expiring stock alerts (will use prefetched data)
  const { data: expiringStock } = useQuery({
    ...api.wms.admin.stock.getExpiring.queryOptions({ daysThreshold: 90 }),
  });

  // Fetch pending partner requests (will use prefetched data)
  const { data: partnerRequests } = useQuery({
    ...api.wms.admin.ownership.getRequests.queryOptions({ status: 'pending', limit: 5, offset: 0 }),
  });

  // Fetch stock reconciliation status
  const { data: reconcileData } = useQuery({
    ...api.wms.admin.stock.reconcile.queryOptions(),
  });

  const hasExpiryAlerts =
    (expiringStock?.summary?.expiredCases ?? 0) > 0 ||
    (expiringStock?.summary?.criticalCases ?? 0) > 0;

  const pendingRequestCount = partnerRequests?.summary?.pendingCount ?? 0;
  const hasReconcileIssues = reconcileData?.summary && !reconcileData.summary.isReconciled;

  return (
    <div className="container mx-auto max-w-lg px-4 py-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Typography variant="headingLg">
            WMS
          </Typography>
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/admin/wms/scanner-test">
              <Icon icon={IconBarcode} size="sm" />
            </Link>
          </Button>
        </div>

        {/* KPI Summary - Compact */}
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-4 divide-x divide-border-primary text-center">
              <div className="px-2">
                <Typography variant="headingSm" className="text-purple-600">
                  {(overview?.summary?.totalCases ?? 0).toLocaleString()}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">cases</Typography>
              </div>
              <div className="px-2">
                <Typography variant="headingSm" className="text-emerald-600">
                  {overview?.summary?.uniqueProducts ?? 0}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">products</Typography>
              </div>
              <div className="px-2">
                <Typography variant="headingSm" className="text-blue-600">
                  {overview?.locations?.occupied ?? 0}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">locations</Typography>
              </div>
              <div className="px-2">
                <Typography variant="headingSm" className="text-cyan-600">
                  {overview?.movements?.last24Hours ?? 0}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">moves</Typography>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Critical Alert: Stock Reconciliation Issue */}
        {hasReconcileIssues && (
          <Card className="border-red-500 bg-red-50 dark:border-red-700 dark:bg-red-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon icon={IconAlertTriangle} size="lg" className="text-red-600" />
                  <div>
                    <Typography variant="headingSm" className="text-red-800 dark:text-red-300">
                      Stock Reconciliation Required
                    </Typography>
                    <Typography variant="bodySm" className="text-red-700 dark:text-red-400">
                      {Math.abs(reconcileData?.summary.discrepancy ?? 0)} case
                      {Math.abs(reconcileData?.summary.discrepancy ?? 0) !== 1 ? 's' : ''}{' '}
                      {(reconcileData?.summary.discrepancy ?? 0) > 0 ? 'over' : 'under'} —
                      movements show {reconcileData?.summary.expectedStock} cases but stock has{' '}
                      {reconcileData?.summary.actualStock}
                    </Typography>
                  </div>
                </div>
                <Button variant="destructive" size="sm" asChild>
                  <Link href="/platform/admin/wms/stock/reconcile">
                    <ButtonContent>Fix Now</ButtonContent>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerts Section */}
        {(hasExpiryAlerts || (overview?.pendingPutaway?.casesInReceiving ?? 0) > 0 || pendingRequestCount > 0) && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Expiry Alerts */}
            {hasExpiryAlerts && (
              <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon icon={IconAlertTriangle} size="md" className="text-orange-600" />
                    <Typography variant="headingSm" className="text-orange-800 dark:text-orange-300">
                      Expiry Alerts
                    </Typography>
                  </div>
                  <div className="space-y-2">
                    {(expiringStock?.summary?.expiredCases ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <Typography variant="bodySm" className="text-red-600">
                          Expired
                        </Typography>
                        <Typography variant="headingSm" className="text-red-600">
                          {expiringStock?.summary?.expiredCases} cases
                        </Typography>
                      </div>
                    )}
                    {(expiringStock?.summary?.criticalCases ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <Typography variant="bodySm" className="text-orange-600">
                          Expiring &lt;30 days
                        </Typography>
                        <Typography variant="headingSm" className="text-orange-600">
                          {expiringStock?.summary?.criticalCases} cases
                        </Typography>
                      </div>
                    )}
                    {(expiringStock?.summary?.warningCases ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <Typography variant="bodySm" className="text-amber-600">
                          Expiring &lt;90 days
                        </Typography>
                        <Typography variant="headingSm" className="text-amber-600">
                          {expiringStock?.summary?.warningCases} cases
                        </Typography>
                      </div>
                    )}
                  </div>
                  <Link
                    href="/platform/admin/wms/stock?expiring=true"
                    className="mt-3 block text-sm text-orange-700 underline hover:no-underline dark:text-orange-400"
                  >
                    View expiring stock →
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Pending Put-Away */}
            {(overview?.pendingPutaway?.casesInReceiving ?? 0) > 0 && (
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon icon={IconTruck} size="md" className="text-blue-600" />
                    <Typography variant="headingSm" className="text-blue-800 dark:text-blue-300">
                      Pending Put-Away
                    </Typography>
                  </div>
                  <Typography variant="headingLg" className="mb-1 text-blue-600">
                    {overview?.pendingPutaway?.casesInReceiving} cases
                  </Typography>
                  <Typography variant="bodyXs" className="text-blue-700 dark:text-blue-400">
                    in receiving area awaiting storage
                  </Typography>
                  <Link
                    href="/platform/admin/wms/putaway"
                    className="mt-3 block text-sm text-blue-700 underline hover:no-underline dark:text-blue-400"
                  >
                    Start put-away →
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Pending Partner Requests */}
            {pendingRequestCount > 0 && (
              <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon icon={IconUsers} size="md" className="text-purple-600" />
                    <Typography variant="headingSm" className="text-purple-800 dark:text-purple-300">
                      Partner Requests
                    </Typography>
                  </div>
                  <Typography variant="headingLg" className="mb-1 text-purple-600">
                    {pendingRequestCount} pending
                  </Typography>
                  <Typography variant="bodyXs" className="text-purple-700 dark:text-purple-400">
                    requests awaiting review
                  </Typography>
                  <Link
                    href="/platform/admin/wms/ownership/requests"
                    className="mt-3 block text-sm text-purple-700 underline hover:no-underline dark:text-purple-400"
                  >
                    Review requests →
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Quick Actions - Large touch targets for mobile */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/platform/admin/wms/putaway">
            <Card className="cursor-pointer transition-colors hover:border-border-brand active:bg-fill-secondary">
              <CardContent className="flex flex-col items-center justify-center p-6">
                <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Icon icon={IconArrowRight} size="xl" className="text-blue-600" />
                </div>
                <Typography variant="headingSm">Put Away</Typography>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/transfer">
            <Card className="cursor-pointer transition-colors hover:border-border-brand active:bg-fill-secondary">
              <CardContent className="flex flex-col items-center justify-center p-6">
                <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <Icon icon={IconTransfer} size="xl" className="text-purple-600" />
                </div>
                <Typography variant="headingSm">Transfer</Typography>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/receive">
            <Card className="cursor-pointer transition-colors hover:border-border-brand active:bg-fill-secondary">
              <CardContent className="flex flex-col items-center justify-center p-6">
                <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <Icon icon={IconPackage} size="xl" className="text-emerald-600" />
                </div>
                <Typography variant="headingSm">Receive</Typography>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/repack">
            <Card className="cursor-pointer transition-colors hover:border-border-brand active:bg-fill-secondary">
              <CardContent className="flex flex-col items-center justify-center p-6">
                <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
                  <Icon icon={IconPackages} size="xl" className="text-orange-600" />
                </div>
                <Typography variant="headingSm">Repack</Typography>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/platform/admin/wms/pick">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconBox} size="md" className="text-text-muted" />
                <Typography variant="bodySm" className="font-medium">Pick Lists</Typography>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/dispatch">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconTruck} size="md" className="text-text-muted" />
                <Typography variant="bodySm" className="font-medium">Dispatch</Typography>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/labels">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconBarcode} size="md" className="text-text-muted" />
                <Typography variant="bodySm" className="font-medium">Labels</Typography>
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/stock">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconBox} size="md" className="text-text-muted" />
                <Typography variant="bodySm" className="font-medium">Stock</Typography>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Movements - Compact */}
        {movements?.movements && movements.movements.length > 0 && (
          <Card>
            <div className="flex items-center justify-between p-3 pb-2">
              <Typography variant="bodySm" className="font-medium">Recent Activity</Typography>
              <Link href="/platform/admin/wms/movements" className="text-xs text-text-muted">
                All →
              </Link>
            </div>
            <CardContent className="p-3 pt-0">
              <div className="space-y-2">
                {movements.movements.slice(0, 3).map((movement) => (
                  <div key={movement.id} className="flex items-center gap-2 text-sm">
                    <MovementTypeBadge
                      movementType={movement.movementType as 'receive' | 'putaway' | 'transfer' | 'pick' | 'adjust' | 'count' | 'ownership_transfer' | 'repack_out' | 'repack_in' | 'pallet_add' | 'pallet_remove' | 'pallet_move'}
                      size="sm"
                      showLabel={false}
                    />
                    <span className="min-w-0 flex-1 truncate text-text-muted">
                      {movement.productName?.substring(0, 25)}...
                    </span>
                    <span className="font-medium text-blue-600">{movement.quantityCases}cs</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* More Options */}
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 gap-2">
              <Link href="/platform/admin/wms/locations" className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-fill-secondary">
                <Icon icon={IconMapPin} size="sm" colorRole="muted" />
                <Typography variant="bodySm">Locations</Typography>
              </Link>
              <Link href="/platform/admin/wms/movements" className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-fill-secondary">
                <Icon icon={IconTransfer} size="sm" colorRole="muted" />
                <Typography variant="bodySm">Movements</Typography>
              </Link>
              <Link href="/platform/admin/wms/ownership/transfer" className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-fill-secondary">
                <Icon icon={IconUserDollar} size="sm" colorRole="muted" />
                <Typography variant="bodySm">Ownership</Typography>
              </Link>
              <Link href="/platform/admin/wms/ownership/requests" className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-fill-secondary">
                <Icon icon={IconUsers} size="sm" colorRole="muted" />
                <Typography variant="bodySm">Requests</Typography>
                {pendingRequestCount > 0 && (
                  <span className="ml-auto rounded-full bg-purple-600 px-1.5 py-0.5 text-xs font-medium text-white">
                    {pendingRequestCount}
                  </span>
                )}
              </Link>
              {hasReconcileIssues && (
                <Link href="/platform/admin/wms/stock/reconcile" className="col-span-2 flex items-center gap-2 rounded-lg bg-red-50 p-2 transition-colors hover:bg-red-100 dark:bg-red-900/20">
                  <Icon icon={IconAlertTriangle} size="sm" className="text-red-600" />
                  <Typography variant="bodySm" className="text-red-700 dark:text-red-400">Reconciliation Issue</Typography>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Setup Notice */}
        {(overview?.locations?.total ?? 0) === 0 && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
            <CardContent className="p-4 text-center">
              <Icon icon={IconBuildingWarehouse} size="lg" colorRole="muted" className="mx-auto mb-2" />
              <Typography variant="bodySm" className="mb-3">
                Create locations to get started
              </Typography>
              <Button asChild size="lg" className="w-full">
                <Link href="/platform/admin/wms/locations/new">
                  <ButtonContent iconLeft={IconPlus}>Create Locations</ButtonContent>
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WMSDashboardContent;
