'use client';

import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconInbox,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter = 'all' | 'pending' | 'submitted' | 'declined';

/**
 * Partner SOURCE page - incoming RFQ inbox
 */
const PartnerSourcePage = () => {
  const api = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading } = useQuery({
    ...api.source.partner.getMany.queryOptions({
      limit: 50,
      search: searchQuery || undefined,
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

  const getPartnerStatusBadge = (status: string, quoteCount?: number) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
            <IconCheck className="h-3 w-3" />
            <span className="hidden xs:inline">Submitted</span>
            {quoteCount !== undefined && quoteCount > 0 && (
              <span className="xs:hidden">{quoteCount}</span>
            )}
          </span>
        );
      case 'viewed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
            <IconClock className="h-3 w-3" />
            <span className="hidden xs:inline">In Progress</span>
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
            <IconX className="h-3 w-3" />
            <span className="hidden xs:inline">Declined</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 animate-pulse">
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
    <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-8">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <Typography variant="headingLg" className="text-lg sm:text-xl">
              Quote Requests
            </Typography>
            <Typography variant="bodySm" colorRole="muted" className="hidden sm:block">
              Respond to sourcing requests from Craft & Culture
            </Typography>
          </div>
          {pendingCount > 0 && (
            <div className="self-start sm:self-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                {pendingCount} pending
              </span>
            </div>
          )}
        </div>

        {/* Pending confirmations banner */}
        {pendingConfirmations > 0 && (
          <Link href="/platform/partner/source/confirmations">
            <Card className="border-amber-300 bg-amber-50 hover:border-amber-400 hover:bg-amber-100/80 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <IconAlertCircle className="h-6 w-6 text-amber-600" />
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">
                      {pendingConfirmations}
                    </span>
                  </div>
                  <div>
                    <Typography variant="bodyMd" className="font-semibold text-amber-900">
                      {pendingConfirmations} quote{pendingConfirmations !== 1 ? 's' : ''} awaiting confirmation
                    </Typography>
                    <Typography variant="bodySm" className="text-amber-700">
                      Your quotes were selected! Please confirm availability.
                    </Typography>
                  </div>
                </div>
                <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700 flex-shrink-0">
                  <ButtonContent iconRight={IconChevronRight}>
                    Confirm Now
                  </ButtonContent>
                </Button>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Status Filters + Search */}
        <div className="space-y-3">
          {/* Status filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {statusFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? 'default' : 'ghost'}
                colorRole={statusFilter === filter.value ? 'brand' : 'primary'}
                size="sm"
                onClick={() => setStatusFilter(filter.value)}
                className="flex-shrink-0"
              >
                <ButtonContent>
                  {filter.label}
                  {filter.count > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                      statusFilter === filter.value
                        ? 'bg-white/20 text-white'
                        : 'bg-fill-muted text-text-muted'
                    }`}>
                      {filter.count}
                    </span>
                  )}
                </ButtonContent>
              </Button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <IconSearch className="text-text-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or RFQ number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background-primary border-border-primary text-text-primary placeholder:text-text-muted w-full rounded-lg border px-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
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
        ) : rfqs.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <IconInbox className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <Typography variant="headingSm" className="mb-2">
                {statusFilter !== 'all' ? 'No matching RFQs' : 'No quote requests yet'}
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="max-w-sm mx-auto">
                {statusFilter !== 'all'
                  ? 'Try selecting a different filter above.'
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
                  <Card className={`hover:border-border-brand transition-all cursor-pointer active:scale-[0.99] ${
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
                            {getPartnerStatusBadge(rfq.partnerStatus, rfq.quoteCount)}
                          </div>

                          {/* Title */}
                          <Typography variant="bodyMd" className="font-semibold line-clamp-1 mb-1">
                            {rfq.name}
                          </Typography>

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-text-muted">
                            <span className="font-medium text-text-primary">
                              {rfq.itemCount} item{rfq.itemCount !== 1 ? 's' : ''}
                            </span>

                            {rfq.responseDeadline && (
                              <span className={`flex items-center gap-1 ${
                                isOverdue
                                  ? 'text-red-600'
                                  : isUrgent
                                    ? 'text-amber-600'
                                    : ''
                              }`}>
                                <IconCalendar className="h-3.5 w-3.5" />
                                {isOverdue ? 'Overdue' : formatDistanceToNow(new Date(rfq.responseDeadline), { addSuffix: true })}
                              </span>
                            )}

                            {rfq.partnerStatus === 'submitted' && rfq.quoteCount > 0 && (
                              <span className="text-green-600 font-medium">
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
        {!isLoading && rfqs.length > 0 && (
          <Typography variant="bodyXs" colorRole="muted" className="text-center">
            Showing {rfqs.length} of {allRfqs.length} RFQs
          </Typography>
        )}
      </div>
    </div>
  );
};

export default PartnerSourcePage;
