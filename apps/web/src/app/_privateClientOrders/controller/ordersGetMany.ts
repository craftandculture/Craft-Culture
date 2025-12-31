import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import getOrdersSchema from '../schemas/getOrdersSchema';

/**
 * Get list of private client orders for the current wine partner
 *
 * Results are filtered by partner ID (data isolation) and support
 * pagination, search, and status filters.
 */
const ordersGetMany = winePartnerProcedure
  .input(getOrdersSchema)
  .query(async ({ input, ctx: { partnerId } }) => {
    const { limit, cursor, search, status, clientId } = input;

    // Build where conditions - always filter by partnerId for data isolation
    const conditions = [eq(privateClientOrders.partnerId, partnerId)];

    if (status) {
      conditions.push(eq(privateClientOrders.status, status));
    }

    if (clientId) {
      conditions.push(eq(privateClientOrders.clientId, clientId));
    }

    if (search) {
      conditions.push(
        or(
          ilike(privateClientOrders.orderNumber, `%${search}%`),
          ilike(privateClientOrders.clientName, `%${search}%`),
          ilike(privateClientOrders.clientEmail, `%${search}%`),
        )!,
      );
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(privateClientOrders)
      .where(and(...conditions));

    const totalCount = Number(countResult?.count ?? 0);

    // Get orders with pagination
    const ordersList = await db
      .select({
        order: privateClientOrders,
        distributor: {
          id: partners.id,
          name: partners.name,
        },
      })
      .from(privateClientOrders)
      .leftJoin(partners, eq(privateClientOrders.distributorId, partners.id))
      .where(and(...conditions))
      .orderBy(desc(privateClientOrders.createdAt))
      .limit(limit)
      .offset(cursor);

    // Flatten the response
    const ordersWithDistributor = ordersList.map((row) => ({
      ...row.order,
      distributor: row.distributor,
    }));

    const nextCursor = cursor + limit < totalCount ? cursor + limit : null;

    return {
      data: ordersWithDistributor,
      meta: {
        totalCount,
        nextCursor,
        hasMore: nextCursor !== null,
      },
    };
  });

export default ordersGetMany;
