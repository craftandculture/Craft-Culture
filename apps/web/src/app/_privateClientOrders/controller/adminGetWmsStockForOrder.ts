import { and, eq, gt, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  ownerId: z.string().uuid(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

/**
 * Get WMS stock for a specific partner (admin use).
 *
 * Same as getPartnerWmsStock but takes ownerId as input
 * so admins can browse any partner's warehouse stock.
 */
const adminGetWmsStockForOrder = adminProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    const { ownerId, search, limit, offset } = input;

    const searchConditions = search
      ? or(
          ilike(wmsStock.productName, `%${search}%`),
          ilike(wmsStock.producer, `%${search}%`),
          ilike(wmsStock.lwin18, `%${search}%`),
        )
      : undefined;

    const rows = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: sql<string>`MIN(${wmsStock.productName})`.as('product_name'),
        producer: sql<string | null>`MIN(${wmsStock.producer})`.as('producer'),
        vintage: sql<number | null>`MIN(${wmsStock.vintage})`.as('vintage'),
        bottleSize: sql<string>`MIN(${wmsStock.bottleSize})`.as('bottle_size'),
        caseConfig: wmsStock.caseConfig,
        availableCases: sql<number>`SUM(${wmsStock.availableCases})`.as('available_cases'),
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})`.as('total_cases'),
      })
      .from(wmsStock)
      .where(
        and(
          eq(wmsStock.ownerId, ownerId),
          searchConditions,
        ),
      )
      .groupBy(wmsStock.lwin18, wmsStock.caseConfig)
      .having(gt(sql`SUM(${wmsStock.availableCases})`, 0))
      .orderBy(sql`MIN(${wmsStock.productName})`)
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      meta: {
        offset,
        limit,
        hasMore: rows.length === limit,
      },
    };
  });

export default adminGetWmsStockForOrder;
