import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Get the stock source filter for the current partner
 *
 * Partners are configured to access specific stock sources:
 * - CULT Wines partners: CultX API stock (cultx)
 * - Other partners: Local inventory (local_inventory)
 *
 * This is determined by the partner's business name for now.
 * Future: Add allowedStockSources field to partners table.
 */
const partnerGetStockSource = winePartnerProcedure.query(async ({ ctx }) => {
  const { partner } = ctx;

  // CULT Wines partners can see CultX API stock
  // Other partners see local inventory only
  const isCultWines = partner.businessName.toLowerCase().includes('cult');

  const stockSource = isCultWines ? 'cultx' : 'local_inventory';

  return {
    stockSource: stockSource as 'cultx' | 'local_inventory',
    partnerName: partner.businessName,
  };
});

export default partnerGetStockSource;
