import { TRPCError } from '@trpc/server';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
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
import { distributorProcedure } from '@/lib/trpc/procedures';

import { DISTRIBUTOR_VISIBLE_STATUSES } from '../constants';
import distributorItemView from '../utils/distributorItemView';
import distributorOrderView from '../utils/distributorOrderView';
import distributorPartnerView from '../utils/distributorPartnerView';
import getCraftCulturePartnerId from '../utils/getCraftCulturePartnerId';

/**
 * Get a single private client order by ID for distributor
 *
 * Returns the order with all line items, activity logs, and related data.
 * Includes client verification status from the client contact record.
 * Only accessible to the distributor assigned to the order.
 */
const distributorGetOne = distributorProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx: { partnerId } }) => {
    // Get the order with data isolation check
    const [orderResult] = await db
      .select({
        order: privateClientOrders,
        client: {
          id: privateClientContacts.id,
          name: privateClientContacts.name,
          cityDrinksVerifiedAt: privateClientContacts.cityDrinksVerifiedAt,
          cityDrinksAccountName: privateClientContacts.cityDrinksAccountName,
          cityDrinksPhone: privateClientContacts.cityDrinksPhone,
        },
      })
      .from(privateClientOrders)
      .leftJoin(privateClientContacts, eq(privateClientOrders.clientId, privateClientContacts.id))
      .where(
        and(
          eq(privateClientOrders.id, input.id),
          eq(privateClientOrders.distributorId, partnerId),
          // Only show orders that are past CC approval
          inArray(privateClientOrders.status, [...DISTRIBUTOR_VISIBLE_STATUSES]),
        ),
      );

    if (!orderResult) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found or not accessible',
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

    // C&C's own orders (Private Cellar deliveries) may say so; nobody else is named
    const craftCulturePartnerId = await getCraftCulturePartnerId();
    const placedByCraftCulture =
      !!orderResult.order.partnerId && orderResult.order.partnerId === craftCulturePartnerId;

    // Get distributor details (the current user's partner) for finance email
    const [distributor] = await db
      .select({
        id: partners.id,
        businessName: partners.businessName,
        financeEmail: partners.financeEmail,
        requiresClientVerification: partners.requiresClientVerification,
        requiresOrderSku: partners.requiresOrderSku,
      })
      .from(partners)
      .where(eq(partners.id, partnerId));

    return {
      ...distributorOrderView(orderResult.order),
      // Whose client this is
      partner: (await distributorPartnerView([orderResult.order.partnerId])).get(orderResult.order.partnerId ?? '') ?? null,
      /*
        The City Drinks account details on a client are City Drinks' own
        record, so only a distributor that verifies clients is sent them.
      */
      client: orderResult.client
        ? distributor?.requiresClientVerification
          ? orderResult.client
          : {
              id: orderResult.client.id,
              name: orderResult.client.name,
              cityDrinksVerifiedAt: null,
              cityDrinksAccountName: null,
              cityDrinksPhone: null,
            }
        : null,
      distributor,
      // Without the partner's own prices, which would show C&C's margin
      items: distributorItemView(items, orderResult.order),
      activityLogs: activityLogs.map((row) =>
        counterpartySafeActivity(
          row,
          placedByCraftCulture ? null : orderResult.order.partnerId,
          'Trade partner',
        ),
      ),
    };
  });

export default distributorGetOne;
