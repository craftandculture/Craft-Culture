'use client';

import {
  IconChevronRight,
  IconCurrencyDollar,
  IconPackage,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import CustomerPoStatusBadge from '@/app/_source/components/CustomerPoStatusBadge';
import ProfitIndicator from '@/app/_source/components/ProfitIndicator';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { sourceCustomerPoStatus } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type CustomerPoStatus = (typeof sourceCustomerPoStatus.enumValues)[number];

/**
 * Admin Customer PO list page
 */
const CustomerPosPage = () => {
  const api = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerPoStatus | 'all'>('all');

  const { data, isLoading } = useQuery({
    ...api.source.admin.customerPo.getMany.queryOptions({
      limit: 50,
      search: searchQuery || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
  });

  const customerPos = data?.items ?? [];

  const statusFilters: Array<{ label: string; value: CustomerPoStatus | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Matched', value: 'matched' },
    { label: 'Orders Generated', value: 'orders_generated' },
    { label: 'Awaiting', value: 'awaiting_confirmations' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Closed', value: 'closed' },
  ];

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Typography variant="headingLg" className="mb-2">
              Customer POs
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Manage customer purchase orders and track profit margins
            </Typography>
          </div>
          <Link href="/platform/admin/source/customer-pos/new">
            <Button variant="default" colorRole="brand">
              <ButtonContent iconLeft={IconPlus}>New Customer PO</ButtonContent>
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
                placeholder="Search by PO number, customer name, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background-primary border-border-primary text-text-primary placeholder:text-text-muted w-full rounded-lg border px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Typography variant="bodySm" className="text-text-muted">
              {isLoading ? 'Loading...' : `${data?.total ?? 0} Customer POs found`}
            </Typography>
          </CardContent>
        </Card>

        {/* Customer PO List */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <Typography variant="bodyMd" className="text-text-muted text-center">
                Loading Customer POs...
              </Typography>
            </CardContent>
          </Card>
        ) : customerPos.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <IconSearch className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <Typography variant="bodyMd" className="text-text-muted">
                No Customer POs found. Create a new Customer PO to get started.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {customerPos.map((po) => (
              <Link
                key={po.id}
                href={`/platform/admin/source/customer-pos/${po.id}`}
                className="block"
              >
                <Card className="hover:border-border-brand transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <Typography variant="bodySm" className="font-mono text-text-muted">
                            {po.ccPoNumber}
                          </Typography>
                          <CustomerPoStatusBadge status={po.status} />
                          {po.losingItemCount && po.losingItemCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded bg-fill-danger/10 text-text-danger">
                              {po.losingItemCount} losing
                            </span>
                          )}
                        </div>
                        <Typography variant="headingSm" className="truncate">
                          {po.customerCompany || po.customerName}
                        </Typography>
                        <Typography variant="bodySm" colorRole="muted">
                          Customer PO: {po.poNumber}
                          {po.rfqNumber && ` • RFQ: ${po.rfqNumber}`}
                        </Typography>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-6 text-sm">
                        {/* Stats */}
                        <div className="hidden sm:flex items-center gap-4 text-text-muted">
                          <div className="flex items-center gap-1.5">
                            <IconPackage className="h-4 w-4" />
                            <span>{po.itemCount} items</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <IconCurrencyDollar className="h-4 w-4" />
                            <span>{formatCurrency(po.totalSellPriceUsd)}</span>
                          </div>
                          <ProfitIndicator
                            profitUsd={po.totalProfitUsd}
                            profitMarginPercent={po.profitMarginPercent}
                            size="sm"
                          />
                        </div>

                        {/* Mobile stats */}
                        <div className="flex sm:hidden items-center gap-2 text-text-muted text-xs">
                          <span>{po.itemCount} items</span>
                          <span>·</span>
                          <span>{formatCurrency(po.totalSellPriceUsd)}</span>
                        </div>

                        <div className="text-right text-text-muted text-xs hidden md:block">
                          {formatDistanceToNow(new Date(po.createdAt), { addSuffix: true })}
                        </div>

                        <IconChevronRight className="h-5 w-5 text-text-muted shrink-0" />
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

export default CustomerPosPage;
