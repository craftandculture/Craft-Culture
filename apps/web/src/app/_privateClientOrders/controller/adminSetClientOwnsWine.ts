import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarReleaseRequests,
  privateClientOrderActivityLogs,
  privateClientOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import recalculateOrderTotals from '../utils/recalculateOrderTotals';

/**
 * Say whether the client already owns the wine on an order
 *
 * When they do, the order is an owner delivery: its lines keep the wine's
 * commercial invoice price, so duty, margins and VAT are built off it, but the
 * client is charged only what sits on top of the wine. The distributor sees the
 * wine's value, what it charges the client, and what it pays back to C&C.
 * When they do not, it is an ordinary sale and the client pays for the wine.
 *
 * A Private Cellar release is always the member's own wine, so it cannot be
 * switched to a sale. Other kinds (samples, cellar sales) are not switchable.
 * The order is repriced straight away and the change is logged.
 *
 * @example
 *   await trpc.privateClientOrders.adminSetClientOwnsWine.mutate({
 *     orderId,
 *     clientOwnsWine: true,
 *   });
 */
const adminSetClientOwnsWine = adminProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      clientOwnsWine: z.boolean(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [order] = await db
      .select({
        id: privateClientOrders.id,
        orderKind: privateClientOrders.orderKind,
      })
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, input.orderId))
      .limit(1);

    if (!order) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    if (
      order.orderKind !== 'client_sale' &&
      order.orderKind !== 'owner_delivery'
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'This order is not a client sale, so who owns the wine cannot be changed here.',
      });
    }

    const nextKind = input.clientOwnsWine ? 'owner_delivery' : 'client_sale';

    if (order.orderKind === nextKind) return { orderKind: nextKind };

    if (!input.clientOwnsWine) {
      const [release] = await db
        .select({ id: cellarReleaseRequests.id })
        .from(cellarReleaseRequests)
        .where(eq(cellarReleaseRequests.privateClientOrderId, order.id))
        .limit(1);

      if (release) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            "This order delivers a Private Cellar member's own wine, so the client always owns it.",
        });
      }
    }

    await db
      .update(privateClientOrders)
      .set({ orderKind: nextKind, updatedAt: new Date() })
      .where(eq(privateClientOrders.id, order.id));

    await recalculateOrderTotals(order.id);

    await db.insert(privateClientOrderActivityLogs).values({
      orderId: order.id,
      userId: ctx.user.id,
      action: 'pricing_updated',
      notes: input.clientOwnsWine
        ? 'Marked as the client owning the wine: the client is charged only what sits on top of it'
        : 'Marked as a sale: the client pays for the wine',
      metadata: { orderKindBefore: order.orderKind, orderKindAfter: nextKind },
    });

    return { orderKind: nextKind };
  });

export default adminSetClientOwnsWine;
