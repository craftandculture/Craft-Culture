import { TRPCError } from '@trpc/server';
import { asc, eq, ilike } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrderItems, privateClientOrders } from '@/database/schema';
import { getInvoice, listInvoices } from '@/lib/zoho/invoices';
import { getSalesOrder, listSalesOrders } from '@/lib/zoho/salesOrders';

import type { CheckLine } from '../utils/checkOrderLines';

export interface CheckDocument {
  kind: 'sales_order' | 'invoice' | 'pco';
  number: string;
  customerName: string;
  status: string;
  date: string | null;
  currency: string;
  total: number | null;
  lines: CheckLine[];
}

type ZohoLine = {
  name: string;
  description?: string;
  sku?: string;
  rate: number;
  quantity: number;
  unit?: string;
  item_total?: number;
  item_type?: string;
};

const fromZohoLines = (lines: ZohoLine[]): CheckLine[] =>
  lines.map((l) => ({
    name: l.name,
    description: l.description ?? null,
    sku: l.sku ?? null,
    rate: l.rate,
    quantity: l.quantity,
    unit: l.unit ?? null,
    itemTotal: l.item_total ?? null,
    isHeader: /header/i.test(l.item_type ?? ''),
  }));

export const salesOrderDocument = async (id: string): Promise<CheckDocument> => {
  const so = await getSalesOrder(id);
  return {
    kind: 'sales_order',
    number: so.salesorder_number,
    customerName: so.customer_name,
    status: so.status,
    date: so.date ?? null,
    currency: so.currency_code,
    total: so.total,
    lines: fromZohoLines(so.line_items),
  };
};

export const invoiceDocument = async (id: string): Promise<CheckDocument> => {
  const inv = await getInvoice(id);
  return {
    kind: 'invoice',
    number: inv.invoice_number,
    customerName: inv.customer_name,
    status: inv.status,
    date: inv.date ?? null,
    currency: inv.currency_code,
    total: inv.total,
    lines: fromZohoLines(inv.line_items),
  };
};

/**
 * Fetch an order or invoice by its number, live
 *
 * Read from Zoho rather than our copy, because drafts — the documents worth
 * checking before they go out — are never synced. A PCO is read from Index.
 * PCO-… is a PCO; otherwise sales orders are tried before invoices.
 *
 * @param number - "SO-00140", "INV-000512" or "PCO-2026-00079"
 */
const fetchCheckDocument = async (number: string): Promise<CheckDocument> => {
  const ref = number.trim().toUpperCase();

  if (ref.startsWith('PCO')) {
    const [order] = await db
      .select()
      .from(privateClientOrders)
      .where(ilike(privateClientOrders.orderNumber, ref.includes('-') && ref.length > 9 ? ref : `%${ref.replace(/\D/g, '')}`))
      .limit(1);
    if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: `No PCO numbered ${number}` });

    const items = await db
      .select()
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, order.id))
      .orderBy(asc(privateClientOrderItems.createdAt));

    return {
      kind: 'pco',
      number: order.orderNumber,
      customerName: order.clientName,
      status: order.status,
      date: order.createdAt.toISOString().slice(0, 10),
      currency: 'USD',
      total: null,
      lines: items.map((i) => ({
        name: `${i.productName}${i.vintage ? ` ${i.vintage}` : ''} (${i.caseConfig ?? 12}x${i.bottleSize ?? '75cl'})`,
        sku: i.lwin,
        rate: i.pricePerCaseUsd,
        quantity: i.quantity,
        unit: 'Case',
        itemTotal: null,
      })),
    };
  }

  const [so] = (await listSalesOrders({ salesorderNumber: ref })).salesOrders ?? [];
  if (so && so.salesorder_number.toUpperCase() === ref) return salesOrderDocument(so.salesorder_id);

  const [inv] = (await listInvoices({ invoiceNumber: ref })).invoices ?? [];
  if (inv && inv.invoice_number.toUpperCase() === ref) return invoiceDocument(inv.invoice_id);

  throw new TRPCError({ code: 'NOT_FOUND', message: `No sales order or invoice numbered ${number} in Zoho` });
};

export default fetchCheckDocument;
