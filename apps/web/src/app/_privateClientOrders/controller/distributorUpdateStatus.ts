import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
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
  // After admin approval, distributor can confirm client payment
  cc_approved: ['client_paid'],
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
    'client_paid',
    'awaiting_distributor_payment',
    'distributor_paid',
    'stock_in_transit',
    'with_distributor',
    'out_for_delivery',
    'delivered',
  ]),
  notes: z.string().optional(),
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
    const { orderId, status, notes } = input;

    // Get current order
    const [order] = await db
      .select()
      .from(privateClientOrders)
      .where(
        and(
          eq(privateClientOrders.id, orderId),
          eq(privateClientOrders.distributorId, partnerId),
          // Only orders assigned to this distributor
          inArray(privateClientOrders.status, [
            'cc_approved',
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

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found or not accessible',
      });
    }

    // Validate transition
    const allowedTransitions = distributorTransitions[order.status] ?? [];
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
    if (status === 'client_paid') {
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
