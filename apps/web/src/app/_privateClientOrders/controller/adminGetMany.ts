import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { privateClientOrderStatusEnum } from '../schemas/getOrdersSchema';

const adminGetOrdersSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.number().default(0),
  search: z.string().optional(),
  status: privateClientOrderStatusEnum.optional(),
  partnerId: z.string().uuid().optional(),
});

/**
 * Get all private client orders for admin view
 *
 * Admins can see all orders across all partners with filtering options.
 */
const adminGetMany = adminProcedure
  .input(adminGetOrdersSchema)
  .query(async ({ input }) => {
    const { limit, cursor, search, status, partnerId } = input;

    // Build where conditions
    const conditions = [];

    if (status) {
      conditions.push(eq(privateClientOrders.status, status));
    }

    if (partnerId) {
      conditions.push(eq(privateClientOrders.partnerId, partnerId));
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(privateClientOrders)
      .where(whereClause);

    const totalCount = Number(countResult?.count ?? 0);

    // Get orders with pagination, including partner info
    const ordersList = await db
      .select({
        order: privateClientOrders,
        partner: {
          id: partners.id,
          businessName: partners.businessName,
        },
      })
      .from(privateClientOrders)
      .leftJoin(partners, eq(privateClientOrders.partnerId, partners.id))
      .where(whereClause)
      .orderBy(desc(privateClientOrders.createdAt))
      .limit(limit)
      .offset(cursor);

    // Flatten the response
    const ordersWithPartner = ordersList.map((row) => ({
      ...row.order,
      partner: row.partner,
    }));

    const nextCursor = cursor + limit < totalCount ? cursor + limit : null;

    return {
      data: ordersWithPartner,
      meta: {
        totalCount,
        nextCursor,
        hasMore: nextCursor !== null,
      },
    };
  });

export default adminGetMany;
