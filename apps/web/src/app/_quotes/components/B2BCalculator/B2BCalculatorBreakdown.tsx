'use client';

import Divider from '@/app/_ui/components/Divider/Divider';
import Switch from '@/app/_ui/components/Switch/Switch';
import Typography from '@/app/_ui/components/Typography/Typography';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

import type { B2BCalculatorResult } from '../../utils/calculateB2BQuote';

export interface B2BCalculatorBreakdownProps {
  /** Calculated quote breakdown */
  calculatedQuote: B2BCalculatorResult;
  /** Display currency */
  currency: 'USD' | 'AED';
  /** Import tax percentage */
  importTaxPercent: number;
  /** Distributor margin percentage (if applicable) */
  distributorMarginPercent?: number;
  /** Currency toggle handler */
  onCurrencyToggle: (checked: boolean) => void;
}

/**
 * Displays B2B calculator pricing breakdown
 *
 * @example
 *   <B2BCalculatorBreakdown
 *     calculatedQuote={result}
 *     currency="USD"
 *   />
 */
const B2BCalculatorBreakdown = ({
  calculatedQuote,
  currency,
  importTaxPercent,
  distributorMarginPercent,
  onCurrencyToggle,
}: B2BCalculatorBreakdownProps) => {
  // Convert values to display currency
  const convertValue = (usdValue: number) => {
    return currency === 'AED' ? convertUsdToAed(usdValue) : usdValue;
  };

  return (
    <div className="flex flex-col space-y-3 rounded-lg border border-border-muted bg-fill-muted/50 p-4 sm:p-5">
      <Typography
        variant="bodySm"
        colorRole="muted"
        className="text-xs uppercase tracking-wide sm:text-sm"
      >
        Pricing breakdown
      </Typography>

      <div className="flex flex-col space-y-2.5">
        {/* In bond price */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodyXs" colorRole="muted" className="text-xs sm:text-sm">
            In Bond UAE Price
          </Typography>
          <Typography variant="bodyXs" className="tabular-nums text-xs sm:text-sm">
            {formatPrice(convertValue(calculatedQuote.inBondPrice), currency)}
          </Typography>
        </div>

        {/* Import tax */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodyXs" colorRole="muted" className="text-xs sm:text-sm">
            Import tax ({importTaxPercent}%)
          </Typography>
          <Typography variant="bodyXs" className="tabular-nums text-xs sm:text-sm">
            {formatPrice(convertValue(calculatedQuote.importTax), currency)}
          </Typography>
        </div>

        {/* Distributor margin */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodyXs" colorRole="muted" className="text-xs sm:text-sm">
            Distributor margin
            {distributorMarginPercent !== undefined && ` (${distributorMarginPercent}%)`}
          </Typography>
          <Typography variant="bodyXs" className="tabular-nums text-xs sm:text-sm">
            {formatPrice(convertValue(calculatedQuote.distributorMargin), currency)}
          </Typography>
        </div>

        {/* Transfer cost */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodyXs" colorRole="muted" className="text-xs sm:text-sm">
            Transfer cost
          </Typography>
          <Typography variant="bodyXs" className="tabular-nums text-xs sm:text-sm">
            {formatPrice(convertValue(calculatedQuote.transferCost), currency)}
          </Typography>
        </div>
      </div>

      <Divider />

      {/* Customer quote price (total) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodySm" className="text-sm sm:text-base">
            Customer price
          </Typography>
          <Typography
            variant="bodySm"
            className="tabular-nums text-base font-medium sm:text-lg"
          >
            {formatPrice(convertValue(calculatedQuote.customerQuotePrice), currency)}
          </Typography>
        </div>

        {/* Currency Toggle - Inline with total */}
        <div className="flex items-center justify-end gap-2">
          <Typography variant="bodyXs" colorRole="muted" className="text-[11px]">
            Display in AED
          </Typography>
          <Switch
            checked={currency === 'AED'}
            onCheckedChange={onCurrencyToggle}
            size="sm"
            aria-label="Toggle currency display"
          />
        </div>
      </div>
    </div>
  );
};

export default B2BCalculatorBreakdown;
