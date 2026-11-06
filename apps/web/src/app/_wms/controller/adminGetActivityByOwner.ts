import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners, wmsStockMovements } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

/**
 * Warehouse work in a period, by owner and kind of movement (staff only)
 *
 * Read-only. Counts movements, cases and bottles for each owner, so the work a
 * partner's stock causes can be set against what C&C earns from it. The owner
 * is whose stock left or, for a receipt, whose stock arrived.
 *
 * @example
 *   await trpcClient.wms.admin.stock.getActivityByOwner.query({ dateFrom, dateTo });
 */
const adminGetActivityByOwner = staffAdminProcedure
  .input(z.object({ dateFrom: z.coerce.date(), dateTo: z.coerce.date() }))
  .query(async ({ input }) => {
    const ownerId = sql`coalesce(${wmsStockMovements.fromOwnerId}, ${wmsStockMovements.toOwnerId})`;

    return db
      .select({
        owner: sql<string | null>`max(${partners.businessName})`,
        movementType: wmsStockMovements.movementType,
        movements: sql<number>`count(*)::int`,
        cases: sql<number>`coalesce(sum(${wmsStockMovements.quantityCases}), 0)::int`,
        bottles: sql<number>`coalesce(sum(${wmsStockMovements.quantityBottles}), 0)::int`,
      })
      .from(wmsStockMovements)
      .leftJoin(partners, eq(partners.id, ownerId))
      .where(and(gte(wmsStockMovements.performedAt, input.dateFrom), lt(wmsStockMovements.performedAt, input.dateTo)))
      .groupBy(ownerId, wmsStockMovements.movementType);
  });

export default adminGetActivityByOwner;
