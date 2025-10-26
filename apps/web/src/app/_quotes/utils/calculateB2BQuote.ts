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
  /** Calculated distributor margin (% of in bond price or fixed) */
  distributorMargin: number;
  /** Transfer cost */
  transferCost: number;
  /** Final customer quote price (sum of all components) */
  customerQuotePrice: number;
}

/**
 * Calculate B2B distributor pricing breakdown
 *
 * Formula:
 * - Import tax = In bond price × (importTaxPercent / 100)
 * - Distributor margin = In bond price × (marginPercent / 100) OR fixed value
 * - Customer price = In bond + Import tax + Distributor margin + Transfer
 *
 * @example
 *   calculateB2BQuote({
 *     inBondPriceUsd: 5000,
 *     transferCostUsd: 200,
 *     importTaxPercent: 20,
 *     distributorMargin: { type: 'percentage', value: 15 },
 *   });
 *   // Returns: { inBondPrice: 5000, importTax: 1000, distributorMargin: 750, transferCost: 200, customerQuotePrice: 6950 }
 *
 * @param inputs - Calculator input values
 * @returns Calculated pricing breakdown
 */
const calculateB2BQuote = (inputs: B2BCalculatorInputs): B2BCalculatorResult => {
  const { inBondPriceUsd, transferCostUsd, importTaxPercent, distributorMargin } = inputs;

  // Import tax calculated on in bond price only
  const importTax = inBondPriceUsd * (importTaxPercent / 100);

  // Distributor margin calculated on in bond price only
  const margin =
    distributorMargin.type === 'percentage'
      ? inBondPriceUsd * (distributorMargin.value / 100)
      : distributorMargin.value;

  // Total = In bond + Import tax + Distributor margin + Transfer
  const customerQuotePrice = inBondPriceUsd + importTax + margin + transferCostUsd;

  return {
    inBondPrice: inBondPriceUsd,
    importTax,
    distributorMargin: margin,
    transferCost: transferCostUsd,
    customerQuotePrice,
  };
};

export default calculateB2BQuote;
