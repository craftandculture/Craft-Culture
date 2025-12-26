'use client';

import { IconChevronRight, IconCoin } from '@tabler/icons-react';
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
 * Commission summary card for B2C users
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
      <Card className="mb-4 bg-surface-success">
        <CardContent className="py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left side - Icon and label */}
            <div className="flex items-center gap-3">
              <Icon icon={IconCoin} size="md" colorRole="success" />
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
                <Typography variant="bodySm" className="font-medium text-text-success">
                  Commission Earned
                </Typography>
                <div className="flex items-center gap-3 text-sm">
                  {paidOut > 0 ? (
                    <>
                      <span className="text-text-success">
                        <span className="font-semibold">{formatPrice(pendingPayout, 'USD')}</span>
                        <span className="ml-1 opacity-75">pending</span>
                      </span>
                      <span className="text-text-success opacity-50">•</span>
                      <span className="text-text-success">
                        <span className="font-semibold">{formatPrice(paidOut, 'USD')}</span>
                        <span className="ml-1 opacity-75">paid</span>
                      </span>
                    </>
                  ) : (
                    <span className="text-text-success">
                      <span className="font-semibold">{formatPrice(pendingPayout, 'USD')}</span>
                      <span className="ml-1 opacity-75">pending</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right side - Button */}
            <Button
              type="button"
              colorRole="primary"
              variant="outline"
              size="sm"
              onClick={() => setIsDetailsOpen(true)}
            >
              <ButtonContent iconRight={IconChevronRight}>View Details</ButtonContent>
            </Button>
          </div>
        </CardContent>
      </Card>

      <CommissionDetailsDialog isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} />
    </>
  );
};

export default CommissionSummaryCard;
