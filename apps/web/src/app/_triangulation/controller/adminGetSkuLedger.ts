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
        AND i.as_of_date <= ${cutoff}
      ORDER BY i.as_of_date DESC, i.kind, l.created_at
    `;

    return { sku: sku ?? null, entries };
  });

export default adminGetSkuLedger;
