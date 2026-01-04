import type {
  B2BPricingVariables,
  ExchangeRates,
  PCOPricingVariables,
  PocketCellarPricingVariables,
} from './types';

/**
 * Default pricing variables for each commercial model
 *
 * These values are used when no overrides are configured in the database.
 * Admin can modify these via the /admin/pricing dashboard.
 */

export const DEFAULT_PCO_VARIABLES: PCOPricingVariables = {
  ccMarginPercent: 2.5,
  importDutyPercent: 20,
  transferCostPercent: 0.75,
  distributorMarginPercent: 7.5,
  vatPercent: 5,
};

export const DEFAULT_B2B_VARIABLES: B2BPricingVariables = {
  ccMarginPercent: 5,
};

export const DEFAULT_POCKET_CELLAR_VARIABLES: PocketCellarPricingVariables = {
  ccMarginPercent: 5,
  importDutyPercent: 20,
  transferCostPercent: 0.75,
  logisticsAirPerBottle: 20,
  logisticsOceanPerBottle: 5,
  distributorMarginPercent: 7.5,
  salesCommissionPercent: 2,
  vatPercent: 5,
};

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  gbpToUsd: 1.27,
  eurToUsd: 1.08,
  usdToAed: 3.67,
};

const pricingDefaults = {
  pco: DEFAULT_PCO_VARIABLES,
  b2b: DEFAULT_B2B_VARIABLES,
  pocketCellar: DEFAULT_POCKET_CELLAR_VARIABLES,
  exchangeRates: DEFAULT_EXCHANGE_RATES,
};

export default pricingDefaults;
