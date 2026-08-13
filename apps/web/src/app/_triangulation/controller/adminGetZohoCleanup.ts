import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface ZohoCleanupRow {
  /** The item code as Zoho holds it today */
  currentCode: string | null;
  description: string | null;
  /** What it should become: the SKU's dashed C&C LWIN */
  targetLwin18: string | null;
  wCode: string | null;
  productName: string | null;
  /** Invoice lines and bottles riding on this code, so the worst come first */
  lines: number;
  bottles: number;
  /** Already the dashed LWIN — nothing to do */
  isStandard: boolean;
  /** Resolved to a SKU, so a target exists to rename it to */
  isMapped: boolean;
  /** Which invoices carry it, for checking against the paper */
  docRefs: string[];
}

/**
 * The Zoho item codes in use, and what each should become
 *
 * The reconciliation can be made to work on the codes as they are — the alias
 * table absorbs any amount of history. What it cannot do is stop the mess
 * regrowing, because every new invoice is raised against the same Zoho item and
 * carries the same wrong code and the same wrong pack size back in.
 *
 * So this is the other half of the job: the worksheet for fixing Zoho itself.
 * Every code carrying invoiced bottles, what it resolves to, and whether it is
 * already the dashed C&C LWIN that is meant to be standard. Ordered by bottles,
 * because a code on one bottle and a code on four hundred are not equally worth
 * an afternoon.
 *
 * Rows that are already standard are kept rather than filtered out. Knowing how
 * much of the catalogue is done is what makes the rest finishable, and a list
 * that only ever shows what is broken never visibly shrinks.
 */
const adminGetZohoCleanup = adminProcedure.query(async () => {
  const rows = await client<ZohoCleanupRow[]>`
    SELECT
      MIN(l.raw_code) AS "currentCode",
      MIN(l.raw_description) AS description,
      MIN(s.lwin18) AS "targetLwin18",
      MIN(s.w_code) AS "wCode",
      MIN(s.product_name) AS "productName",
      COUNT(*)::int AS lines,
      COALESCE(SUM(l.quantity_bottles), 0)::float8 AS bottles,
      -- Standard means the code Zoho holds already is the SKU's dashed LWIN,
      -- compared with punctuation stripped so a dashless copy still counts as
      -- the same code needing only its dashes back.
      BOOL_OR(
        s.lwin18 IS NOT NULL
        AND UPPER(REGEXP_REPLACE(COALESCE(l.raw_code, ''), '[^A-Za-z0-9]', '', 'g'))
          = UPPER(REGEXP_REPLACE(s.lwin18, '[^A-Za-z0-9]', '', 'g'))
      ) AS "isStandard",
      BOOL_OR(l.sku_id IS NOT NULL) AS "isMapped",
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.doc_ref), NULL) AS "docRefs"
    FROM tri_import_lines l
    JOIN tri_imports i ON i.id = l.import_id
    LEFT JOIN tri_skus s ON s.id = l.sku_id
    WHERE i.kind = 'cc_sales_to_cd'
      AND i.alias_source = 'zoho'
      AND COALESCE(l.normalized_code, '') <> ''
    GROUP BY l.normalized_code
    ORDER BY COALESCE(SUM(l.quantity_bottles), 0) DESC
    LIMIT 500
  `;

  const done = rows.filter((row) => row.isStandard);

  return {
    rows,
    summary: {
      total: rows.length,
      standard: done.length,
      /** Mapped, so the target LWIN is known and the rename is mechanical */
      renameable: rows.filter((row) => !row.isStandard && row.isMapped).length,
      /** No SKU yet, so there is nothing to rename them to until mapped */
      unresolved: rows.filter((row) => !row.isMapped).length,
      bottlesOnNonStandard: rows
        .filter((row) => !row.isStandard)
        .reduce((total, row) => total + row.bottles, 0),
    },
  };
});

export default adminGetZohoCleanup;
