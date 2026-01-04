'use client';

import { IconInfoCircle } from '@tabler/icons-react';

import Divider from '@/app/_ui/components/Divider/Divider';
import Input from '@/app/_ui/components/Input/Input';
import Popover from '@/app/_ui/components/Popover/Popover';
import PopoverContent from '@/app/_ui/components/Popover/PopoverContent';
import PopoverTrigger from '@/app/_ui/components/Popover/PopoverTrigger';
import Switch from '@/app/_ui/components/Switch/Switch';
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

  // Calculate landed price (In-Bond + Import Duty + Transfer Cost)
  const getLandedPrice = (item: B2BCalculatorLineItem) => {
    const inBondPricePerCase = getInBondPricePerCase(item);
    const importTax = inBondPricePerCase * (importTaxPercent / 100);
    const transferCostPerCase = transferCostTotal / totalQuantity;

    return inBondPricePerCase + importTax + transferCostPerCase;
  };

  // Calculate price after margin (before VAT)
  const getPriceAfterMargin = (item: B2BCalculatorLineItem, productIndex: number) => {
    const config = getProductMarginConfig(productIndex);
    const landedPrice = getLandedPrice(item);

    if (config.type === 'percentage') {
      // Margin calculation: Landed Price / (1 - Margin%)
      // e.g., 15% margin means divide by 0.85
      return landedPrice / (1 - config.value / 100);
    }
    // Fixed dollar amount
    return landedPrice + config.value;
  };

  // Calculate margin amount (the actual profit)
  const calculateMarginAmount = (item: B2BCalculatorLineItem, productIndex: number) => {
    const landedPrice = getLandedPrice(item);
    const priceAfterMargin = getPriceAfterMargin(item, productIndex);

    return priceAfterMargin - landedPrice;
  };

  // Calculate customer price per case for each product with individual margin
  const getCustomerPricePerCase = (item: B2BCalculatorLineItem, productIndex: number) => {
    const priceAfterMargin = getPriceAfterMargin(item, productIndex);
    const vat = priceAfterMargin * 0.05; // 5% VAT

    return priceAfterMargin + vat;
  };

  // Calculate customer price per bottle
  const getCustomerPricePerBottle = (item: B2BCalculatorLineItem, productIndex: number) => {
    const customerPricePerCase = getCustomerPricePerCase(item, productIndex);
    return customerPricePerCase / item.unitCount;
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
    <div className="flex flex-col space-y-4 rounded-lg border border-border-muted bg-fill-muted/50 p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <Typography
          variant="bodySm"
          colorRole="muted"
          className="font-semibold uppercase tracking-wide"
        >
          Product breakdown
        </Typography>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex">
              <IconInfoCircle className="h-4 w-4 text-text-muted" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="max-w-xs p-3">
            <Typography variant="bodyXs">
              Override the global margin for individual products. Set custom % or $ margins per product.
            </Typography>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col space-y-4">
        {lineItems.map((item, index) => {
          const config = getProductMarginConfig(index);
          const inBondPricePerCase = getInBondPricePerCase(item);
          const marginAmount = calculateMarginAmount(item, index);

          return (
            <div
              key={index}
              className="flex flex-col space-y-3 rounded-lg border border-border-muted bg-background-primary p-3 sm:p-4"
            >
              {/* Product Name, Case Config & Quantity */}
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <Typography variant="bodySm" className="font-semibold">
                    {item.productName}
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {item.quantity} {item.quantity === 1 ? 'case' : 'cases'}
                  </Typography>
                </div>
                <div className="flex items-center gap-2">
                  <Typography variant="bodyXs" colorRole="muted" className="rounded bg-fill-muted px-1.5 py-0.5">
                    {item.unitCount}×{item.unitSize}
                  </Typography>
                </div>
              </div>

              {/* In-Bond Price */}
              <div className="flex items-baseline justify-between gap-2">
                <Typography variant="bodySm" colorRole="muted">
                  In-Bond Price
                </Typography>
                <Typography variant="bodySm" className="tabular-nums font-medium">
                  {formatPrice(convertValue(inBondPricePerCase), currency)}/case
                </Typography>
              </div>

              <Divider />

              {/* Customer Price - Prominent */}
              <div className="flex flex-col space-y-2 rounded-md bg-fill-brand/5 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Typography variant="bodySm" className="font-medium">
                    Customer price
                  </Typography>
                  <Typography variant="bodySm" className="tabular-nums font-bold text-text-brand">
                    {formatPrice(convertValue(getCustomerPricePerCase(item, index)), currency)}/case
                  </Typography>
                </div>

                {/* Per Bottle Price */}
                <div className="flex items-baseline justify-between gap-2">
                  <Typography variant="bodyXs" colorRole="muted">
                    Per {item.unitSize} bottle
                  </Typography>
                  <Typography variant="bodyXs" className="tabular-nums font-medium">
                    {formatPrice(convertValue(getCustomerPricePerBottle(item, index)), currency)}
                  </Typography>
                </div>
              </div>

              {/* Editable Margin with toggle */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Typography variant="bodySm" colorRole="muted">
                  Adjust Margin:
                </Typography>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={config.value === 0 ? '' : config.value}
                    onChange={(e) => handleMarginValueChange(index, e.target.value)}
                    min={0}
                    step={config.type === 'percentage' ? 0.5 : 1}
                    size="sm"
                    placeholder="0"
                    className="w-20"
                  />
                  <Typography variant="bodySm" colorRole="muted">
                    {config.type === 'percentage' ? '%' : '$'}
                  </Typography>
                  <Switch
                    checked={config.type === 'fixed'}
                    onCheckedChange={(checked) => handleMarginTypeToggle(index, checked)}
                    size="sm"
                    aria-label="Toggle between percentage and fixed margin"
                  />
                  <Typography
                    variant="bodySm"
                    colorRole={config.type === 'fixed' ? 'primary' : 'muted'}
                  >
                    $
                  </Typography>
                </div>
              </div>

              {/* Profit Display */}
              <div className="flex items-baseline justify-between gap-2 rounded-md bg-fill-muted/30 px-2.5 py-1.5">
                <Typography variant="bodyXs" colorRole="muted">
                  Your profit per case
                </Typography>
                <Typography variant="bodyXs" className="tabular-nums font-semibold text-text-success">
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
