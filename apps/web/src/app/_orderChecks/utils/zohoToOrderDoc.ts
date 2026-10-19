import isUsableLwin18 from '@/app/_lwin/utils/isUsableLwin18';
import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';
import type { ZohoInvoice, ZohoSalesOrder } from '@/lib/zoho/types';

import { statedPackAndSize } from './checkOrderLines';
import type { OrderDoc, OrderDocLine } from './compareOrderDocuments';

const YEAR = /\b(19[5-9]\d|20[0-4]\d)\b/;

const CONSIGNMENT = /consign/i;

type ZohoLine = ZohoSalesOrder['line_items'][number] | ZohoInvoice['line_items'][number];

const toLine = (line: ZohoLine): OrderDocLine | null => {
  const l = line as ZohoLine & { item_type?: string; unit?: string; item_total?: number; description?: string; sku?: string };
  if (/header/i.test(l.item_type ?? '')) return null;
  if (!l.sku && !(l.quantity > 0)) return null;

  const code = l.sku ? normalizeLwin18(l.sku.trim()) : null;
  const parts = code && isUsableLwin18(code) ? code.split('-') : null;
  const stated = statedPackAndSize(`${l.name} ${l.description ?? ''}`);

  const pack = stated.pack ?? (parts ? Number(parts[2]) : null);
  const sizeMl = stated.sizeMl ?? (parts ? Number(parts[3]) : null);
  const vintage = YEAR.exec(l.name)?.[1] ?? (parts && parts[1] !== '1000' ? parts[1]! : null);

  const byBottle = /^bottle/i.test((l.unit ?? '').trim());
  const bottles = byBottle ? l.quantity : pack ? l.quantity * pack : null;
  const perBottle = byBottle ? l.rate : pack ? l.rate / pack : null;

  return {
    name: l.name,
    code: parts ? code : null,
    vintage,
    sizeMl,
    pack,
    bottles,
    perBottle,
    lineTotal: l.item_total ?? l.rate * l.quantity,
  };
};

/**
 * A Zoho sales order or invoice, in the form every order document is compared in
 *
 * Quantities are turned into bottles and prices into a price per bottle, since
 * the client may order in cases and we may bill in bottles or the reverse. The
 * pack comes from the name the client reads first ("(6x75cl)"), then from the
 * code. Without either, bottles and price per bottle stay unknown rather than
 * being guessed, and only the line total is compared.
 *
 * Consignment is read from the payment-terms label and the reference, because
 * Zoho does not return the subject printed on the PDF.
 *
 * @example
 *   zohoToOrderDoc('invoice', await getInvoice(id)).reference; // 'SO-00198'
 *
 * @param kind - Which Zoho document this is
 * @param doc - The document as Zoho's detail endpoint returns it
 * @returns The document as an `OrderDoc`
 */
const zohoToOrderDoc = (kind: 'sales_order' | 'invoice', doc: ZohoSalesOrder | ZohoInvoice): OrderDoc => {
  const isInvoice = kind === 'invoice';
  const inv = doc as ZohoInvoice;
  const so = doc as ZohoSalesOrder;
  const labels = [doc.reference_number, isInvoice ? inv.payment_terms_label : null, isInvoice ? inv.subject : null]
    .concat(isInvoice ? (inv.custom_fields ?? []).map((f) => String((f as { value?: unknown }).value ?? '')) : [])
    .filter(Boolean)
    .join(' ');

  return {
    kind,
    number: isInvoice ? inv.invoice_number : so.salesorder_number,
    customerName: doc.customer_name,
    reference: doc.reference_number?.trim() || null,
    currency: doc.currency_code,
    total: doc.total,
    terms: isInvoice ? (inv.payment_terms_label ?? null) : null,
    printedText: [doc.terms, doc.notes].filter(Boolean).join('\n'),
    saleType: CONSIGNMENT.test(labels) ? 'consignment' : isInvoice ? 'sale' : null,
    lines: doc.line_items.map(toLine).filter((l): l is OrderDocLine => l !== null),
  };
};

export default zohoToOrderDoc;
