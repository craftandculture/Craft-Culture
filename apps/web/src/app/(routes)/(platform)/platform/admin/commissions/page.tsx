'use client';

import { IconCheck, IconCoin, IconLoader2 } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

/**
 * Admin page for managing B2C commission payouts
 *
 * Features:
 * - View all pending commission payouts
 * - Mark individual commissions as paid
 * - Track total pending payout amount
 */
const CommissionsPage = () => {
  const api = useTRPC();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch pending commissions
  const { data, isLoading, refetch } = useQuery({
    ...api.commissions.getPending.queryOptions({ limit: 100 }),
    staleTime: 30000,
  });

  // Mark as paid mutation
  const { mutate: markPaid, isPending } = useMutation(
    api.commissions.markPaid.mutationOptions({
      onSuccess: () => {
        setProcessingId(null);
        void refetch();
      },
      onError: () => {
        setProcessingId(null);
      },
    }),
  );

  const pendingPayouts = data?.data ?? [];

  // Calculate totals
  const totalPending = pendingPayouts.reduce((sum, item) => sum + item.commissionAmount, 0);
  const uniqueUsers = new Set(pendingPayouts.map((p) => p.user?.id).filter(Boolean)).size;

  const handleMarkPaid = (quoteId: string) => {
    setProcessingId(quoteId);
    markPaid({ quoteId });
  };

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
        <div className="mb-6 sm:mb-8">
          <Typography variant="headingLg" className="mb-2">
            Commission Payouts
          </Typography>
          <Typography variant="bodyMd" colorRole="muted">
            Manage B2C sales person commission payments
          </Typography>
        </div>

        {/* Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Icon icon={IconCoin} size="md" className="text-amber-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                    Total Pending
                  </Typography>
                  <Typography variant="headingMd" className="text-amber-600">
                    {formatPrice(totalPending, 'USD')}
                  </Typography>
                </div>
              </div>

              <div className="h-10 w-px bg-border-muted" />

              <div>
                <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                  Pending Payouts
                </Typography>
                <Typography variant="headingMd">{pendingPayouts.length}</Typography>
              </div>

              <div className="h-10 w-px bg-border-muted" />

              <div>
                <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                  Sales People
                </Typography>
                <Typography variant="headingMd">{uniqueUsers}</Typography>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Payouts Table */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
            </CardContent>
          </Card>
        ) : pendingPayouts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon icon={IconCheck} size="xl" className="mx-auto mb-4 text-green-600" />
              <Typography variant="headingSm" className="mb-2">
                All Caught Up!
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                No pending commission payouts at this time.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead className="border-b border-border-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Sales Person
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Order
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Order Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Commission
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Delivered
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted">
                    {pendingPayouts.map((item) => (
                      <tr key={item.quoteId} className="hover:bg-surface-muted">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <Typography variant="bodySm" className="font-medium">
                              {item.user?.name || 'Unknown'}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {item.user?.email || '-'}
                            </Typography>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Typography variant="bodySm">{item.quoteName}</Typography>
                        </td>
                        <td className="px-6 py-4">
                          <Typography variant="bodySm">
                            {formatPrice(item.orderTotal, 'USD')}
                          </Typography>
                        </td>
                        <td className="px-6 py-4">
                          <Typography variant="bodySm" className="font-semibold text-fill-brand">
                            {formatPrice(item.commissionAmount, 'USD')}
                          </Typography>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              item.status === 'delivered'
                                ? 'border border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}
                          >
                            {item.status === 'delivered' ? 'Delivered' : 'In Progress'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Typography variant="bodySm" colorRole="muted">
                            {item.status === 'delivered' ? formatDate(item.paidAt) : '-'}
                          </Typography>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            variant="default"
                            colorRole="brand"
                            onClick={() => handleMarkPaid(item.quoteId)}
                            isDisabled={isPending && processingId === item.quoteId}
                          >
                            <ButtonContent iconLeft={IconCheck}>
                              {isPending && processingId === item.quoteId ? 'Processing...' : 'Mark Paid'}
                            </ButtonContent>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="divide-y divide-border-muted md:hidden">
                {pendingPayouts.map((item) => (
                  <div key={item.quoteId} className="space-y-3 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <Typography variant="bodySm" className="font-medium">
                          {item.user?.name || 'Unknown'}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {item.quoteName}
                        </Typography>
                      </div>
                      <Typography variant="bodySm" className="font-semibold text-fill-brand">
                        {formatPrice(item.commissionAmount, 'USD')}
                      </Typography>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Typography variant="bodyXs" colorRole="muted">
                          Order: {formatPrice(item.orderTotal, 'USD')}
                        </Typography>
                        <span className="text-text-muted">|</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.status === 'delivered'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}
                        >
                          {item.status === 'delivered' ? 'Delivered' : 'In Progress'}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="default"
                      colorRole="brand"
                      onClick={() => handleMarkPaid(item.quoteId)}
                      isDisabled={isPending && processingId === item.quoteId}
                      className="w-full"
                    >
                      <ButtonContent iconLeft={IconCheck}>
                        {isPending && processingId === item.quoteId ? 'Processing...' : 'Mark Paid'}
                      </ButtonContent>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CommissionsPage;
