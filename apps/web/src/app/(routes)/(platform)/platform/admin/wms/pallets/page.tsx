'use client';

import {
  IconArrowLeft,
  IconBox,
  IconChevronRight,
  IconLoader2,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter = 'all' | 'active' | 'sealed' | 'retrieved' | 'archived';

/**
 * WMS Pallets - Manage mixed pallets
 */
const WMSPalletsPage = () => {
  const api = useTRPC();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const { data, isLoading, refetch } = useQuery({
    ...api.wms.admin.pallets.getMany.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: 50,
    }),
  });

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: 'active', label: 'Active' },
    { id: 'sealed', label: 'Sealed' },
    { id: 'retrieved', label: 'Retrieved' },
    { id: 'all', label: 'All' },
  ];

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      sealed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      retrieved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    };
    const labels: Record<string, string> = {
      active: 'Active',
      sealed: 'Sealed',
      retrieved: 'Retrieved',
      archived: 'Archived',
    };
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-fill-secondary text-text-muted'}`}>
        {labels[status] || status}
      </span>
    );
  };

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
              Pallets
            </Typography>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <Icon icon={IconRefresh} size="sm" />
              </Button>
              <Link href="/platform/admin/wms/pallets/new">
                <Button variant="default" size="sm">
                  <ButtonContent iconLeft={IconPlus}>New</ButtonContent>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {data?.counts && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg" className="text-blue-600">
                  {data.counts.active ?? 0}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Active
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg" className="text-emerald-600">
                  {data.counts.sealed ?? 0}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Sealed
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg" className="text-amber-600">
                  {data.counts.retrieved ?? 0}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Retrieved
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingMd">{data.totalPallets}</Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Total
                </Typography>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-fill-secondary p-1">
          {statusFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === filter.id
                  ? 'bg-fill-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
          </div>
        )}

        {/* Pallets List */}
        {!isLoading && data && (
          <div className="grid gap-3 md:grid-cols-2">
            {data.pallets.length === 0 ? (
              <Card className="md:col-span-2">
                <CardContent className="p-8 text-center">
                  <Icon icon={IconBox} size="xl" colorRole="muted" className="mx-auto mb-4" />
                  <Typography variant="headingSm" className="mb-2">
                    No Pallets
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {statusFilter === 'active'
                      ? 'Create a new pallet to start adding cases'
                      : 'No pallets match this filter'}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              data.pallets.map((pallet) => (
                <Link key={pallet.id} href={`/platform/admin/wms/pallets/${pallet.id}`}>
                  <Card className="transition-shadow hover:shadow-md hover:border-border-brand">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fill-brand/10">
                            <Icon icon={IconBox} size="md" className="text-text-brand" />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <Typography variant="bodySm" className="font-semibold">
                                {pallet.palletCode}
                              </Typography>
                              {getStatusBadge(pallet.status ?? 'active')}
                            </div>
                            <Typography variant="bodyXs" colorRole="muted">
                              {pallet.ownerName}
                            </Typography>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <Typography variant="bodySm" className="font-semibold">
                              {pallet.totalCases}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              cases
                            </Typography>
                          </div>
                          {pallet.locationCode && (
                            <div className="text-right">
                              <Typography variant="bodySm" className="font-semibold">
                                {pallet.locationCode}
                              </Typography>
                              <Typography variant="bodyXs" colorRole="muted">
                                location
                              </Typography>
                            </div>
                          )}
                          <IconChevronRight className="h-5 w-5 text-text-muted" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}

            {/* Pagination */}
            {data.totalPallets > 0 && (
              <Typography variant="bodyXs" colorRole="muted" className="text-center">
                Showing {data.pallets.length} of {data.totalPallets} pallets
              </Typography>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSPalletsPage;
