import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
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
    columns: { id: true, businessName: true, type: true },
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

  // Update order with distributor
  const [updatedOrder] = await db
    .update(privateClientOrders)
    .set({
      distributorId,
      distributorAssignedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(privateClientOrders.id, orderId))
    .returning();

  // Log the activity
  await db.insert(privateClientOrderActivityLogs).values({
    orderId,
    userId: user.id,
    action: 'distributor_assigned',
    previousStatus: order.status,
    newStatus: order.status,
    notes: notes ?? `Assigned to ${distributor.businessName}`,
    metadata: { distributorId, distributorName: distributor.businessName },
  });

  return updatedOrder;
});

export default ordersAssignDistributor;
