'use client';

import { IconChevronRight, IconCoin, IconLoader2 } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

import CommissionDetailsDialog from './CommissionDetailsDialog';

/**
 * Card showing B2C user's commission summary
 *
 * Displays total earned, pending payout, and paid out amounts.
 * Only visible to B2C users who earn commission.
 */
const CommissionSummaryCard = () => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const api = useTRPC();

  const { data, isLoading, error } = useQuery({
    ...api.commissions.getSummary.queryOptions(),
    staleTime: 30000, // 30 seconds
  });

  // Don't render if not B2C or loading
  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center justify-center py-8">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" />
        </CardContent>
      </Card>
    );
  }

  // Don't render for non-B2C users or if there's an error
  if (error || !data?.isB2C) {
    return null;
  }

  const { totalEarned, pendingPayout, paidOut } = data;

  // Don't show if no commission activity
  if (totalEarned === 0 && pendingPayout === 0 && paidOut === 0) {
    return null;
  }

  return (
    <>
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fill-brand/10">
                <Icon icon={IconCoin} className="text-fill-brand" size="md" />
              </div>
              <div>
                <Typography variant="h4" className="font-semibold">
                  Commission Summary
                </Typography>
                <Typography variant="bodySm" className="text-text-muted">
                  Your earnings from completed orders
                </Typography>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            {/* Total Earned */}
            <div className="rounded-lg bg-surface-muted p-4">
              <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide">
                Total Earned
              </Typography>
              <Typography variant="h3" className="mt-1 font-bold text-fill-brand">
                {formatPrice(totalEarned, 'USD')}
              </Typography>
            </div>

            {/* Pending Payout */}
            <div className="rounded-lg bg-surface-muted p-4">
              <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide">
                Pending Payout
              </Typography>
              <Typography variant="h3" className="mt-1 font-bold text-amber-600">
                {formatPrice(pendingPayout, 'USD')}
              </Typography>
            </div>

            {/* Paid Out */}
            <div className="rounded-lg bg-surface-muted p-4">
              <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide">
                Paid Out
              </Typography>
              <Typography variant="h3" className="mt-1 font-bold text-green-600">
                {formatPrice(paidOut, 'USD')}
              </Typography>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDetailsOpen(true)}
            >
              <ButtonContent iconRight={IconChevronRight}>
                View Details
              </ButtonContent>
            </Button>
          </div>
        </CardContent>
      </Card>

      <CommissionDetailsDialog
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    </>
  );
};

export default CommissionSummaryCard;
