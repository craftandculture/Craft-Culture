import { getPricingConfig } from '@/app/_pricing/data/getPricingConfig';
import { DEFAULT_EXCHANGE_RATES, DEFAULT_PCO_VARIABLES } from '@/lib/pricing/defaults';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Get shared pricing defaults for partner-facing tools
 *
 * Returns UAE regulatory values (import duty, VAT) and exchange rates
 * that can be used as defaults in calculators and tools.
 *
 * This endpoint is accessible to any authenticated user, not just admins.
 */
const sharedDefaultsGet = protectedProcedure.query(async () => {
  // Get PCO config for shared regulatory values
  const pcoConfig = await getPricingConfig('pco');
  const exchangeConfig = await getPricingConfig('exchange_rates');

  return {
    // UAE regulatory values (shared across modules)
    importDutyPercent: pcoConfig.import_duty_percent ?? DEFAULT_PCO_VARIABLES.importDutyPercent,
    vatPercent: pcoConfig.vat_percent ?? DEFAULT_PCO_VARIABLES.vatPercent,

    // Exchange rates
    usdToAed: exchangeConfig.usd_to_aed ?? DEFAULT_EXCHANGE_RATES.usdToAed,
  };
});

export default sharedDefaultsGet;
