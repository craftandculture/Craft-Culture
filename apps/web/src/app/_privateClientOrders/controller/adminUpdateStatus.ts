import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { privateClientOrderStatusEnum } from '../schemas/getOrdersSchema';

const updateStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: privateClientOrderStatusEnum,
  adminNotes: z.string().optional(),
});

/**
 * Update the status of a private client order
 *
 * Admins can update the status of any order and optionally add notes.
 */
const adminUpdateStatus = adminProcedure
  .input(updateStatusSchema)
  .mutation(async ({ input }) => {
    const { orderId, status, adminNotes } = input;

    // Verify order exists
    const [existing] = await db
      .select({ id: privateClientOrders.id })
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, orderId));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
    }

    // Update the order status
    const [updated] = await db
      .update(privateClientOrders)
      .set({
        status,
        adminNotes: adminNotes ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(privateClientOrders.id, orderId))
      .returning();

    return updated;
  });

export default adminUpdateStatus;
