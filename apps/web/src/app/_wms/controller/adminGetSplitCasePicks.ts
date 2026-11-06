import { and, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners, users, wmsStockMovements } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

/**
 * Every pick in a period that took bottles rather than whole cases (staff only)
 *
 * Read-only. A by-the-bottle pick means a case was opened on the floor, which
 * is repack work the Repack screen never sees. A pick counts here when its
 * bottles are not a whole number of the pack named in the LWIN18; picks of
 * internal codes without a numeric pack are left out.
 *
 * @example
 *   await trpcClient.wms.admin.stock.getSplitCasePicks.query({ dateFrom, dateTo });
 */
const adminGetSplitCasePicks = staffAdminProcedure
  .input(z.object({ dateFrom: z.coerce.date(), dateTo: z.coerce.date() }))
  .query(async ({ input }) => {
    const pack = sql`nullif(case when split_part(${wmsStockMovements.lwin18}, '-', 3) ~ '^[0-9]+$' then split_part(${wmsStockMovements.lwin18}, '-', 3)::int end, 0)`;

    return db
      .select({
        movementNumber: wmsStockMovements.movementNumber,
        performedAt: wmsStockMovements.performedAt,
        owner: partners.businessName,
        productName: wmsStockMovements.productName,
        lwin18: wmsStockMovements.lwin18,
        bottles: wmsStockMovements.quantityBottles,
        notes: wmsStockMovements.notes,
        performedBy: users.name,
      })
      .from(wmsStockMovements)
      .leftJoin(partners, eq(partners.id, wmsStockMovements.fromOwnerId))
      .leftJoin(users, eq(users.id, wmsStockMovements.performedBy))
      .where(
        and(
          inArray(wmsStockMovements.movementType, ['pick', 'dispatch']),
          isNotNull(wmsStockMovements.quantityBottles),
          gte(wmsStockMovements.performedAt, input.dateFrom),
          lt(wmsStockMovements.performedAt, input.dateTo),
          sql`${wmsStockMovements.quantityBottles} % ${pack} <> 0`,
        ),
      )
      .orderBy(wmsStockMovements.performedAt);
  });

export default adminGetSplitCasePicks;
