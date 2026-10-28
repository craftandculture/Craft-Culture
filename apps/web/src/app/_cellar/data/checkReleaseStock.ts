import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';

import getClaimedBottles from '@/app/_cellar/data/getClaimedBottles';
import lwinPackAgnosticPattern from '@/app/_wms/utils/lwinPackAgnosticPattern';
import db from '@/database/client';
import {
  type CellarReleaseRequest,
  cellarReleaseRequestItems,
  wmsStock,
} from '@/database/schema';

import findReleasePicks, { type ReleaseOrderPicks } from './findReleasePicks';

type ReleaseLine = typeof cellarReleaseRequestItems.$inferSelect;

/**
 * Check a release's wine is still there to deliver, before its order is raised
 *
 * Time passes between a quote going out and it being agreed, and stock moves in
 * that time: picked for another order, transferred, adjusted after a count.
 * Raising the order anyway would commit us to wine that is no longer there, and
 * the failure would surface in the warehouse days later rather than here.
 *
 * One move is not a failure. When the team has already raised the Zoho order
 * for this delivery and the warehouse has picked it, the bottles have left the
 * cellar row because they are on their way. Any shortfall covered by picks on
 * one of the member's orders is accepted, and that order is returned so the
 * release links to it rather than being pushed to Zoho a second time.
 *
 * @example
 *   const { salesOrder } = await checkReleaseStock({
 *     request,
 *     lines,
 *     audience: 'member',
 *   });
 *
 * @param params.request - The release being confirmed
 * @param params.lines - Its wines
 * @param params.zohoContactId - The member's Zoho customer, to search their
 *   orders
 * @param params.salesOrderNumber - An order staff named; only that one is
 *   searched
 * @param params.audience - Who reads the error: the member, or staff
 * @returns The Zoho order that already carries the wine, or null
 */
const checkReleaseStock = async ({
  request,
  lines,
  zohoContactId,
  salesOrderNumber,
  audience,
}: {
  request: CellarReleaseRequest;
  lines: ReleaseLine[];
  zohoContactId?: string | null;
  salesOrderNumber?: string | null;
  audience: 'member' | 'staff';
}) => {
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
            eq(wmsStock.ownerId, request.partnerId),
          ),
        )
    : [];

  const heldById = new Map(held.map((row) => [row.id, row]));

  /* Offered for sale or due on another delivery since this was quoted. */
  const claimed = await getClaimedBottles(stockIds, {
    exceptRequestId: request.id,
  });

  const shortfalls: { line: ReleaseLine; missing: number; free: number }[] = [];

  for (const line of lines) {
    const stock = line.stockId ? heldById.get(line.stockId) : undefined;

    const free = stock
      ? stock.quantityCases * (stock.caseConfig ?? 1) +
        (stock.openBottles ?? 0) -
        (claimed.get(stock.id) ?? 0)
      : 0;

    if (line.bottles > free) {
      shortfalls.push({
        line,
        missing: line.bottles - Math.max(free, 0),
        free,
      });
    }
  }

  if (shortfalls.length === 0) return { salesOrder: null };

  const orders = await findReleasePicks({
    lwins: shortfalls.map(({ line }) => line.lwin18),
    zohoContactId: salesOrderNumber ? null : zohoContactId,
    salesOrderNumber,
    since: salesOrderNumber ? null : (request.submittedAt ?? request.createdAt),
  });

  /* One order must cover every shortfall; a PCO links to a single SO. */
  const covers = (order: ReleaseOrderPicks) => {
    const left = new Map(order.bottlesByWine);

    return shortfalls.every(({ line, missing }) => {
      const pattern = lwinPackAgnosticPattern(line.lwin18);
      const picked = pattern ? (left.get(pattern) ?? 0) : 0;

      if (!pattern || picked < missing) return false;

      left.set(pattern, picked - missing);
      return true;
    });
  };

  const order = orders.find(covers);

  if (order) {
    return {
      salesOrder: {
        zohoSalesOrderId: order.zohoSalesOrderId,
        salesOrderNumber: order.salesOrderNumber,
        linkedOrderId: order.linkedOrderId,
      },
    };
  }

  const [{ line, free }] = shortfalls as [(typeof shortfalls)[number]];
  const name = line.productName;

  if (audience === 'staff') {
    throw new TRPCError({
      code: 'CONFLICT',
      message: salesOrderNumber
        ? `${salesOrderNumber.trim().toUpperCase()} has not picked ${name}, or its order already carries another release. Check the order number.`
        : `${name} is no longer in the member's cellar. If it went out on a Zoho order, enter that order number.`,
    });
  }

  throw new TRPCError({
    code: 'CONFLICT',
    message:
      free > 0
        ? `Only ${free} ${free === 1 ? 'bottle' : 'bottles'} of ${name} ${free === 1 ? 'is' : 'are'} free to deliver now. Contact us and we will re-quote.`
        : `${name} has already left your cellar. Contact us and we will confirm where it stands.`,
  });
};

export default checkReleaseStock;
