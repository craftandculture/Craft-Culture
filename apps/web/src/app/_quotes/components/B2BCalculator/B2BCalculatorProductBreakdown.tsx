'use client';

import { IconInfoCircle } from '@tabler/icons-react';

import Input from '@/app/_ui/components/Input/Input';
import Switch from '@/app/_ui/components/Switch/Switch';
import Tooltip from '@/app/_ui/components/Tooltip/Tooltip';
import TooltipContent from '@/app/_ui/components/Tooltip/TooltipContent';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';
import TooltipTrigger from '@/app/_ui/components/Tooltip/TooltipTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

import type { B2BCalculatorLineItem } from './B2BCalculator';

export interface B2BCalculatorProductBreakdownProps {
  /** Line items with product details */
  lineItems: B2BCalculatorLineItem[];
  /** Display currency */
  currency: 'USD' | 'AED';
  /** Global margin type (from main calculator) */
  globalMarginType: 'percentage' | 'fixed';
  /** Global margin value (from main calculator) */
  globalMarginValue: number;
  /** Import tax percentage */
  importTaxPercent: number;
  /** Total transfer cost to allocate */
  transferCostTotal: number;
  /** Per-product margin overrides (index-based) */
  productMargins: Record<number, { type: 'percentage' | 'fixed'; value: number }>;
  /** Handler for updating product margins */
  onProductMarginChange: (productIndex: number, type: 'percentage' | 'fixed', value: number) => void;
}

/**
 * Displays per-product case pricing breakdown with editable margins
 *
 * Shows each product with:
 * - Product name and quantity
 * - In-Bond price per case
 * - Editable margin (percentage or fixed dollar amount)
 * - Margin profit amount
 * - Customer price per case (with all costs applied)
 *
 * @example
 *   <B2BCalculatorProductBreakdown
 *     lineItems={items}
 *     currency="USD"
 *     globalMarginType="percentage"
 *     globalMarginValue={15}
 *     importTaxPercent={20}
 *     transferCostTotal={200}
 *     productMargins={{}}
 *     onProductMarginChange={handleChange}
 *   />
 */
const B2BCalculatorProductBreakdown = ({
  lineItems,
  currency,
  globalMarginType,
  globalMarginValue,
  importTaxPercent,
  transferCostTotal,
  productMargins,
  onProductMarginChange,
}: B2BCalculatorProductBreakdownProps) => {
  // Convert values to display currency
  const convertValue = (usdValue: number) => {
    return currency === 'AED' ? convertUsdToAed(usdValue) : usdValue;
  };

  // Calculate total quantity for transfer cost allocation
  const totalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);

  // Get margin configuration for a product (override or global)
  const getProductMarginConfig = (productIndex: number) => {
    return productMargins[productIndex] ?? { type: globalMarginType, value: globalMarginValue };
  };

  // Get In-Bond UAE price per case (distributor price from pricing model)
  const getInBondPricePerCase = (item: B2BCalculatorLineItem) => {
    return item.lineItemTotalUsd / item.quantity;
  };

  // Calculate margin amount for a product using its individual In-Bond UAE price
  const calculateMarginAmount = (item: B2BCalculatorLineItem, productIndex: number) => {
    const config = getProductMarginConfig(productIndex);
    const inBondPricePerCase = getInBondPricePerCase(item);

    if (config.type === 'percentage') {
      return inBondPricePerCase * (config.value / 100);
    }
    // Fixed dollar amount
    return config.value;
  };

  // Calculate customer price per case for each product with individual margin
  const getCustomerPricePerCase = (item: B2BCalculatorLineItem, productIndex: number) => {
    const inBondPricePerCase = getInBondPricePerCase(item);
    const marginAmount = calculateMarginAmount(item, productIndex);

    // Calculate components per case
    const importTax = inBondPricePerCase * (importTaxPercent / 100);

    // Allocate transfer cost per case
    const transferCostPerCase = transferCostTotal / totalQuantity;

    return inBondPricePerCase + importTax + marginAmount + transferCostPerCase;
  };

  // Handle margin value change
  const handleMarginValueChange = (productIndex: number, value: string) => {
    const config = getProductMarginConfig(productIndex);
    const numValue = parseFloat(value);

    if (isNaN(numValue) || numValue < 0) return;

    onProductMarginChange(productIndex, config.type, numValue);
  };

  // Handle margin type toggle (% ↔ $)
  const handleMarginTypeToggle = (productIndex: number, checked: boolean) => {
    const config = getProductMarginConfig(productIndex);
    const newType = checked ? 'fixed' : 'percentage';
    onProductMarginChange(productIndex, newType, config.value);
  };

  return (
    <div className="flex flex-col space-y-3 rounded-lg border border-border-muted bg-fill-muted/50 p-4 sm:p-5">
      <div className="flex items-center gap-1.5">
        <Typography
          variant="bodySm"
          colorRole="muted"
          className="text-xs font-bold uppercase tracking-wide sm:text-sm"
        >
          Product breakdown
        </Typography>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex">
                <IconInfoCircle className="h-3.5 w-3.5 text-text-muted" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <Typography variant="bodyXs">
                Override the global margin for individual products. Set custom % or $ margins per product.
              </Typography>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex flex-col space-y-3">
        {lineItems.map((item, index) => {
          const config = getProductMarginConfig(index);
          const inBondPricePerCase = getInBondPricePerCase(item);
          const marginAmount = calculateMarginAmount(item, index);

          return (
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
                  In-Bond: {formatPrice(convertValue(inBondPricePerCase), currency)}/case
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

              {/* Editable Margin with toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                <Typography variant="bodyXs" colorRole="muted" className="text-[11px] sm:text-xs">
                  Margin:
                </Typography>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={config.value === 0 ? '' : config.value}
                    onChange={(e) => handleMarginValueChange(index, e.target.value)}
                    min={0}
                    step={config.type === 'percentage' ? 0.5 : 1}
                    size="sm"
                    placeholder="0"
                    className="w-14 text-xs"
                  />
                  <Typography variant="bodyXs" colorRole="muted" className="text-[11px] sm:text-xs">
                    {config.type === 'percentage' ? '%' : '$'}
                  </Typography>
                  <Switch
                    checked={config.type === 'fixed'}
                    onCheckedChange={(checked) => handleMarginTypeToggle(index, checked)}
                    size="sm"
                    aria-label="Toggle between percentage and fixed margin"
                  />
                  <Typography
                    variant="bodyXs"
                    colorRole={config.type === 'fixed' ? 'primary' : 'muted'}
                    className="text-[11px] sm:text-xs"
                  >
                    $
                  </Typography>
                </div>
              </div>

              {/* Profit Display - Inline on right */}
              <div className="flex items-baseline justify-end gap-1">
                <Typography variant="bodyXs" colorRole="muted" className="text-[10px] sm:text-[11px]">
                  Profit/case:
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="tabular-nums text-[10px] sm:text-[11px]">
                  {formatPrice(convertValue(marginAmount), currency)}
                </Typography>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default B2BCalculatorProductBreakdown;
