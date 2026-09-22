import { inArray } from 'drizzle-orm';

import planOutstandingRelease from '@/app/_wms/utils/planOutstandingRelease';
import db from '@/database/client';
import {
  wmsPickListItems,
  wmsPickLists,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/** Orders whose pick is finished but which Zoho may still have changed. */
const SETTLED = ['picked', 'dispatched', 'delivered'] as const;

/**
 * Orders that have been picked and then grown.
 *
 * A line added in Zoho after the pick was finished has nowhere to show: the
 * pick list is a record of what was picked and never changes, and the Release
 * button only appears on an unreleased order. So the added cases were invisible
 * — SO-00127 gained two and nothing on any screen said so.
 *
 * What is owed is counted from what was actually picked, so a wine picked out
 * of a six-pack and invoiced as a three-pack does not reappear here as unpicked.
 *
 * @returns One entry per order with something still owed, newest first
 */
const adminGetOutstandingOrders = wmsOperatorProcedure.query(async () => {
  const orders = await db
    .select({
      id: zohoSalesOrders.id,
      salesOrderNumber: zohoSalesOrders.salesOrderNumber,
      customerName: zohoSalesOrders.customerName,
      status: zohoSalesOrders.status,
      invoiceNumber: zohoSalesOrders.invoiceNumber,
      orderDate: zohoSalesOrders.orderDate,
      soModifiedAt: zohoSalesOrders.soModifiedAt,
    })
    .from(zohoSalesOrders)
    .where(inArray(zohoSalesOrders.status, [...SETTLED]));

  if (orders.length === 0) return { orders: [] };

  const orderIds = orders.map((order) => order.id);

  const [allItems, allPickLists] = await Promise.all([
    db
      .select()
      .from(zohoSalesOrderItems)
      .where(inArray(zohoSalesOrderItems.salesOrderId, orderIds)),
    db
      .select({
        id: wmsPickLists.id,
        orderId: wmsPickLists.orderId,
        createdAt: wmsPickLists.createdAt,
      })
      .from(wmsPickLists)
      .where(inArray(wmsPickLists.orderId, orderIds)),
  ]);

  const pickedLines = allPickLists.length
    ? await db
        .select({
          pickListId: wmsPickListItems.pickListId,
          lwin18: wmsPickListItems.lwin18,
          quantityCases: wmsPickListItems.quantityCases,
          quantityBottles: wmsPickListItems.quantityBottles,
          isPicked: wmsPickListItems.isPicked,
        })
        .from(wmsPickListItems)
        .where(
          inArray(
            wmsPickListItems.pickListId,
            allPickLists.map((list) => list.id),
          ),
        )
    : [];

  const pickListsByOrder = new Map<string, string[]>();
  // The newest pick per order: a line that reached us after it is new work,
  // whatever code it carries.
  const lastPickAtByOrder = new Map<string, Date>();

  allPickLists.forEach((list) => {
    pickListsByOrder.set(list.orderId, [
      ...(pickListsByOrder.get(list.orderId) ?? []),
      list.id,
    ]);
    const seen = lastPickAtByOrder.get(list.orderId);
    if (list.createdAt && (!seen || list.createdAt > seen)) {
      lastPickAtByOrder.set(list.orderId, list.createdAt);
    }
  });

  const outstanding = orders
    .map((order) => {
      const items = allItems.filter((item) => item.salesOrderId === order.id);
      if (items.length === 0) return null;

      const listIds = new Set(pickListsByOrder.get(order.id) ?? []);
      const picked = pickedLines.filter((line) => listIds.has(line.pickListId));

      const plan = planOutstandingRelease(
        items.map((item) => ({
          id: item.id,
          sku: item.sku,
          lwin18: item.lwin18,
          name: item.name,
          unit: item.unit,
          quantity: item.quantity,
          createdAt: item.createdAt,
        })),
        picked,
        { lastPickListAt: lastPickAtByOrder.get(order.id) ?? null },
      );

      if (plan.toRelease.length === 0) return null;

      return {
        ...order,
        outstandingBottles: plan.totalOutstandingBottles,
        lines: plan.toRelease.map((entry) => ({
          name: entry.line.name,
          sku: entry.line.sku,
          outstandingBottles: entry.outstandingBottles,
          releaseQuantity: entry.releaseQuantity,
          unit: entry.line.unit,
        })),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort(
      (a, b) =>
        (b.orderDate?.getTime() ?? 0) - (a.orderDate?.getTime() ?? 0),
    );

  return { orders: outstanding };
});

export default adminGetOutstandingOrders;
