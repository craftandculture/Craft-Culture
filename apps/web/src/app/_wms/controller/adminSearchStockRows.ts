import { and, desc, eq, gt, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/**
 * Individual stock lines matching a search, for actions taken on one line
 *
 * The global search groups by wine, which is right for finding a product and
 * wrong for moving one: an ownership transfer acts on a single line — one
 * owner, one place — and needs its id, owner and free quantity. The transfer
 * screen called the grouped search with a field it does not take, so it never
 * showed a result.
 *
 * @example
 *   await trpcClient.wms.admin.stock.searchRows.query({ query: 'cervaro' });
 */
const adminSearchStockRows = wmsOperatorProcedure
  .input(
    z.object({
      query: z.string().trim().min(2).max(100),
      limit: z.number().int().min(1).max(50).default(20),
    }),
  )
  .query(async ({ input }) => {
    const pattern = `%${input.query}%`;

    const rows = await db
      .select({
        id: wmsStock.id,
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        vintage: wmsStock.vintage,
        bottleSize: wmsStock.bottleSize,
        caseConfig: wmsStock.caseConfig,
        locationCode: wmsLocations.locationCode,
        ownerId: wmsStock.ownerId,
        ownerName: wmsStock.ownerName,
        quantityCases: wmsStock.quantityCases,
        availableCases: wmsStock.availableCases,
        reservedCases: wmsStock.reservedCases,
        salesArrangement: wmsStock.salesArrangement,
        notForSale: wmsStock.notForSale,
      })
      .from(wmsStock)
      .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
      .where(
        and(
          gt(wmsStock.quantityCases, 0),
          or(
            ilike(wmsStock.productName, pattern),
            ilike(wmsStock.producer, pattern),
            ilike(wmsStock.lwin18, pattern),
            ilike(wmsStock.ownerName, pattern),
          ),
        ),
      )
      .orderBy(desc(wmsStock.quantityCases))
      .limit(input.limit);

    return { results: rows };
  });

export default adminSearchStockRows;
