import type { CalculationVariables } from '../schemas/calculationVariablesSchema';

interface RawProduct {
  productName: string;
  vintage?: string;
  ukInBondPrice: number;
  inputCurrency: string;
  caseConfig: number;
  bottleSize?: string;
  region?: string;
  producer?: string;
  lwin?: string;
}

interface CalculatedProduct {
  productName: string;
  vintage: string | null;
  region: string | null;
  producer: string | null;
  bottleSize: string | null;
  caseConfig: number;
  lwin: string | null;
  ukInBondPrice: number;
  inputCurrency: string;

  // B2B pricing
  inBondCaseUsd: number;
  inBondBottleUsd: number;
  inBondCaseAed: number;
  inBondBottleAed: number;

  // D2C pricing
  deliveredCaseUsd: number;
  deliveredBottleUsd: number;
  deliveredCaseAed: number;
  deliveredBottleAed: number;
}

/**
 * Calculate B2B and D2C prices for a product
 *
 * B2B: UK In-Bond → USD → + Margin → + Freight → UAE In-Bond (USD/AED)
 * D2C: B2B + Sales Advisor Margin → + Import Duty → + Local Costs → + VAT → Delivered
 */
const calculatePrices = (
  products: RawProduct[],
  variables: CalculationVariables,
): CalculatedProduct[] => {
  return products.map((product) => {
    // Step 1: Convert to USD
    let priceUsd = product.ukInBondPrice;

    const currency = product.inputCurrency || variables.inputCurrency;
    if (currency === 'GBP') {
      priceUsd = product.ukInBondPrice * variables.gbpToUsdRate;
    } else if (currency === 'EUR') {
      priceUsd = product.ukInBondPrice * variables.eurToUsdRate;
    }
    // USD stays as-is

    // Step 2: Apply C&C Margin (before freight)
    let marginedPriceUsd: number;
    if (variables.marginType === 'percentage') {
      // Percentage margin: price ÷ (1 - margin%)
      const divisor = 1 - variables.marginPercent / 100;
      marginedPriceUsd = divisor > 0 ? priceUsd / divisor : priceUsd;
    } else {
      // Absolute margin: price + fixed amount
      marginedPriceUsd = priceUsd + variables.marginAbsolute;
    }

    // Step 3: Add freight (per bottle × case config)
    const caseConfig = product.caseConfig || 6;
    // Support old sessions with shippingMethod/airFreight/seaFreight
    const freightPerBottle = variables.freightPerBottle ?? 2;
    const freightPerCase = freightPerBottle * caseConfig;

    const inBondCaseUsd = marginedPriceUsd + freightPerCase;
    const inBondBottleUsd = inBondCaseUsd / caseConfig;

    // Convert to AED
    const inBondCaseAed = inBondCaseUsd * variables.usdToAedRate;
    const inBondBottleAed = inBondBottleUsd * variables.usdToAedRate;

    // D2C Calculation
    // Step 4: Add Sales Advisor Margin to UAE In-Bond
    const adjustedInBondUsd = inBondCaseUsd * (1 + variables.salesAdvisorMarginPercent / 100);

    // Step 5: Add Import Duty
    const withDutyUsd = adjustedInBondUsd * (1 + variables.importDutyPercent / 100);

    // Step 6: Add Local Costs
    const withLocalCostsUsd = withDutyUsd + variables.localCosts;

    // Step 7: Add VAT
    const deliveredCaseUsd = withLocalCostsUsd * (1 + variables.vatPercent / 100);
    const deliveredBottleUsd = deliveredCaseUsd / caseConfig;

    // Convert to AED
    const deliveredCaseAed = deliveredCaseUsd * variables.usdToAedRate;
    const deliveredBottleAed = deliveredBottleUsd * variables.usdToAedRate;

    return {
      productName: product.productName,
      vintage: product.vintage ?? null,
      region: product.region ?? null,
      producer: product.producer ?? null,
      bottleSize: product.bottleSize ?? null,
      caseConfig,
      lwin: product.lwin ?? null,
      ukInBondPrice: product.ukInBondPrice,
      inputCurrency: currency,

      inBondCaseUsd,
      inBondBottleUsd,
      inBondCaseAed,
      inBondBottleAed,

      deliveredCaseUsd,
      deliveredBottleUsd,
      deliveredCaseAed,
      deliveredBottleAed,
    };
  });
};

export default calculatePrices;
