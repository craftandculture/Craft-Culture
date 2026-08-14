import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { syncSalesFromZohoSchema } from '../schemas/triangulationSchemas';
import tokenizeMatch from '../utils/tokenizeMatch';

export interface InvoiceCoverage {
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  customerName: string;
  total: number;
  /** The sales order this invoice references, when it names one */
  referenceNumber: string | null;
  /** Whether that order is in our synced tables */
  orderSynced: boolean;
  /** Line items on that order, which is all the sales feed can read */
  orderLines: number;
  /** Lines the reconciliation actually counted against this document */
  countedLines: number;
  countedBottles: number;
  /** Why nothing was counted, in one phrase */
  verdict: string;
}

/**
 * Every City Drinks invoice, and whether its lines reached the reconciliation
 *
 * Sold to CD is built from sales order *lines*, because that is the only place
 * Zoho keeps line detail we sync — `zoho_invoices` holds headers alone. Two
 * gaps follow, and neither announces itself:
 *
 * An invoice raised without a sales order behind it has no lines anywhere to
 * read, so its bottles are simply absent. And the sales order sync fetches
 * only the `open` and `invoiced` statuses, so an order that has moved to any
 * other status is not in our tables at all — its invoice looks unremarkable
 * and contributes nothing.
 *
 * Both understate what was sold, which overstates what C&C still holds. This
 * lists every invoice against what was counted for it, so the gap is a list of
 * documents to look at rather than a variance to argue about.
 */
const adminGetSalesCoverage = adminProcedure
  .input(syncSalesFromZohoSchema)
  .query(async ({ input }) => {
    const tokens = tokenizeMatch(input.customerMatch);

    const rows = await client<InvoiceCoverage[]>`
      SELECT
        inv.invoice_number AS "invoiceNumber",
        inv.invoice_date::text AS "invoiceDate",
        inv.status,
        inv.customer_name AS "customerName",
        inv.total,
        inv.reference_number AS "referenceNumber",
        (so.id IS NOT NULL) AS "orderSynced",
        COALESCE(
          (SELECT COUNT(*)::int FROM zoho_sales_order_items it
            WHERE it.sales_order_id = so.id),
          0
        ) AS "orderLines",
        COALESCE(counted.lines, 0) AS "countedLines",
        COALESCE(counted.bottles, 0) AS "countedBottles",
        CASE
          WHEN COALESCE(counted.lines, 0) > 0 THEN 'Counted'
          WHEN inv.status ILIKE '%void%' THEN 'Voided, correctly ignored'
          WHEN so.id IS NULL AND inv.reference_number IS NULL
            THEN 'No sales order named — the lines exist only on the invoice, which we do not sync'
          WHEN so.id IS NULL
            THEN 'Names an order we have not synced — it is in a status the sync does not fetch'
          WHEN COALESCE(
            (SELECT COUNT(*) FROM zoho_sales_order_items it
              WHERE it.sales_order_id = so.id), 0) = 0
            THEN 'Its order carries no line items'
          ELSE 'Lines exist but none reached the figures — every one is unmapped or the customer name did not match'
        END AS verdict
      FROM zoho_invoices inv
      LEFT JOIN zoho_sales_orders so
        ON so.salesorder_number = inv.reference_number
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS lines,
               COALESCE(SUM(l.quantity_bottles), 0)::float8 AS bottles
        FROM tri_import_lines l
        JOIN tri_imports i ON i.id = l.import_id
        WHERE i.kind = 'cc_sales_to_cd'
          AND l.doc_ref = inv.invoice_number
          AND l.sku_id IS NOT NULL
      ) counted ON TRUE
      WHERE NOT EXISTS (
        SELECT 1 FROM UNNEST(${tokens}::text[]) AS t(tok)
        WHERE POSITION(
          tok IN REGEXP_REPLACE(UPPER(inv.customer_name), '[^A-Z0-9]', '', 'g')
        ) = 0
      )
      ORDER BY inv.invoice_date DESC
      LIMIT 400
    `;

    const missing = rows.filter((row) => row.countedLines === 0);

    return {
      rows,
      summary: {
        invoices: rows.length,
        counted: rows.length - missing.length,
        missing: missing.length,
        /** Raised with no order behind them, so no line detail exists at all */
        noOrder: missing.filter((row) => !row.orderSynced).length,
        missingValue: missing.reduce((total, row) => total + row.total, 0),
      },
    };
  });

export default adminGetSalesCoverage;
