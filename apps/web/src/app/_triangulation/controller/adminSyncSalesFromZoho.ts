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
  unit: string | null;
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
 * A Zoho line quantity is cases of the ordered pack format, so the pack has to
 * come from somewhere. The description wins over the SKU here, which is the
 * opposite of the WMS rule — and deliberately so.
 *
 * On an invoice the rate is per case, so description × quantity × rate has to
 * equal the amount the customer was billed. That makes the description the one
 * field the money already agrees with. A SKU's pack digits are item metadata
 * nothing reconciles against, and a mistyped LWIN18 sails through: Zoho carried
 * this rum under `183149819901600700`, whose digits read pack 16 for a wine
 * sold as `1x70cl`. 16 is wrong but not absurd, so `parseSkuPack` accepts it,
 * and a 2-case line silently became 32 bottles.
 *
 * @returns The pack size and where it came from, or null when neither states one
 */
const resolvePack = (sku: string | null, description: string | null) => {
  // The pack sits in the line's format ("1 x 70cl", "6 x 75cl") — not always
  // at the start of the string, so this is not anchored.
  const match = /(\d+)\s*[x×]\s*\d/i.exec(description ?? '');
  const fromDescription = match?.[1] ? Number(match[1]) : null;
  const fromSku = parseSkuPack(sku)?.pack ?? null;

  if (fromDescription && fromDescription > 0 && fromDescription <= 24) {
    return { pack: fromDescription, disagrees: !!fromSku && fromSku !== fromDescription };
  }

  return fromSku ? { pack: fromSku, disagrees: false } : null;
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
        it.unit,
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
    // Lines where the SKU's pack digits contradict the printed format. Worth
    // surfacing: it means an item in Zoho carries a wrong LWIN.
    let packDisagreements = 0;

    const lines = rows.map((row) => {
      // Zoho states the unit on the line. When it says bottles, the quantity
      // is already bottles and multiplying by any pack invents stock.
      const isBottles = /bottle|btl/i.test(row.unit ?? '');
      const resolved = resolvePack(row.sku ?? row.lwin18, row.description);

      if (!isBottles && !resolved) {
        unknownPack += 1;
      }

      if (resolved?.disagrees) {
        packDisagreements += 1;
      }

      // Always write an explicit pack. Leaving it null let the SKU's default
      // fill the gap later, and that default is wine-shaped — it turned a
      // 6-bottle invoice line of single-bottle rum into 36. An unknown pack
      // falls back to 1, which can only understate: an understated position
      // shows up as a shortfall someone chases, where an overstated one just
      // looks plausible.
      const pack = isBottles ? 1 : (resolved?.pack ?? 1);

      return {
        import_id: importId,
        // The SKU is the LWIN, which the mapper resolves against tri_skus.lwin18
        raw_code: row.sku ?? row.lwin18,
        normalized_code: normalizeCode(row.sku ?? row.lwin18),
        raw_description: `${row.name}${row.description ? ` (${row.description})` : ''}`,
        quantity: row.quantity,
        unit: isBottles ? 'bottle' : 'case',
        case_config: pack,
        quantity_bottles: row.quantity * pack,
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
      packDisagreements,
      customers: [...new Set(rows.map((row) => row.customerName))],
      // Which invoices actually came through. An invoice you know exists and
      // cannot find here was never synced into the platform — a different
      // problem from a line that arrived and failed to map, and previously
      // indistinguishable from it.
      invoices: [
        ...new Set(
          rows
            .map((row) => row.invoiceNumber ?? row.salesOrderNumber)
            .filter(Boolean),
        ),
      ].sort(),
    };
  });

export default adminSyncSalesFromZoho;
