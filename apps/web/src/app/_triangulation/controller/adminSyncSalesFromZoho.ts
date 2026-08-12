import { TRPCError } from '@trpc/server';

import parseSkuPack from '@/app/_wms/utils/parseSkuPack';
import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import insertRows from '../data/insertRows';
import mapImportLines from '../data/mapImportLines';
import { syncSalesFromZohoSchema } from '../schemas/triangulationSchemas';
import normalizeCode from '../utils/normalizeCode';
import tokenizeMatch from '../utils/tokenizeMatch';

interface ZohoSaleRow {
  sku: string | null;
  lwin18: string | null;
  name: string;
  description: string | null;
  quantity: number;
  rate: number | null;
  currencyCode: string | null;
  invoiceNumber: string | null;
  salesOrderNumber: string;
  docDate: string;
  customerName: string;
}

/**
 * Resolve how many bottles a Zoho line represents
 *
 * A Zoho line quantity is cases of the ordered pack format, so the pack size
 * has to come from somewhere. The WMS rule applies here too: trust the LWIN18
 * SKU when its pack digits are plausible, otherwise read the line description
 * ("6x75cl"). See `parseSkuPack` for why a SKU is not always trustworthy.
 *
 * @returns The pack size, or null when neither source states one
 */
const resolvePack = (sku: string | null, description: string | null) => {
  const fromSku = parseSkuPack(sku);

  if (fromSku) {
    return fromSku.pack;
  }

  const match = /^(\d+)\s*[x×]/i.exec(description ?? '');
  const parsed = match?.[1] ? Number(match[1]) : null;

  return parsed && parsed > 0 && parsed <= 24 ? parsed : null;
};

/**
 * Take C&C's sales to City Drinks from the synced Zoho orders
 *
 * `zoho_invoices` carries only headers, so the line detail comes from the
 * sales orders and their items, which the two-minute sync already keeps
 * current. That removes the monthly Zoho export from the process entirely.
 *
 * Only invoiced, non-cancelled orders count — an open order is not a sale.
 * Each line keeps its invoice date, so one import spans every period and
 * belongs to none: a closed period stays stable because its cut-off excludes
 * anything invoiced later.
 */
const adminSyncSalesFromZoho = adminProcedure
  .input(syncSalesFromZohoSchema)
  .mutation(async ({ input, ctx }) => {
    const { customerMatch } = input;
    const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);

    // City Drinks trade in Zoho as "C D General Trading L.L.C", so a plain
    // substring match fails on spacing, on punctuation, and on the words in
    // between. Every word of the search has to appear in the customer name
    // once both are stripped to letters and digits — "CD General", "CD General
    // LLC" and "c.d. general trading" all then find it, while a genuinely
    // different customer still does not.
    const tokens = tokenizeMatch(customerMatch);

    if (tokens.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Customer name must contain at least one letter or number',
      });
    }

    const rows = await client<ZohoSaleRow[]>`
      SELECT
        it.sku,
        it.lwin18,
        it.name,
        it.description,
        it.quantity,
        it.rate,
        so.currency_code AS "currencyCode",
        so.invoice_number AS "invoiceNumber",
        so.salesorder_number AS "salesOrderNumber",
        COALESCE(inv.invoice_date, so.order_date)::text AS "docDate",
        so.customer_name AS "customerName"
      FROM zoho_sales_order_items it
      JOIN zoho_sales_orders so ON so.id = it.sales_order_id
      LEFT JOIN zoho_invoices inv
        ON inv.reference_number = so.salesorder_number
      WHERE NOT EXISTS (
          SELECT 1 FROM UNNEST(${tokens}::text[]) AS t(tok)
          WHERE POSITION(
            tok IN REGEXP_REPLACE(UPPER(so.customer_name), '[^A-Z0-9]', '', 'g')
          ) = 0
        )
        AND so.status IS DISTINCT FROM 'cancelled'
        AND (so.invoice_number IS NOT NULL OR so.zoho_status ILIKE '%invoiced%')
        AND it.quantity <> 0
      ORDER BY COALESCE(inv.invoice_date, so.order_date)
    `;

    if (rows.length === 0) {
      const customers = await client<{ customerName: string }[]>`
        SELECT DISTINCT customer_name AS "customerName"
        FROM zoho_sales_orders
        WHERE invoice_number IS NOT NULL
        ORDER BY customer_name
        LIMIT 40
      `;

      throw new TRPCError({
        code: 'NOT_FOUND',
        message:
          `No invoiced Zoho orders have a customer containing all of: ${tokens.join(', ')}.` +
          (customers.length > 0
            ? ` Invoiced customers: ${customers.map((row) => row.customerName).join(', ')}.`
            : ''),
      });
    }

    await client`
      DELETE FROM tri_imports
      WHERE kind = 'cc_sales_to_cd' AND source_ref = 'zoho-sales'
    `;

    const [created] = await client<{ id: string }[]>`
      INSERT INTO tri_imports (
        period_id, kind, status, file_name, source_ref, alias_source,
        as_of_date, notes, uploaded_by, committed_at
      )
      VALUES (
        NULL, 'cc_sales_to_cd', 'committed',
        ${`Zoho invoiced orders — ${customerMatch}`}, 'zoho-sales', 'zoho',
        ${asOfDate},
        ${'Synced live from Zoho sales orders. Each line keeps its invoice date.'},
        ${ctx.user.id}, NOW()
      )
      RETURNING id
    `;

    const importId = created?.id;

    if (!importId) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create the Zoho sales feed',
      });
    }

    let unknownPack = 0;

    const lines = rows.map((row) => {
      const pack = resolvePack(row.sku ?? row.lwin18, row.description);

      if (!pack) {
        unknownPack += 1;
      }

      return {
        import_id: importId,
        // The SKU is the LWIN, which the mapper resolves against tri_skus.lwin18
        raw_code: row.sku ?? row.lwin18,
        normalized_code: normalizeCode(row.sku ?? row.lwin18),
        raw_description: `${row.name}${row.description ? ` (${row.description})` : ''}`,
        quantity: row.quantity,
        unit: 'case',
        case_config: pack,
        // Left for recalculateLineBottles when the pack is unknown, so the SKU's
        // own pack size fills the gap once the line is mapped.
        quantity_bottles: pack ? row.quantity * pack : row.quantity,
        unit_price: row.rate,
        currency: row.currencyCode,
        doc_ref: row.invoiceNumber ?? row.salesOrderNumber,
        doc_date: row.docDate,
        status: 'unmapped',
      };
    });

    await insertRows(
      'tri_import_lines',
      [
        'import_id',
        'raw_code',
        'normalized_code',
        'raw_description',
        'quantity',
        'unit',
        'case_config',
        'quantity_bottles',
        'unit_price',
        'currency',
        'doc_ref',
        'doc_date',
        'status',
      ],
      lines,
    );

    const totals = await mapImportLines(importId, 'zoho');

    return {
      importId,
      asOfDate,
      ...totals,
      orderLines: rows.length,
      unknownPack,
      customers: [...new Set(rows.map((row) => row.customerName))],
    };
  });

export default adminSyncSalesFromZoho;
