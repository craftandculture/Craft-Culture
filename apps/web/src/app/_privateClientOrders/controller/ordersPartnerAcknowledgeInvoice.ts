import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrderDocuments, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import notifyDistributorOfOrderUpdate from '../utils/notifyDistributorOfOrderUpdate';

const acknowledgeSchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * Partner acknowledges receipt of distributor invoice
 *
 * When a distributor uploads an invoice, the partner must acknowledge
 * that they have received it and forwarded it to their client.
 * This enables the distributor to confirm payment once received.
 */
const ordersPartnerAcknowledgeInvoice = winePartnerProcedure
  .input(acknowledgeSchema)
  .mutation(async ({ input, ctx }) => {
    const { orderId } = input;
    const { partnerId, user } = ctx;

    // Fetch the order
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId, partnerId },
    });

    if (!order) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found or not owned by you',
      });
    }

    // Validate order status - must be awaiting client payment
    if (order.status !== 'awaiting_client_payment') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot acknowledge invoice for order with status "${order.status}". Order must be awaiting client payment.`,
      });
    }

    // Check if already acknowledged
    if (order.partnerInvoiceAcknowledgedAt) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Invoice has already been acknowledged',
      });
    }

    // Verify invoice exists
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
        message: 'No invoice has been uploaded by the distributor yet',
      });
    }

    // Update order with acknowledgment
    const [updatedOrder] = await db
      .update(privateClientOrders)
      .set({
        partnerInvoiceAcknowledgedAt: new Date(),
        partnerInvoiceAcknowledgedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    // Log the activity
    await db.insert(privateClientOrderActivityLogs).values({
      orderId,
      userId: user.id,
      partnerId,
      action: 'invoice_acknowledged',
      previousStatus: order.status,
      newStatus: order.status,
      notes: 'Partner acknowledged receipt of distributor invoice',
      metadata: { invoiceId: invoice.id },
    });

    // Notify distributor that invoice was acknowledged
    if (order.distributorId) {
      await notifyDistributorOfOrderUpdate({
        orderId,
        orderNumber: updatedOrder?.orderNumber ?? order.orderNumber ?? orderId,
        distributorId: order.distributorId,
        type: 'invoice_acknowledged',
        paymentReference: order.paymentReference ?? undefined,
      });
    }

    return updatedOrder;
  });

export default ordersPartnerAcknowledgeInvoice;
