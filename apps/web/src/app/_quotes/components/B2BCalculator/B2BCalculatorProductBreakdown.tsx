'use client';

import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

import type { B2BCalculatorLineItem } from './B2BCalculator';

export interface B2BCalculatorProductBreakdownProps {
  /** Line items with product details */
  lineItems: B2BCalculatorLineItem[];
  /** Display currency */
  currency: 'USD' | 'AED';
  /** Global margin percentage (from main calculator) */
  globalMarginPercent?: number;
  /** Import tax percentage */
  importTaxPercent: number;
  /** Total transfer cost to allocate */
  transferCostTotal: number;
  /** Per-product margin overrides (index-based) */
  productMargins: Record<number, number>;
  /** Handler for updating product margins */
  onProductMarginChange: (productIndex: number, marginPercent: number) => void;
}

/**
 * Displays per-product case pricing breakdown with editable margins
 *
 * Shows each product with:
 * - Product name and quantity
 * - In-Bond price per case
 * - Editable margin percentage
 * - Customer price per case (with all costs applied)
 *
 * @example
 *   <B2BCalculatorProductBreakdown
 *     lineItems={items}
 *     currency="USD"
 *     globalMarginPercent={15}
 *     importTaxPercent={20}
 *     transferCostTotal={200}
 *     productMargins={{}}
 *     onProductMarginChange={handleChange}
 *   />
 */
const B2BCalculatorProductBreakdown = ({
  lineItems,
  currency,
  globalMarginPercent = 15,
  importTaxPercent,
  transferCostTotal,
  productMargins,
  onProductMarginChange,
}: B2BCalculatorProductBreakdownProps) => {
  // Convert values to display currency
  const convertValue = (usdValue: number) => {
    return currency === 'AED' ? convertUsdToAed(usdValue) : usdValue;
  };

  // Calculate total in-bond price for allocation
  const totalInBondPrice = lineItems.reduce((sum, item) => sum + item.lineItemTotalUsd, 0);

  // Calculate customer price per case for each product with individual margin
  const getCustomerPricePerCase = (item: B2BCalculatorLineItem, productIndex: number) => {
    const basePricePerCase = item.basePriceUsd;

    // Get margin for this product (override or global)
    const marginPercent = productMargins[productIndex] ?? globalMarginPercent;

    // Calculate components per case
    const importTax = basePricePerCase * (importTaxPercent / 100);
    const margin = basePricePerCase * (marginPercent / 100);

    // Allocate transfer cost proportionally based on line item total
    const transferCostPerCase =
      (item.lineItemTotalUsd / totalInBondPrice) * transferCostTotal / item.quantity;

    return basePricePerCase + importTax + margin + transferCostPerCase;
  };

  // Get margin for a product (override or global)
  const getProductMargin = (productIndex: number) => {
    return productMargins[productIndex] ?? globalMarginPercent;
  };

  // Handle margin input change
  const handleMarginChange = (productIndex: number, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      onProductMarginChange(productIndex, numValue);
    }
  };

  return (
    <div className="flex flex-col space-y-3 rounded-lg border border-border-muted bg-fill-muted/50 p-4 sm:p-5">
      <Typography
        variant="bodySm"
        colorRole="muted"
        className="text-xs font-bold uppercase tracking-wide sm:text-sm"
      >
        Product breakdown
      </Typography>

      <div className="flex flex-col space-y-3">
        {lineItems.map((item, index) => (
          <div key={index} className="flex flex-col space-y-1.5">
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
            </div>

            {/* Editable Margin */}
            <div className="flex items-center gap-2">
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] sm:text-xs">
                Margin:
              </Typography>
              <Input
                type="number"
                value={getProductMargin(index)}
                onChange={(e) => handleMarginChange(index, e.target.value)}
                min={0}
                max={100}
                step={0.5}
                size="sm"
                className="w-16 text-xs"
              />
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] sm:text-xs">
                %
              </Typography>
            </div>

            {/* Customer Price */}
            <div className="flex items-baseline justify-between gap-2 pt-1">
              <Typography variant="bodyXs" colorRole="muted" className="text-[11px] sm:text-xs">
                Customer price:
              </Typography>
              <Typography variant="bodyXs" className="tabular-nums text-xs font-medium sm:text-sm">
                {formatPrice(convertValue(getCustomerPricePerCase(item, index)), currency)}/case
              </Typography>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default B2BCalculatorProductBreakdown;
