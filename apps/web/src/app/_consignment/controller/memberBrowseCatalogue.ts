import { z } from 'zod';

import getCatalogueRows from '@/app/_wms/data/getCatalogueRows';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * Everything a member can buy
 *
 * This is the catalogue, not a separate marketplace. Everything C&C holds is
 * for sale unless it is being held for its owner, and wine another member has
 * offered joins it the moment we accept — so there is one list, and consigned
 * stock is simply supply that arrived a different way.
 *
 * Priced at the private-client rate, because that is what a collector is. The
 * owner of each parcel is deliberately dropped: a buyer is buying from C&C,
 * which is legally what is happening, and whose wine it was is nobody else's
 * business.
 */
const memberBrowseCatalogue = stockOwnerProcedure
  .input(
    z
      .object({
        search: z.string().max(120).optional(),
        category: z.string().max(40).optional(),
      })
      .optional(),
  )
  .query(async ({ input }) => {
    const rows = await getCatalogueRows({
      search: input?.search,
      category: input?.category,
    });

    return {
      wines: rows.map((row) => ({
        lwin18: row.lwin18,
        product: row.product,
        producer: row.producer,
        vintage: row.vintage,
        region: row.region,
        country: row.country,
        category: row.category,
        caseConfig: row.caseConfig,
        bottleSize: row.bottleSize,
        availableBottles: row.availableBottles,
        availableCases: row.availableCases,
        pricePerBottleUsd: row.pcPerBottle,
        pricePerCaseUsd: row.pcPerCase,
      })),
    };
  });

export default memberBrowseCatalogue;
