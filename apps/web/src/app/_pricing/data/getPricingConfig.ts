import { eq } from 'drizzle-orm';
import { cache } from 'react';

import db from '@/database/client';
import { pricingConfig } from '@/database/schema';
import { DEFAULT_PCO_VARIABLES } from '@/lib/pricing/defaults';
import type { PCOPricingVariables, PricingModuleType } from '@/lib/pricing/types';

/**
 * Get pricing configuration for a module from the database
 *
 * Returns all key-value pairs for the specified module.
 * Falls back to defaults if no config exists.
 */
const getPricingConfig = cache(async (module: PricingModuleType) => {
  const config = await db.query.pricingConfig.findMany({
    where: eq(pricingConfig.module, module),
  });

  return config.reduce(
    (acc, row) => {
      acc[row.key] = row.value;
      return acc;
    },
    {} as Record<string, number>,
  );
});

/**
 * Get PCO pricing variables with database overrides
 *
 * Fetches config from database and merges with defaults.
 * Database values take precedence over defaults.
 */
const getPCOVariables = cache(async (): Promise<PCOPricingVariables> => {
  const config = await getPricingConfig('pco');

  return {
    ccMarginPercent: config.cc_margin_percent ?? DEFAULT_PCO_VARIABLES.ccMarginPercent,
    importDutyPercent: config.import_duty_percent ?? DEFAULT_PCO_VARIABLES.importDutyPercent,
    transferCostPercent: config.transfer_cost_percent ?? DEFAULT_PCO_VARIABLES.transferCostPercent,
    distributorMarginPercent:
      config.distributor_margin_percent ?? DEFAULT_PCO_VARIABLES.distributorMarginPercent,
    vatPercent: config.vat_percent ?? DEFAULT_PCO_VARIABLES.vatPercent,
  };
});

export { getPCOVariables, getPricingConfig };

export default getPricingConfig;
