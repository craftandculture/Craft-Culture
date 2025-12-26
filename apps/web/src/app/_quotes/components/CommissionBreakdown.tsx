'use client';

import { IconChevronDown, IconCoins } from '@tabler/icons-react';
import { useState } from 'react';

import Typography from '@/app/_ui/components/Typography/Typography';
import formatPrice from '@/utils/formatPrice';

import CommissionInfoTooltip from './CommissionInfoTooltip';

interface CommissionLineItem {
  productName: string;
  quantity: number;
  commissionPerCase: number;
  lineCommission: number;
}

export interface CommissionBreakdownProps {
  lineItems: CommissionLineItem[];
  totalCommission: number;
  currency: 'USD' | 'AED';
}

/**
 * Collapsible accordion showing sales commission breakdown
 * Commission is extracted from the total, not added on top
 *
 * @example
 *   <CommissionBreakdown
 *     lineItems={[{ productName: 'Wine', quantity: 1, commissionPerCase: 84.15, lineCommission: 84.15 }]}
 *     totalCommission={84.15}
 *     currency="USD"
 *   />
 */
const CommissionBreakdown = ({
  lineItems,
  totalCommission,
  currency,
}: CommissionBreakdownProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-teal-950/30">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 sm:px-5 sm:py-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20">
            <IconCoins className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <div className="flex items-center gap-1.5">
              <Typography
                variant="bodySm"
                className="font-semibold text-emerald-900 dark:text-emerald-100 sm:text-base"
              >
                Your Earnings
              </Typography>
              <CommissionInfoTooltip />
            </div>
            <Typography
              variant="bodyXs"
              className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 sm:text-xs"
            >
              Tap to see breakdown
            </Typography>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Typography
            variant="bodySm"
            className="text-lg font-bold text-emerald-700 dark:text-emerald-300 sm:text-xl"
          >
            {formatPrice(totalCommission, currency)}
          </Typography>
          <IconChevronDown
            className={`h-4 w-4 text-emerald-500 transition-transform sm:h-5 sm:w-5 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Accordion Content - Per-line breakdown */}
      {isExpanded && (
        <div className="border-t border-emerald-200/50 bg-white/50 px-4 py-4 dark:border-emerald-800/30 dark:bg-black/10 sm:px-5 sm:py-5">
          {/* Product breakdown */}
          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="flex items-start justify-between gap-3 rounded-lg bg-emerald-50/50 px-3 py-2.5 dark:bg-emerald-900/10"
              >
                <div className="min-w-0 flex-1">
                  <Typography
                    variant="bodyXs"
                    className="truncate text-xs font-medium text-emerald-900 dark:text-emerald-100 sm:text-sm"
                  >
                    {item.productName}
                  </Typography>
                  <Typography
                    variant="bodyXs"
                    className="mt-0.5 text-[11px] text-emerald-600/70 dark:text-emerald-400/60 sm:text-xs"
                  >
                    {item.quantity} {item.quantity === 1 ? 'case' : 'cases'} ×{' '}
                    {formatPrice(item.commissionPerCase, currency)}
                  </Typography>
                </div>
                <Typography
                  variant="bodyXs"
                  className="shrink-0 tabular-nums text-sm font-semibold text-emerald-700 dark:text-emerald-300 sm:text-base"
                >
                  {formatPrice(item.lineCommission, currency)}
                </Typography>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-4 flex items-center justify-between border-t border-emerald-200/50 pt-4 dark:border-emerald-800/30">
            <Typography
              variant="bodySm"
              className="font-medium text-emerald-800 dark:text-emerald-200"
            >
              Total Earnings
            </Typography>
            <Typography
              variant="bodySm"
              className="tabular-nums text-lg font-bold text-emerald-700 dark:text-emerald-300 sm:text-xl"
            >
              {formatPrice(totalCommission, currency)}
            </Typography>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionBreakdown;
