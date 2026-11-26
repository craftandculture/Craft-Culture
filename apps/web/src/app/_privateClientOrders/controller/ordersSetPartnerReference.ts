import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderActivityLogs, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Set or clear the partner's own reference on one of their orders
 *
 * Partners raise a sales order of their own for each PCO, often after the PCO
 * is placed, so this can be set at any stage. The reference comes back on the
 * partner stock API's sale events, which is how their system matches a sale to
 * their order. The previous value goes into the activity log.
 */
const ordersSetPartnerReference = winePartnerProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      partnerReference: z.string().trim().max(100),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const [order] = await db
      .select({ partnerReference: privateClientOrders.partnerReference })
      .from(privateClientOrders)
      .where(
        and(
          eq(privateClientOrders.id, input.orderId),
          eq(privateClientOrders.partnerId, ctx.partnerId),
        ),
      )
      .limit(1);

    if (!order) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    const next = input.partnerReference || null;
    if (next === order.partnerReference) return { changed: false, partnerReference: next };

    await db.transaction(async (tx) => {
      await tx
        .update(privateClientOrders)
        .set({ partnerReference: next, updatedAt: new Date() })
        .where(eq(privateClientOrders.id, input.orderId));

      await tx.insert(privateClientOrderActivityLogs).values({
        orderId: input.orderId,
        userId: ctx.user.id,
        action: 'notes_updated',
        notes: `Your reference ${next ? 'set' : 'cleared'}`,
        metadata: { field: 'Your reference', before: order.partnerReference, after: next },
      });
    });

    return { changed: true, partnerReference: next };
  });

export default ordersSetPartnerReference;
