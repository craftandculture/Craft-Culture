'use client';

import { IconCalculator, IconChevronDown, IconDownload } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Switch from '@/app/_ui/components/Switch/Switch';
import Typography from '@/app/_ui/components/Typography/Typography';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

import B2BCalculatorBreakdown from './B2BCalculatorBreakdown';
import B2BCalculatorInput from './B2BCalculatorInput';
import B2BCalculatorMarginToggle from './B2BCalculatorMarginToggle';
import calculateB2BQuote from '../../utils/calculateB2BQuote';
import exportB2BQuoteToExcel from '../../utils/exportB2BQuoteToExcel';

export interface B2BCalculatorProps {
  /** Base in bond UAE price in USD */
  inBondPriceUsd: number;
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
const B2BCalculator = ({ inBondPriceUsd }: B2BCalculatorProps) => {
  // Accordion expansion state
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculator inputs with defaults
  const [transferCost, setTransferCost] = useState(200);
  const [importTax, setImportTax] = useState(20);
  const [marginType, setMarginType] = useState<'percentage' | 'fixed'>('percentage');
  const [marginValue, setMarginValue] = useState(15);

  // Currency display toggle
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'AED'>('USD');

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

  // Reset to default values
  const handleReset = () => {
    setTransferCost(200);
    setImportTax(20);
    setMarginType('percentage');
    setMarginValue(15);
  };

  // Export to Excel
  const handleExport = () => {
    exportB2BQuoteToExcel(calculatedQuote, displayCurrency);
  };

  // Toggle currency display
  const handleCurrencyToggle = (checked: boolean) => {
    setDisplayCurrency(checked ? 'AED' : 'USD');
  };

  const displayValue = (usdValue: number) => {
    return displayCurrency === 'AED' ? convertUsdToAed(usdValue) : usdValue;
  };

  return (
    <div className="rounded-lg border border-border-muted bg-fill-muted/50">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-fill-muted sm:p-3"
      >
        <div className="flex items-center gap-2 sm:gap-2.5">
          <IconCalculator className="h-4 w-4 text-text-muted sm:h-5 sm:w-5" />
          <div className="flex flex-col items-start gap-0.5">
            <Typography variant="bodySm" className="sm:text-base">
              B2B pricing calculator
            </Typography>
            <Typography
              variant="bodyXs"
              colorRole="muted"
              className="text-[10px] sm:text-xs"
            >
              Calculate distributor costs and margins
            </Typography>
          </div>
        </div>
        <IconChevronDown
          className={`h-3.5 w-3.5 text-text-muted transition-transform sm:h-4 sm:w-4 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="border-t border-border-muted px-3 py-4 sm:p-5">
          {/* Two-column layout on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            {/* Left Column - Input Controls */}
            <div className="flex flex-col space-y-4">
              {/* Baseline Price (read-only) */}
              <div className="rounded-lg border border-border-muted bg-fill-primary p-4">
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="mb-1.5 text-[10px] uppercase tracking-wide sm:text-xs"
                >
                  Baseline price
                </Typography>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="mb-1 text-xs sm:text-sm"
                >
                  In bond UAE price
                </Typography>
                <Typography
                  variant="bodyLg"
                  className="tabular-nums text-xl font-medium sm:text-2xl"
                >
                  {formatPrice(displayValue(inBondPriceUsd), displayCurrency)}
                </Typography>
              </div>

              <Divider />

              {/* Cost Inputs */}
              <div className="flex flex-col space-y-4">
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="text-[10px] uppercase tracking-wide sm:text-xs"
                >
                  Cost inputs
                </Typography>

                <B2BCalculatorInput
                  label="Transfer cost"
                  value={transferCost}
                  onChange={setTransferCost}
                  prefix="$"
                />

                <B2BCalculatorInput
                  label="Import tax"
                  helperText="Applied to In bond price"
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

            {/* Right Column - Results Breakdown */}
            <div className="flex flex-col space-y-4">
              <B2BCalculatorBreakdown
                calculatedQuote={calculatedQuote}
                currency={displayCurrency}
              />

              {/* Currency Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border-muted bg-fill-primary px-4 py-3">
                <Typography variant="bodySm" colorRole="muted" className="text-xs sm:text-sm">
                  Display in AED
                </Typography>
                <Switch
                  checked={displayCurrency === 'AED'}
                  onCheckedChange={handleCurrencyToggle}
                  size="sm"
                  aria-label="Toggle currency display"
                />
              </div>
            </div>
          </div>

          <Divider className="my-5" />

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button
              variant="secondary"
              size="md"
              onClick={handleExport}
              className="w-full sm:w-auto"
            >
              <ButtonContent iconLeft={IconDownload}>Export to Excel</ButtonContent>
            </Button>

            <Button
              variant="ghost"
              size="md"
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              <ButtonContent>Reset to Defaults</ButtonContent>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default B2BCalculator;
