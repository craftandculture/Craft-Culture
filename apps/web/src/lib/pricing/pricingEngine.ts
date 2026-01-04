import {
  DEFAULT_B2B_VARIABLES,
  DEFAULT_EXCHANGE_RATES,
  DEFAULT_PCO_VARIABLES,
  DEFAULT_POCKET_CELLAR_VARIABLES,
} from './defaults';
import type {
  B2BPricingResultAdmin,
  B2BPricingVariables,
  ExchangeRates,
  LogisticsType,
  PCOPricingResultAdmin,
  PCOPricingResultPartner,
  PCOPricingVariables,
  PocketCellarPricingResultAdmin,
  PocketCellarPricingResultPartner,
  PocketCellarPricingVariables,
  ProductSourceType,
} from './types';

/**
 * Apply a margin percentage using division
 *
 * Margin = Price ÷ (1 - margin%)
 * Example: 2.5% margin = Price ÷ 0.975
 *
 * @param price - The base price
 * @param marginPercent - The margin percentage (e.g., 2.5 for 2.5%)
 * @returns The price after margin applied
 */
const applyMargin = (price: number, marginPercent: number) => {
  return price / (1 - marginPercent / 100);
};

/**
 * Round to 2 decimal places
 */
const round2 = (value: number) => {
  return Math.round(value * 100) / 100;
};

// ============================================================================
// PCO Module Calculations
// ============================================================================

/**
 * Calculate PCO pricing with full admin breakdown
 *
 * Formula:
 * 1. Landed Duty Free = Supplier Price ÷ (1 - C&C Margin%)
 * 2. Import Duty = LDF × Duty%
 * 3. Transfer Cost = LDF × Transfer%
 * 4. Duty Paid Landed = LDF + Duty + Transfer
 * 5. After Distributor = DPL ÷ (1 - Distributor Margin%)
 * 6. VAT = After Distributor × VAT%
 * 7. Final = After Distributor + VAT
 */
const calculatePCOAdmin = (
  supplierPriceUsd: number,
  variables: PCOPricingVariables = DEFAULT_PCO_VARIABLES,
  exchangeRates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
  isBespoke: boolean = false,
): PCOPricingResultAdmin => {
  // Step 1: Apply C&C Margin
  const landedDutyFree = applyMargin(supplierPriceUsd, variables.ccMarginPercent);
  const ccMarginAmount = landedDutyFree - supplierPriceUsd;

  // Step 2 & 3: Import Duty and Transfer Cost (on Landed Duty Free)
  const importDutyAmount = landedDutyFree * (variables.importDutyPercent / 100);
  const transferCostAmount = landedDutyFree * (variables.transferCostPercent / 100);

  // Step 4: Duty Paid Landed
  const dutyPaidLanded = landedDutyFree + importDutyAmount + transferCostAmount;

  // Step 5: Apply Distributor Margin
  const afterDistributor = applyMargin(dutyPaidLanded, variables.distributorMarginPercent);
  const distributorMarginAmount = afterDistributor - dutyPaidLanded;

  // Step 6: VAT
  const vatAmount = afterDistributor * (variables.vatPercent / 100);

  // Final price
  const finalPriceUsd = afterDistributor + vatAmount;
  const finalPriceAed = finalPriceUsd * exchangeRates.usdToAed;

  return {
    supplierPriceUsd: round2(supplierPriceUsd),
    ccMarginPercent: variables.ccMarginPercent,
    ccMarginAmount: round2(ccMarginAmount),
    landedDutyFree: round2(landedDutyFree),
    importDutyPercent: variables.importDutyPercent,
    importDutyAmount: round2(importDutyAmount),
    transferCostPercent: variables.transferCostPercent,
    transferCostAmount: round2(transferCostAmount),
    dutyPaidLanded: round2(dutyPaidLanded),
    distributorMarginPercent: variables.distributorMarginPercent,
    distributorMarginAmount: round2(distributorMarginAmount),
    afterDistributor: round2(afterDistributor),
    vatPercent: variables.vatPercent,
    vatAmount: round2(vatAmount),
    finalPriceUsd: round2(finalPriceUsd),
    finalPriceAed: round2(finalPriceAed),
    isBespoke,
    usdToAedRate: exchangeRates.usdToAed,
  };
};

