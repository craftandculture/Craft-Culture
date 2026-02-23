'use client';

import {
  IconArrowLeft,
  IconChevronRight,
  IconClipboardCheck,
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

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'reconciled';

/**
 * WMS Cycle Counts - List and manage inventory cycle counts
 */
const WMSCycleCountsPage = () => {
  const api = useTRPC();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  const { data, isLoading, refetch } = useQuery({
    ...api.wms.admin.cycleCounts.getMany.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: 50,
      offset: 0,
    }),
  });

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'in_progress', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'reconciled', label: 'Reconciled' },
    { id: 'all', label: 'All' },
  ];

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      completed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      reconciled: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    };
    const labels: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Needs Review',
      reconciled: 'Reconciled',
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? ''}`}>
        {labels[status] ?? status}
      </span>
    );
  };

  return (
    <div className="container mx-auto max-w-2xl md:max-w-3xl lg:max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/platform/admin/wms">
              <Button variant="ghost" size="sm">
                <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
              </Button>
            </Link>
            <div>
              <Typography variant="h4">Cycle Counts</Typography>
              <Typography variant="bodySm" colorRole="muted">
                Verify physical inventory against system records
              </Typography>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <Icon icon={IconRefresh} size="sm" />
            </Button>
            <Link href="/platform/admin/wms/cycle-count/new">
              <Button size="sm">
                <ButtonContent iconLeft={IconPlus}>New Count</ButtonContent>
              </Button>
            </Link>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-1.5 overflow-x-auto">
          {statusFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f.id
                  ? 'bg-fill-brand text-white'
                  : 'bg-fill-secondary text-text-muted hover:bg-fill-tertiary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Icon icon={IconLoader2} size="lg" className="animate-spin text-text-muted" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && data?.counts.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <Icon icon={IconClipboardCheck} size="lg" className="text-text-muted" />
              <Typography variant="bodySm" colorRole="muted">
                No cycle counts found
              </Typography>
              <Link href="/platform/admin/wms/cycle-count/new">
                <Button size="sm">
                  <ButtonContent iconLeft={IconPlus}>Start a Count</ButtonContent>
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Count List */}
        {data?.counts && data.counts.length > 0 && (
          <div className="space-y-2">
            {data.counts.map((count) => (
              <Link
                key={count.id}
                href={`/platform/admin/wms/cycle-count/${count.id}`}
              >
                <Card className="cursor-pointer transition-colors hover:border-border-brand">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Typography variant="bodySm" className="font-semibold font-mono">
                            {count.countNumber}
                          </Typography>
                          {getStatusBadge(count.status ?? 'pending')}
                        </div>
                        <Typography variant="bodySm" colorRole="muted">
                          {count.locationCode ?? 'Unknown location'}
                        </Typography>
                        <div className="flex gap-4 text-xs text-text-muted">
                          <span>Expected: {count.expectedItems ?? 0}</span>
                          {count.countedItems !== null && count.countedItems !== undefined && count.countedItems > 0 && (
                            <span>Counted: {count.countedItems}</span>
                          )}
                          {count.discrepancyCount !== null && count.discrepancyCount !== undefined && count.discrepancyCount > 0 && (
                            <span className="text-red-600 font-medium">
                              {count.discrepancyCount} discrepanc{count.discrepancyCount === 1 ? 'y' : 'ies'}
                            </span>
                          )}
                        </div>
                      </div>
                      <Icon icon={IconChevronRight} size="sm" className="text-text-muted" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Total */}
        {data && data.total > 0 && (
          <Typography variant="bodySm" colorRole="muted" className="text-center">
            Showing {data.counts.length} of {data.total} count{data.total !== 1 ? 's' : ''}
          </Typography>
        )}
      </div>
    </div>
  );
};

export default WMSCycleCountsPage;
