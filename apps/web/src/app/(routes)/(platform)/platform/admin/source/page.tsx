'use client';

import {
  IconCalendar,
  IconChevronRight,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import RfqStatusBadge from '@/app/_source/components/RfqStatusBadge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { sourceRfqStatus } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type RfqStatus = (typeof sourceRfqStatus.enumValues)[number];

/**
 * Admin SOURCE page - RFQ list dashboard
 */
const SourcePage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RfqStatus | 'all'>('all');

  const { data, isLoading } = useQuery({
    ...api.source.admin.getMany.queryOptions({
      limit: 50,
      search: searchQuery || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
  });

  const { mutate: deleteRfq } = useMutation(
    api.source.admin.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: api.source.admin.getMany.queryKey() });
      },
      onError: (error) => {
        alert(`Failed to delete: ${error.message}`);
      },
    }),
  );

  const handleDelete = (e: React.MouseEvent, rfqId: string, rfqName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete RFQ "${rfqName}"? This cannot be undone.`)) {
      deleteRfq({ rfqId });
    }
  };

  const rfqs = data?.data ?? [];

  const statusFilters: Array<{ label: string; value: RfqStatus | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Sent', value: 'sent' },
    { label: 'Collecting', value: 'collecting' },
    { label: 'Comparing', value: 'comparing' },
    { label: 'Quoted', value: 'quote_generated' },
    { label: 'Closed', value: 'closed' },
  ];

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Typography variant="headingLg" className="mb-2">
              SOURCE - RFQ Management
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Create and manage sourcing requests for out-of-stock items
            </Typography>
          </div>
          <Link href="/platform/admin/source/new">
            <Button variant="default" colorRole="brand">
              <ButtonContent iconLeft={IconPlus}>New RFQ</ButtonContent>
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? 'default' : 'outline'}
                  colorRole={statusFilter === filter.value ? 'brand' : 'primary'}
                  size="sm"
                  onClick={() => setStatusFilter(filter.value)}
                >
                  <ButtonContent>{filter.label}</ButtonContent>
                </Button>
              ))}
            </div>

            <div className="relative">
              <IconSearch className="text-text-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, RFQ number, or distributor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background-primary border-border-primary text-text-primary placeholder:text-text-muted w-full rounded-lg border px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Typography variant="bodySm" className="text-text-muted">
              {isLoading ? 'Loading...' : `${data?.meta.totalCount ?? 0} RFQs found`}
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
              <IconSearch className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <Typography variant="bodyMd" className="text-text-muted">
                No RFQs found. Create a new RFQ to get started.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rfqs.map((rfq) => (
              <Link
                key={rfq.id}
                href={`/platform/admin/source/${rfq.id}`}
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
                        </div>
                        <Typography variant="headingSm" className="truncate">
                          {rfq.name}
                        </Typography>
                        {rfq.distributorCompany && (
                          <Typography variant="bodySm" colorRole="muted">
                            {rfq.distributorCompany}
                            {rfq.distributorName && ` - ${rfq.distributorName}`}
                          </Typography>
                        )}
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="hidden sm:flex items-center gap-4 text-text-muted">
                          <div className="flex items-center gap-1.5">
                            <IconSearch className="h-4 w-4" />
                            <span>{rfq.itemCount} items</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <IconUsers className="h-4 w-4" />
                            <span>
                              {rfq.responseCount}/{rfq.partnerCount} responses
                            </span>
                          </div>
                          {rfq.responseDeadline && (
                            <div className="flex items-center gap-1.5">
                              <IconCalendar className="h-4 w-4" />
                              <span>
                                {formatDistanceToNow(new Date(rfq.responseDeadline), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="text-right text-text-muted text-xs hidden md:block">
                          {formatDistanceToNow(new Date(rfq.createdAt), { addSuffix: true })}
                        </div>

                        {rfq.status === 'draft' && (
                          <button
                            onClick={(e) => handleDelete(e, rfq.id, rfq.name)}
                            className="p-1.5 rounded hover:bg-fill-danger/10 text-text-muted hover:text-text-danger transition-colors"
                            title="Delete RFQ"
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
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

export default SourcePage;