/**
 * Calculate PCO pricing with consolidated partner view
 *
 * Partners see:
 * - Subtotal (hides internal margins - shows Landed Duty Free)
 * - Duty (import duty amount)
 * - Logistics (transfer cost)
 * - VAT
 * - Total
 */
const calculatePCOPartner = (
  supplierPriceUsd: number,
  variables: PCOPricingVariables = DEFAULT_PCO_VARIABLES,
  exchangeRates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
): PCOPricingResultPartner => {
  const adminResult = calculatePCOAdmin(supplierPriceUsd, variables, exchangeRates);

  return {
    subtotalUsd: adminResult.landedDutyFree,
    dutyUsd: adminResult.importDutyAmount,
    logisticsUsd: adminResult.transferCostAmount,
    vatUsd: adminResult.vatAmount,
    totalUsd: adminResult.finalPriceUsd,
    totalAed: adminResult.finalPriceAed,
  };
};

// ============================================================================
// B2B Module Calculations
// ============================================================================

/**
 * Calculate B2B pricing
 *
 * Formula:
 * 1. Final B2B Price = Supplier Price ÷ (1 - C&C Margin%)
 */
const calculateB2BAdmin = (
  supplierPriceUsd: number,
  variables: B2BPricingVariables = DEFAULT_B2B_VARIABLES,
  exchangeRates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
): B2BPricingResultAdmin => {
  // Step 1: Apply C&C Margin
  const finalPriceUsd = applyMargin(supplierPriceUsd, variables.ccMarginPercent);
  const ccMarginAmount = finalPriceUsd - supplierPriceUsd;
  const finalPriceAed = finalPriceUsd * exchangeRates.usdToAed;

  return {
    supplierPriceUsd: round2(supplierPriceUsd),
    ccMarginPercent: variables.ccMarginPercent,
    ccMarginAmount: round2(ccMarginAmount),
    finalPriceUsd: round2(finalPriceUsd),
    finalPriceAed: round2(finalPriceAed),
    usdToAedRate: exchangeRates.usdToAed,
  };
};

// ============================================================================
// Pocket Cellar Module Calculations
// ============================================================================

/**
 * Determine logistics type and cost based on product source
 */
const getLogisticsInfo = (
  productSource: ProductSourceType,
  variables: PocketCellarPricingVariables,
): { type: LogisticsType; perBottle: number } => {
  if (productSource === 'cultx') {
    return { type: 'air', perBottle: variables.logisticsAirPerBottle };
  }
  // local_inventory - already in UAE, no import logistics needed
  return { type: 'none', perBottle: 0 };
};

/**
 * Calculate Pocket Cellar pricing with full admin breakdown
 *
 * Formula:
 * 1. After C&C = Supplier Price ÷ (1 - C&C Margin%)
 * 2. Landed Duty Free = After C&C + Logistics (if international)
 * 3. Import Duty = LDF × Duty%
 * 4. Transfer Cost = LDF × Transfer%
 * 5. Duty Paid Landed = LDF + Duty + Transfer
 * 6. After Distributor = DPL ÷ (1 - Distributor Margin%)
 * 7. Sales Commission = After Distributor × Commission%
 * 8. Pre-VAT = After Distributor + Sales Commission
 * 9. VAT = Pre-VAT × VAT%
 * 10. Final = Pre-VAT + VAT
 */
