import { and, count, desc, eq, ilike, or } from 'drizzle-orm';

import db from '@/database/client';
import { sourceCustomerPos, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import getManyCustomerPosSchema from '../schemas/getManyCustomerPosSchema';

/**
 * Get many Customer POs with pagination and filtering
 *
 * @example
 *   await trpcClient.source.admin.customerPo.getMany.query({
 *     limit: 20,
 *     status: 'matched',
 *   });
 */
const adminGetManyCustomerPos = adminProcedure
  .input(getManyCustomerPosSchema)
  .query(async ({ input }) => {
    const { limit, cursor, search, status, rfqId } = input;

    const conditions = [];

    if (status) {
      conditions.push(eq(sourceCustomerPos.status, status));
    }

    if (rfqId) {
      conditions.push(eq(sourceCustomerPos.rfqId, rfqId));
    }

    if (search) {
      conditions.push(
        or(
          ilike(sourceCustomerPos.poNumber, `%${search}%`),
          ilike(sourceCustomerPos.ccPoNumber, `%${search}%`),
          ilike(sourceCustomerPos.customerName, `%${search}%`),
          ilike(sourceCustomerPos.customerCompany, `%${search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: sourceCustomerPos.id,
          poNumber: sourceCustomerPos.poNumber,
          ccPoNumber: sourceCustomerPos.ccPoNumber,
          rfqId: sourceCustomerPos.rfqId,
          status: sourceCustomerPos.status,
          customerName: sourceCustomerPos.customerName,
          customerCompany: sourceCustomerPos.customerCompany,
          totalSellPriceUsd: sourceCustomerPos.totalSellPriceUsd,
          totalBuyPriceUsd: sourceCustomerPos.totalBuyPriceUsd,
          totalProfitUsd: sourceCustomerPos.totalProfitUsd,
          profitMarginPercent: sourceCustomerPos.profitMarginPercent,
          itemCount: sourceCustomerPos.itemCount,
          losingItemCount: sourceCustomerPos.losingItemCount,
          createdAt: sourceCustomerPos.createdAt,
          rfqNumber: sourceRfqs.rfqNumber,
        })
        .from(sourceCustomerPos)
        .leftJoin(sourceRfqs, eq(sourceCustomerPos.rfqId, sourceRfqs.id))
        .where(whereClause)
        .orderBy(desc(sourceCustomerPos.createdAt))
        .limit(limit)
        .offset(cursor),
      db
        .select({ count: count() })
        .from(sourceCustomerPos)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return {
      items,
      total,
      nextCursor: cursor + limit < total ? cursor + limit : null,
    };
  });

export default adminGetManyCustomerPos;
