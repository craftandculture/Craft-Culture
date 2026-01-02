import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  privateClientOrderActivityLogs,
  privateClientOrderDocuments,
  privateClientOrderStatus,
  privateClientOrders,
} from '@/database/schema';
import { distributorProcedure } from '@/lib/trpc/procedures';

type PrivateClientOrderStatus = (typeof privateClientOrderStatus.enumValues)[number];

/**
 * Valid status transitions for distributors
 *
 * New verification flow:
 * - City Drinks (CD): Requires verification - partner confirms → distributor verifies → payment
 * - The Bottle Store (TBS): No verification - straight to payment after admin assigns
 */
const distributorTransitions: Record<string, PrivateClientOrderStatus[]> = {
  // When awaiting distributor verification (CD only), use dedicated verification endpoint
  // Distributors can confirm client payment when awaiting
  awaiting_client_payment: ['client_paid'],
  // When client has paid, distributor raises PO to C&C
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
 *
 * Note: Client verification is now handled by ordersDistributorVerification
 */
const distributorUpdateStatus = distributorProcedure
  .input(updateStatusSchema)
  .mutation(async ({ input, ctx: { partnerId, user } }) => {
    const { orderId, status, notes } = input;

    // Get current order
    const [orderResult] = await db
      .select({
        order: privateClientOrders,
      })
      .from(privateClientOrders)
      .where(
        and(
          eq(privateClientOrders.id, orderId),
          eq(privateClientOrders.distributorId, partnerId),
          // Only orders assigned to this distributor
          inArray(privateClientOrders.status, [
            'cc_approved',
            'awaiting_partner_verification',
            'awaiting_distributor_verification',
            'verification_suspended',
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

    // Validate transition
    const allowedTransitions = distributorTransitions[order.status] ?? [];

    if (!allowedTransitions.includes(status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot transition from ${order.status} to ${status}`,
      });
    }

    // Check if invoice is required before confirming client payment
    if (status === 'client_paid') {
      const [invoice] = await db
        .select()
        .from(privateClientOrderDocuments)
        .where(
          and(
            eq(privateClientOrderDocuments.orderId, orderId),
            eq(privateClientOrderDocuments.documentType, 'distributor_invoice'),
          ),
        )
        .limit(1);

      if (!invoice) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must upload an invoice before confirming client payment',
        });
      }

      // Check if partner has acknowledged the invoice
      if (!order.partnerInvoiceAcknowledgedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Partner must acknowledge the invoice before you can confirm payment',
        });
      }
    }

    // Build update data with timestamp
    const updateData: Partial<typeof privateClientOrders.$inferInsert> = {
      status,
      distributorNotes: notes ?? order.distributorNotes,
      updatedAt: new Date(),
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
