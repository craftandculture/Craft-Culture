import { z } from 'zod';

import { getPCOVariables, getPricingConfig } from '@/app/_pricing/data/getPricingConfig';
import { DEFAULT_B2B_VARIABLES, DEFAULT_POCKET_CELLAR_VARIABLES } from '@/lib/pricing/defaults';
import type {
  B2BPricingVariables,
  PCOPricingVariables,
  PocketCellarPricingVariables,
} from '@/lib/pricing/types';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  module: z.enum(['b2b', 'pco', 'pocket_cellar']).optional(),
});

interface PricingConfigResponse {
  b2b: B2BPricingVariables;
  pco: PCOPricingVariables;
  pocketCellar: PocketCellarPricingVariables;
}

/**
 * Get pricing configuration for all modules or a specific module
 *
 * Admin-only endpoint that returns the current pricing variables.
 */
const configGet = adminProcedure.input(inputSchema).query(async ({ input }) => {
  const { module } = input;

  // Get PCO variables (which have database support)
  const pcoVariables = await getPCOVariables();

  // Get B2B config from database
  const b2bConfig = await getPricingConfig('b2b');
  const b2bVariables: B2BPricingVariables = {
    ccMarginPercent: b2bConfig.cc_margin_percent ?? DEFAULT_B2B_VARIABLES.ccMarginPercent,
  };

  // Get Pocket Cellar config from database
  const pcConfig = await getPricingConfig('pocket_cellar');
  const pocketCellarVariables: PocketCellarPricingVariables = {
    ccMarginPercent: pcConfig.cc_margin_percent ?? DEFAULT_POCKET_CELLAR_VARIABLES.ccMarginPercent,
    importDutyPercent:
      pcConfig.import_duty_percent ?? DEFAULT_POCKET_CELLAR_VARIABLES.importDutyPercent,
    transferCostPercent:
      pcConfig.transfer_cost_percent ?? DEFAULT_POCKET_CELLAR_VARIABLES.transferCostPercent,
    logisticsAirPerBottle:
      pcConfig.logistics_air_per_bottle ?? DEFAULT_POCKET_CELLAR_VARIABLES.logisticsAirPerBottle,
    logisticsOceanPerBottle:
      pcConfig.logistics_ocean_per_bottle ?? DEFAULT_POCKET_CELLAR_VARIABLES.logisticsOceanPerBottle,
    distributorMarginPercent:
      pcConfig.distributor_margin_percent ?? DEFAULT_POCKET_CELLAR_VARIABLES.distributorMarginPercent,
    salesCommissionPercent:
      pcConfig.sales_commission_percent ?? DEFAULT_POCKET_CELLAR_VARIABLES.salesCommissionPercent,
    vatPercent: pcConfig.vat_percent ?? DEFAULT_POCKET_CELLAR_VARIABLES.vatPercent,
  };

  const response: PricingConfigResponse = {
    b2b: b2bVariables,
    pco: pcoVariables,
    pocketCellar: pocketCellarVariables,
  };

  if (module) {
    if (module === 'b2b') return { b2b: b2bVariables };
    if (module === 'pco') return { pco: pcoVariables };
    if (module === 'pocket_cellar') return { pocketCellar: pocketCellarVariables };
  }

  return response;
});

export default configGet;
