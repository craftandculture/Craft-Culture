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
  /** Distributor margin type */
  distributorMarginType: 'percentage' | 'fixed';
  /** Distributor margin value (percentage or fixed dollar amount) */
  distributorMarginValue: number;
  /** Lead time minimum (days) */
  leadTimeMin: number;
  /** Lead time maximum (days) */
  leadTimeMax: number;
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
  distributorMarginType,
  distributorMarginValue,
  leadTimeMin,
  leadTimeMax,
  onCurrencyToggle,
}: B2BCalculatorBreakdownProps) => {
  // Convert values to display currency
  const convertValue = (usdValue: number) => {
    return currency === 'AED' ? convertUsdToAed(usdValue) : usdValue;
  };

  // Format margin display based on type
  const marginLabel =
    distributorMarginType === 'percentage'
      ? `Distributor margin (${distributorMarginValue}%)`
      : `Distributor margin ($${distributorMarginValue})`;


  return (
    <div className="flex flex-col space-y-3 rounded-lg border border-border-muted bg-fill-muted/30 p-4 shadow-sm sm:p-5">
      <Typography
        variant="bodySm"
        colorRole="muted"
        className="font-semibold uppercase tracking-wide"
      >
        Total Price Breakdown
      </Typography>

      <div className="flex flex-col space-y-2">
        {/* In bond price */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodySm" colorRole="muted">
            In Bond UAE Price
          </Typography>
          <Typography variant="bodySm" className="tabular-nums font-medium">
            {formatPrice(convertValue(calculatedQuote.inBondPrice), currency)}
          </Typography>
        </div>

        {/* Import duty */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodySm" colorRole="muted">
            Import duty ({importTaxPercent}%)
          </Typography>
          <Typography variant="bodySm" className="tabular-nums font-medium">
            {formatPrice(convertValue(calculatedQuote.importTax), currency)}
          </Typography>
        </div>

        {/* Transfer cost */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodySm" colorRole="muted">
            Transfer cost
          </Typography>
          <Typography variant="bodySm" className="tabular-nums font-medium">
            {formatPrice(convertValue(calculatedQuote.transferCost), currency)}
          </Typography>
        </div>

        {/* Distributor margin */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodySm" colorRole="muted">
            {marginLabel}
          </Typography>
          <Typography variant="bodySm" className="tabular-nums font-medium">
            {formatPrice(convertValue(calculatedQuote.distributorMargin), currency)}
          </Typography>
        </div>

        {/* VAT */}
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodySm" colorRole="muted">
            VAT (5%)
          </Typography>
          <Typography variant="bodySm" className="tabular-nums font-medium">
            {formatPrice(convertValue(calculatedQuote.vat), currency)}
          </Typography>
        </div>
      </div>

      <Divider className="my-1" />

      {/* Lead Time */}
      <div className="flex items-baseline justify-between gap-2">
        <Typography variant="bodySm" colorRole="muted">
          Lead time
        </Typography>
        <Typography variant="bodySm" className="text-right">
          {leadTimeMin}-{leadTimeMax} days via air freight
        </Typography>
      </div>

      <Divider className="my-2" />

      {/* Customer quote price (total) - Prominent display */}
      <div className="flex flex-col gap-3 rounded-lg bg-fill-brand/10 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <Typography variant="bodyMd" className="font-semibold">
            Customer Price
          </Typography>
          <Typography
            variant="bodyLg"
            className="tabular-nums font-bold text-text-brand"
          >
            {formatPrice(convertValue(calculatedQuote.customerQuotePrice), currency)}
          </Typography>
        </div>

        {/* Currency Toggle - Refined design */}
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 rounded-md border border-border-muted bg-fill-primary px-2.5 py-1.5 shadow-sm">
            <Typography
              variant="bodyXs"
              colorRole={currency === 'USD' ? 'primary' : 'muted'}
              className="text-xs font-semibold uppercase tracking-wide"
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
              className="text-xs font-semibold uppercase tracking-wide"
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
