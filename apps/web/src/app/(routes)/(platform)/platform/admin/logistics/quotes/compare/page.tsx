'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconCurrencyDollar,
  IconLoader2,
  IconTrophy,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const formatCurrency = (amount: number | null, currency = 'USD') => {
  if (amount === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: Date | null | undefined) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Quote comparison page - compare 2-5 quotes side by side
 */
const QuoteComparePage = () => {
  const searchParams = useSearchParams();
  const api = useTRPC();

  const idsParam = searchParams.get('ids') || '';
  const quoteIds = idsParam.split(',').filter((id) => id.length > 0);

  const { data, isLoading, error } = useQuery({
    ...api.logistics.admin.quotes.compare.queryOptions({ quoteIds }),
    enabled: quoteIds.length >= 2,
  });

  if (quoteIds.length < 2) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Icon icon={IconCurrencyDollar} size="xl" className="mx-auto mb-4 text-text-muted" />
            <Typography variant="headingSm" className="mb-2">
              Select Quotes to Compare
            </Typography>
            <Typography variant="bodyMd" colorRole="muted" className="mb-4">
              You need to select at least 2 quotes (up to 5) to compare them side-by-side.
            </Typography>
            <Button asChild>
              <Link href="/platform/admin/logistics/quotes">Back to Quotes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Typography variant="headingSm" className="mb-2 text-red-600">
              Error Loading Quotes
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              {error?.message || 'Failed to load quotes for comparison'}
            </Typography>
            <Button className="mt-4" asChild>
              <Link href="/platform/admin/logistics/quotes">Back to Quotes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { quotes, comparison, categoryComparison } = data;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/platform/admin/logistics/quotes">
              <Icon icon={IconArrowLeft} size="sm" />
            </Link>
          </Button>
          <div>
            <Typography variant="headingLg">Compare Quotes</Typography>
            <Typography variant="bodySm" colorRole="muted">
              Comparing {quotes.length} freight quotes side-by-side
            </Typography>
          </div>
        </div>

        {/* Quick Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Icon icon={IconCurrencyDollar} size="md" className="text-green-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Lowest Price
                  </Typography>
                  <Typography variant="headingSm" className="text-green-600">
                    {formatCurrency(comparison.lowestPrice)}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <Icon icon={IconCurrencyDollar} size="md" className="text-red-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Highest Price
                  </Typography>
                  <Typography variant="headingSm" className="text-red-600">
                    {formatCurrency(comparison.highestPrice)}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Icon icon={IconClock} size="md" className="text-blue-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Fastest Transit
                  </Typography>
                  <Typography variant="headingSm" className="text-blue-600">
                    {comparison.fastestTransit ? `${comparison.fastestTransit} days` : '-'}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Icon icon={IconCurrencyDollar} size="md" className="text-orange-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Price Difference
                  </Typography>
                  <Typography variant="headingSm" className="text-orange-600">
                    {formatCurrency(comparison.priceDifference)}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quote Cards */}
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className={`grid gap-4 grid-cols-${quotes.length}`} style={{ gridTemplateColumns: `repeat(${quotes.length}, minmax(280px, 1fr))` }}>
              {quotes.map((quote) => {
                const isLowestPrice = quote.id === comparison.lowestPriceQuoteId;
                const isFastest = quote.id === comparison.fastestQuoteId;

                return (
                  <Card
                    key={quote.id}
                    className={isLowestPrice ? 'border-green-500 ring-2 ring-green-500/20' : ''}
                  >
                    <div className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Typography variant="bodyXs" className="font-mono text-text-muted">
                            {quote.quoteNumber}
                          </Typography>
                          <CardTitle className="mt-1">{quote.forwarderName}</CardTitle>
                        </div>
                        <div className="flex flex-col gap-1">
                          {isLowestPrice && (
                            <Badge variant="success">
                              <IconTrophy className="h-3 w-3 mr-1" />
                              Best Price
                            </Badge>
                          )}
                          {isFastest && (
                            <Badge variant="default">
                              <IconClock className="h-3 w-3 mr-1" />
                              Fastest
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <CardContent className="space-y-4">
                      {/* Price */}
                      <div className="rounded-lg bg-surface-secondary p-4 text-center">
                        <Typography variant="bodyXs" colorRole="muted">
                          Total Price
                        </Typography>
                        <Typography
                          variant="headingLg"
                          className={isLowestPrice ? 'text-green-600' : ''}
                        >
                          {formatCurrency(quote.totalPrice, quote.currency)}
                        </Typography>
                        {isLowestPrice && quotes.length > 1 && (
                          <Typography variant="bodyXs" className="text-green-600 mt-1">
                            Save {formatCurrency(comparison.highestPrice - quote.totalPrice)}
                          </Typography>
                        )}
                      </div>

                      {/* Details */}
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Typography variant="bodySm" colorRole="muted">
                            Route
                          </Typography>
                          <Typography variant="bodySm" className="text-right">
                            {quote.originCity || quote.originCountry || '-'} →{' '}
                            {quote.destinationCity || quote.destinationCountry || '-'}
                          </Typography>
                        </div>
                        <div className="flex justify-between">
                          <Typography variant="bodySm" colorRole="muted">
                            Transport
                          </Typography>
                          <Typography variant="bodySm">
                            {quote.transportMode?.replace('_', ' ') || '-'}
                          </Typography>
                        </div>
                        <div className="flex justify-between">
                          <Typography variant="bodySm" colorRole="muted">
                            Transit Time
                          </Typography>
                          <Typography
                            variant="bodySm"
                            className={isFastest ? 'text-blue-600 font-medium' : ''}
                          >
                            {quote.transitDays ? `${quote.transitDays} days` : '-'}
                          </Typography>
                        </div>
                        <div className="flex justify-between">
                          <Typography variant="bodySm" colorRole="muted">
                            Valid Until
                          </Typography>
                          <Typography variant="bodySm">
                            {formatDate(quote.validUntil)}
                          </Typography>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t border-border-primary">
                        <Button variant="outline" size="sm" className="w-full" asChild>
                          <Link href={`/platform/admin/logistics/quotes/${quote.id}`}>
                            View Details
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Category Comparison */}
        {Object.keys(categoryComparison).length > 0 && (
          <Card>
            <div className="p-4 pb-0">
              <CardTitle>Cost Breakdown by Category</CardTitle>
            </div>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-secondary">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                        Category
                      </th>
                      {quotes.map((quote) => (
                        <th
                          key={quote.id}
                          className="px-4 py-3 text-right text-sm font-medium text-text-muted"
                        >
                          {quote.forwarderName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary">
                    {Object.entries(categoryComparison).map(([category, values]) => {
                      const amounts = values.map((v) => v.amount).filter((a): a is number => a !== null);
                      const lowestAmount = amounts.length > 0 ? Math.min(...amounts) : null;

                      return (
                        <tr key={category}>
                          <td className="px-4 py-3 text-sm font-medium">{category}</td>
                          {values.map((value) => (
                            <td
                              key={value.quoteId}
                              className={`px-4 py-3 text-sm text-right ${
                                value.amount !== null && value.amount === lowestAmount
                                  ? 'text-green-600 font-medium'
                                  : ''
                              }`}
                            >
                              {value.amount !== null ? formatCurrency(value.amount) : '-'}
                              {value.amount !== null && value.amount === lowestAmount && (
                                <IconCheck className="inline-block h-4 w-4 ml-1" />
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-surface-secondary font-medium">
                    <tr>
                      <td className="px-4 py-3 text-sm">Total</td>
                      {quotes.map((quote) => (
                        <td
                          key={quote.id}
                          className={`px-4 py-3 text-sm text-right ${
                            quote.id === comparison.lowestPriceQuoteId
                              ? 'text-green-600'
                              : ''
                          }`}
                        >
                          {formatCurrency(quote.totalPrice, quote.currency)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendation */}
        {comparison.lowestPriceQuoteId && (
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <IconTrophy className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm">Recommendation</Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {quotes.find((q) => q.id === comparison.lowestPriceQuoteId)?.forwarderName} offers
                    the best price at {formatCurrency(comparison.lowestPrice)}
                    {comparison.fastestQuoteId === comparison.lowestPriceQuoteId &&
                      ' and the fastest transit time'}
                    .
                  </Typography>
                </div>
                <Button asChild>
                  <Link href={`/platform/admin/logistics/quotes/${comparison.lowestPriceQuoteId}`}>
                    View Quote
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default QuoteComparePage;
