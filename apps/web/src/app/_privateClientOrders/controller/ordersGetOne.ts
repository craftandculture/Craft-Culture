import { TRPCError } from '@trpc/server';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import counterpartySafeActivity from '@/app/_privateClientOrders/utils/counterpartySafeActivity';
import { STAFF_ONLY_ACTIVITY_ACTIONS } from '@/app/_privateClientOrders/utils/staffOnlyActivity';
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

import partnerOrderView from '../utils/partnerOrderView';

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
          // Partners never see the distributor's name, only its role
          businessName: sql<string>`'Appointed UAE distributor'`,
          requiresClientVerification: partners.requiresClientVerification,
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

    // Get all line items for this order
    const items = await db
      .select()
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
      .where(
        and(
          eq(privateClientOrderActivityLogs.orderId, input.id),
          // C&C-only notes never reach the partner or distributor
          notInArray(privateClientOrderActivityLogs.action, [
              ...STAFF_ONLY_ACTIVITY_ACTIONS,
            ]),
        ),
      )
      .orderBy(privateClientOrderActivityLogs.createdAt);

    return {
      // No landed, duty, transfer or VAT figures: only the partner's own price and the client's
      ...partnerOrderView(orderResult.order),
      /** What the partner's wine costs C&C: their prices on the lines */
      winePriceUsd: Math.round(items.reduce((sum, item) => sum + (item.totalUsd ?? 0), 0) * 100) / 100,
      distributor: orderResult.distributor,
      client: orderResult.client,
      items,
      // The distributor's staff are never named to the partner
      activityLogs: activityLogs.map((row) =>
        counterpartySafeActivity(row, orderResult.order.distributorId, 'Distributor'),
      ),
    };
  });

export default ordersGetOne;
