import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface AssumedPackLine {
  /** The Zoho SKU or W code the line carried */
  rawCode: string | null;
  /** What the invoice line calls the wine */
  rawDescription: string;
  /** Whether the line reached a SKU at all */
  wCode: string | null;
  /** How many invoice lines share this description */
  lines: number;
  /** What the reconciliation is currently counting */
  bottles: number;
  /** Which invoices it came from, so the paper can be checked */
  docRefs: string[];
}

/**
 * Sold lines whose pack size had to be assumed, and so may be counted short
 *
 * A Zoho line quantity is cases of the ordered format. When neither the
 * printed description ("6 x 75cl") nor the item's SKU digits state that format,
 * the sync has nothing to multiply by and falls back to one bottle per unit.
 *
 * The fallback is deliberately the understating one — a position that reads
 * short gets chased, where one that reads long just looks plausible — but it is
 * still a guess, and a line of six cases counted as six bottles hides thirty
 * bottles of sales. Left as a number in a toast it is invisible; listed against
 * its invoice it takes a minute to fix at source in Zoho.
 */
const adminGetAssumedPacks = adminProcedure.query(async () => {
  const rows = await client<AssumedPackLine[]>`
    SELECT
      MIN(l.raw_code) AS "rawCode",
      l.raw_description AS "rawDescription",
      MIN(s.w_code) AS "wCode",
      COUNT(*)::int AS lines,
      COALESCE(SUM(l.quantity_bottles), 0)::float8 AS bottles,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.doc_ref), NULL) AS "docRefs"
    FROM tri_import_lines l
    JOIN tri_imports i ON i.id = l.import_id
    LEFT JOIN tri_skus s ON s.id = l.sku_id
    WHERE i.kind = 'cc_sales_to_cd'
      AND i.source_ref IN ('zoho-sales', 'zoho-invoices')
      -- unit 'case' with a pack of 1 is the signature of the fallback: a line
      -- genuinely sold by the bottle is written as unit 'bottle'.
      AND l.unit = 'case'
      AND COALESCE(l.case_config, 1) = 1
      AND COALESCE(l.raw_description, '') <> ''
    GROUP BY l.raw_description
    ORDER BY COUNT(*) DESC, l.raw_description
    LIMIT 200
  `;

  return rows;
});

export default adminGetAssumedPacks;
