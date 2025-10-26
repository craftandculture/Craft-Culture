/**
 * Calculator inputs for B2B distributor pricing
 */
export interface B2BCalculatorInputs {
  /** Base in bond UAE price in USD */
  inBondPriceUsd: number;
  /** Transfer cost in USD (default: $200) */
  transferCostUsd: number;
  /** Import tax percentage (default: 20%) */
  importTaxPercent: number;
  /** Distributor margin configuration */
  distributorMargin: {
    /** Margin type: percentage of in bond price or fixed cash amount */
    type: 'percentage' | 'fixed';
    /** Margin value: percentage (e.g., 15) or fixed USD amount */
    value: number;
  };
}

/**
 * Calculated B2B quote breakdown
 */
export interface B2BCalculatorResult {
  /** Base in bond UAE price */
  inBondPrice: number;
  /** Calculated import tax (% of in bond price) */
  importTax: number;
  /** Transfer cost */
  transferCost: number;
  /** Landed price (In-Bond + Import Tax + Transfer) */
  landedPrice: number;
  /** Calculated distributor margin profit */
  distributorMargin: number;
  /** Price after margin (before VAT) */
  priceAfterMargin: number;
  /** VAT (5% of price after margin) */
  vat: number;
  /** Final customer quote price (including VAT) */
  customerQuotePrice: number;
}

/**
 * Calculate B2B distributor pricing breakdown
 *
 * Formula:
 * - Import tax = In bond price × (importTaxPercent / 100)
 * - Landed price = In bond + Import tax + Transfer cost
 * - Apply margin: Landed price / (1 - margin%) OR Landed price + fixed $
 * - VAT = Price after margin × 5%
 * - Customer price = Price after margin + VAT
 *
 * @example
 *   calculateB2BQuote({
 *     inBondPriceUsd: 1000,
 *     transferCostUsd: 20,
 *     importTaxPercent: 20,
 *     distributorMargin: { type: 'percentage', value: 15 },
 *   });
 *   // Landed: 1000 + 200 + 20 = 1220
 *   // After 15% margin: 1220 / 0.85 = 1435.29
 *   // VAT: 1435.29 × 5% = 71.76
 *   // Final: 1435.29 + 71.76 = 1507.05
 *
 * @param inputs - Calculator input values
 * @returns Calculated pricing breakdown
 */
const calculateB2BQuote = (inputs: B2BCalculatorInputs): B2BCalculatorResult => {
  const { inBondPriceUsd, transferCostUsd, importTaxPercent, distributorMargin } = inputs;

  // Import tax calculated on in bond price
  const importTax = inBondPriceUsd * (importTaxPercent / 100);

  // Landed price = In-Bond + Import Tax + Transfer
  const landedPrice = inBondPriceUsd + importTax + transferCostUsd;

  // Apply margin to landed price
  const priceAfterMargin =
    distributorMargin.type === 'percentage'
      ? landedPrice / (1 - distributorMargin.value / 100)
      : landedPrice + distributorMargin.value;

  // Calculate actual margin profit
  const margin = priceAfterMargin - landedPrice;

  // Calculate 5% VAT on price after margin
  const vat = priceAfterMargin * 0.05;

  // Final customer price
  const customerQuotePrice = priceAfterMargin + vat;

  return {
    inBondPrice: inBondPriceUsd,
    importTax,
    transferCost: transferCostUsd,
    landedPrice,
    distributorMargin: margin,
    priceAfterMargin,
    vat,
    customerQuotePrice,
  };
};

export default calculateB2BQuote;
