import { TRPCError } from '@trpc/server';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import generateOrderNumber from '@/app/_privateClientOrders/utils/generateOrderNumber';
import db from '@/database/client';
import {
  type CellarReleaseRequest,
  cellarReleaseRequestItems,
  cellarReleaseRequests,
  partners,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';

import getReleaseDeliveryDetails from './getReleaseDeliveryDetails';
import buildReleaseDeliveryNotes from '../utils/buildReleaseDeliveryNotes';

type ReleaseLine = typeof cellarReleaseRequestItems.$inferSelect;

/**
 * Confirm a quoted release and raise its private client order
 *
 * Shared by the member's Accept and staff confirming on the member's behalf, so
 * the two can never raise different orders for the same agreement.
 *
 * From this point fulfilment is the existing private client order: dispatch,
 * delivery notes and invoicing already know how to handle one, and a second
 * path would be a second set of bugs.
 *
 * When the Zoho order already exists, because the team raised it before the
 * member pressed Accept, the PCO is linked to it, so the button that raises a
 * sales order refuses to raise a second.
 *
 * @example
 *   const order = await raiseReleaseOrder({
 *     request,
 *     lines,
 *     confirmedBy,
 *     salesOrder: null,
 *   });
 *
 * @param params.request - The quoted release
 * @param params.lines - Its wines
 * @param params.confirmedBy - The user confirming: the member, or staff
 * @param params.salesOrder - The Zoho order already carrying the wine, if any
 * @returns The order raised
 */
const raiseReleaseOrder = async ({
  request,
  lines,
  confirmedBy,
  salesOrder,
}: {
  request: CellarReleaseRequest;
  lines: ReleaseLine[];
  confirmedBy: string;
  salesOrder: { zohoSalesOrderId: string; salesOrderNumber: string } | null;
}) => {
  const [owner] = await db
    .select({
      businessName: partners.businessName,
      businessPhone: partners.businessPhone,
    })
    .from(partners)
    .where(eq(partners.id, request.partnerId))
    .limit(1);

  const memberName = owner?.businessName ?? 'Private Cellar member';

  /*
    The person at the door. For a gift that is the recipient, and the
    distributor checks their age and ID, so the order names them — with the
    member alongside, so nobody mistakes whose wine it is.
  */
  const details = (await getReleaseDeliveryDetails([request.id])).get(
    request.id,
  );
  const isGift = details?.isGift === true && Boolean(details.recipientName);

  const bottles = lines.reduce((sum, line) => sum + line.bottles, 0);

  /*
    One transaction, and the request is claimed before anything is raised.
    A double click, or a withdraw landing at the same moment, finds nothing
    to claim and stops — otherwise one delivery raised two orders.
  */
  const order = await db.transaction(async (tx) => {
    const now = new Date();

    const [claimed] = await tx
      .update(cellarReleaseRequests)
      .set({
        status: 'confirmed',
        confirmedAt: now,
        confirmedBy,
        updatedAt: now,
      })
      .where(
        and(
          eq(cellarReleaseRequests.id, request.id),
          eq(cellarReleaseRequests.status, 'under_review'),
          isNotNull(cellarReleaseRequests.quotedAt),
          isNull(cellarReleaseRequests.privateClientOrderId),
        ),
      )
      .returning({ id: cellarReleaseRequests.id });

    if (!claimed) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'This request has just changed. Please refresh to see where it stands.',
      });
    }

    const yearStart = `PCO-${now.getFullYear()}-`;

    const [lastOrder] = await tx
      .select({ orderNumber: privateClientOrders.orderNumber })
      .from(privateClientOrders)
      .where(sql`${privateClientOrders.orderNumber} LIKE ${yearStart + '%'}`)
      .orderBy(sql`${privateClientOrders.orderNumber} DESC`)
      .limit(1);

    const nextSequence = lastOrder?.orderNumber
      ? parseInt(lastOrder.orderNumber.split('-')[2] ?? '0', 10) + 1
      : 1;

    const [created] = await tx
      .insert(privateClientOrders)
      .values({
        orderNumber: generateOrderNumber(nextSequence),
        partnerId: request.partnerId,
        clientName: isGift
          ? `${details?.recipientName} (gift from ${memberName})`
          : memberName,
        clientPhone: isGift
          ? (details?.recipientPhone ?? null)
          : (owner?.businessPhone ?? null),
        clientAddress: request.deliveryAddress ?? null,
        deliveryNotes: buildReleaseDeliveryNotes({
          memberNotes: request.memberNotes,
          details,
          memberName,
        }),
        status: 'cc_approved',
        /*
          The goods are already the member's, so nothing is being sold. What
          is owed is the cost of getting them out: clearance and delivery.
        */
        subtotalUsd: 0,
        dutyUsd: request.clearanceCostUsd ?? 0,
        logisticsUsd: request.deliveryCostUsd ?? 0,
        totalUsd: request.totalCostUsd ?? 0,
        itemCount: lines.length,
        caseCount: bottles,
        ...(salesOrder
          ? {
              zohoSalesOrderId: salesOrder.zohoSalesOrderId,
              zohoSalesOrderNumber: salesOrder.salesOrderNumber,
              zohoSalesOrderCreatedAt: now,
            }
          : {}),
      })
      .returning({
        id: privateClientOrders.id,
        orderNumber: privateClientOrders.orderNumber,
      });

    if (!created) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not raise the order',
      });
    }

    await tx.insert(privateClientOrderItems).values(
      lines.map((line) => ({
        orderId: created.id,
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

    await tx
      .update(cellarReleaseRequests)
      .set({ privateClientOrderId: created.id })
      .where(eq(cellarReleaseRequests.id, request.id));

    return created;
  });

  return { ...order, bottles };
};

export default raiseReleaseOrder;
