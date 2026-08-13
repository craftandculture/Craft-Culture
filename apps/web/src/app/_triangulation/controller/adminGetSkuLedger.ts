import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { skuLedgerSchema } from '../schemas/triangulationSchemas';
import type { TriImportKind } from '../schemas/triangulationSchemas';

export interface TriLedgerEntry {
  id: string;
  kind: TriImportKind;
  importId: string;
  importStatus: 'draft' | 'committed';
  fileName: string | null;
  periodLabel: string | null;
  asOfDate: string;
  effectiveDate: string;
  docRef: string | null;
  docDate: string | null;
  rawCode: string | null;
  rawDescription: string | null;
  quantity: number;
  unit: string;
  caseConfig: number | null;
  quantityBottles: number;
  unitPrice: number | null;
  currency: string | null;
}

/**
 * Every import line that contributed to one SKU's position
 *
 * This is the audit trail behind a variance: when the calculated and counted
 * figures disagree, the answer is almost always a specific invoice line or a
 * miscounted pack size sitting in here.
 */
const adminGetSkuLedger = adminProcedure
  .input(skuLedgerSchema)
  .query(async ({ input }) => {
    const { skuId, periodId } = input;

    const [period] = periodId
      ? await client<{ periodEnd: string }[]>`
          SELECT period_end::text AS "periodEnd"
          FROM tri_periods WHERE id = ${periodId} LIMIT 1
        `
      : [];

    const cutoff = period?.periodEnd ?? '9999-12-31';

    const [sku] = await client<
      {
        id: string;
        wCode: string;
        productName: string;
        producer: string | null;
        vintage: number | null;
        caseConfig: number;
        lwin18: string | null;
      }[]
    >`
      SELECT
        id, w_code AS "wCode", product_name AS "productName",
        producer, vintage, case_config AS "caseConfig", lwin18
      FROM tri_skus WHERE id = ${skuId} LIMIT 1
    `;

    const entries = await client<TriLedgerEntry[]>`
      SELECT
        l.id,
        i.kind,
        i.id AS "importId",
        i.status AS "importStatus",
        i.file_name AS "fileName",
        p.label AS "periodLabel",
        i.as_of_date::text AS "asOfDate",
        -- The date the reconciliation actually counts this line on. Flows
        -- count from their own document date; a live feed carries all of
        -- history under one import stamped the day it synced, so showing the
        -- import's date here would misreport when the movement happened.
        (CASE
          WHEN i.kind IN ('cc_opening', 'cc_sales_to_cd', 'cd_sales')
            THEN COALESCE(l.doc_date, i.as_of_date)
          ELSE i.as_of_date
        END)::text AS "effectiveDate",
        l.doc_ref AS "docRef",
        l.doc_date::text AS "docDate",
        l.raw_code AS "rawCode",
        l.raw_description AS "rawDescription",
        l.quantity,
        l.unit,
        l.case_config AS "caseConfig",
        l.quantity_bottles AS "quantityBottles",
        l.unit_price AS "unitPrice",
        l.currency
      FROM tri_import_lines l
      JOIN tri_imports i ON i.id = l.import_id
      LEFT JOIN tri_periods p ON p.id = i.period_id
      WHERE l.sku_id = ${skuId}
        -- Must match the reconciliation's cut-off exactly. Filtering the
        -- ledger on the import date while the figures count by line date hid
        -- every line of a live feed, so the drill-down could not explain the
        -- number it was opened to explain.
        AND (CASE
          WHEN i.kind IN ('cc_opening', 'cc_sales_to_cd', 'cd_sales')
            THEN COALESCE(l.doc_date, i.as_of_date)
          ELSE i.as_of_date
        END) <= ${cutoff}
      ORDER BY (CASE
          WHEN i.kind IN ('cc_opening', 'cc_sales_to_cd', 'cd_sales')
            THEN COALESCE(l.doc_date, i.as_of_date)
          ELSE i.as_of_date
        END) DESC, i.kind, l.created_at
    `;

    return { sku: sku ?? null, entries };
  });

export default adminGetSkuLedger;
