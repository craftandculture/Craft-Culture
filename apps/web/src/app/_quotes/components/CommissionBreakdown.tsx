'use client';

import { IconChevronDown } from '@tabler/icons-react';
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
    <div className="rounded-lg border border-border-muted bg-fill-muted">
      {/* Accordion Header - Collapsed by default */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-3 transition-colors hover:bg-fill-secondary"
      >
        <div className="flex items-center gap-2">
          <Typography variant="bodyMd" className="font-medium">
            Sales Commission
          </Typography>
          <CommissionInfoTooltip />
        </div>
        <div className="flex items-center gap-3">
          <Typography variant="bodyMd" className="font-semibold">
            {formatPrice(totalCommission, currency)}
          </Typography>
          <IconChevronDown
            className={`h-4 w-4 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Accordion Content - Per-line breakdown */}
      {isExpanded && (
        <div className="border-t border-border-muted p-3 pt-4">
          <Typography
            variant="bodyXs"
            colorRole="muted"
            className="mb-3 font-medium uppercase"
          >
            Commission Breakdown
          </Typography>

          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <div key={index} className="space-y-1">
                <Typography variant="bodySm" className="font-medium">
                  {item.productName}
                </Typography>
                <div className="flex justify-between">
                  <Typography variant="bodyXs" colorRole="muted">
                    {item.quantity} {item.quantity === 1 ? 'case' : 'cases'} ×{' '}
                    {formatPrice(item.commissionPerCase, currency)}
                  </Typography>
                  <Typography variant="bodyXs" className="font-medium">
                    {formatPrice(item.lineCommission, currency)}
                  </Typography>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-border-muted pt-3">
            <div className="flex justify-between">
              <Typography variant="bodySm" className="font-semibold">
                Total Commission
              </Typography>
              <Typography variant="bodySm" className="font-semibold">
                {formatPrice(totalCommission, currency)}
              </Typography>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionBreakdown;
