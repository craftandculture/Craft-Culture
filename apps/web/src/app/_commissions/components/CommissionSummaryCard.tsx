'use client';

import { IconChevronRight, IconCoin } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Banner from '@/app/_ui/components/Banner/Banner';
import BannerContent from '@/app/_ui/components/Banner/BannerContent';
import Button from '@/app/_ui/components/Button/Button';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

import CommissionDetailsDialog from './CommissionDetailsDialog';

/**
 * Commission summary banner for B2C users
 *
 * Displays pending payout amount with link to view details.
 * Uses platform design system for consistent UI.
 */
const CommissionSummaryCard = () => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const api = useTRPC();

  const { data, isLoading, error } = useQuery({
    ...api.commissions.getSummary.queryOptions(),
    staleTime: 30000,
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
      <div className="mb-4">
        <Banner colorRole="success" size="sm" className="inline-flex">
          <BannerContent className="flex-wrap gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <IconCoin size={16} className="shrink-0" />
              <span className="text-sm font-medium">Commission Earned</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {paidOut > 0 ? (
                <>
                  <span>
                    <span className="font-semibold">{formatPrice(pendingPayout, 'USD')}</span>
                    <span className="ml-1 opacity-75">pending</span>
                  </span>
                  <span className="hidden sm:inline opacity-50">•</span>
                  <span>
                    <span className="font-semibold">{formatPrice(paidOut, 'USD')}</span>
                    <span className="ml-1 opacity-75">paid</span>
                  </span>
                </>
              ) : (
                <span>
                  <span className="font-semibold">{formatPrice(pendingPayout, 'USD')}</span>
                  <span className="ml-1 opacity-75">pending payout</span>
                </span>
              )}
            </div>

            <Button
              type="button"
              colorRole="primary"
              variant="outline"
              size="xs"
              onClick={() => setIsDetailsOpen(true)}
              className="ml-auto"
            >
              View Details
              <IconChevronRight size={14} className="ml-1" />
            </Button>
          </BannerContent>
        </Banner>
      </div>

      <CommissionDetailsDialog isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} />
    </>
  );
};

export default CommissionSummaryCard;
