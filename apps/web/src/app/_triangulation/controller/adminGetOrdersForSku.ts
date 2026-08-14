import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { skuLedgerSchema } from '../schemas/triangulationSchemas';

/**
 * The Zoho sales orders that carry this wine, so they can be re-read
 *
 * Correcting a Zoho item changes the item master and nothing else. The sales
 * order's last-modified time does not move, so the ordinary sync short-circuits
 * and the tool goes on reporting the code it read last week — the work looks
 * undone when it is in fact finished.
 *
 * The cure is to name the orders and force them, which the sales-order sync
 * already supports; what was missing was any way to know which orders to name.
 * Matched on every code the wine has ever carried, since the point is to re-read
 * orders that were written under the old one.
 *
 * Capped at the sync's own limit of twenty-five. Zoho charges a detail request
 * per named order and a blanket force would exhaust the rate limit on one
 * click.
 */
const adminGetOrdersForSku = adminProcedure
  .input(skuLedgerSchema.pick({ skuId: true }))
  .query(async ({ input }) => {
    const codes = await client<{ normalizedCode: string }[]>`
      SELECT DISTINCT l.normalized_code AS "normalizedCode"
      FROM tri_import_lines l
      WHERE l.sku_id = ${input.skuId}
        AND COALESCE(l.normalized_code, '') <> ''
      UNION
      SELECT UPPER(REGEXP_REPLACE(k.lwin18, '[^A-Za-z0-9]', '', 'g'))
      FROM tri_skus k
      WHERE k.id = ${input.skuId} AND k.lwin18 IS NOT NULL
    `;

    const codeList = codes
      .map((entry) => entry.normalizedCode)
      .filter((entry) => entry.length > 0);

    if (codeList.length === 0) return { orderNumbers: [] };

    const orders = await client<{ salesOrderNumber: string }[]>`
      SELECT DISTINCT so.salesorder_number AS "salesOrderNumber"
      FROM zoho_sales_order_items it
      JOIN zoho_sales_orders so ON so.id = it.sales_order_id
      WHERE so.salesorder_number IS NOT NULL
        AND (
          UPPER(REGEXP_REPLACE(COALESCE(it.sku, ''), '[^A-Za-z0-9]', '', 'g'))
            = ANY(${codeList}::text[])
          OR UPPER(REGEXP_REPLACE(COALESCE(it.lwin18, ''), '[^A-Za-z0-9]', '', 'g'))
            = ANY(${codeList}::text[])
        )
      ORDER BY so.salesorder_number DESC
      LIMIT 25
    `;

    return { orderNumbers: orders.map((order) => order.salesOrderNumber) };
  });

export default adminGetOrdersForSku;
