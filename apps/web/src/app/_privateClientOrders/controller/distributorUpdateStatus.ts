import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  privateClientContacts,
  privateClientOrderActivityLogs,
  privateClientOrderStatus,
  privateClientOrders,
} from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

type PrivateClientOrderStatus = (typeof privateClientOrderStatus.enumValues)[number];

/**
 * Valid status transitions for distributors
 */
const distributorTransitions: Record<string, PrivateClientOrderStatus[]> = {
  // After admin approval, client needs to verify on City Drinks app
  cc_approved: ['awaiting_client_verification'],
  // After client verifies, await payment
  awaiting_client_verification: ['awaiting_client_payment'],
  // When awaiting client payment, distributor can confirm payment received
  awaiting_client_payment: ['client_paid'],
  // When client has paid, distributor can pay C&C
  client_paid: ['awaiting_distributor_payment'],
  awaiting_distributor_payment: ['distributor_paid'],
  // Distributor waits for C&C to mark stock_in_transit
  // When stock arrives at distributor (after C&C ships)
  stock_in_transit: ['with_distributor'],
  // When ready to deliver
  with_distributor: ['out_for_delivery'],
  // When delivered
  out_for_delivery: ['delivered'],
};

const updateStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    'awaiting_client_verification',
    'awaiting_client_payment',
    'client_paid',
    'awaiting_distributor_payment',
    'distributor_paid',
    'stock_in_transit',
    'with_distributor',
    'out_for_delivery',
    'delivered',
  ]),
  notes: z.string().optional(),
  // City Drinks verification details (required when confirming verification)
  cityDrinksAccountName: z.string().optional(),
  cityDrinksPhone: z.string().optional(),
});

/**
 * Update order status - distributor actions
 *
 * Distributors can:
 * - Confirm client payment received
 * - Record payment to C&C
 * - Confirm stock receipt
 * - Start delivery
 * - Complete delivery
 */
const distributorUpdateStatus = distributorProcedure
  .input(updateStatusSchema)
  .mutation(async ({ input, ctx: { partnerId, user } }) => {
    const { orderId, status, notes, cityDrinksAccountName, cityDrinksPhone } = input;

    // Get current order with client contact info
    const [orderResult] = await db
      .select({
        order: privateClientOrders,
        client: {
          id: privateClientContacts.id,
          cityDrinksVerifiedAt: privateClientContacts.cityDrinksVerifiedAt,
        },
      })
      .from(privateClientOrders)
      .leftJoin(privateClientContacts, eq(privateClientOrders.clientId, privateClientContacts.id))
      .where(
        and(
          eq(privateClientOrders.id, orderId),
          eq(privateClientOrders.distributorId, partnerId),
          // Only orders assigned to this distributor
          inArray(privateClientOrders.status, [
            'cc_approved',
            'awaiting_client_verification',
            'awaiting_client_payment',
            'client_paid',
            'awaiting_distributor_payment',
            'distributor_paid',
            'awaiting_partner_payment',
            'partner_paid',
            'stock_in_transit',
            'with_distributor',
            'out_for_delivery',
          ]),
        ),
      );

    if (!orderResult) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found or not accessible',
      });
    }

    const order = orderResult.order;
    const clientAlreadyVerified = !!orderResult.client?.cityDrinksVerifiedAt;

    // Validate transition
    let allowedTransitions = distributorTransitions[order.status] ?? [];

    // Allow skipping verification step if client is already verified
    if (order.status === 'cc_approved' && clientAlreadyVerified) {
      allowedTransitions = [...allowedTransitions, 'awaiting_client_payment'];
    }

    if (!allowedTransitions.includes(status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot transition from ${order.status} to ${status}`,
      });
    }

    // Build update data with timestamp
    const updateData: Partial<typeof privateClientOrders.$inferInsert> = {
      status,
      distributorNotes: notes ?? order.distributorNotes,
    };

    // Add specific timestamp based on status
    const now = new Date();
    if (status === 'awaiting_client_payment') {
      // Client has been verified - record the verification timestamp on order
      updateData.clientVerifiedAt = now;
      updateData.clientVerifiedBy = user.id;

      // Also update the client contact record if linked
      if (order.clientId) {
        await db
          .update(privateClientContacts)
          .set({
            cityDrinksVerifiedAt: now,
            cityDrinksVerifiedBy: user.id,
            cityDrinksAccountName: cityDrinksAccountName ?? null,
            cityDrinksPhone: cityDrinksPhone ?? null,
          })
          .where(eq(privateClientContacts.id, order.clientId));
      }
    } else if (status === 'client_paid') {
      updateData.clientPaidAt = now;
    } else if (status === 'distributor_paid') {
      updateData.distributorPaidAt = now;
    } else if (status === 'with_distributor') {
      updateData.stockReceivedAt = now;
    } else if (status === 'out_for_delivery') {
      updateData.outForDeliveryAt = now;
    } else if (status === 'delivered') {
      updateData.deliveredAt = now;
    }

    // Update order
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set(updateData)
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Log activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId,
      action: `Status changed to ${status}`,
      previousStatus: order.status,
      newStatus: status,
      notes,
    });

    return updatedOrder;
  });

export default distributorUpdateStatus;
