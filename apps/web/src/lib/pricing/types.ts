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

export type UserType = 'b2b' | 'b2c';
