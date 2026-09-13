import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import generateOrderNumber from '@/app/_privateClientOrders/utils/generateOrderNumber';
import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  partners,
  privateClientOrderItems,
  privateClientOrders,
  wmsStock,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * Accept the quoted cost, and turn the request into an order
 *
 * The member agreeing the number is what makes this real, so the order is
 * raised here rather than by an admin afterwards — the two must not be able to
 * disagree about what was accepted.
 *
 * From this point fulfilment is the existing private client order: dispatch,
 * delivery notes and invoicing already know how to handle one, and a second
 * path would be a second set of bugs.
 */
const memberAcceptRelease = stockOwnerProcedure
  .input(z.object({ requestId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const [request] = await db
      .select()
      .from(cellarReleaseRequests)
      .where(
        and(
          eq(cellarReleaseRequests.id, input.requestId),
          eq(cellarReleaseRequests.partnerId, ctx.partner.id),
        ),
      )
      .limit(1);

    if (!request) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
    }

    if (request.status !== 'under_review' || request.quotedAt === null) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'There is no quote on this request to accept yet.',
      });
    }

    if (request.privateClientOrderId) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This release has already been accepted.',
      });
    }

    const lines = await db
      .select()
      .from(cellarReleaseRequestItems)
      .where(eq(cellarReleaseRequestItems.requestId, request.id));

    if (lines.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This request has no wines on it.',
      });
    }

    /*
      Re-checked at acceptance, not only when the request was raised.

      Time passes between a quote going out and a member agreeing it, and stock
      moves in that time — picked for another order, transferred, adjusted after
      a count. Raising the order anyway would commit us to wine that is no
      longer there, and the failure would surface in the warehouse days later
      rather than here, where it can still be explained.
    */
    const stockIds = lines
      .map((line) => line.stockId)
      .filter((id): id is string => Boolean(id));

    const held = stockIds.length
      ? await db
          .select({
            id: wmsStock.id,
            productName: wmsStock.productName,
            caseConfig: wmsStock.caseConfig,
            quantityCases: wmsStock.quantityCases,
            openBottles: wmsStock.openBottles,
          })
          .from(wmsStock)
          .where(
            and(
              inArray(wmsStock.id, stockIds),
              eq(wmsStock.ownerId, ctx.partner.id),
            ),
          )
      : [];

    const heldById = new Map(held.map((row) => [row.id, row]));

    for (const line of lines) {
      const stock = line.stockId ? heldById.get(line.stockId) : undefined;

      if (!stock) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${line.productName} is no longer held in your cellar. Contact us and we will re-quote what remains.`,
        });
      }

      const available =
        stock.quantityCases * (stock.caseConfig ?? 1) + (stock.openBottles ?? 0);

      if (line.bottles > available) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Only ${available} ${available === 1 ? 'bottle' : 'bottles'} of ${stock.productName} remain. Contact us and we will re-quote.`,
        });
      }
    }

    const [owner] = await db
      .select({ businessName: partners.businessName })
      .from(partners)
      .where(eq(partners.id, ctx.partner.id))
      .limit(1);

    const yearStart = `PCO-${new Date().getFullYear()}-`;

    const [lastOrder] = await db
      .select({ orderNumber: privateClientOrders.orderNumber })
      .from(privateClientOrders)
      .where(sql`${privateClientOrders.orderNumber} LIKE ${yearStart + '%'}`)
      .orderBy(sql`${privateClientOrders.orderNumber} DESC`)
      .limit(1);

    const nextSequence = lastOrder?.orderNumber
      ? parseInt(lastOrder.orderNumber.split('-')[2] ?? '0', 10) + 1
      : 1;

    const bottles = lines.reduce((sum, line) => sum + line.bottles, 0);

    const [order] = await db
      .insert(privateClientOrders)
      .values({
        orderNumber: generateOrderNumber(nextSequence),
        partnerId: ctx.partner.id,
        clientName: owner?.businessName ?? 'Private Cellar member',
        clientAddress: request.deliveryAddress ?? null,
        deliveryNotes: request.memberNotes ?? null,
        status: 'cc_approved',
        /*
          The goods are already the member's, so nothing is being sold. What is
          owed is the cost of getting them out: clearance and delivery.
        */
        subtotalUsd: 0,
        dutyUsd: request.clearanceCostUsd ?? 0,
        logisticsUsd: request.deliveryCostUsd ?? 0,
        totalUsd: request.totalCostUsd ?? 0,
        itemCount: lines.length,
        caseCount: bottles,
      })
      .returning({ id: privateClientOrders.id, orderNumber: privateClientOrders.orderNumber });

    if (!order) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not raise the order',
      });
    }

    await db.insert(privateClientOrderItems).values(
      lines.map((line) => ({
        orderId: order.id,
        productName: line.productName,
        vintage: line.vintage ? String(line.vintage) : null,
        lwin: line.lwin18,
        bottleSize: line.bottleSize,
        caseConfig: line.caseConfig ?? 12,
        quantity: line.bottles,
        /*
          The parcel the member chose, carried through so the pick is against
          their bottles rather than any bottles of the same wine.
        */
        sourceStockId: line.stockId,
        sourceLotNumber: line.lotNumber,
        // Nothing is being sold: the member already owns the wine.
        pricePerCaseUsd: 0,
        totalUsd: 0,
      })),
    );

    await db
      .update(cellarReleaseRequests)
      .set({
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: ctx.user.id,
        privateClientOrderId: order.id,
        updatedAt: new Date(),
      })
      .where(eq(cellarReleaseRequests.id, request.id));

    return { orderNumber: order.orderNumber, bottles };
  });

export default memberAcceptRelease;
