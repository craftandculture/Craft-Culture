import { desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsInvoiceShipments,
  logisticsInvoices,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get all Hillebrand invoices with linked shipment numbers
 *
 * @example
 *   await trpcClient.logistics.admin.getInvoices.query();
 */
const adminGetInvoices = adminProcedure.query(async () => {
  const invoices = await db
    .select({
      id: logisticsInvoices.id,
      invoiceNumber: logisticsInvoices.invoiceNumber,
      invoiceDate: logisticsInvoices.invoiceDate,
      paymentDueDate: logisticsInvoices.paymentDueDate,
      status: logisticsInvoices.status,
      currencyCode: logisticsInvoices.currencyCode,
      totalAmount: logisticsInvoices.totalAmount,
      openAmount: logisticsInvoices.openAmount,
      paidAmount: logisticsInvoices.paidAmount,
      paidAt: logisticsInvoices.paidAt,
      hillebrandLastSync: logisticsInvoices.hillebrandLastSync,
      createdAt: logisticsInvoices.createdAt,
      shipmentNumbers: sql<string[]>`COALESCE(
        array_agg(DISTINCT ${logisticsShipments.shipmentNumber}) FILTER (WHERE ${logisticsShipments.shipmentNumber} IS NOT NULL),
        '{}'
      )`,
    })
    .from(logisticsInvoices)
    .leftJoin(logisticsInvoiceShipments, eq(logisticsInvoiceShipments.invoiceId, logisticsInvoices.id))
    .leftJoin(logisticsShipments, eq(logisticsShipments.id, logisticsInvoiceShipments.shipmentId))
    .groupBy(logisticsInvoices.id)
    .orderBy(desc(logisticsInvoices.invoiceDate));

  return invoices;
});

export default adminGetInvoices;
