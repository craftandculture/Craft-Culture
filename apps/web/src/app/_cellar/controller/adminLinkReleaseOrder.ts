import { TRPCError } from '@trpc/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';

import wineKey from '@/app/_distribution/utils/wineKey';
import resolveOrderPartnerId from '@/app/_partners/data/resolveOrderPartnerId';
import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

/**
 * Link a confirmed release to the order now carrying it, when its own order is gone
 *
 * REL-2026-0011 was confirmed and raised its order, which was then deleted, and
 * the team raised PCO-2026-00104 by hand for the same five bottles. The release
 * pointed at nothing, so the pick guard could not see the member's own
 * delivery and refused every bottle as held stock. This points the release at
 * the live order and marks that order the member's own delivery, as
 * confirming would have. The order's prices are left as they are.
 */
const adminLinkReleaseOrder = staffAdminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      orderNumber: z
        .string()
        .trim()
        .regex(/^PCO-\d{4}-\d+$/i, 'Enter a PCO number, like PCO-2026-00104'),
    }),
  )
  .mutation(async ({ input }) => {
    const orderNumber = input.orderNumber.toUpperCase();

    return db.transaction(async (tx) => {
      const [request] = await tx
        .select({
          id: cellarReleaseRequests.id,
          partnerId: cellarReleaseRequests.partnerId,
          status: cellarReleaseRequests.status,
          privateClientOrderId: cellarReleaseRequests.privateClientOrderId,
        })
        .from(cellarReleaseRequests)
        .where(eq(cellarReleaseRequests.id, input.requestId))
        .for('update');

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
      }

      const [linked] = request.privateClientOrderId
        ? await tx
            .select({ id: privateClientOrders.id })
            .from(privateClientOrders)
            .where(eq(privateClientOrders.id, request.privateClientOrderId))
            .limit(1)
        : [];

      if (request.status !== 'confirmed' || linked) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Only a confirmed release whose order is missing can be linked.',
        });
      }

      const [order] = await tx
        .select({
          id: privateClientOrders.id,
          status: privateClientOrders.status,
          partnerId: privateClientOrders.partnerId,
          clientName: privateClientOrders.clientName,
        })
        .from(privateClientOrders)
        .where(eq(privateClientOrders.orderNumber, orderNumber))
        .limit(1);

      if (!order || order.status === 'cancelled') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `${orderNumber} is not an open order in the Index.`,
        });
      }

      if (order.status === 'delivered') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${orderNumber} has already been delivered, so it cannot carry this release.`,
        });
      }

      /*
        The PCO number is typed by hand, and linking marks the order as the
        member's own delivery, which lets their bottles go out on it. So the
        order must be raised for this member (under their own record, or under
        C&C as member orders are), and carry only this release's wines.
      */
      const allowedPartnerIds = new Set([
        request.partnerId,
        await resolveOrderPartnerId(request.partnerId),
      ]);

      if (!order.partnerId || !allowedPartnerIds.has(order.partnerId)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${orderNumber} (for ${order.clientName}) belongs to another partner, not this member. Check the PCO number.`,
        });
      }

      const releaseItems = await tx
        .select({ lwin18: cellarReleaseRequestItems.lwin18 })
        .from(cellarReleaseRequestItems)
        .where(eq(cellarReleaseRequestItems.requestId, request.id));

      const orderItems = await tx
        .select({
          lwin: privateClientOrderItems.lwin,
          productName: privateClientOrderItems.productName,
        })
        .from(privateClientOrderItems)
        .where(eq(privateClientOrderItems.orderId, order.id));

      const releaseWines = new Set(
        releaseItems.map((item) => wineKey(item.lwin18)),
      );
      const strangers = orderItems.filter(
        (item) => !item.lwin || !releaseWines.has(wineKey(item.lwin)),
      );

      if (orderItems.length === 0 || strangers.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            orderItems.length === 0
              ? `${orderNumber} (for ${order.clientName}) has no lines, so it cannot be checked against this release.`
              : `${orderNumber} (for ${order.clientName}) carries wine that is not on this release: ${strangers
                  .map((item) => item.productName)
                  .join(', ')}. Check the PCO number.`,
        });
      }

      const [taken] = await tx
        .select({ id: cellarReleaseRequests.id })
        .from(cellarReleaseRequests)
        .where(
          and(
            eq(cellarReleaseRequests.privateClientOrderId, order.id),
            ne(cellarReleaseRequests.id, request.id),
          ),
        )
        .limit(1);

      if (taken) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${orderNumber} already carries another release.`,
        });
      }

      await tx
        .update(cellarReleaseRequests)
        .set({ privateClientOrderId: order.id, updatedAt: new Date() })
        .where(eq(cellarReleaseRequests.id, request.id));

      // The member's own wine going to them, so the pick guard lets their bottles go
      await tx
        .update(privateClientOrders)
        .set({ orderKind: 'owner_delivery' })
        .where(eq(privateClientOrders.id, order.id));

      return { orderNumber };
    });
  });

export default adminLinkReleaseOrder;
