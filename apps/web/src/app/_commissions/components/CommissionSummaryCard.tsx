'use client';

import { IconChevronRight, IconCoin } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

import CommissionDetailsDialog from './CommissionDetailsDialog';

/**
 * Commission summary card for B2C users
 *
 * Displays pending payout amount with link to view details.
 * Uses a subtle, professional design that doesn't overwhelm.
 */
const CommissionSummaryCard = () => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const api = useTRPC();

  const { data, isLoading, error } = useQuery({
    ...api.commissions.getSummary.queryOptions(),
    staleTime: 5000,
  });

  // Don't render while loading or on error
  if (isLoading || error || !data?.isB2C) {
    return null;
  }

  const { totalEarned, pendingPayout, paidOut } = data;

  // Don't show if no commission activity
  if (totalEarned === 0 && pendingPayout === 0 && paidOut === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border-muted bg-surface-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side - Icon and amounts */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <IconCoin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
            <Typography variant="bodySm" className="font-medium text-text-primary">
              Commission
            </Typography>
            <div className="flex items-center gap-2 text-sm">
              {pendingPayout > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {formatPrice(pendingPayout, 'USD')} pending
                </span>
              )}
              {paidOut > 0 && (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">
                  {formatPrice(paidOut, 'USD')} paid
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Button */}
        <Button
          type="button"
          colorRole="muted"
          variant="ghost"
          size="sm"
          onClick={() => setIsDetailsOpen(true)}
        >
          <ButtonContent iconRight={IconChevronRight}>Details</ButtonContent>
        </Button>
      </div>

      <CommissionDetailsDialog isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} />
    </>
  );
};

export default CommissionSummaryCard;
