'use client';

import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconInbox,
  IconRefresh,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter = 'all' | 'pending' | 'submitted' | 'declined';

/**
 * Partner SOURCE page - incoming RFQ inbox
 */
const PartnerSourcePage = () => {
  const api = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    ...api.source.partner.getMany.queryOptions({
      limit: 50,
      search: debouncedSearch || undefined,
    }),
  });

  // Fetch pending confirmation requests
  const { data: confirmationData } = useQuery({
    ...api.source.partner.getConfirmationRequests.queryOptions(),
  });

  const pendingConfirmations = confirmationData?.pendingCount ?? 0;

  // Filter RFQs by partner status
  const allRfqs = data?.data ?? [];
  const rfqs = allRfqs.filter((rfq) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return rfq.partnerStatus === 'pending' || rfq.partnerStatus === 'viewed';
    return rfq.partnerStatus === statusFilter;
  });

  // Count by status
  const pendingCount = allRfqs.filter((r) => r.partnerStatus === 'pending' || r.partnerStatus === 'viewed').length;
  const submittedCount = allRfqs.filter((r) => r.partnerStatus === 'submitted').length;
  const declinedCount = allRfqs.filter((r) => r.partnerStatus === 'declined').length;

  const pill = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

  const getPartnerStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className={`${pill} bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60`}>
            <IconCheck className="h-3 w-3" />
            Submitted
          </span>
        );
      case 'viewed':
        return (
          <span className={`${pill} bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60`}>
            <IconClock className="h-3 w-3" />
            In progress
          </span>
        );
      case 'declined':
        return (
          <span className={`${pill} bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/60`}>
            <IconX className="h-3 w-3" />
            Declined
          </span>
        );
      default:
        return (
          <span className={`${pill} bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60`}>
            New
          </span>
        );
    }
  };

  const statusFilters: Array<{ label: string; value: StatusFilter; count: number }> = [
    { label: 'All', value: 'all', count: allRfqs.length },
    { label: 'Pending', value: 'pending', count: pendingCount },
    { label: 'Submitted', value: 'submitted', count: submittedCount },
    { label: 'Declined', value: 'declined', count: declinedCount },
  ];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <Typography variant="headingLg">
              Quote requests
            </Typography>
            <Typography variant="bodySm" colorRole="muted" className="mt-1">
              Respond to sourcing requests from Craft & Culture
            </Typography>
          </div>
          {pendingCount > 0 && (
            <div className="self-start sm:self-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {pendingCount} pending
              </span>
            </div>
          )}
        </div>

        {/* Pending confirmations banner */}
        {pendingConfirmations > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <IconAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <Typography variant="bodySm" className="font-semibold text-amber-900 dark:text-amber-200">
                  {pendingConfirmations} {pendingConfirmations === 1 ? 'quote' : 'quotes'} awaiting confirmation
                </Typography>
                <Typography variant="bodySm" className="text-amber-800 dark:text-amber-300">
                  C&amp;C has accepted {pendingConfirmations} of your quotes. Please confirm availability.
                </Typography>
              </div>
            </div>
            <Link
              href="/platform/partner/source/confirmations"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-text-primary px-3 py-1.5 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 sm:self-auto"
            >
              Confirm now
              <IconChevronRight size={14} />
            </Link>
          </div>
        )}

        {/* Status Filters + Search */}
        <div className="space-y-3">
          {/* Status filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {statusFilters.map((filter) => {
              const on = statusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    on
                      ? 'bg-text-primary text-surface-primary'
                      : 'bg-surface-muted text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {filter.label}
                  {filter.count > 0 && (
                    <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${on ? 'bg-surface-primary/20' : 'bg-surface-primary text-text-muted'}`}>
                      {filter.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <Input
            type="search"
            placeholder="Search by name or RFQ number"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            iconLeft={IconSearch}
            size="lg"
            className="h-11 w-full rounded-xl"
          />
        </div>

        {/* RFQ List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-fill-muted rounded w-24 mb-3" />
                  <div className="h-5 bg-fill-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-fill-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border-muted bg-surface-primary px-4 py-12 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
              <IconAlertCircle size={22} />
            </div>
            <Typography variant="bodySm" className="font-medium">
              Quote requests could not be loaded
            </Typography>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <IconRefresh size={14} />
              {isFetching ? 'Loading…' : 'Try again'}
            </button>
          </div>
        ) : rfqs.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="py-12 text-center">
              <IconInbox className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <Typography variant="headingSm" className="mb-2">
                {statusFilter !== 'all' || debouncedSearch ? 'No matching quote requests' : 'No quote requests yet'}
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="max-w-sm mx-auto">
                {statusFilter !== 'all' || debouncedSearch
                  ? 'Try a different filter or search.'
                  : 'When Craft & Culture sends you a sourcing request, it will appear here.'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {rfqs.map((rfq) => {
              const isUrgent = rfq.responseDeadline &&
                new Date(rfq.responseDeadline) < new Date(Date.now() + 24 * 60 * 60 * 1000);
              const isOverdue = rfq.responseDeadline &&
                new Date() > new Date(rfq.responseDeadline);

              return (
                <Link
                  key={rfq.id}
                  href={`/platform/partner/source/${rfq.id}`}
                  className="block"
                >
                  <Card className={`cursor-pointer transition-all hover:-translate-y-px hover:shadow-md ${
                    rfq.partnerStatus === 'pending' ? 'border-l-4 border-l-blue-500' : ''
                  } ${isOverdue && rfq.partnerStatus !== 'submitted' ? 'opacity-60' : ''}`}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        {/* Left content */}
                        <div className="flex-1 min-w-0">
                          {/* Status row */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                            <span className="font-mono text-xs text-text-muted">
                              {rfq.rfqNumber}
                            </span>
                            {getPartnerStatusBadge(rfq.partnerStatus)}
                          </div>

                          {/* Title */}
                          <Typography variant="bodyMd" className="font-semibold line-clamp-1 mb-1">
                            {rfq.name}
                          </Typography>

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-text-muted">
                            <span className="font-medium text-text-primary">
                              {rfq.itemCount} {rfq.itemCount === 1 ? 'item' : 'items'}
                            </span>

                            {rfq.responseDeadline && (
                              <span className={`flex items-center gap-1 ${
                                isOverdue
                                  ? 'text-red-600 dark:text-red-400'
                                  : isUrgent
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : ''
                              }`}>
                                <IconCalendar className="h-3.5 w-3.5" />
                                {isOverdue ? 'Overdue' : formatDistanceToNow(new Date(rfq.responseDeadline), { addSuffix: true })}
                              </span>
                            )}

                            {rfq.partnerStatus === 'submitted' && rfq.quoteCount > 0 && (
                              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                                {rfq.quoteCount} quote{rfq.quoteCount !== 1 ? 's' : ''} sent
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Chevron */}
                        <IconChevronRight className="h-5 w-5 text-text-muted flex-shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Count */}
        {!isLoading && !isError && rfqs.length > 0 && (
          <Typography variant="bodyXs" colorRole="muted" className="text-center">
            Showing {rfqs.length} of {allRfqs.length} quote requests
          </Typography>
        )}
      </div>
    </div>
  );
};

export default PartnerSourcePage;
