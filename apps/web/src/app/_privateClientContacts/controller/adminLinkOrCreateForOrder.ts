import { TRPCError } from '@trpc/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import findOrCreateClientForPartner from '../utils/findOrCreateClientForPartner';

/**
 * Give an order a real client record, so it can be corrected and verified.
 *
 * Orders can be raised with the client's details typed straight onto them and
 * no `clientId` — over half of them are — which leaves nothing to edit and,
 * more importantly, nothing to mark verified. Those orders then sit at
 * `awaiting_distributor_verification` with no way out, because the flag that
 * would release them lives on a client record that was never created.
 *
 * An existing client of the same partner with the same name is reused rather
 * than duplicated: matching is on trimmed, case-insensitive name within that
 * partner, which is the same scope the client list is presented in.
 *
 * Other unlinked orders carrying that name are counted but **not** linked
 * unless asked for. Two people of one name inside a single partner is unlikely
 * but not impossible, and quietly merging two clients is much harder to undo
 * than clicking twice.
 *
 * @param input - The order to give a client record to
 * @returns The client, whether it was created, and how many other orders match
 */
const adminLinkOrCreateForOrder = wmsOperatorProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      /** Also link the other unlinked orders carrying this exact name. */
      includeMatchingOrders: z.boolean().optional().default(false),
    }),
  )
  .mutation(async ({ input }) => {
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    if (order.clientId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This order already has a client record',
      });
    }

    if (!order.partnerId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'This order has no partner, so there is nobody to own the client record',
      });
    }

    const name = (order.clientName ?? '').trim();
    if (!name) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This order has no client name to create a record from',
      });
    }

    const resolved = await findOrCreateClientForPartner(order.partnerId, {
      name,
      email: order.clientEmail,
      phone: order.clientPhone,
      address: order.clientAddress,
    });

    if (!resolved) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Client record was not created',
      });
    }

    const { clientId, created } = resolved;

    await db
      .update(privateClientOrders)
      .set({ clientId, updatedAt: new Date() })
      .where(eq(privateClientOrders.id, input.orderId));

    // Every other order of this partner with the same typed name and no record.
    const siblings = await db
      .select({ id: privateClientOrders.id })
      .from(privateClientOrders)
      .where(
        and(
          eq(privateClientOrders.partnerId, order.partnerId),
          isNull(privateClientOrders.clientId),
          sql`LOWER(TRIM(${privateClientOrders.clientName})) = LOWER(${name})`,
        ),
      );

    let alsoLinked = 0;
    if (input.includeMatchingOrders && siblings.length > 0) {
      const linked = await db
        .update(privateClientOrders)
        .set({ clientId, updatedAt: new Date() })
        .where(
          and(
            eq(privateClientOrders.partnerId, order.partnerId),
            isNull(privateClientOrders.clientId),
            sql`LOWER(TRIM(${privateClientOrders.clientName})) = LOWER(${name})`,
          ),
        )
        .returning({ id: privateClientOrders.id });
      alsoLinked = linked.length;
    }

    return {
      clientId,
      name,
      created,
      alsoLinked,
      /** Still unlinked after this call — what a second click would fix. */
      matchingOrders: input.includeMatchingOrders ? 0 : siblings.length,
    };
  });

export default adminLinkOrCreateForOrder;
