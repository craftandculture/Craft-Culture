'use client';

import {
  IconBookmark,
  IconCalculator,
  IconChevronDown,
  IconDownload,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Popover from '@/app/_ui/components/Popover/Popover';
import PopoverContent from '@/app/_ui/components/Popover/PopoverContent';
import PopoverTrigger from '@/app/_ui/components/Popover/PopoverTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

import B2BCalculatorBreakdown from './B2BCalculatorBreakdown';
import B2BCalculatorInput from './B2BCalculatorInput';
import B2BCalculatorMarginToggle from './B2BCalculatorMarginToggle';
import B2BCalculatorProductBreakdown from './B2BCalculatorProductBreakdown';
import calculateB2BQuote from '../../utils/calculateB2BQuote';
import exportB2BQuoteToExcel from '../../utils/exportB2BQuoteToExcel';

export interface B2BCalculatorLineItem {
  /** Product name */
  productName: string;
  /** Quantity */
  quantity: number;
  /** Supplier/buy price per case in USD (NOT the In-Bond UAE price) */
  basePriceUsd: number;
  /** Line item total In-Bond UAE price in USD (distributor price from pricing model) */
  lineItemTotalUsd: number;
  /** Number of bottles per case (e.g., 6, 12, 3) */
  unitCount: number;
  /** Optional margin override (percentage) for this specific product */
  marginOverride?: number;
}

export interface B2BCalculatorProps {
  /** Base in bond UAE price in USD */
  inBondPriceUsd: number;
  /** Optional line items for detailed Excel export */
  lineItems?: B2BCalculatorLineItem[];
  /** Callback to open save dialog with margin configuration */
  onSaveWithMargins?: (marginConfig: {
    marginType: 'percentage' | 'fixed';
    marginValue: number;
    transferCost: number;
    importTax: number;
    customerQuotePrice: number;
    displayCurrency: 'USD' | 'AED';
  }) => void;
}

/**
 * B2B distributor pricing calculator
 *
 * Allows B2B partners to calculate customer quotes by applying:
 * - Import tax (20% of in bond price)
 * - Distributor margin (15% of in bond price or fixed $)
 * - Transfer cost ($200 default)
 *
 * @example
 *   <B2BCalculator inBondPriceUsd={5000} />
 */
const B2BCalculator = ({ inBondPriceUsd, lineItems, onSaveWithMargins }: B2BCalculatorProps) => {
  const api = useTRPC();

  // Fetch lead time settings from database
  const { data: leadTimeMinData } = useQuery(
    api.admin.settings.get.queryOptions({ key: 'leadTimeMin' }),
  );
  const { data: leadTimeMaxData } = useQuery(
    api.admin.settings.get.queryOptions({ key: 'leadTimeMax' }),
  );

  // Accordion expansion state
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculator inputs with defaults
  const [transferCost, setTransferCost] = useState(200);
  const [importTax, setImportTax] = useState(20);
  const [marginType, setMarginType] = useState<'percentage' | 'fixed'>('percentage');
  const [marginValue, setMarginValue] = useState(15);

  // Lead time from settings or defaults
  const leadTimeMin = leadTimeMinData ? Number(leadTimeMinData) : 14;
  const leadTimeMax = leadTimeMaxData ? Number(leadTimeMaxData) : 21;

  // Currency display toggle
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'AED'>('USD');

  // Per-product margin overrides (index-based map)
  const [productMargins, setProductMargins] = useState<Record<number, { type: 'percentage' | 'fixed'; value: number }>>({});

  // Handler to update individual product margin
  const handleProductMarginChange = (productIndex: number, type: 'percentage' | 'fixed', value: number) => {
    setProductMargins((prev) => ({
      ...prev,
      [productIndex]: { type, value },
    }));
  };

  // Calculate quote based on inputs
  const calculatedQuote = useMemo(
    () =>
      calculateB2BQuote({
        inBondPriceUsd,
        transferCostUsd: transferCost,
        importTaxPercent: importTax,
        distributorMargin: {
          type: marginType,
          value: marginValue,
        },
      }),
    [inBondPriceUsd, transferCost, importTax, marginType, marginValue],
  );

  // Calculate actual quote totals when using per-product margins
  const actualQuoteTotals = useMemo(() => {
    if (!lineItems || lineItems.length === 0) {
      return calculatedQuote;
    }

    // Calculate total quantity for transfer cost allocation
    const totalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate totals by summing per-product calculations
    let totalInBond = 0;
    let totalImportTax = 0;
    let totalTransferCost = 0;
    let totalMargin = 0;
    let totalVAT = 0;
    let totalCustomerPrice = 0;

    lineItems.forEach((item, index) => {
      const inBondPerCase = item.lineItemTotalUsd / item.quantity;
      const importTaxPerCase = inBondPerCase * (importTax / 100);
      const transferCostPerCase = transferCost / totalQuantity;
      const landedPrice = inBondPerCase + importTaxPerCase + transferCostPerCase;

      // Get margin config (override or global)
      const marginConfig = productMargins[index] ?? { type: marginType, value: marginValue };

      // Calculate price after margin
      const priceAfterMargin =
        marginConfig.type === 'percentage'
          ? landedPrice / (1 - marginConfig.value / 100)
          : landedPrice + marginConfig.value;

      const marginAmount = priceAfterMargin - landedPrice;
      const vat = priceAfterMargin * 0.05;
      const customerPrice = priceAfterMargin + vat;

      // Accumulate totals (multiply by quantity)
      totalInBond += inBondPerCase * item.quantity;
      totalImportTax += importTaxPerCase * item.quantity;
      totalTransferCost += transferCostPerCase * item.quantity;
      totalMargin += marginAmount * item.quantity;
      totalVAT += vat * item.quantity;
      totalCustomerPrice += customerPrice * item.quantity;
    });

    const totalLanded = totalInBond + totalImportTax + totalTransferCost;
    const totalAfterMargin = totalLanded + totalMargin;

    return {
      inBondPrice: totalInBond,
      importTax: totalImportTax,
      transferCost: totalTransferCost,
      landedPrice: totalLanded,
      distributorMargin: totalMargin,
      priceAfterMargin: totalAfterMargin,
      vat: totalVAT,
      customerQuotePrice: totalCustomerPrice,
    };
  }, [lineItems, transferCost, importTax, marginType, marginValue, productMargins, calculatedQuote]);

  // Reset to default values
  const handleReset = () => {
    setTransferCost(200);
    setImportTax(20);
    setMarginType('percentage');
    setMarginValue(15);
  };

  // Export to Excel
  const handleExport = () => {
    exportB2BQuoteToExcel(
      actualQuoteTotals,
      displayCurrency,
      lineItems,
      leadTimeMin,
      leadTimeMax,
      importTax,
      transferCost,
      marginType,
      marginValue,
      productMargins,
    );
  };

  // Toggle currency display
  const handleCurrencyToggle = (checked: boolean) => {
    setDisplayCurrency(checked ? 'AED' : 'USD');
  };

  const displayValue = (usdValue: number) => {
    return displayCurrency === 'AED' ? convertUsdToAed(usdValue) : usdValue;
  };

  // Handle save quote with current margin configuration
  const handleSaveQuote = () => {
    if (onSaveWithMargins) {
      onSaveWithMargins({
        marginType,
        marginValue,
        transferCost,
        importTax,
        customerQuotePrice: actualQuoteTotals.customerQuotePrice,
        displayCurrency,
      });
    }
  };

  return (
    <div className="rounded-lg border border-border-muted bg-fill-muted/50">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-fill-muted sm:px-5 sm:py-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fill-brand/10 sm:h-10 sm:w-10">
            <IconCalculator className="h-5 w-5 text-text-brand sm:h-5 sm:w-5" />
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <Typography variant="bodySm" className="font-semibold sm:text-base">
              Your Margin Calculator
            </Typography>
            <Typography
              variant="bodyXs"
              colorRole="muted"
              className="text-xs sm:text-sm"
            >
              Calculate your profit margins in seconds
            </Typography>
          </div>
        </div>
        <IconChevronDown
          className={`h-4 w-4 text-text-muted transition-transform sm:h-5 sm:w-5 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="border-t border-border-muted px-4 py-5 sm:px-5 sm:py-6">
          {/* Description */}
          <div className="mb-6 rounded-lg border border-border-brand/20 bg-fill-brand/5 px-4 py-3">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Your personal pricing assistant. Quickly calculate customer quotes by adjusting margins,
              tax rates, and transfer costs to find the perfect price for your customers.
            </Typography>
          </div>

          {/* Two-column layout on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(auto,280px)_1fr] lg:gap-8">
            {/* Left Column - Input Controls (Compact) */}
            <div className="flex flex-col space-y-4 lg:max-w-[280px]">
              {/* Baseline Price (read-only) */}
              <div className="rounded-lg border border-border-muted bg-fill-primary p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-1.5">
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="text-xs font-semibold uppercase tracking-wide"
                  >
                    In-Bond UAE
                  </Typography>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="inline-flex">
                        <IconInfoCircle className="h-3.5 w-3.5 text-text-muted" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="max-w-xs p-3">
                      <Typography variant="bodyXs">
                        Base price before tax, margin, and transfer costs
                      </Typography>
                    </PopoverContent>
                  </Popover>
                </div>
                <Typography variant="bodyLg" className="tabular-nums font-semibold">
                  {formatPrice(displayValue(inBondPriceUsd), displayCurrency)}
                </Typography>
              </div>

              <Divider />

              {/* Cost Inputs */}
              <div className="flex flex-col space-y-4">
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="text-xs font-semibold uppercase tracking-wide"
                >
                  Cost inputs
                </Typography>

                <B2BCalculatorInput
                  label="Transfer cost"
                  value={transferCost}
                  onChange={setTransferCost}
                  prefix="$"
                  tooltipText="UAE In Bond -> Mainland Transfer cost inc delivery"
                />

                <B2BCalculatorInput
                  label="Import duty"
                  helperText="Applied to In-Bond UAE Price"
                  value={importTax}
                  onChange={setImportTax}
                  suffix="%"
                  max={100}
                />

                <B2BCalculatorMarginToggle
                  marginType={marginType}
                  marginValue={marginValue}
                  onMarginTypeChange={setMarginType}
                  onMarginValueChange={setMarginValue}
                />
              </div>
            </div>

            {/* Right Column - Results Breakdown (Expanded) */}
            <div className="flex flex-col space-y-3">
              {/* Product Breakdown - Only show if line items are available */}
              {lineItems && lineItems.length > 0 && (
                <B2BCalculatorProductBreakdown
                  lineItems={lineItems}
                  currency={displayCurrency}
                  globalMarginType={marginType}
                  globalMarginValue={marginValue}
                  importTaxPercent={importTax}
                  transferCostTotal={transferCost}
                  productMargins={productMargins}
                  onProductMarginChange={handleProductMarginChange}
                />
              )}

              {/* Pricing Breakdown */}
              <B2BCalculatorBreakdown
                calculatedQuote={actualQuoteTotals}
                currency={displayCurrency}
                importTaxPercent={importTax}
                distributorMarginType={marginType}
                distributorMarginValue={marginValue}
                leadTimeMin={leadTimeMin}
                leadTimeMax={leadTimeMax}
                onCurrencyToggle={handleCurrencyToggle}
              />
            </div>
          </div>

          <Divider className="my-5" />

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              size="md"
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              <ButtonContent>Reset to Defaults</ButtonContent>
            </Button>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Save Quote Button - Only show if callback provided */}
              {onSaveWithMargins && (
                <Button
                  variant="default"
                  colorRole="brand"
                  size="md"
                  onClick={handleSaveQuote}
                  className="w-full sm:w-auto"
                >
                  <ButtonContent iconLeft={IconBookmark}>Save Quote</ButtonContent>
                </Button>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleExport}
                  className="w-full sm:w-auto"
                >
                  <ButtonContent iconLeft={IconDownload}>Export to Excel</ButtonContent>
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex">
                      <IconInfoCircle className="h-4 w-4 text-text-muted" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="max-w-xs p-3">
                    <Typography variant="bodyXs">
                      Export product & distributor margin calculations
                    </Typography>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default B2BCalculator;
