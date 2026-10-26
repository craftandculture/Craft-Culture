import { TRPCError } from '@trpc/server';
import { and, eq, gt, like, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  users,
  wmsLocations,
  wmsPickListItems,
  wmsPickLists,
  wmsStock,
  wmsStockReservations,
  zohoInvoices,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getPickListSchema } from '../schemas/pickListSchema';
import chooseLiveBay from '../utils/chooseLiveBay';
import lwinPackAgnosticPattern from '../utils/lwinPackAgnosticPattern';
import parseSkuPack from '../utils/parseSkuPack';

/**
 * Get a single pick list with items and location details
 *
 * @example
 *   await trpcClient.wms.admin.picking.getOne.query({ pickListId: "uuid" });
 */
const adminGetPickList = wmsOperatorProcedure
  .input(getPickListSchema)
  .query(async ({ input }) => {
    const { pickListId } = input;

    // Get pick list with assignee info
    const [pickList] = await db
      .select({
        id: wmsPickLists.id,
        pickListNumber: wmsPickLists.pickListNumber,
        status: wmsPickLists.status,
        orderId: wmsPickLists.orderId,
        orderNumber: wmsPickLists.orderNumber,
        totalItems: wmsPickLists.totalItems,
        pickedItems: wmsPickLists.pickedItems,
        assignedTo: wmsPickLists.assignedTo,
        assignedToName: users.name,
        startedAt: wmsPickLists.startedAt,
        completedAt: wmsPickLists.completedAt,
        completedBy: wmsPickLists.completedBy,
        notes: wmsPickLists.notes,
        createdAt: wmsPickLists.createdAt,
        // Raised when the linked Zoho order was edited after release to pick —
        // drives the "re-sync pick" prompt on the pick screen.
        soModifiedAfterRelease: zohoSalesOrders.soModifiedAfterRelease,
        soModifiedAt: zohoSalesOrders.soModifiedAt,
        // Who the pick is for, with their partner logo, so the picker sees the client
        customerName: zohoSalesOrders.customerName,
        customerLogoUrl: sql<string | null>`(
          SELECT p.logo_url FROM partners p
          WHERE p.logo_url IS NOT NULL
            AND (p.zoho_contact_id = ${zohoSalesOrders.zohoCustomerId}
              OR lower(p.business_name) = lower(${zohoSalesOrders.customerName}))
          ORDER BY (p.zoho_contact_id = ${zohoSalesOrders.zohoCustomerId}) DESC NULLS LAST
          LIMIT 1
        )`,
      })
      .from(wmsPickLists)
      .leftJoin(users, eq(wmsPickLists.assignedTo, users.id))
      .leftJoin(zohoSalesOrders, eq(wmsPickLists.orderId, zohoSalesOrders.id))
      .where(eq(wmsPickLists.id, pickListId));

    if (!pickList) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pick list not found',
      });
    }

    // Get pick list items with location and stock details (case config for picking)
    const storedItems = await db
      .select({
        id: wmsPickListItems.id,
        lwin18: wmsPickListItems.lwin18,
        productName: wmsPickListItems.productName,
        quantityCases: wmsPickListItems.quantityCases,
        quantityBottles: wmsPickListItems.quantityBottles,
        suggestedLocationId: wmsPickListItems.suggestedLocationId,
        suggestedLocationCode: wmsLocations.locationCode,
        pickedFromLocationId: wmsPickListItems.pickedFromLocationId,
        pickedQuantity: wmsPickListItems.pickedQuantity,
        pickedAt: wmsPickListItems.pickedAt,
        pickedBy: wmsPickListItems.pickedBy,
        isPicked: wmsPickListItems.isPicked,
        notes: wmsPickListItems.notes,
        caseConfig: wmsStock.caseConfig,
        bottleSize: wmsStock.bottleSize,
      })
      .from(wmsPickListItems)
      .leftJoin(wmsLocations, eq(wmsPickListItems.suggestedLocationId, wmsLocations.id))
      .leftJoin(wmsStock, eq(wmsPickListItems.suggestedStockId, wmsStock.id))
      .where(eq(wmsPickListItems.pickListId, pickListId));

    /*
      The bay as the stock stands now, not as it stood when the list was made.

      Fifteen subscription-box picks in a row drain the small-pack bay, and the
      last few lists still sent the picker there to be told it held nothing
      while the wine sat in bigger cases one aisle over. Unpicked lines whose
      stored bay can no longer cover them are re-pointed here, on every read,
      so the screen always names a bay that can actually be picked from.
    */
    const patterns = [
      ...new Set(
        storedItems
          .filter((item) => !item.isPicked)
          .map((item) => lwinPackAgnosticPattern(item.lwin18))
          .filter((pattern): pattern is string => Boolean(pattern)),
      ),
    ];

    const liveStock = patterns.length
      ? await db
          .select({
            stockId: wmsStock.id,
            lwin18: wmsStock.lwin18,
            locationId: wmsStock.locationId,
            locationCode: wmsLocations.locationCode,
            storageMethod: sql<string | null>`${wmsLocations.storageMethod}::text`,
            caseConfig: wmsStock.caseConfig,
            bottleSize: wmsStock.bottleSize,
            quantityCases: wmsStock.quantityCases,
            availableCases: wmsStock.availableCases,
            openBottles: wmsStock.openBottles,
          })
          .from(wmsStock)
          .leftJoin(wmsLocations, eq(wmsStock.locationId, wmsLocations.id))
          .where(
            and(
              or(...patterns.map((pattern) => like(wmsStock.lwin18, pattern))),
              or(gt(wmsStock.quantityCases, 0), gt(wmsStock.openBottles, 0)),
            ),
          )
      : [];

    const held = pickList.orderId && liveStock.length
      ? await db
          .select({
            stockId: wmsStockReservations.stockId,
            cases: sql<number>`COALESCE(SUM(${wmsStockReservations.quantityCases}), 0)::int`,
          })
          .from(wmsStockReservations)
          .where(
            and(
              eq(wmsStockReservations.orderId, pickList.orderId),
              eq(wmsStockReservations.status, 'active'),
            ),
          )
          .groupBy(wmsStockReservations.stockId)
      : [];

    const heldByStock = new Map(held.map((row) => [row.stockId, row.cases]));

    const items = storedItems.map((item) => {
      const pattern = item.isPicked ? null : lwinPackAgnosticPattern(item.lwin18);

      if (!pattern) return { ...item, bayMovedFrom: null };

      const prefix = pattern.split('%')[0] ?? '';
      const suffix = pattern.split('%')[1] ?? '';
      const rows = liveStock
        .filter((row) => row.lwin18.startsWith(prefix) && row.lwin18.endsWith(suffix))
        .map((row) => ({
          ...row,
          openBottles: row.openBottles ?? 0,
          heldForThisOrder: heldByStock.get(row.stockId) ?? 0,
        }));

      const live = chooseLiveBay(
        {
          suggestedLocationId: item.suggestedLocationId,
          quantityBottles: item.quantityBottles,
          quantityCases: item.quantityCases,
          linePack: parseSkuPack(item.lwin18)?.pack ?? 0,
        },
        rows,
      );

      if (!live) return { ...item, bayMovedFrom: null };

      return {
        ...item,
        suggestedLocationId: live.locationId,
        suggestedLocationCode: live.locationCode,
        caseConfig: live.caseConfig,
        bottleSize: live.bottleSize,
        /* The bay the list was written against, so the screen can say why */
        bayMovedFrom: item.suggestedLocationCode,
      };
    });

    // Look up invoice number
    const [invoice] = await db
      .select({ invoiceNumber: zohoInvoices.invoiceNumber })
      .from(zohoInvoices)
      .where(eq(zohoInvoices.referenceNumber, pickList.orderNumber))
      .limit(1);

    /*
      Progress, counted in cases at both ends.

      `pickedQuantity` is in BOTTLES on a split-case line and in CASES on every
      other, while the total is always cases. Adding them straight together
      reported a finished eight-line pick as 24/20 — two lines of three bottles
      counted three each against a total that counted them one each, which
      reads as four cases picked that nobody ordered.

      A line that is picked contributes the cases it was asked for. A part-
      picked bottle line contributes nothing, because a fraction of a case has
      no honest case figure.
    */
    const totalToPick = items.reduce((sum, i) => sum + i.quantityCases, 0);
    const totalPicked = items.reduce((sum, i) => {
      if (i.isPicked) return sum + i.quantityCases;
      if (i.quantityBottles) return sum;
      return sum + (i.pickedQuantity ?? 0);
    }, 0);
    const progressPercent = totalToPick > 0 ? Math.round((totalPicked / totalToPick) * 100) : 0;

    return {
      ...pickList,
      invoiceNumber: invoice?.invoiceNumber ?? null,
      items,
      progress: {
        totalItems: items.length,
        pickedItems: items.filter((i) => i.isPicked).length,
        totalCases: totalToPick,
        pickedCases: totalPicked,
        percent: progressPercent,
      },
    };
  });

export default adminGetPickList;
