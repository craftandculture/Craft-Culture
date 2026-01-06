'use client';

import {
  IconCalendar,
  IconChevronRight,
  IconInbox,
  IconSearch,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import RfqStatusBadge from '@/app/_source/components/RfqStatusBadge';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Partner SOURCE page - incoming RFQ inbox
 */
const PartnerSourcePage = () => {
  const api = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    ...api.source.partner.getMany.queryOptions({
      limit: 50,
      search: searchQuery || undefined,
    }),
  });

  const rfqs = data?.data ?? [];

  const getPartnerStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-fill-success/10 text-text-success">
            Submitted
          </span>
        );
      case 'viewed':
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-fill-warning/10 text-text-warning">
            Viewed
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-fill-danger/10 text-text-danger">
            Declined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-fill-brand/10 text-text-brand">
            New
          </span>
        );
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Typography variant="headingLg" className="mb-2">
            SOURCE - RFQ Inbox
          </Typography>
          <Typography variant="bodyMd" colorRole="muted">
            Quote requests from Craft & Culture
          </Typography>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              <IconSearch className="text-text-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search RFQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background-primary border-border-primary text-text-primary placeholder:text-text-muted w-full rounded-lg border px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Typography variant="bodySm" className="text-text-muted mt-3">
              {isLoading ? 'Loading...' : `${data?.meta.totalCount ?? 0} RFQs`}
            </Typography>
          </CardContent>
        </Card>

        {/* RFQ List */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <Typography variant="bodyMd" className="text-text-muted text-center">
                Loading RFQs...
              </Typography>
            </CardContent>
          </Card>
        ) : rfqs.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <IconInbox className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <Typography variant="headingSm" className="mb-2">
                No RFQs yet
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                When Craft & Culture sends you an RFQ, it will appear here.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rfqs.map((rfq) => (
              <Link
                key={rfq.id}
                href={`/platform/partner/source/${rfq.id}`}
                className="block"
              >
                <Card className="hover:border-border-brand transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <Typography variant="bodySm" className="font-mono text-text-muted">
                            {rfq.rfqNumber}
                          </Typography>
                          <RfqStatusBadge status={rfq.status} />
                          {getPartnerStatusBadge(rfq.partnerStatus)}
                        </div>
                        <Typography variant="headingSm" className="truncate">
                          {rfq.name}
                        </Typography>
                        <Typography variant="bodySm" colorRole="muted">
                          {rfq.itemCount} items to quote
                        </Typography>
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        {rfq.responseDeadline && (
                          <div className="hidden sm:flex items-center gap-1.5 text-text-muted">
                            <IconCalendar className="h-4 w-4" />
                            <span>
                              Due{' '}
                              {formatDistanceToNow(new Date(rfq.responseDeadline), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        )}

                        {rfq.partnerStatus === 'submitted' && rfq.quoteCount > 0 && (
                          <Typography variant="bodySm" className="text-text-success">
                            {rfq.quoteCount} quotes submitted
                          </Typography>
                        )}

                        <IconChevronRight className="h-5 w-5 text-text-muted" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerSourcePage;
