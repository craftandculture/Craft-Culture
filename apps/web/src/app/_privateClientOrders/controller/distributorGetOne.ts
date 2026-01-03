import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
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
import { distributorProcedure } from '@/lib/trpc/procedures';

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
        partner: {
          id: partners.id,
          businessName: partners.businessName,
          logoUrl: partners.logoUrl,
        },
        client: {
          id: privateClientContacts.id,
          name: privateClientContacts.name,
          cityDrinksVerifiedAt: privateClientContacts.cityDrinksVerifiedAt,
          cityDrinksAccountName: privateClientContacts.cityDrinksAccountName,
          cityDrinksPhone: privateClientContacts.cityDrinksPhone,
        },
      })
      .from(privateClientOrders)
      .leftJoin(partners, eq(privateClientOrders.partnerId, partners.id))
      .leftJoin(privateClientContacts, eq(privateClientOrders.clientId, privateClientContacts.id))
      .where(
        and(
          eq(privateClientOrders.id, input.id),
          eq(privateClientOrders.distributorId, partnerId),
          // Only show orders that are past CC approval
          inArray(privateClientOrders.status, [
            'cc_approved',
            'awaiting_partner_verification',
            'awaiting_distributor_verification',
            'verification_suspended',
            'awaiting_client_payment',
            'client_paid',
            'scheduling_delivery',
            'delivery_scheduled',
            'awaiting_distributor_payment',
            'distributor_paid',
            'awaiting_partner_payment',
            'partner_paid',
            'stock_in_transit',
            'with_distributor',
            'out_for_delivery',
            'delivered',
          ]),
        ),
      );

    if (!orderResult) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found or not accessible',
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
      partner: orderResult.partner,
      client: orderResult.client,
      items,
      activityLogs: activityLogs.map((row) => ({
        ...row.log,
        user: row.user,
        partner: row.partner,
      })),
    };
  });

export default distributorGetOne;
