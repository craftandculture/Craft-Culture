'use client';

import {
  IconCheck,
  IconChevronRight,
  IconClock,
  IconPackage,
  IconSearch,
  IconSend,
  IconTruck,
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
import formatPrice from '@/utils/formatPrice';

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered';

/**
 * Partner Purchase Orders page - incoming PO inbox
 */
const PartnerOrdersPage = () => {
  const api = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading } = useQuery({
    ...api.source.partner.getPurchaseOrders.queryOptions(),
  });

  // Filter POs by status
  const allPOs = data?.purchaseOrders ?? [];
  const pos = allPOs.filter((po) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        po.poNumber?.toLowerCase().includes(query) ||
        po.rfqNumber?.toLowerCase().includes(query) ||
        po.rfqName?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return po.status === 'sent';
    return po.status === statusFilter;
  });

  const summary = data?.summary;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
            <IconClock className="h-3 w-3" />
            Pending Confirmation
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
            <IconCheck className="h-3 w-3" />
            Confirmed
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
            <IconTruck className="h-3 w-3" />
            Shipped
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
            <IconCheck className="h-3 w-3" />
            Delivered
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const statusFilters: Array<{ label: string; value: StatusFilter; count: number }> = [
    { label: 'All', value: 'all', count: allPOs.length },
    { label: 'Pending', value: 'pending', count: summary?.pendingConfirmation ?? 0 },
    { label: 'Confirmed', value: 'confirmed', count: summary?.confirmed ?? 0 },
    { label: 'Shipped', value: 'shipped', count: summary?.shipped ?? 0 },
    { label: 'Delivered', value: 'delivered', count: summary?.delivered ?? 0 },
  ];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-8">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <Typography variant="headingLg" className="text-lg sm:text-xl">
              Purchase Orders
            </Typography>
            <Typography variant="bodySm" colorRole="muted" className="hidden sm:block">
              Orders from Craft & Culture for your quoted products
            </Typography>
          </div>
          {summary && summary.pendingConfirmation > 0 && (
            <div className="self-start sm:self-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                {summary.pendingConfirmation} awaiting confirmation
              </span>
            </div>
          )}
        </div>

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
              placeholder="Search by PO number or RFQ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background-primary border-border-primary text-text-primary placeholder:text-text-muted w-full rounded-lg border px-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* PO List */}
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
        ) : pos.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <IconPackage className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <Typography variant="headingSm" className="mb-2">
                {statusFilter !== 'all' ? 'No matching orders' : 'No purchase orders yet'}
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="max-w-sm mx-auto">
                {statusFilter !== 'all'
                  ? 'Try selecting a different filter above.'
                  : 'When Craft & Culture sends you a purchase order, it will appear here.'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {pos.map((po) => {
              const needsAction = po.status === 'sent';

              return (
                <Link
                  key={po.id}
                  href={`/platform/partner/source/orders/${po.id}`}
                  className="block"
                >
                  <Card className={`hover:border-border-brand transition-all cursor-pointer active:scale-[0.99] ${
                    needsAction ? 'border-l-4 border-l-amber-500' : ''
                  }`}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        {/* Left content */}
                        <div className="flex-1 min-w-0">
                          {/* Status row */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                            <span className="font-mono text-xs text-text-muted">
                              {po.poNumber}
                            </span>
                            {getStatusBadge(po.status)}
                          </div>

                          {/* RFQ reference */}
                          {po.rfqName && (
                            <Typography variant="bodyMd" className="font-semibold line-clamp-1 mb-1">
                              {po.rfqName}
                            </Typography>
                          )}

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-text-muted">
                            <span className="font-semibold text-text-brand">
                              {formatPrice(po.totalAmountUsd ?? 0, 'USD')}
                            </span>

                            {po.rfqNumber && (
                              <span className="font-mono">
                                {po.rfqNumber}
                              </span>
                            )}

                            {po.sentAt && (
                              <span className="flex items-center gap-1">
                                <IconSend className="h-3.5 w-3.5" />
                                {formatDistanceToNow(new Date(po.sentAt), { addSuffix: true })}
                              </span>
                            )}

                            {po.trackingNumber && (
                              <span className="flex items-center gap-1 text-blue-600">
                                <IconTruck className="h-3.5 w-3.5" />
                                {po.trackingNumber}
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
        {!isLoading && pos.length > 0 && (
          <Typography variant="bodyXs" colorRole="muted" className="text-center">
            Showing {pos.length} of {allPOs.length} orders
          </Typography>
        )}
      </div>
    </div>
  );
};

export default PartnerOrdersPage;
