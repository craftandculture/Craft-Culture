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

      // Classify each line as a single bottle or a full case, and compute the
      // TRUE physical bottle count. A line named "(Single Bottle)" is 1 bottle
      // per qty regardless of its case-config description (e.g. "3x75cl" is the
      // wine's native pack, not what's sold). A case line is qty × pack size.
      let caseUnits = 0;
      let bottleUnits = 0;
      let bottleCount = 0;
      let needsRepack = false;
      for (const item of items) {
        const isSingle = /single bottle/i.test(item.name ?? '');
        const packMatch = /^(\d+)\s*[x×]/i.exec(item.description ?? '');
        const perCase =
          packMatch && Number(packMatch[1]) > 0 ? Number(packMatch[1]) : 1;
        if (isSingle) {
          bottleUnits += item.quantity;
          bottleCount += item.quantity;
          // A single bottle pulled from a multi-bottle pack means a case must
          // be broken down — flag it so the picker plans a repack.
          if (perCase > 1) needsRepack = true;
        } else {
          caseUnits += item.quantity;
          bottleCount += item.quantity * perCase;
        }
      }

      const unitLabel =
        bottleUnits > 0 && caseUnits === 0
          ? ('bottle' as const)
          : caseUnits > 0 && bottleUnits === 0
            ? ('case' as const)
            : ('unit' as const);

      return {
        ...order,
        invoiceNumber: order.invoiceNumber ?? linkedInvoice?.invoiceNumber ?? null,
        invoiceStatus: linkedInvoice?.invoiceStatus ?? null,
        itemCount: items.length,
        totalQuantity: caseUnits + bottleUnits,
        bottleCount,
        unitLabel,
        needsRepack,
      };
    }),
  );

  return ordersWithItems;
});

export default adminListSalesOrders;
