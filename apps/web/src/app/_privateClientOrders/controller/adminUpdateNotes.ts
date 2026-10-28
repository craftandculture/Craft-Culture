import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  privateClientOrderActivityLogs,
  privateClientOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/**
 * Edit or clear an order's partner and delivery notes
 *
 * The notes were written once, when the order was raised, and could not be
 * corrected afterwards: a note that had gone out of date stayed on the order
 * for everyone to read. A field left out is untouched; an empty one clears it.
 * The previous text goes into the activity log, so nothing is lost.
 */
const adminUpdateNotes = wmsOperatorProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      partnerNotes: z.string().max(5000).optional(),
      deliveryNotes: z.string().max(5000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [order] = await db
      .select({
        partnerNotes: privateClientOrders.partnerNotes,
        deliveryNotes: privateClientOrders.deliveryNotes,
      })
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, input.orderId))
      .limit(1);

    if (!order) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    const tidy = (value: string | undefined) =>
      value === undefined ? undefined : value.trim() || null;

    const partnerNotes = tidy(input.partnerNotes);
    const deliveryNotes = tidy(input.deliveryNotes);

    const changes = [
      partnerNotes !== undefined && partnerNotes !== order.partnerNotes
        ? { field: 'Partner notes', before: order.partnerNotes, after: partnerNotes }
        : null,
      deliveryNotes !== undefined && deliveryNotes !== order.deliveryNotes
        ? { field: 'Delivery notes', before: order.deliveryNotes, after: deliveryNotes }
        : null,
    ].filter((change) => change !== null);

    if (changes.length === 0) return { changed: 0 };

    await db.transaction(async (tx) => {
      await tx
        .update(privateClientOrders)
        .set({
          ...(partnerNotes !== undefined ? { partnerNotes } : {}),
          ...(deliveryNotes !== undefined ? { deliveryNotes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(privateClientOrders.id, input.orderId));

      await tx.insert(privateClientOrderActivityLogs).values(
        changes.map((change) => ({
          orderId: input.orderId,
          userId: ctx.user.id,
          action: 'notes_updated',
          notes: `${change.field} ${change.after ? 'edited' : 'deleted'}`,
          metadata: { field: change.field, before: change.before, after: change.after },
        })),
      );
    });

    return { changed: changes.length };
  });

export default adminUpdateNotes;
