import type { CalculationVariables } from '../schemas/calculationVariablesSchema';

interface ItemInput {
  ukInBondPrice: number;
  inputCurrency: string;
  caseConfig: number;
}

interface CalculatedPrices {
  inBondCaseUsd: number;
  inBondBottleUsd: number;
  inBondCaseAed: number;
  inBondBottleAed: number;
  deliveredCaseUsd: number;
  deliveredBottleUsd: number;
  deliveredCaseAed: number;
  deliveredBottleAed: number;
}

/**
 * Recalculate prices for a single item
 *
 * Used when updating case config per item
 */
const recalculateItemPrices = (
  item: ItemInput,
  variables: CalculationVariables,
): CalculatedPrices => {
  const caseConfig = item.caseConfig || 6;

  // The ukInBondPrice stored is always per-case (converted during initial calculation)
  const baseCasePrice = item.ukInBondPrice;

  // Step 1: Convert to USD
  let priceUsd = baseCasePrice;
  const currency = item.inputCurrency || variables.inputCurrency;

  if (currency === 'GBP') {
    priceUsd = baseCasePrice * variables.gbpToUsdRate;
  } else if (currency === 'EUR') {
    priceUsd = baseCasePrice * variables.eurToUsdRate;
  }

  // Step 2: Apply C&C Margin
  let marginedPriceUsd: number;
  if (variables.marginType === 'percentage') {
    const divisor = 1 - variables.marginPercent / 100;
    marginedPriceUsd = divisor > 0 ? priceUsd / divisor : priceUsd;
  } else {
    marginedPriceUsd = priceUsd + variables.marginAbsolute;
  }

  // Step 3: Add freight
  const freightPerBottle = variables.freightPerBottle ?? 2;
  const freightPerCase = freightPerBottle * caseConfig;

  const inBondCaseUsd = marginedPriceUsd + freightPerCase;
  const inBondBottleUsd = inBondCaseUsd / caseConfig;

  // Convert to AED
  const inBondCaseAed = inBondCaseUsd * variables.usdToAedRate;
  const inBondBottleAed = inBondBottleUsd * variables.usdToAedRate;

  // D2C Calculation
  const adjustedInBondUsd = inBondCaseUsd * (1 + variables.salesAdvisorMarginPercent / 100);
  const withDutyUsd = adjustedInBondUsd * (1 + variables.importDutyPercent / 100);
  const withLocalCostsUsd = withDutyUsd + variables.localCosts;
  const deliveredCaseUsd = withLocalCostsUsd * (1 + variables.vatPercent / 100);
  const deliveredBottleUsd = deliveredCaseUsd / caseConfig;

  const deliveredCaseAed = deliveredCaseUsd * variables.usdToAedRate;
  const deliveredBottleAed = deliveredBottleUsd * variables.usdToAedRate;

  return {
    inBondCaseUsd,
    inBondBottleUsd,
    inBondCaseAed,
    inBondBottleAed,
    deliveredCaseUsd,
    deliveredBottleUsd,
    deliveredCaseAed,
    deliveredBottleAed,
  };
};

export default recalculateItemPrices;
