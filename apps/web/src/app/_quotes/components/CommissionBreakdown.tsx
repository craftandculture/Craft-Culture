'use client';

import { IconCalculator, IconChevronDown } from '@tabler/icons-react';
import { useState } from 'react';

import Divider from '@/app/_ui/components/Divider/Divider';
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
    <div className="rounded-lg border border-border-muted bg-fill-muted/50">
      {/* Accordion Header - Collapsed by default */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-fill-muted sm:p-3"
      >
        <div className="flex items-center gap-2 sm:gap-2.5">
          <IconCalculator className="h-4 w-4 text-text-muted sm:h-5 sm:w-5" />
          <div className="flex flex-col items-start gap-0.5">
            <div className="flex items-center gap-1.5">
              <Typography variant="bodySm" className="sm:text-base">
                Your Commission
              </Typography>
              <CommissionInfoTooltip />
            </div>
            <Typography
              variant="bodyXs"
              colorRole="muted"
              className="text-[10px] sm:text-xs"
            >
              Breakdown by product
            </Typography>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Typography variant="bodySm" className="sm:text-base">
            {formatPrice(totalCommission, currency)}
          </Typography>
          <IconChevronDown
            className={`h-3.5 w-3.5 text-text-muted transition-transform sm:h-4 sm:w-4 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Accordion Content - Per-line breakdown */}
      {isExpanded && (
        <div className="border-t border-border-muted px-3 py-4 sm:p-5">
          {/* Description */}
          <div className="mb-5 rounded-lg border border-border-muted bg-fill-muted/30 px-3 py-2.5 sm:px-4 sm:py-3">
            <Typography variant="bodyXs" colorRole="muted" className="text-xs leading-relaxed sm:text-sm">
              Your earnings breakdown from this quote. Commission is included in the quoted prices
              and calculated based on your role and product margins.
            </Typography>
          </div>

          <Typography
            variant="bodyXs"
            colorRole="muted"
            className="mb-2.5 text-[10px] uppercase tracking-wide sm:mb-3 sm:text-xs"
          >
            By product
          </Typography>

          <div className="space-y-3 sm:space-y-3.5">
            {lineItems.map((item, index) => (
              <div key={index} className="space-y-1 sm:space-y-1.5">
                <Typography variant="bodyXs" className="text-xs font-medium sm:text-sm">
                  {item.productName}
                </Typography>
                <div className="flex items-baseline justify-between gap-2">
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="text-[11px] sm:text-xs"
                  >
                    {item.quantity} {item.quantity === 1 ? 'case' : 'cases'} ×{' '}
                    {formatPrice(item.commissionPerCase, currency)}
                  </Typography>
                  <Typography
                    variant="bodyXs"
                    className="tabular-nums text-xs sm:text-sm"
                  >
                    {formatPrice(item.lineCommission, currency)}
                  </Typography>
                </div>
              </div>
            ))}
          </div>

          <Divider className="my-4 sm:my-5" />

          <div className="flex items-baseline justify-between">
            <Typography variant="bodySm" className="text-sm sm:text-base">
              Total Commission
            </Typography>
            <Typography variant="bodySm" className="tabular-nums text-base font-medium sm:text-lg">
              {formatPrice(totalCommission, currency)}
            </Typography>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionBreakdown;
