'use client';

import {
  IconAlertTriangle,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFileInvoice,
  IconGitCompare,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { logisticsQuoteStatus } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type QuoteStatus = (typeof logisticsQuoteStatus.enumValues)[number];

const statusOptions: { value: QuoteStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

const statusBadgeVariants: Record<QuoteStatus, 'default' | 'warning' | 'success' | 'error' | 'secondary'> = {
  draft: 'secondary',
  pending: 'warning',
  accepted: 'success',
  rejected: 'error',
  expired: 'default',
};

const statusIcons: Record<QuoteStatus, typeof IconClock> = {
  draft: IconFileInvoice,
  pending: IconClock,
  accepted: IconCheck,
  rejected: IconX,
  expired: IconAlertTriangle,
};

const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Freight Quotes list page
 */
const QuotesListPage = () => {
  const api = useTRPC();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);

  const shipmentId = searchParams.get('shipmentId') || undefined;

  const { data, isLoading, refetch, isFetching } = useQuery({
    ...api.logistics.admin.quotes.getMany.queryOptions({
      limit: 50,
      search: searchQuery || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      shipmentId,
    }),
  });

  const quotes = data?.data ?? [];
  const totalCount = data?.meta.totalCount ?? 0;

  const toggleQuoteSelection = (quoteId: string) => {
    setSelectedQuotes((prev) =>
      prev.includes(quoteId) ? prev.filter((id) => id !== quoteId) : [...prev, quoteId],
    );
  };

  const canCompare = selectedQuotes.length >= 2 && selectedQuotes.length <= 5;

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
              <span>Quotes</span>
            </div>
            <Typography variant="headingLg" className="mb-2">
              Freight Quotes
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Compare and manage forwarder quotes
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            {selectedQuotes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={!canCompare}
                asChild={canCompare}
              >
                {canCompare ? (
                  <Link
                    href={`/platform/admin/logistics/quotes/compare?ids=${selectedQuotes.join(',')}`}
                  >
                    <ButtonContent iconLeft={IconGitCompare}>
                      Compare ({selectedQuotes.length})
                    </ButtonContent>
                  </Link>
                ) : (
                  <ButtonContent iconLeft={IconGitCompare}>
                    Compare ({selectedQuotes.length})
                  </ButtonContent>
                )}
              </Button>
            )}
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
              <Link href="/platform/admin/logistics/quotes/new">
                <ButtonContent iconLeft={IconPlus}>New Quote</ButtonContent>
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
                  placeholder="Search by quote number, forwarder, or route..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as QuoteStatus | 'all')}
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
            </div>
            <div className="flex items-center justify-between mt-3">
              <Typography variant="bodySm" className="text-text-muted">
                {isLoading ? 'Loading...' : `${totalCount} quotes found`}
              </Typography>
              {selectedQuotes.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedQuotes([])}
                  className="text-sm"
                >
                  Clear selection
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Compare hint */}
        {selectedQuotes.length > 0 && selectedQuotes.length < 2 && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            <IconGitCompare className="h-4 w-4" />
            <Typography variant="bodySm">
              Select at least 2 quotes to compare them side-by-side
            </Typography>
          </div>
        )}

        {/* Quotes List */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
            </CardContent>
          </Card>
        ) : quotes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon icon={IconFileInvoice} size="xl" className="mx-auto mb-4 text-text-muted" />
              <Typography variant="headingSm" className="mb-2">
                No Quotes Found
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                {searchQuery || statusFilter !== 'all'
                  ? 'No quotes match your filters. Try adjusting your search.'
                  : 'No quotes have been created yet.'}
              </Typography>
              <Button className="mt-4" asChild>
                <Link href="/platform/admin/logistics/quotes/new">
                  <ButtonContent iconLeft={IconPlus}>Create First Quote</ButtonContent>
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {quotes.map((quote) => {
              const StatusIcon = statusIcons[quote.status];
              const isSelected = selectedQuotes.includes(quote.id);
              const isExpiringSoon =
                quote.status === 'pending' &&
                quote.validUntil &&
                new Date(quote.validUntil) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

              return (
                <div
                  key={quote.id}
                  className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                    isSelected ? 'border-border-brand bg-surface-secondary' : 'border-border-primary bg-surface-primary hover:border-border-brand'
                  }`}
                >
                  <div className="flex items-center pt-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleQuoteSelection(quote.id)}
                      aria-label={`Select ${quote.quoteNumber}`}
                    />
                  </div>
                  <Link
                    href={`/platform/admin/logistics/quotes/${quote.id}`}
                    className="flex flex-1 items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Typography variant="bodySm" className="font-mono text-text-muted">
                          {quote.quoteNumber}
                        </Typography>
                        <Badge variant={statusBadgeVariants[quote.status]}>
                          <Icon icon={StatusIcon} size="xs" className="mr-1" />
                          {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                        </Badge>
                        {isExpiringSoon && (
                          <Badge variant="warning">
                            <IconAlertTriangle className="h-3 w-3 mr-1" />
                            Expiring soon
                          </Badge>
                        )}
                      </div>
                      <Typography variant="headingSm" className="truncate mb-1">
                        {quote.forwarderName}
                      </Typography>
                      <Typography variant="bodySm" colorRole="muted">
                        {quote.originCity || quote.originCountry || 'Origin'} →{' '}
                        {quote.destinationCity || quote.destinationCountry || 'Destination'}
                        {quote.transportMode && ` · ${quote.transportMode.replace('_', ' ')}`}
                      </Typography>
                      {quote.shipment && (
                        <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                          Shipment: {quote.shipment.shipmentNumber}
                        </Typography>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-sm text-text-muted">
                      <div className="text-right">
                        <Typography variant="headingSm">
                          {formatCurrency(quote.totalPrice, quote.currency)}
                        </Typography>
                        {quote.transitDays && (
                          <Typography variant="bodyXs" colorRole="muted">
                            {quote.transitDays} days transit
                          </Typography>
                        )}
                      </div>
                      <div className="hidden md:block text-right">
                        {quote.validUntil && (
                          <>
                            <Typography variant="bodyXs" colorRole="muted">
                              Valid until
                            </Typography>
                            <Typography variant="bodySm">
                              {formatDate(quote.validUntil)}
                            </Typography>
                          </>
                        )}
                      </div>
                      <div className="hidden lg:block text-right text-xs">
                        {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                      </div>
                      <IconChevronRight className="h-5 w-5 shrink-0" />
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuotesListPage;
