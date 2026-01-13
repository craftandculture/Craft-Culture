import { and, count, desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceCustomerPos, sourceSupplierOrders } from '@/database/schema';
import { partnerProcedure } from '@/lib/trpc/procedures';

import getManySupplierOrdersSchema from '../schemas/getManySupplierOrdersSchema';

/**
 * Get many Supplier Orders for the authenticated partner
 *
 * @example
 *   await trpcClient.source.partner.supplierOrders.getMany.query({
 *     limit: 20,
 *     status: 'sent',
 *   });
 */
const partnerGetManySupplierOrders = partnerProcedure
  .input(getManySupplierOrdersSchema)
  .query(async ({ input, ctx: { user } }) => {
    const { limit, cursor, status } = input;

    const conditions = [eq(sourceSupplierOrders.partnerId, user.partnerId)];

    if (status) {
      conditions.push(eq(sourceSupplierOrders.status, status));
    }

    const whereClause = and(...conditions);

    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: sourceSupplierOrders.id,
          orderNumber: sourceSupplierOrders.orderNumber,
          customerPoId: sourceSupplierOrders.customerPoId,
          status: sourceSupplierOrders.status,
          itemCount: sourceSupplierOrders.itemCount,
          totalAmountUsd: sourceSupplierOrders.totalAmountUsd,
          confirmedAmountUsd: sourceSupplierOrders.confirmedAmountUsd,
          sentAt: sourceSupplierOrders.sentAt,
          confirmedAt: sourceSupplierOrders.confirmedAt,
          createdAt: sourceSupplierOrders.createdAt,
          customerPoNumber: sourceCustomerPos.ccPoNumber,
          customerCompany: sourceCustomerPos.customerCompany,
        })
        .from(sourceSupplierOrders)
        .leftJoin(
          sourceCustomerPos,
          eq(sourceSupplierOrders.customerPoId, sourceCustomerPos.id),
        )
        .where(whereClause)
        .orderBy(desc(sourceSupplierOrders.sentAt))
        .limit(limit)
        .offset(cursor),
      db
        .select({ count: count() })
        .from(sourceSupplierOrders)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return {
      items,
      total,
      nextCursor: cursor + limit < total ? cursor + limit : null,
    };
  });

export default partnerGetManySupplierOrders;
