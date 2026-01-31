'use client';

import {
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
import useTRPC from '@/lib/trpc/browser';

/**
 * WMS Dashboard - overview of warehouse locations, stock, and quick actions
 */
const WMSDashboardPage = () => {
  const api = useTRPC();

  const { data: locations, isLoading } = useQuery({
    ...api.wms.admin.locations.getMany.queryOptions({}),
  });

  const totalLocations = locations?.length ?? 0;
  const activeLocations = locations?.filter((l) => l.isActive).length ?? 0;
  const totalCases = locations?.reduce((sum, l) => sum + (l.totalCases ?? 0), 0) ?? 0;
  const productCount = locations?.reduce((sum, l) => sum + (l.productCount ?? 0), 0) ?? 0;

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

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
                    {activeLocations}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
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
                    {totalCases.toLocaleString()}
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
                    {productCount}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Icon icon={IconBuildingWarehouse} size="md" className="text-orange-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Owners
                  </Typography>
                  <Typography variant="headingMd" className="text-orange-600">
                    0
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
        </div>

        {/* Setup Notice */}
        {totalLocations === 0 && (
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

export default WMSDashboardPage;
