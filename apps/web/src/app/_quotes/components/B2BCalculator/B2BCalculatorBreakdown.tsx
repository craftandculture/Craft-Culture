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
    <div className="flex flex-col space-y-2.5 rounded-lg border border-border-muted bg-fill-muted/30 p-3 sm:p-4">
      <Typography
        variant="bodyXs"
        colorRole="muted"
        className="text-[10px] uppercase tracking-wide sm:text-xs"
      >
        Total Price Breakdown
      </Typography>

      <div className="flex flex-col space-y-1.5">
        {/* In bond price */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodyXs" colorRole="muted" className="text-[11px] sm:text-xs">
            In Bond UAE Price
          </Typography>
          <Typography variant="bodyXs" className="tabular-nums text-[11px] sm:text-xs">
            {formatPrice(convertValue(calculatedQuote.inBondPrice), currency)}
          </Typography>
        </div>

        {/* Import tax */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodyXs" colorRole="muted" className="text-[11px] sm:text-xs">
            Import tax ({importTaxPercent}%)
          </Typography>
          <Typography variant="bodyXs" className="tabular-nums text-[11px] sm:text-xs">
            {formatPrice(convertValue(calculatedQuote.importTax), currency)}
          </Typography>
        </div>

        {/* Distributor margin */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodyXs" colorRole="muted" className="text-[11px] sm:text-xs">
            Distributor margin
            {distributorMarginPercent !== undefined && ` (${distributorMarginPercent}%)`}
          </Typography>
          <Typography variant="bodyXs" className="tabular-nums text-[11px] sm:text-xs">
            {formatPrice(convertValue(calculatedQuote.distributorMargin), currency)}
          </Typography>
        </div>

        {/* Transfer cost */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodyXs" colorRole="muted" className="text-[11px] sm:text-xs">
            Transfer cost
          </Typography>
          <Typography variant="bodyXs" className="tabular-nums text-[11px] sm:text-xs">
            {formatPrice(convertValue(calculatedQuote.transferCost), currency)}
          </Typography>
        </div>
      </div>

      <Divider className="my-1" />

      {/* Customer quote price (total) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodyXs" className="text-xs font-medium sm:text-sm">
            Customer price
          </Typography>
          <Typography
            variant="bodyXs"
            className="tabular-nums text-sm font-medium sm:text-base"
          >
            {formatPrice(convertValue(calculatedQuote.customerQuotePrice), currency)}
          </Typography>
        </div>

        {/* Currency Toggle - Refined design */}
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-border-muted bg-fill-primary px-2 py-1">
            <Typography
              variant="bodyXs"
              colorRole={currency === 'USD' ? 'primary' : 'muted'}
              className="text-[10px] font-medium uppercase tracking-wide"
            >
              USD
            </Typography>
            <Switch
              checked={currency === 'AED'}
              onCheckedChange={onCurrencyToggle}
              size="sm"
              aria-label="Toggle currency display"
            />
            <Typography
              variant="bodyXs"
              colorRole={currency === 'AED' ? 'primary' : 'muted'}
              className="text-[10px] font-medium uppercase tracking-wide"
            >
              AED
            </Typography>
          </div>
        </div>
      </div>
    </div>
  );
};

export default B2BCalculatorBreakdown;
