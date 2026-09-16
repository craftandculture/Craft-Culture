/**
 * Get picked Zoho Sales Orders ready for dispatch batch
 *
 * Returns orders ready for dispatch that haven't been assigned to a dispatch batch.
 * Includes orders with status 'picked' OR orders with a completed pick list.
 * Optionally filter by distributor name.
 */

import { and, eq, inArray, isNull, like, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  wmsPickListItems,
  wmsPickLists,
  zohoInvoices,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

const adminGetPickedOrdersForDispatch = wmsOperatorProcedure
  .input(
    z
      .object({
        distributorName: z.string().optional(),
      })
      .optional(),
  )
  .query(async ({ input }) => {
    // First get IDs of orders with completed pick lists
    const completedPickLists = await db
      .select({ orderId: wmsPickLists.orderId })
      .from(wmsPickLists)
      .where(eq(wmsPickLists.status, 'completed'));

    const orderIdsWithCompletedPicks = completedPickLists.map((p) => p.orderId);

    // Build conditions: must not have dispatch batch, and either:
    // 1. Status is 'picked', OR
    // 2. Has a completed pick list
    const baseConditions = [isNull(zohoSalesOrders.dispatchBatchId)];

    // Optionally filter by distributor name (case-insensitive partial match)
    if (input?.distributorName) {
      baseConditions.push(like(zohoSalesOrders.customerName, `%${input.distributorName}%`));
    }

    // Build the status condition
    const statusCondition =
      orderIdsWithCompletedPicks.length > 0
        ? or(
            eq(zohoSalesOrders.status, 'picked'),
            inArray(zohoSalesOrders.id, orderIdsWithCompletedPicks),
          )
        : eq(zohoSalesOrders.status, 'picked');

    const orders = await db
      .select({
        id: zohoSalesOrders.id,
        salesOrderNumber: zohoSalesOrders.salesOrderNumber,
        customerName: zohoSalesOrders.customerName,
        total: zohoSalesOrders.total,
        orderDate: zohoSalesOrders.orderDate,
        status: zohoSalesOrders.status,
      })
      .from(zohoSalesOrders)
      .where(and(...baseConditions, statusCondition));

    // Look up invoice numbers for the orders
    const soNumbers = orders.map((o) => o.salesOrderNumber);
    const invoiceLookup =
      soNumbers.length > 0
        ? await db
            .select({
              referenceNumber: zohoInvoices.referenceNumber,
              invoiceNumber: zohoInvoices.invoiceNumber,
            })
            .from(zohoInvoices)
            .where(inArray(zohoInvoices.referenceNumber, soNumbers))
        : [];

    const invoiceMap = new Map(
      invoiceLookup.map((inv) => [inv.referenceNumber, inv.invoiceNumber]),
    );

    const orderIds = orders.map((o) => o.id);

    // Ordered quantities, batched — one query rather than one per order.
    const orderedRows =
      orderIds.length > 0
        ? await db
            .select({
              salesOrderId: zohoSalesOrderItems.salesOrderId,
              quantity: zohoSalesOrderItems.quantity,
            })
            .from(zohoSalesOrderItems)
            .where(inArray(zohoSalesOrderItems.salesOrderId, orderIds))
        : [];

    const orderedByOrder = new Map<string, number>();
    orderedRows.forEach((row) => {
      orderedByOrder.set(
        row.salesOrderId,
        (orderedByOrder.get(row.salesOrderId) ?? 0) + row.quantity,
      );
    });

    /*
      What is actually on the pallet, line by line.

      Dispatch used to show the ordered case count, which is the figure from
      before anyone went to the shelves. A pick that came up short still read
      as complete here, so the discrepancy surfaced at the customer rather than
      on the dock. The picked quantities are what leaves the building, so they
      are what this screen reports — with the ordered figure kept alongside so
      a shortfall is visible rather than merely absent.
    */
    const pickRows =
      orderIds.length > 0
        ? await db
            .select({
              orderId: wmsPickLists.orderId,
              pickListNumber: wmsPickLists.pickListNumber,
              pickListStatus: wmsPickLists.status,
              productName: wmsPickListItems.productName,
              lwin18: wmsPickListItems.lwin18,
              quantityCases: wmsPickListItems.quantityCases,
              quantityBottles: wmsPickListItems.quantityBottles,
              pickedQuantity: wmsPickListItems.pickedQuantity,
              isPicked: wmsPickListItems.isPicked,
            })
            .from(wmsPickLists)
            .leftJoin(
              wmsPickListItems,
              eq(wmsPickListItems.pickListId, wmsPickLists.id),
            )
            .where(inArray(wmsPickLists.orderId, orderIds))
        : [];

    interface DispatchLine {
      productName: string;
      lwin18: string | null;
      cases: number;
      bottles: number | null;
      picked: boolean;
    }

    const pickByOrder = new Map<
      string,
      {
        pickListNumber: string | null;
        pickListStatus: string | null;
        pickedCases: number;
        lines: DispatchLine[];
      }
    >();

    pickRows.forEach((row) => {
      const entry = pickByOrder.get(row.orderId) ?? {
        pickListNumber: row.pickListNumber,
        pickListStatus: row.pickListStatus,
        pickedCases: 0,
        lines: [],
      };
      if (row.productName) {
        // An unpicked line contributes nothing to the pallet but still belongs
        // on the manifest, so the gap is named rather than silently missing.
        const cases = row.pickedQuantity ?? (row.isPicked ? (row.quantityCases ?? 0) : 0);
        entry.pickedCases += cases;
        entry.lines.push({
          productName: row.productName,
          lwin18: row.lwin18,
          cases,
          bottles: row.quantityBottles,
          picked: row.isPicked ?? false,
        });
      }
      pickByOrder.set(row.orderId, entry);
    });

    const ordersWithCases = orders.map((order) => {
      const pick = pickByOrder.get(order.id);
      const orderedCases = orderedByOrder.get(order.id) ?? 0;
      const pickedCases = pick?.pickedCases ?? 0;
      return {
        ...order,
        invoiceNumber: invoiceMap.get(order.salesOrderNumber) ?? null,
        pickListNumber: pick?.pickListNumber ?? null,
        pickListStatus: pick?.pickListStatus ?? null,
        orderedCases,
        pickedCases,
        // Kept as `totalCases` so existing callers keep working, but it now
        // reports what was picked once a pick exists.
        totalCases: pick ? pickedCases : orderedCases,
        isShort: pick != null && pickedCases < orderedCases,
        lines: pick?.lines ?? [],
      };
    });

    return { orders: ordersWithCases };
  });

export default adminGetPickedOrdersForDispatch;
