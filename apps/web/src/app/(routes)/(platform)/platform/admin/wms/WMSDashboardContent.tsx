'use client';

import {
  IconAlertTriangle,
  IconArrowRight,
  IconBarcode,
  IconBox,
  IconBuildingWarehouse,
  IconChevronRight,
  IconLoader2,
  IconMapPin,
  IconPackage,
  IconPackages,
  IconPlus,
  IconTransfer,
  IconTruck,
  IconUser,
  IconUserDollar,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
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
  const { data: movements, isLoading: movementsLoading } = useQuery({
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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasExpiryAlerts =
    (expiringStock?.summary?.expiredCases ?? 0) > 0 ||
    (expiringStock?.summary?.criticalCases ?? 0) > 0;

  const pendingRequestCount = partnerRequests?.summary?.pendingCount ?? 0;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Typography variant="headingLg" className="mb-2">
              WMS Dashboard
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Warehouse management system overview
            </Typography>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/admin/wms/scanner-test">
                <ButtonContent iconLeft={IconBarcode}>Scanner Test</ButtonContent>
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Icon icon={IconBox} size="md" className="text-purple-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Total Cases
                  </Typography>
                  <Typography variant="headingMd" className="text-purple-600">
                    {(overview?.summary?.totalCases ?? 0).toLocaleString()}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <Icon icon={IconPackage} size="md" className="text-emerald-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Products
                  </Typography>
                  <Typography variant="headingMd" className="text-emerald-600">
                    {overview?.summary?.uniqueProducts ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Icon icon={IconMapPin} size="md" className="text-blue-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Locations
                  </Typography>
                  <Typography variant="headingMd" className="text-blue-600">
                    {overview?.locations?.occupied ?? 0}/{overview?.locations?.active ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Icon icon={IconUser} size="md" className="text-orange-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Owners
                  </Typography>
                  <Typography variant="headingMd" className="text-orange-600">
                    {overview?.summary?.uniqueOwners ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-900/30">
                  <Icon icon={IconTransfer} size="md" className="text-cyan-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Moves (24h)
                  </Typography>
                  <Typography variant="headingMd" className="text-cyan-600">
                    {overview?.movements?.last24Hours ?? 0}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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

        {/* Quick Actions */}
        <Card>
          <div className="p-4 pb-3">
            <CardTitle>Quick Actions</CardTitle>
          </div>
          <CardContent className="pt-0">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                <Link href="/platform/admin/wms/putaway">
                  <Icon icon={IconArrowRight} size="lg" />
                  <span>Put Away</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                <Link href="/platform/admin/wms/transfer">
                  <Icon icon={IconTransfer} size="lg" />
                  <span>Transfer</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                <Link href="/platform/admin/wms/repack">
                  <Icon icon={IconPackages} size="lg" />
                  <span>Repack</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                <Link href="/platform/admin/wms/receive">
                  <Icon icon={IconPackage} size="lg" />
                  <span>Receive</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                <Link href="/platform/admin/wms/labels">
                  <Icon icon={IconBarcode} size="lg" />
                  <span>Print Labels</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout: Recent Movements + Top Owners */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Movements */}
          <Card>
            <div className="flex items-center justify-between p-4 pb-3">
              <CardTitle>Recent Movements</CardTitle>
              <Link
                href="/platform/admin/wms/movements"
                className="text-sm text-text-muted hover:text-text-primary"
              >
                View all →
              </Link>
            </div>
            <CardContent className="pt-0">
              {movementsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" />
                </div>
              ) : movements?.movements && movements.movements.length > 0 ? (
                <div className="space-y-3">
                  {movements.movements.map((movement) => (
                    <div
                      key={movement.id}
                      className="flex items-center gap-3 rounded-lg bg-fill-secondary p-3"
                    >
                      <MovementTypeBadge
                        movementType={movement.movementType as 'receive' | 'putaway' | 'transfer' | 'pick' | 'adjust' | 'count' | 'ownership_transfer' | 'repack_out' | 'repack_in' | 'pallet_add' | 'pallet_remove' | 'pallet_move'}
                        size="sm"
                        showLabel={false}
                      />
                      <div className="min-w-0 flex-1">
                        <Typography variant="bodySm" className="truncate font-medium">
                          {movement.productName}
                        </Typography>
                        <div className="flex items-center gap-1 text-xs text-text-muted">
                          {movement.fromLocationCode && (
                            <span>{movement.fromLocationCode}</span>
                          )}
                          {movement.fromLocationCode && movement.toLocationCode && (
                            <span>→</span>
                          )}
                          {movement.toLocationCode && (
                            <span>{movement.toLocationCode}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Typography variant="bodySm" className="font-medium text-blue-600">
                          {movement.quantityCases} cs
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {formatDate(movement.performedAt)}
                        </Typography>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Typography variant="bodySm" colorRole="muted">
                    No recent movements
                  </Typography>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Stock Owners */}
          <Card>
            <div className="flex items-center justify-between p-4 pb-3">
              <CardTitle>Stock by Owner</CardTitle>
              <Link
                href="/platform/admin/wms/stock?tab=owner"
                className="text-sm text-text-muted hover:text-text-primary"
              >
                View all →
              </Link>
            </div>
            <CardContent className="pt-0">
              {overview?.topOwners && overview.topOwners.length > 0 ? (
                <div className="space-y-3">
                  {overview.topOwners.map((owner) => (
                    <div
                      key={owner.ownerId}
                      className="flex items-center justify-between rounded-lg bg-fill-secondary p-3"
                    >
                      <div>
                        <Typography variant="bodySm" className="font-medium">
                          {owner.ownerName}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {owner.productCount} products
                        </Typography>
                      </div>
                      <Typography variant="headingSm" className="text-blue-600">
                        {owner.totalCases.toLocaleString()} cs
                      </Typography>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Typography variant="bodySm" colorRole="muted">
                    No stock owners yet
                  </Typography>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Navigation Links */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/platform/admin/wms/locations">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconMapPin} size="md" className="text-text-muted" />
                <div>
                  <Typography variant="headingSm">Locations</Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Manage warehouse locations
                  </Typography>
                </div>
                <IconChevronRight className="ml-auto h-5 w-5 text-text-muted" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/stock">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconBox} size="md" className="text-text-muted" />
                <div>
                  <Typography variant="headingSm">Stock Overview</Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    View stock by product or location
                  </Typography>
                </div>
                <IconChevronRight className="ml-auto h-5 w-5 text-text-muted" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/movements">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconTransfer} size="md" className="text-text-muted" />
                <div>
                  <Typography variant="headingSm">Movements</Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Stock movement history
                  </Typography>
                </div>
                <IconChevronRight className="ml-auto h-5 w-5 text-text-muted" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/ownership/transfer">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconUserDollar} size="md" className="text-text-muted" />
                <div>
                  <Typography variant="headingSm">Transfer Ownership</Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Transfer stock between partners
                  </Typography>
                </div>
                <IconChevronRight className="ml-auto h-5 w-5 text-text-muted" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/platform/admin/wms/ownership/requests">
            <Card className="cursor-pointer transition-colors hover:border-border-brand">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon icon={IconUsers} size="md" className="text-text-muted" />
                <div className="flex items-center gap-2">
                  <Typography variant="headingSm">Partner Requests</Typography>
                  {pendingRequestCount > 0 && (
                    <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs font-medium text-white">
                      {pendingRequestCount}
                    </span>
                  )}
                </div>
                <Typography variant="bodyXs" colorRole="muted">
                  Review transfer & withdrawal requests
                </Typography>
                <IconChevronRight className="ml-auto h-5 w-5 text-text-muted" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Setup Notice */}
        {(overview?.locations?.total ?? 0) === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <Icon icon={IconBuildingWarehouse} size="xl" colorRole="muted" className="mx-auto mb-4" />
              <Typography variant="headingSm" className="mb-2">
                Set Up Your Warehouse
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-4">
                Create locations to start managing your warehouse inventory
              </Typography>
              <Button asChild>
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
