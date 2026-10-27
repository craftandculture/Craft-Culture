import { and, eq, gte, isNotNull, or, sql } from 'drizzle-orm';

import lwinPackAgnosticPattern from '@/app/_wms/utils/lwinPackAgnosticPattern';
import db from '@/database/client';
import {
  cellarReleaseRequests,
  privateClientOrders,
  wmsPickListItems,
  wmsPickLists,
  zohoSalesOrders,
} from '@/database/schema';

export interface ReleaseOrderPicks {
  zohoSalesOrderId: string;
  salesOrderNumber: string;
  /** The PCO already raised for this order by hand, if any */
  linkedOrderId: string | null;
  /** Bottles picked on the order, keyed by pack-agnostic LWIN pattern */
  bottlesByWine: Map<string, number>;
}

/**
 * Zoho orders whose picks already took a member's release wine
 *
 * When a member agrees a delivery on WhatsApp, the team often raises the Zoho
 * order straight away and the warehouse picks it before the member presses
 * Accept. The bottles have then left the cellar row, and the accept saw them as
 * missing. They are not missing: they are on their way, on that order.
 *
 * The team sometimes raises a PCO by hand and pushes that to Zoho, so an order
 * may already have a PCO; it is returned so the release links to it rather than
 * raising a second. An order whose PCO already carries a release is left out,
 * so one pick can never confirm two releases.
 *
 * @example
 *   await findReleasePicks({ lwins, zohoContactId, since }); // [{ salesOrderNumber: 'SO-00225', ... }]
 *
 * @param params.lwins - The LWIN18s on the release
 * @param params.zohoContactId - The member's Zoho customer; searches all their
 *   orders
 * @param params.salesOrderNumber - One named order instead, e.g. typed by staff
 * @param params.since - Ignore pick lists raised before this
 * @returns One entry per order, each with the bottles it picked of each wine
 */
const findReleasePicks = async ({
  lwins,
  zohoContactId,
  salesOrderNumber,
  since,
}: {
  lwins: string[];
  zohoContactId?: string | null;
  salesOrderNumber?: string | null;
  since?: Date | null;
}) => {
  const patterns = [
    ...new Set(
      lwins
        .map((lwin) => lwinPackAgnosticPattern(lwin))
        .filter((pattern): pattern is string => Boolean(pattern)),
    ),
  ];

  const scope = salesOrderNumber
    ? eq(
        zohoSalesOrders.salesOrderNumber,
        salesOrderNumber.trim().toUpperCase(),
      )
    : zohoContactId
      ? eq(zohoSalesOrders.zohoCustomerId, zohoContactId)
      : null;

  if (!scope || patterns.length === 0) return [];

  const rows = await db
    .select({
      zohoSalesOrderId: zohoSalesOrders.zohoSalesOrderId,
      salesOrderNumber: zohoSalesOrders.salesOrderNumber,
      linkedOrderId: privateClientOrders.id,
      lwin18: wmsPickListItems.lwin18,
      quantityBottles: wmsPickListItems.quantityBottles,
      pickedQuantity: wmsPickListItems.pickedQuantity,
    })
    .from(zohoSalesOrders)
    .innerJoin(wmsPickLists, eq(wmsPickLists.id, zohoSalesOrders.pickListId))
    .innerJoin(
      wmsPickListItems,
      eq(wmsPickListItems.pickListId, wmsPickLists.id),
    )
    .leftJoin(
      privateClientOrders,
      eq(
        privateClientOrders.zohoSalesOrderId,
        zohoSalesOrders.zohoSalesOrderId,
      ),
    )
    .where(
      and(
        scope,
        eq(wmsPickListItems.isPicked, true),
        isNotNull(wmsPickListItems.pickedQuantity),
        since ? gte(wmsPickLists.createdAt, since) : undefined,
        or(
          ...patterns.map(
            (pattern) => sql`${wmsPickListItems.lwin18} LIKE ${pattern}`,
          ),
        ),
        sql`NOT EXISTS (
          SELECT 1 FROM ${cellarReleaseRequests}
          WHERE ${cellarReleaseRequests.privateClientOrderId} = ${privateClientOrders.id}
        )`,
      ),
    );

  const byOrder = new Map<string, ReleaseOrderPicks>();

  for (const row of rows) {
    const pattern = lwinPackAgnosticPattern(row.lwin18);
    if (!pattern) continue;

    /* Bottles on a split-case line, cases on every other. */
    const pack = Number(row.lwin18.split('-')[2]) || 1;
    const bottles =
      row.quantityBottles != null
        ? (row.pickedQuantity ?? 0)
        : (row.pickedQuantity ?? 0) * pack;

    const order = byOrder.get(row.zohoSalesOrderId) ?? {
      zohoSalesOrderId: row.zohoSalesOrderId,
      salesOrderNumber: row.salesOrderNumber,
      linkedOrderId: row.linkedOrderId,
      bottlesByWine: new Map<string, number>(),
    };

    order.bottlesByWine.set(
      pattern,
      (order.bottlesByWine.get(pattern) ?? 0) + bottles,
    );
    byOrder.set(row.zohoSalesOrderId, order);
  }

  return [...byOrder.values()];
};

export default findReleasePicks;
