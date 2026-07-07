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

      // Every line is `quantity` cases of its ordered pack format (from the
      // description, e.g. "3x75cl"). totalQuantity is the case count; bottleCount
      // is the true physical bottle total (quantity × bottles-per-case). The
      // "(Single Bottle)" name is just a Zoho product-code variant — ignored.
      let cases = 0;
      let bottleCount = 0;
      for (const item of items) {
        const packMatch = /^(\d+)\s*[x×]/i.exec(item.description ?? '');
        const perCase =
          packMatch && Number(packMatch[1]) > 0 ? Number(packMatch[1]) : 1;
        cases += item.quantity;
        bottleCount += item.quantity * perCase;
      }

      return {
        ...order,
        invoiceNumber: order.invoiceNumber ?? linkedInvoice?.invoiceNumber ?? null,
        invoiceStatus: linkedInvoice?.invoiceStatus ?? null,
        itemCount: items.length,
        totalQuantity: cases,
        bottleCount,
      };
    }),
  );

  return ordersWithItems;
});

export default adminListSalesOrders;
