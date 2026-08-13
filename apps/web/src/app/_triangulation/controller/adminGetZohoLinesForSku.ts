import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { skuLedgerSchema } from '../schemas/triangulationSchemas';

export interface ZohoLineForSku {
  salesOrderNumber: string;
  invoiceNumber: string | null;
  zohoStatus: string | null;
  orderDate: string;
  customerName: string;
  sku: string | null;
  description: string | null;
  quantity: number;
  unit: string | null;
  /** Whether the reconciliation counts this line, and if not, why not */
  countedReason: string;
  isCounted: boolean;
}

/**
 * Every Zoho line for this wine, counted or not, read straight from Zoho
 *
 * The ledger can only show what the sync let through, so a line the sync
 * dropped is invisible in the one place someone goes to ask where the bottles
 * went. That is how SO-00090 cost a day: the invoice existed, the bottles were
 * shipped, and the tool could only say the figure was short.
 *
 * Two things drop a line, and neither is wrong on its own. An order with no
 * invoice against it is not a sale yet. A line whose item code has no alias
 * pointing at this SKU belongs, as far as the map is concerned, to another
 * wine. Both are legitimate; both are indistinguishable from missing stock
 * until they are named.
 *
 * Read-only, and deliberately not filtered by customer: a case shipped under a
 * second trading name is exactly the sort of thing being hunted here.
 */
const adminGetZohoLinesForSku = adminProcedure
  .input(skuLedgerSchema.pick({ skuId: true }))
  .query(async ({ input }) => {
    const { skuId } = input;

    const [sku] = await client<
      { wCode: string; lwin18: string | null; productName: string }[]
    >`
      SELECT w_code AS "wCode", lwin18, product_name AS "productName"
      FROM tri_skus WHERE id = ${skuId} LIMIT 1
    `;

    if (!sku) return { lines: [], productName: null };

    // Everything that identifies this wine to Zoho: its W code, its LWIN, and
    // any code someone has mapped onto it.
    const codes = await client<{ normalizedCode: string }[]>`
      SELECT UPPER(REGEXP_REPLACE(${sku.wCode}, '[^A-Za-z0-9]', '', 'g'))
        AS "normalizedCode"
      UNION
      SELECT UPPER(REGEXP_REPLACE(${sku.lwin18 ?? ''}, '[^A-Za-z0-9]', '', 'g'))
      UNION
      SELECT normalized_code FROM tri_sku_aliases WHERE sku_id = ${skuId}
    `;

    const codeList = codes
      .map((code) => code.normalizedCode)
      .filter((code) => code.length > 0);

    if (codeList.length === 0) return { lines: [], productName: sku.productName };

    const lines = await client<ZohoLineForSku[]>`
      SELECT
        so.salesorder_number AS "salesOrderNumber",
        so.invoice_number AS "invoiceNumber",
        so.zoho_status AS "zohoStatus",
        so.order_date::text AS "orderDate",
        so.customer_name AS "customerName",
        it.sku,
        it.description,
        it.quantity,
        it.unit,
        (
          so.status IS DISTINCT FROM 'cancelled'
          AND (
            so.invoice_number IS NOT NULL
            OR so.zoho_status ILIKE '%invoiced%'
            OR inv.id IS NOT NULL
          )
        ) AS "isCounted",
        CASE
          WHEN so.status = 'cancelled' THEN 'Order cancelled'
          WHEN so.invoice_number IS NULL
            AND so.zoho_status NOT ILIKE '%invoiced%'
            AND inv.id IS NULL
            THEN 'No invoice against this order yet, so not a sale'
          ELSE 'Counted'
        END AS "countedReason"
      FROM zoho_sales_order_items it
      JOIN zoho_sales_orders so ON so.id = it.sales_order_id
      LEFT JOIN zoho_invoices inv
        ON inv.reference_number = so.salesorder_number
      WHERE it.quantity <> 0
        AND (
          UPPER(REGEXP_REPLACE(COALESCE(it.sku, ''), '[^A-Za-z0-9]', '', 'g'))
            = ANY(${codeList}::text[])
          OR UPPER(REGEXP_REPLACE(COALESCE(it.lwin18, ''), '[^A-Za-z0-9]', '', 'g'))
            = ANY(${codeList}::text[])
        )
      ORDER BY so.order_date DESC
      LIMIT 100
    `;

    return { lines, productName: sku.productName };
  });

export default adminGetZohoLinesForSku;
