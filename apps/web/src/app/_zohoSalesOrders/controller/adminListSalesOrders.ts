/**
 * List Zoho Sales Orders
 *
 * Returns synced sales orders from Zoho Books with their status, item counts,
 * and the linked invoice number (resolved live from zohoInvoices by
 * reference_number = sales order number, so the invoice shows even before the
 * sync backfills the invoice_number column onto the order).
 */

import { desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  zohoInvoices,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

const adminListSalesOrders = wmsOperatorProcedure.query(async () => {
  const orders = await db
    .select()
    .from(zohoSalesOrders)
    .orderBy(desc(zohoSalesOrders.createdAt))
    .limit(100);

  // Batch-resolve the linked invoice for each order (reference_number = SO number)
  const orderNumbers = orders
    .map((order) => order.salesOrderNumber)
    .filter((n): n is string => Boolean(n));

  const invoices = orderNumbers.length
    ? await db
        .select({
          referenceNumber: zohoInvoices.referenceNumber,
          invoiceNumber: zohoInvoices.invoiceNumber,
          invoiceStatus: zohoInvoices.status,
        })
        .from(zohoInvoices)
        .where(inArray(zohoInvoices.referenceNumber, orderNumbers))
    : [];

  const invoiceByRef = new Map(
    invoices.map((invoice) => [invoice.referenceNumber, invoice]),
  );

  // Fetch item counts for each order
  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const items = await db
        .select()
        .from(zohoSalesOrderItems)
        .where(eq(zohoSalesOrderItems.salesOrderId, order.id));

      const linkedInvoice = order.salesOrderNumber
        ? invoiceByRef.get(order.salesOrderNumber)
        : undefined;

      // When every line is a single bottle, the "cases" label is misleading —
      // surface a 'bottle' unit label so the picker isn't fooled by "x1".
      const allSingleBottles =
        items.length > 0 &&
        items.every((item) => /single bottle/i.test(item.name ?? ''));

      return {
        ...order,
        invoiceNumber: order.invoiceNumber ?? linkedInvoice?.invoiceNumber ?? null,
        invoiceStatus: linkedInvoice?.invoiceStatus ?? null,
        itemCount: items.length,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        unitLabel: allSingleBottles ? ('bottle' as const) : ('case' as const),
      };
    }),
  );

  return ordersWithItems;
});

export default adminListSalesOrders;
