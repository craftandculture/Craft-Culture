export interface PricingInputs {
  // Quote aggregates
  casesCount: number;
  totalIbGbp: number;
  avgCaseCostGbp: number;

  // Pricing model parameters
  fxGbpToUsd: number;
  fxUsdToAed: number;
  airFreightTotalUsd: number;
  insuranceRate: number;
  ukLogsTotalUsd: number;
  ccCommissionRate: number;
  rakTransferTotalUsd: number;
  salespersonCommissionPerCaseUsd: number;
  distributorMarginRate: number;

  // User-specific overrides (optional)
  customRates?: {
    distributorMarginRate?: number;
    ccCommissionRate?: number;
  };
}

export interface PricingBreakdown {
  // Per case calculations
  avgCaseUsd: number;
  airFreightPerCase: number;
  insurancePerCase: number;
  ukLogsPerCase: number;

  // CIF calculations
  cifPrice: number;
  cifPlusCc: number;
  ccMargin: number;

  // RAK transfer
  rakPerCase: number;
  dutyFree: number;

  // Mainland calculations
  mainlandTransfer: number;
  importTax: number;
  dutyPaid: number;

  // Distributor layer
  mainlandDistPrice: number;
  vat: number;
  priceToClientUsd: number;
  priceToClientAed: number;
}

export type UserType = 'b2b' | 'b2c' | 'private_clients';

// ============================================================================
// New Pricing Module Types (Pricing Consolidation)
// ============================================================================

/** Pricing modules available in the system */
export type PricingModuleType = 'b2b' | 'pco' | 'pocket_cellar' | 'exchange_rates';

/** Product source determines logistics costs for Pocket Cellar */
export type ProductSourceType = 'cultx' | 'local_inventory';

/** Logistics type based on product source */
export type LogisticsType = 'air' | 'ocean' | 'none';

// ============================================================================
// PCO Pricing Variables
// ============================================================================

export interface PCOPricingVariables {
  ccMarginPercent: number; // default 2.5%
  importDutyPercent: number; // default 20%
  transferCostPercent: number; // default 0.75%
  distributorMarginPercent: number; // default 7.5%
  vatPercent: number; // default 5%
}

// ============================================================================
// B2B Pricing Variables
// ============================================================================

export interface B2BPricingVariables {
  ccMarginPercent: number; // default 5%
}

// ============================================================================
// Pocket Cellar Pricing Variables
// ============================================================================

export interface PocketCellarPricingVariables {
  ccMarginPercent: number; // default 5%
  importDutyPercent: number; // default 20%
  transferCostPercent: number; // default 0.75%
  logisticsAirPerBottle: number; // default $20
  logisticsOceanPerBottle: number; // default $5
  distributorMarginPercent: number; // default 7.5%
  salesCommissionPercent: number; // default 2%
  vatPercent: number; // default 5%
}

// ============================================================================
// Calculation Results - Admin (Full Breakdown)
// ============================================================================

export interface PCOPricingResultAdmin {
  // Input
  supplierPriceUsd: number;

  // Step 1: C&C Margin
  ccMarginPercent: number;
  ccMarginAmount: number;
  landedDutyFree: number;

  // Step 2 & 3: Duty and Transfer (on LDF)
  importDutyPercent: number;
  importDutyAmount: number;
  transferCostPercent: number;
  transferCostAmount: number;
  dutyPaidLanded: number;

  // Step 4: Distributor Margin
  distributorMarginPercent: number;
  distributorMarginAmount: number;
  afterDistributor: number;

  // Step 5: VAT
  vatPercent: number;
  vatAmount: number;

  // Final
  finalPriceUsd: number;
  finalPriceAed: number;

  // Metadata
  isBespoke: boolean;
  usdToAedRate: number;
}

export interface PocketCellarPricingResultAdmin {
  // Input
  supplierPriceUsd: number;
  productSource: ProductSourceType;

  // Step 1: C&C Margin
  ccMarginPercent: number;
  ccMarginAmount: number;
  afterCcMargin: number;

  // Step 2: Logistics
  logisticsType: LogisticsType;
  logisticsPerBottle: number;
  logisticsAmount: number;
  landedDutyFree: number;

  // Step 3 & 4: Duty and Transfer (on LDF)
  importDutyPercent: number;
  importDutyAmount: number;
  transferCostPercent: number;
  transferCostAmount: number;
  dutyPaidLanded: number;

  // Step 5: Distributor Margin
  distributorMarginPercent: number;
  distributorMarginAmount: number;
  afterDistributor: number;

  // Step 6: Sales Commission
  salesCommissionPercent: number;
  salesCommissionAmount: number;
  preVat: number;

  // Step 7: VAT
  vatPercent: number;
  vatAmount: number;

  // Final
  finalPriceUsd: number;
  finalPriceAed: number;

  // Metadata
  usdToAedRate: number;
}

export interface B2BPricingResultAdmin {
  // Input
  supplierPriceUsd: number;

  // Step 1: C&C Margin
  ccMarginPercent: number;
  ccMarginAmount: number;

  // Final
  finalPriceUsd: number;
  finalPriceAed: number;

  // Metadata
  usdToAedRate: number;
}

// ============================================================================
// Calculation Results - Partner/Distributor (Consolidated)
// ============================================================================

export interface PCOPricingResultPartner {
  // Consolidated view matching existing presentation
  subtotalUsd: number; // Base product cost (hides internal margins)
  dutyUsd: number; // Import duty amount
  logisticsUsd: number; // Transfer/logistics
  vatUsd: number; // VAT amount
  totalUsd: number; // Final price
  totalAed: number; // Final price in AED
}

export interface PocketCellarPricingResultPartner {
  subtotalUsd: number;
  dutyUsd: number;
  logisticsUsd: number;
  vatUsd: number;
  totalUsd: number;
  totalAed: number;
}

// ============================================================================
// Exchange Rates
// ============================================================================

export interface ExchangeRates {
  gbpToUsd: number;
  eurToUsd: number;
  usdToAed: number;
}

// ============================================================================
// Pricing Config Keys
// ============================================================================

export const PCO_CONFIG_KEYS = [
  'cc_margin_percent',
  'import_duty_percent',
  'transfer_cost_percent',
  'distributor_margin_percent',
  'vat_percent',
] as const;

export const B2B_CONFIG_KEYS = ['cc_margin_percent'] as const;

export const POCKET_CELLAR_CONFIG_KEYS = [
  'cc_margin_percent',
  'import_duty_percent',
  'transfer_cost_percent',
  'logistics_air_per_bottle',
  'logistics_ocean_per_bottle',
  'distributor_margin_percent',
  'sales_commission_percent',
  'vat_percent',
] as const;

export const EXCHANGE_RATE_KEYS = ['gbp_to_usd', 'eur_to_usd', 'usd_to_aed'] as const;

export type PCOConfigKey = (typeof PCO_CONFIG_KEYS)[number];
export type B2BConfigKey = (typeof B2B_CONFIG_KEYS)[number];
export type PocketCellarConfigKey = (typeof POCKET_CELLAR_CONFIG_KEYS)[number];
export type ExchangeRateKey = (typeof EXCHANGE_RATE_KEYS)[number];
