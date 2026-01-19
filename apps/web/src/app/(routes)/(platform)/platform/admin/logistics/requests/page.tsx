'use client';

import {
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFileText,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSnowflake,
  IconThermometer,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import Badge from '@/app/_ui/components/Badge/Badge';
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
import type { logisticsQuoteRequestPriority, logisticsQuoteRequestStatus } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type RequestStatus = (typeof logisticsQuoteRequestStatus.enumValues)[number];
type RequestPriority = (typeof logisticsQuoteRequestPriority.enumValues)[number];

const statusOptions: { value: RequestStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const priorityOptions: { value: RequestPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

const statusBadgeVariants: Record<RequestStatus, 'default' | 'warning' | 'success' | 'error' | 'secondary'> = {
  pending: 'warning',
  in_progress: 'secondary',
  quoted: 'success',
  completed: 'success',
  cancelled: 'error',
};

const priorityBadgeVariants: Record<RequestPriority, 'default' | 'warning' | 'success' | 'error' | 'secondary'> = {
  low: 'default',
  normal: 'secondary',
  high: 'warning',
  urgent: 'error',
};

const statusIcons: Record<RequestStatus, typeof IconClock> = {
  pending: IconClock,
  in_progress: IconTruck,
  quoted: IconFileText,
  completed: IconCheck,
  cancelled: IconX,
};

/**
 * Quote Requests list page
 */
const QuoteRequestsListPage = () => {
  const api = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | 'all'>('all');

  const { data, isLoading, refetch, isFetching } = useQuery({
    ...api.logistics.admin.requests.getMany.queryOptions({
      limit: 50,
      search: searchQuery || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
    }),
  });

  const requests = data?.requests ?? [];
  const totalCount = data?.totalCount ?? 0;

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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
              <span>Quote Requests</span>
            </div>
            <Typography variant="headingLg" className="mb-2">
              Quote Requests
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Manage freight quote requests from the sales team
            </Typography>
          </div>
          <div className="flex items-center gap-2">
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
              <Link href="/platform/admin/logistics/requests/new">
                <ButtonContent iconLeft={IconPlus}>New Request</ButtonContent>
              </Link>
            </Button>
          </div>
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
                  placeholder="Search by request number, route..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as RequestStatus | 'all')}
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
                value={priorityFilter}
                onValueChange={(v) => setPriorityFilter(v as RequestPriority | 'all')}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between mt-3">
              <Typography variant="bodySm" className="text-text-muted">
                {isLoading ? 'Loading...' : `${totalCount} requests found`}
              </Typography>
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
            </CardContent>
          </Card>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon icon={IconFileText} size="xl" className="mx-auto mb-4 text-text-muted" />
              <Typography variant="headingSm" className="mb-2">
                No Requests Found
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'No requests match your filters. Try adjusting your search.'
                  : 'No quote requests have been created yet.'}
              </Typography>
              <Button className="mt-4" asChild>
                <Link href="/platform/admin/logistics/requests/new">
                  <ButtonContent iconLeft={IconPlus}>Create First Request</ButtonContent>
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const StatusIcon = statusIcons[request.status];

              return (
                <Link
                  key={request.id}
                  href={`/platform/admin/logistics/requests/${request.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border-primary bg-surface-primary p-4 transition-colors hover:border-border-brand"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Typography variant="bodySm" className="font-mono text-text-muted">
                        {request.requestNumber}
                      </Typography>
                      <Badge variant={statusBadgeVariants[request.status]}>
                        <Icon icon={StatusIcon} size="xs" className="mr-1" />
                        {request.status.replace('_', ' ').charAt(0).toUpperCase() +
                          request.status.replace('_', ' ').slice(1)}
                      </Badge>
                      <Badge variant={priorityBadgeVariants[request.priority]}>
                        {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                      </Badge>
                    </div>
                    <Typography variant="headingSm" className="truncate mb-1">
                      {request.originCity || request.originCountry} →{' '}
                      {request.destinationCity || request.destinationCountry}
                    </Typography>
                    <div className="flex items-center gap-4 text-sm text-text-muted">
                      <span className="capitalize">{request.productType}</span>
                      {request.totalCases && <span>{request.totalCases} cases</span>}
                      {request.totalPallets && <span>{request.totalPallets} pallets</span>}
                      {request.totalWeightKg && <span>{request.totalWeightKg.toFixed(0)} kg</span>}
                    </div>
                    {(request.requiresThermalLiner || request.requiresTracker) && (
                      <div className="flex items-center gap-2 mt-2">
                        {request.requiresThermalLiner && (
                          <Badge variant="secondary">
                            <IconSnowflake className="h-3 w-3 mr-1" />
                            Thermal Liner
                          </Badge>
                        )}
                        {request.requiresTracker && (
                          <Badge variant="secondary">
                            <IconThermometer className="h-3 w-3 mr-1" />
                            Tracker
                          </Badge>
                        )}
                      </div>
                    )}
                    {request.requester && (
                      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                        Requested by: {request.requester.name || request.requester.email}
                      </Typography>
                    )}
                  </div>

                  <div className="flex items-center gap-6 text-sm text-text-muted">
                    <div className="hidden md:block text-right">
                      {request.targetDeliveryDate && (
                        <>
                          <Typography variant="bodyXs" colorRole="muted">
                            Target Delivery
                          </Typography>
                          <Typography variant="bodySm">
                            {formatDate(request.targetDeliveryDate)}
                          </Typography>
                        </>
                      )}
                    </div>
                    <div className="hidden lg:block text-right text-xs">
                      {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                    </div>
                    <IconChevronRight className="h-5 w-5 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteRequestsListPage;
