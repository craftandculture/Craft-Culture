import { TRPCError } from '@trpc/server';
import { and, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  privateClientOrderItems,
  privateClientOrders,
  wmsStock,
} from '@/database/schema';

import { lwinPakKeyOf } from '../../_wms/utils/lwinPakKey';

/** A client with an order for this box this recent already has this month's */
const RECENT_BOX_DAYS = 25;

/**
 * What cloning an order would take out of the warehouse, and who already has it
 *
 * Before a box is copied for the whole membership, each line is shown in
 * bottles — per box and for the batch — beside the bottles on hand. It is the
 * check that a box is really 3 or 6 bottles, and that there is enough of each
 * wine for everyone on it, made once before any order exists.
 *
 * Stock is counted in bottles across every pack of the wine (a six and two
 * loose bottles are eight bottles of it), and does not subtract other open
 * orders: it is on-hand stock, not stock promised to nobody.
 *
 * Also returned: the clients of this partner who already have an order for
 * this same box from the last few weeks, so they can be held back — a second
 * clone for them is a double shipment.
 *
 * @param orderId - The order that would be cloned
 * @param copies - How many clones are being considered
 * @param scope - A partner id limits the source to that partner's orders
 * @returns Lines with bottles per box, needed and on hand; clients with the box
 */
const buildClonePreview = async (
  orderId: string,
  copies: number,
  scope: { partnerId?: string } = {},
) => {
  const source = await db.query.privateClientOrders.findFirst({
    where: { id: orderId },
    columns: {
      id: true,
      partnerId: true,
      subscriptionTier: true,
      subscriptionCaseSize: true,
      subscriptionVariant: true,
    },
  });

  if (!source || (scope.partnerId && source.partnerId !== scope.partnerId)) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
  }

  const items = await db
    .select()
    .from(privateClientOrderItems)
    .where(eq(privateClientOrderItems.orderId, orderId));

  if (items.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'This order has no lines to copy',
    });
  }

  const lwins = [...new Set(items.flatMap((i) => (i.lwin ? [i.lwin] : [])))];

  // Every pack of the same wine counts: group on the pack-agnostic key
  const stockRows = lwins.length
    ? await db
        .select({
          lwin18: wmsStock.lwin18,
          bottles: sql<number>`SUM(${wmsStock.availableCases} * COALESCE(${wmsStock.caseConfig}, 1))::int`,
        })
        .from(wmsStock)
        .where(
          inArray(
            sql`split_part(${wmsStock.lwin18}, '-', 1) || '-' || split_part(${wmsStock.lwin18}, '-', 2) || '-' || split_part(${wmsStock.lwin18}, '-', 4)`,
            lwins.map(lwinPakKeyOf),
          ),
        )
        .groupBy(wmsStock.lwin18)
    : [];

  const onHand = new Map<string, number>();
  for (const row of stockRows) {
    const key = lwinPakKeyOf(row.lwin18);
    onHand.set(key, (onHand.get(key) ?? 0) + (row.bottles ?? 0));
  }

  // The source order ships too, so the batch is the clones plus one
  const boxes = copies + 1;

  const lines = items.map((item) => {
    const bottlesPerBox = item.quantity * (item.caseConfig ?? 1);
    const available = item.lwin ? (onHand.get(lwinPakKeyOf(item.lwin)) ?? 0) : null;

    return {
      id: item.id,
      productName: item.productName,
      vintage: item.vintage,
      lwin: item.lwin,
      bottlesPerBox,
      bottlesNeeded: bottlesPerBox * boxes,
      available,
      pricePerCaseUsd: item.pricePerCaseUsd,
      totalUsd: item.totalUsd,
    };
  });

  const recent =
    source.subscriptionTier && source.partnerId
      ? await db
          .select({
            clientId: privateClientOrders.clientId,
            orderNumber: privateClientOrders.orderNumber,
          })
          .from(privateClientOrders)
          .where(
            and(
              eq(privateClientOrders.partnerId, source.partnerId),
              eq(privateClientOrders.subscriptionTier, source.subscriptionTier),
              source.subscriptionCaseSize === null
                ? isNull(privateClientOrders.subscriptionCaseSize)
                : eq(privateClientOrders.subscriptionCaseSize, source.subscriptionCaseSize),
              source.subscriptionVariant === null
                ? isNull(privateClientOrders.subscriptionVariant)
                : eq(privateClientOrders.subscriptionVariant, source.subscriptionVariant),
              ne(privateClientOrders.status, 'cancelled'),
              gte(
                privateClientOrders.createdAt,
                new Date(Date.now() - RECENT_BOX_DAYS * 24 * 60 * 60 * 1000),
              ),
            ),
          )
      : [];

  const clientsWithBox: Record<string, string> = {};
  for (const row of recent) {
    if (row.clientId && !clientsWithBox[row.clientId]) {
      clientsWithBox[row.clientId] = row.orderNumber;
    }
  }

  return {
    boxes,
    bottlesPerBox: lines.reduce((sum, l) => sum + l.bottlesPerBox, 0),
    boxTotalUsd: lines.reduce((sum, l) => sum + l.totalUsd, 0),
    lines,
    clientsWithBox,
  };
};

export default buildClonePreview;
