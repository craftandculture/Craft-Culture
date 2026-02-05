import { desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  exchangeOrderItems,
  exchangeOrders,
  partners,
} from '@/database/schema';
import { supplierProcedure } from '@/lib/trpc/procedures';

import { exchangeOrderListSchema } from '../../schemas/exchangeOrderSchema';

/**
 * Get supplier sales history
 *
 * Returns paginated list of items sold from this supplier's inventory,
 * including buyer info and order status.
 *
 * @example
 *   const sales = await api.exchange.supplier.salesList.query({ page: 1 });
 */
const supplierSalesList = supplierProcedure
  .input(exchangeOrderListSchema)
  .query(async ({ ctx, input }) => {
    const { partnerId } = ctx;
    const { page, limit, status: _status } = input;
    const offset = (page - 1) * limit;

    // Build base query using denormalized fields on exchangeOrderItems
    const baseQuery = db
      .select({
        itemId: exchangeOrderItems.id,
        orderId: exchangeOrderItems.orderId,
        supplierProductId: exchangeOrderItems.supplierProductId,
        productName: exchangeOrderItems.productName,
        vintage: exchangeOrderItems.productVintage,
        quantity: exchangeOrderItems.quantity,
        pricePerCase: exchangeOrderItems.unitPriceUsd,
        totalPrice: exchangeOrderItems.lineTotalUsd,
        supplierCostEur: exchangeOrderItems.supplierCostEur,
        orderStatus: exchangeOrders.status,
        orderReference: exchangeOrders.orderNumber,
        buyerName: partners.businessName,
        createdAt: exchangeOrderItems.createdAt,
      })
      .from(exchangeOrderItems)
      .innerJoin(
        exchangeOrders,
        eq(exchangeOrderItems.orderId, exchangeOrders.id),
      )
      .innerJoin(partners, eq(exchangeOrders.buyerId, partners.id))
      .where(eq(exchangeOrderItems.supplierId, partnerId));

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(exchangeOrderItems)
      .where(eq(exchangeOrderItems.supplierId, partnerId));

    const total = countResult?.count ?? 0;

    // Get paginated results
    const items = await baseQuery
      .orderBy(desc(exchangeOrderItems.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

export default supplierSalesList;
