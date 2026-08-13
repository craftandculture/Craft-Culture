import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { skuLedgerSchema } from '../schemas/triangulationSchemas';
import type { TriImportKind } from '../schemas/triangulationSchemas';
import wineIdentity from '../utils/wineIdentity';

export interface StrayLine {
  id: string;
  kind: TriImportKind;
  fileName: string | null;
  importStatus: 'draft' | 'committed';
  /** mapped | unmapped | ignored */
  status: string;
  rawCode: string | null;
  /** The comparable form of the code, and what a re-map acts on */
  normalizedCode: string;
  rawDescription: string | null;
  docRef: string | null;
  effectiveDate: string;
  quantity: number;
  unit: string;
  caseConfig: number | null;
  quantityBottles: number;
  /** The W code it went to instead, when it mapped somewhere else */
  mappedTo: string | null;
  score: number;
}

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

    // Lines that name this wine but are not on this SKU. The ledger above can
    // only show what already mapped here, so a line that *should* be on this
    // SKU and is not was invisible — which is exactly the case that produces an
    // unexplained variance: the bottles exist, somewhere else or nowhere.
    //
    // Name similarity alone is useless as the test. At any threshold loose
    // enough to catch a genuine miss it also catches the neighbouring vintage,
    // the magnum, and the 1er cru from the same grower — and since the query
    // always returned its full limit sorted by score, the panel looked equally
    // alarming whether or not anything was wrong. Similarity is now only a
    // cheap pre-filter; what decides is the same identity test used to find
    // split SKUs, which is that the vintage and bottle size do not contradict
    // and the rest of the name is the same wine.
    const candidates = sku
      ? await client<StrayLine[]>`
          SELECT
            l.id,
            i.kind,
            i.file_name AS "fileName",
            i.status AS "importStatus",
            l.status,
            l.raw_code AS "rawCode",
            l.normalized_code AS "normalizedCode",
            l.raw_description AS "rawDescription",
            l.doc_ref AS "docRef",
            COALESCE(l.doc_date, i.as_of_date)::text AS "effectiveDate",
            l.quantity,
            l.unit,
            l.case_config AS "caseConfig",
            l.quantity_bottles AS "quantityBottles",
            other.w_code AS "mappedTo",
            similarity(l.raw_description, ${sku.productName})::float8 AS score
          FROM tri_import_lines l
          JOIN tri_imports i ON i.id = l.import_id
          LEFT JOIN tri_skus other ON other.id = l.sku_id
          WHERE (l.sku_id IS DISTINCT FROM ${skuId})
            AND l.raw_description IS NOT NULL
            AND similarity(l.raw_description, ${sku.productName}) > 0.5
          ORDER BY score DESC
          LIMIT 200
        `
      : [];

    const skuIdentity = sku
      ? wineIdentity(sku.productName, sku.vintage, null)
      : null;

    const strays = skuIdentity
      ? candidates.filter((line) => {
          const identity = wineIdentity(line.rawDescription ?? '', null, null);

          // A stated vintage or size that differs makes it a different wine,
          // however close the words are.
          if (
            identity.vintage !== null &&
            skuIdentity.vintage !== null &&
            identity.vintage !== skuIdentity.vintage
          ) {
            return false;
          }

          if (
            identity.sizeMl !== null &&
            skuIdentity.sizeMl !== null &&
            identity.sizeMl !== skuIdentity.sizeMl
          ) {
            return false;
          }

          // What is left once vintage and size are removed has to be the same
          // wine. One name containing the other is the village-versus-1er-cru
          // case: the extra words are the difference, not noise.
          return identity.base === skuIdentity.base;
        })
      : [];

    return { sku: sku ?? null, entries, strays };
  });

export default adminGetSkuLedger;
