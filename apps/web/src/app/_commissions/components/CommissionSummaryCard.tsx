'use client';

import {
  IconChevronDown,
  IconChevronUp,
  IconCoin,
  IconExternalLink,
  IconGift,
  IconInfoCircle,
  IconReceipt,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

import CommissionDetailsDialog from './CommissionDetailsDialog';

/**
 * Compact inline commission indicator for B2C users
 *
 * Displays pending payout amount with expandable info section
 * explaining how commissions work.
 */
const CommissionSummaryCard = () => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
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
      <div className="mb-4 w-fit">
        {/* Main pill button */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsDetailsOpen(true)}
            className="inline-flex items-center gap-2 rounded-l-full border border-r-0 border-amber-200 bg-amber-50 py-1.5 pl-3 pr-2 text-xs transition-all hover:bg-amber-100 dark:border-amber-800/50 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
          >
            <IconCoin size={14} className="text-amber-600 dark:text-amber-500" />
            {paidOut > 0 ? (
              <span className="text-amber-800 dark:text-amber-300">
                <span className="font-medium">{formatPrice(pendingPayout, 'USD')}</span>
                <span className="mx-1 text-amber-600/60 dark:text-amber-500/60">pending</span>
                <span className="text-amber-600/60 dark:text-amber-500/60">·</span>
                <span className="ml-1 text-green-700 dark:text-green-400">
                  {formatPrice(paidOut, 'USD')} paid
                </span>
              </span>
            ) : (
              <span className="text-amber-800 dark:text-amber-300">
                <span className="font-medium">{formatPrice(pendingPayout, 'USD')}</span>
                <span className="ml-1 text-amber-600/80 dark:text-amber-500/80">
                  commission pending
                </span>
              </span>
            )}
            <IconExternalLink size={12} className="text-amber-500 dark:text-amber-600" />
          </button>

          <button
            onClick={() => setIsInfoExpanded(!isInfoExpanded)}
            className="inline-flex items-center gap-1 rounded-r-full border border-amber-200 bg-amber-50 py-1.5 pl-2 pr-3 text-xs text-amber-700 transition-all hover:bg-amber-100 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
            aria-expanded={isInfoExpanded}
          >
            <IconInfoCircle size={14} />
            {isInfoExpanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
          </button>
        </div>

        {/* Expandable info panel */}
        {isInfoExpanded && (
          <div className="mt-2 max-w-sm rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs dark:border-amber-800/50 dark:bg-amber-900/10">
            <h4 className="mb-2 flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
              <IconGift size={14} />
              How Commission Works
            </h4>

            <div className="space-y-2 text-amber-800 dark:text-amber-300/90">
              <div className="flex gap-2">
                <IconReceipt size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <p>
                  <span className="font-medium">Earn 5%</span> of the ex-works value on every order
                  you place through the platform.
                </p>
              </div>

              <div className="flex gap-2">
                <IconTruck size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <p>
                  Commission becomes <span className="font-medium">payable</span> once your order is
                  delivered and confirmed.
                </p>
              </div>

              <div className="flex gap-2">
                <IconCoin size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <p>
                  Add your <span className="font-medium">bank details</span> in Settings to receive
                  payouts directly to your account.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsDetailsOpen(true)}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-md bg-amber-200/50 px-2 py-1.5 font-medium text-amber-900 transition-colors hover:bg-amber-200 dark:bg-amber-800/30 dark:text-amber-200 dark:hover:bg-amber-800/50"
            >
              View Commission History
              <IconExternalLink size={12} />
            </button>
          </div>
        )}
      </div>

      <CommissionDetailsDialog isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} />
    </>
  );
};

export default CommissionSummaryCard;
