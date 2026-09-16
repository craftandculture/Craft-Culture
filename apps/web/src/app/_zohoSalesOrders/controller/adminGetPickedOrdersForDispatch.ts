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

    /*
      Cases and bottles are different units and must not be added together.

      wms_pick_list_items.picked_quantity holds BOTTLES on a split-case line
      (quantity_bottles set) and CASES on a whole-case line. Summing the column
      as if it were all cases inflated the total on any order containing a
      bottle pick, and comparing that total against Zoho's ordered quantity —
      itself in bottles when the Zoho unit is Bottle — produced shortfalls that
      were units, not stock. A short badge nobody can trust is worse than none.

      So shortfall is judged per line, in that line's own unit, and never
      across the two.
    */
    interface DispatchLine {
      productName: string;
      lwin18: string | null;
      unit: 'cases' | 'bottles';
      requested: number;
      picked: number;
      isPicked: boolean;
    }

    const pickByOrder = new Map<
      string,
      {
        pickListNumber: string | null;
        pickListStatus: string | null;
        pickedCases: number;
        pickedBottles: number;
        lines: DispatchLine[];
      }
    >();

    pickRows.forEach((row) => {
      const entry = pickByOrder.get(row.orderId) ?? {
        pickListNumber: row.pickListNumber,
        pickListStatus: row.pickListStatus,
        pickedCases: 0,
        pickedBottles: 0,
        lines: [],
      };
      if (row.productName) {
        // NULL quantity_bottles means a whole-case line — see wms_pick_list_items.
        const isBottleLine = row.quantityBottles != null;
        const requested = isBottleLine
          ? (row.quantityBottles ?? 0)
          : (row.quantityCases ?? 0);
        const picked = row.pickedQuantity ?? (row.isPicked ? requested : 0);

        if (isBottleLine) entry.pickedBottles += picked;
        else entry.pickedCases += picked;

        entry.lines.push({
          productName: row.productName,
          lwin18: row.lwin18,
          unit: isBottleLine ? 'bottles' : 'cases',
          requested,
          picked,
          isPicked: row.isPicked ?? false,
        });
      }
      pickByOrder.set(row.orderId, entry);
    });

    const ordersWithCases = orders.map((order) => {
      const pick = pickByOrder.get(order.id);
      const orderedCases = orderedByOrder.get(order.id) ?? 0;
      const lines = pick?.lines ?? [];
      return {
        ...order,
        invoiceNumber: invoiceMap.get(order.salesOrderNumber) ?? null,
        pickListNumber: pick?.pickListNumber ?? null,
        pickListStatus: pick?.pickListStatus ?? null,
        orderedCases,
        pickedCases: pick?.pickedCases ?? 0,
        pickedBottles: pick?.pickedBottles ?? 0,
        // Kept as `totalCases` for existing callers; reports picked cases once
        // a pick exists, with loose bottles carried separately.
        totalCases: pick ? pick.pickedCases : orderedCases,
        // Judged line by line, each in its own unit — never cases against bottles.
        isShort: lines.some((l) => l.picked < l.requested),
        lines,
      };
    });

    return { orders: ordersWithCases };
  });

export default adminGetPickedOrdersForDispatch;
