'use client';

import Typography from '@/app/_ui/components/Typography/Typography';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

import type { B2BCalculatorLineItem } from './B2BCalculator';

export interface B2BCalculatorProductBreakdownProps {
  /** Line items with product details */
  lineItems: B2BCalculatorLineItem[];
  /** Display currency */
  currency: 'USD' | 'AED';
  /** Customer price per case multiplier (includes tax, margin, transfer allocated per case) */
  priceMultiplier: number;
}

/**
 * Displays per-product case pricing breakdown
 *
 * Shows each product with:
 * - Product name and quantity
 * - In-Bond price per case
 * - Customer price per case (with all costs applied)
 *
 * @example
 *   <B2BCalculatorProductBreakdown
 *     lineItems={items}
 *     currency="USD"
 *     priceMultiplier={1.47}
 *   />
 */
const B2BCalculatorProductBreakdown = ({
  lineItems,
  currency,
  priceMultiplier,
}: B2BCalculatorProductBreakdownProps) => {
  // Convert values to display currency
  const convertValue = (usdValue: number) => {
    return currency === 'AED' ? convertUsdToAed(usdValue) : usdValue;
  };

  // Calculate customer price per case for each product
  const getCustomerPricePerCase = (item: B2BCalculatorLineItem) => {
    const basePricePerCase = item.basePriceUsd;
    return basePricePerCase * priceMultiplier;
  };

  return (
    <div className="flex flex-col space-y-3 rounded-lg border border-border-muted bg-fill-muted/50 p-4 sm:p-5">
      <Typography
        variant="bodySm"
        colorRole="muted"
        className="text-xs uppercase tracking-wide sm:text-sm"
      >
        Product breakdown
      </Typography>

      <div className="flex flex-col space-y-3">
        {lineItems.map((item, index) => (
          <div key={index} className="flex flex-col space-y-1">
            <Typography variant="bodyXs" className="text-xs font-medium sm:text-sm">
              {item.productName}
            </Typography>
            <div className="flex items-baseline justify-between gap-2">
              <Typography variant="bodyXs" colorRole="muted" className="text-xs sm:text-sm">
                {item.quantity} {item.quantity === 1 ? 'case' : 'cases'}
              </Typography>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] sm:text-xs">
                In-Bond: {formatPrice(convertValue(item.basePriceUsd), currency)}/case
              </Typography>
              <Typography variant="bodyXs" className="tabular-nums text-xs sm:text-sm">
                → {formatPrice(convertValue(getCustomerPricePerCase(item)), currency)}/case
              </Typography>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default B2BCalculatorProductBreakdown;