const calculatePocketCellarAdmin = (
  supplierPriceUsd: number,
  productSource: ProductSourceType,
  bottleCount: number = 1,
  variables: PocketCellarPricingVariables = DEFAULT_POCKET_CELLAR_VARIABLES,
  exchangeRates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
): PocketCellarPricingResultAdmin => {
  // Step 1: Apply C&C Margin
  const afterCcMargin = applyMargin(supplierPriceUsd, variables.ccMarginPercent);
  const ccMarginAmount = afterCcMargin - supplierPriceUsd;

  // Step 2: Add Logistics (if international)
  const logisticsInfo = getLogisticsInfo(productSource, variables);
  const logisticsAmount = logisticsInfo.perBottle * bottleCount;
  const landedDutyFree = afterCcMargin + logisticsAmount;

  // Step 3 & 4: Import Duty and Transfer Cost (on Landed Duty Free)
  const importDutyAmount = landedDutyFree * (variables.importDutyPercent / 100);
  const transferCostAmount = landedDutyFree * (variables.transferCostPercent / 100);

  // Step 5: Duty Paid Landed
  const dutyPaidLanded = landedDutyFree + importDutyAmount + transferCostAmount;

  // Step 6: Apply Distributor Margin
  const afterDistributor = applyMargin(dutyPaidLanded, variables.distributorMarginPercent);
  const distributorMarginAmount = afterDistributor - dutyPaidLanded;

  // Step 7: Sales Commission
  const salesCommissionAmount = afterDistributor * (variables.salesCommissionPercent / 100);

  // Step 8: Pre-VAT
  const preVat = afterDistributor + salesCommissionAmount;

  // Step 9: VAT
  const vatAmount = preVat * (variables.vatPercent / 100);

  // Final price
  const finalPriceUsd = preVat + vatAmount;
  const finalPriceAed = finalPriceUsd * exchangeRates.usdToAed;

  return {
    supplierPriceUsd: round2(supplierPriceUsd),
    productSource,
    ccMarginPercent: variables.ccMarginPercent,
    ccMarginAmount: round2(ccMarginAmount),
    afterCcMargin: round2(afterCcMargin),
    logisticsType: logisticsInfo.type,
    logisticsPerBottle: logisticsInfo.perBottle,
    logisticsAmount: round2(logisticsAmount),
    landedDutyFree: round2(landedDutyFree),
    importDutyPercent: variables.importDutyPercent,
    importDutyAmount: round2(importDutyAmount),
    transferCostPercent: variables.transferCostPercent,
    transferCostAmount: round2(transferCostAmount),
    dutyPaidLanded: round2(dutyPaidLanded),
    distributorMarginPercent: variables.distributorMarginPercent,
    distributorMarginAmount: round2(distributorMarginAmount),
    afterDistributor: round2(afterDistributor),
    salesCommissionPercent: variables.salesCommissionPercent,
    salesCommissionAmount: round2(salesCommissionAmount),
    preVat: round2(preVat),
    vatPercent: variables.vatPercent,
    vatAmount: round2(vatAmount),
    finalPriceUsd: round2(finalPriceUsd),
    finalPriceAed: round2(finalPriceAed),
    usdToAedRate: exchangeRates.usdToAed,
  };
};

/**
 * Calculate Pocket Cellar pricing with consolidated partner view
 */
const calculatePocketCellarPartner = (
  supplierPriceUsd: number,
  productSource: ProductSourceType,
  bottleCount: number = 1,
  variables: PocketCellarPricingVariables = DEFAULT_POCKET_CELLAR_VARIABLES,
  exchangeRates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
): PocketCellarPricingResultPartner => {
  const adminResult = calculatePocketCellarAdmin(
    supplierPriceUsd,
    productSource,
    bottleCount,
    variables,
    exchangeRates,
  );

  return {
    subtotalUsd: adminResult.landedDutyFree,
    dutyUsd: adminResult.importDutyAmount,
    logisticsUsd: adminResult.transferCostAmount + adminResult.logisticsAmount,
    vatUsd: adminResult.vatAmount,
    totalUsd: adminResult.finalPriceUsd,
    totalAed: adminResult.finalPriceAed,
  };
};

// ============================================================================
// Exports
// ============================================================================

export {
  applyMargin,
  calculateB2BAdmin,
  calculatePCOAdmin,
  calculatePCOPartner,
  calculatePocketCellarAdmin,
  calculatePocketCellarPartner,
  getLogisticsInfo,
  round2,
};

const pricingEngine = {
  pco: {
    admin: calculatePCOAdmin,
    partner: calculatePCOPartner,
  },
  b2b: {
    admin: calculateB2BAdmin,
  },
  pocketCellar: {
    admin: calculatePocketCellarAdmin,
    partner: calculatePocketCellarPartner,
  },
};

export default pricingEngine;
