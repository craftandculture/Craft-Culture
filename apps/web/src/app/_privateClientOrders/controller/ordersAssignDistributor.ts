import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import type { PrivateClientOrder } from '@/database/schema';
import { partnerMembers, privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const assignDistributorSchema = z.object({
  orderId: z.string().uuid(),
  distributorId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Assign a distributor to a private client order
 *
 * Admin assigns a distributor partner to handle delivery of an approved order.
 */
const ordersAssignDistributor = adminProcedure.input(assignDistributorSchema).mutation(async ({ input, ctx }) => {
  const { orderId, distributorId, notes } = input;
  const { user } = ctx;

  // Fetch the order
  const order = await db.query.privateClientOrders.findFirst({
    where: { id: orderId },
  });

  if (!order) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Order not found',
    });
  }

  // Validate current status allows distributor assignment
  const validStatuses = ['cc_approved', 'awaiting_client_payment', 'client_paid'];
  if (!validStatuses.includes(order.status)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot assign distributor to order with status "${order.status}". Order must be approved first.`,
    });
  }

  // Verify the distributor exists and is a distributor type partner
  const distributor = await db.query.partners.findFirst({
    where: { id: distributorId },
    columns: {
      id: true,
      businessName: true,
      type: true,
      requiresClientVerification: true,
      distributorCode: true,
    },
  });

  if (!distributor) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Distributor not found',
    });
  }

  if (distributor.type !== 'distributor') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Selected partner is not a distributor',
    });
  }

  // Determine the new status based on whether distributor requires verification
  const previousStatus = order.status;
  let newStatus: PrivateClientOrder['status'];
  let paymentReference: string | null = null;

  if (distributor.requiresClientVerification) {
    // Distributor requires verification - prompt partner first
    newStatus = 'awaiting_partner_verification';
  } else {
    // No verification required - proceed directly to payment
    newStatus = 'awaiting_client_payment';
    // Generate payment reference: {distributorCode}-{orderNumber}
    paymentReference = `${distributor.distributorCode ?? 'ORD'}-${order.orderNumber}`;
  }

  // Update order with distributor and new status
  const [updatedOrder] = await db
    .update(privateClientOrders)
    .set({
      distributorId,
      distributorAssignedAt: new Date(),
      status: newStatus,
      paymentReference,
      updatedAt: new Date(),
    })
    .where(eq(privateClientOrders.id, orderId))
    .returning();

  // Log the activity
  await db.insert(privateClientOrderActivityLogs).values({
    orderId,
    userId: user.id,
    action: 'distributor_assigned',
    previousStatus,
    newStatus,
    notes: notes ?? `Assigned to ${distributor.businessName}`,
    metadata: { distributorId, distributorName: distributor.businessName },
  });

  // Send notifications based on the flow
  if (distributor.requiresClientVerification && order.partnerId) {
    // Notify partner to verify client with distributor
    const partnerMembersList = await db
      .select({ userId: partnerMembers.userId })
      .from(partnerMembers)
      .where(eq(partnerMembers.partnerId, order.partnerId));

    for (const member of partnerMembersList) {
      await createNotification({
        userId: member.userId,
        type: 'action_required',
        title: 'Client Verification Required',
        message: `Please confirm if your client is verified with ${distributor.businessName} for order ${updatedOrder?.orderNumber ?? orderId}.`,
        entityType: 'private_client_order',
        entityId: orderId,
        actionUrl: `/platform/private-orders/${orderId}`,
      });
    }
  } else {
    // Notify distributor members about the new order
    const distributorMembersList = await db
      .select({ userId: partnerMembers.userId })
      .from(partnerMembers)
      .where(eq(partnerMembers.partnerId, distributorId));

    for (const member of distributorMembersList) {
      await createNotification({
        userId: member.userId,
        type: 'po_assigned',
        title: 'New Order Assigned',
        message: `Order ${updatedOrder?.orderNumber ?? orderId} has been assigned to you. Payment reference: ${paymentReference}.`,
        entityType: 'private_client_order',
        entityId: orderId,
        actionUrl: `/platform/distributor/orders/${orderId}`,
      });
    }
  }

  return updatedOrder;
});

export default ordersAssignDistributor;
