import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  privateClientContacts,
  privateClientOrderActivityLogs,
  privateClientOrderItems,
  privateClientOrders,
  users,
} from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single private client order by ID
 *
 * Returns the order with all line items and related data.
 * Only accessible to the wine partner who owns the order.
 */
const ordersGetOne = winePartnerProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx: { partnerId } }) => {
    // Get the order with data isolation check
    const [orderResult] = await db
      .select({
        order: privateClientOrders,
        distributor: {
          id: partners.id,
          businessName: partners.businessName,
          logoUrl: partners.logoUrl,
        },
        client: {
          id: privateClientContacts.id,
          name: privateClientContacts.name,
          email: privateClientContacts.email,
          phone: privateClientContacts.phone,
        },
      })
      .from(privateClientOrders)
      .leftJoin(partners, eq(privateClientOrders.distributorId, partners.id))
      .leftJoin(privateClientContacts, eq(privateClientOrders.clientId, privateClientContacts.id))
      .where(
        and(
          eq(privateClientOrders.id, input.id),
          eq(privateClientOrders.partnerId, partnerId),
        ),
      );

    if (!orderResult) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // Get line items with explicit column selection to ensure stock fields are included
    const items = await db
      .select({
        id: privateClientOrderItems.id,
        orderId: privateClientOrderItems.orderId,
        productId: privateClientOrderItems.productId,
        productName: privateClientOrderItems.productName,
        producer: privateClientOrderItems.producer,
        vintage: privateClientOrderItems.vintage,
        lwin: privateClientOrderItems.lwin,
        quantity: privateClientOrderItems.quantity,
        bottleSize: privateClientOrderItems.bottleSize,
        bottlesPerCase: privateClientOrderItems.bottlesPerCase,
        pricePerCaseUsd: privateClientOrderItems.pricePerCaseUsd,
        totalUsd: privateClientOrderItems.totalUsd,
        notes: privateClientOrderItems.notes,
        source: privateClientOrderItems.source,
        stockStatus: privateClientOrderItems.stockStatus,
        stockConfirmedAt: privateClientOrderItems.stockConfirmedAt,
        stockExpectedAt: privateClientOrderItems.stockExpectedAt,
        stockNotes: privateClientOrderItems.stockNotes,
        createdAt: privateClientOrderItems.createdAt,
        updatedAt: privateClientOrderItems.updatedAt,
      })
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, input.id))
      .orderBy(privateClientOrderItems.createdAt);

    // Get activity logs with user info
    const activityLogs = await db
      .select({
        log: privateClientOrderActivityLogs,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        partner: {
          id: partners.id,
          businessName: partners.businessName,
        },
      })
      .from(privateClientOrderActivityLogs)
      .leftJoin(users, eq(privateClientOrderActivityLogs.userId, users.id))
      .leftJoin(partners, eq(privateClientOrderActivityLogs.partnerId, partners.id))
      .where(eq(privateClientOrderActivityLogs.orderId, input.id))
      .orderBy(privateClientOrderActivityLogs.createdAt);

    return {
      ...orderResult.order,
      distributor: orderResult.distributor,
      client: orderResult.client,
      items,
      activityLogs: activityLogs.map((row) => ({
        ...row.log,
        user: row.user,
        partner: row.partner,
      })),
    };
  });

export default ordersGetOne;
