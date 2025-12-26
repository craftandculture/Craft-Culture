'use client';

import { IconChevronRight, IconCoin } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

import CommissionDetailsDialog from './CommissionDetailsDialog';

/**
 * Compact banner showing B2C user's commission summary
 *
 * Displays earned, pending, and paid amounts in a subtle horizontal bar.
 * Only visible to B2C users who have commission activity.
 */
const CommissionSummaryCard = () => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const api = useTRPC();

  const { data, isLoading, error } = useQuery({
    ...api.commissions.getSummary.queryOptions(),
    staleTime: 30000,
  });

  // Don't render while loading (no loading state to keep it unobtrusive)
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
      <div className="mb-4 flex items-center justify-between rounded-lg border border-border-muted bg-surface-muted/50 px-4 py-2.5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <IconCoin size={16} className="text-fill-brand" />
            <span className="text-xs font-medium text-text-muted">Commission</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {paidOut > 0 ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted">Total Earned:</span>
                  <span className="font-semibold text-fill-brand">
                    {formatPrice(totalEarned, 'USD')}
                  </span>
                </div>
                {pendingPayout > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted">Pending:</span>
                    <span className="font-semibold text-amber-600">
                      {formatPrice(pendingPayout, 'USD')}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted">Paid:</span>
                  <span className="font-semibold text-green-600">
                    {formatPrice(paidOut, 'USD')}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted">Pending Payout:</span>
                <span className="font-semibold text-amber-600">
                  {formatPrice(pendingPayout, 'USD')}
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsDetailsOpen(true)}
          className="flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          Details
          <IconChevronRight size={14} />
        </button>
      </div>

      <CommissionDetailsDialog
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    </>
  );
};

export default CommissionSummaryCard;
