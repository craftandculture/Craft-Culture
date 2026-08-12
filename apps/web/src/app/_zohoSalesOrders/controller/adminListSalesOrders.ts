/**
 * List Zoho Sales Orders
 *
 * Returns synced sales orders from Zoho Books with their status, item counts,
 * and the linked invoice number (resolved live from zohoInvoices by
 * reference_number = sales order number, so the invoice shows even before the
 * sync backfills the invoice_number column onto the order).
 */

import { desc, eq, gt, inArray } from 'drizzle-orm';

import resolveRepackFromStock from '@/app/_wms/utils/resolveRepackFromStock';
import type { RepackStockRow } from '@/app/_wms/utils/resolveRepackFromStock';
import db from '@/database/client';
import {
  wmsLocations,
  wmsStock,
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

  // Stock for the readiness flags below. Loaded ONCE for the whole list and
  // matched in memory — per-line queries would mean hundreds of round trips on
  // a list this page polls.
  const readyOrderIds = new Set(
    orders
      .filter(
        (order) => order.status === 'synced' && order.zohoStatus === 'invoiced',
      )
      .map((order) => order.id),
  );

  const stockRows: RepackStockRow[] = readyOrderIds.size
    ? await db
        .select({
          lwin18: wmsStock.lwin18,
          productName: wmsStock.productName,
          vintage: wmsStock.vintage,
          caseConfig: wmsStock.caseConfig,
          quantityCases: wmsStock.quantityCases,
          availableCases: wmsStock.availableCases,
          locationCode: wmsLocations.locationCode,
        })
        .from(wmsStock)
        .leftJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
        .where(gt(wmsStock.quantityCases, 0))
    : [];

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

      // Readiness for the pick-list picker's filters: how many lines need a
      // case broken/combined, and how many can't be matched to stock at all —
      // the ones that would be released UNRESOLVED and stall on the floor.
      let repackLines = 0;
      let unmatchedLines = 0;
      if (readyOrderIds.has(order.id)) {
        for (const item of items) {
          const repack = resolveRepackFromStock(stockRows, {
            name: item.name,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
          });
          if (!repack.hasStock) unmatchedLines++;
          else if (repack.needsRepack) repackLines++;
        }
      }

      return {
        ...order,
        invoiceNumber: order.invoiceNumber ?? linkedInvoice?.invoiceNumber ?? null,
        invoiceStatus: linkedInvoice?.invoiceStatus ?? null,
        itemCount: items.length,
        totalQuantity: cases,
        bottleCount,
        repackLines,
        unmatchedLines,
      };
    }),
  );

  return ordersWithItems;
});

export default adminListSalesOrders;
