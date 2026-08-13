import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface DoubleCountSource {
  /** What the import is called on the Imports tab */
  fileName: string;
  /** 'wms-receipts', 'zoho-sales', or null for an uploaded file */
  sourceRef: string | null;
  asOfDate: string;
  bottles: number;
}

export interface DoubleCountRow {
  skuId: string;
  wCode: string;
  productName: string;
  /** Which figure is affected: received into C&C, or a physical count */
  kind: string;
  /** Everything contributing to that figure for this SKU */
  sources: DoubleCountSource[];
  /** What the reconciliation is currently counting */
  total: number;
  /** What it would be if only the largest single source counted */
  largest: number;
  /** Why these two sources should not both be counted */
  reason: string;
}

/**
 * SKUs whose figure is being fed by two sources that describe the same bottles
 *
 * Two shapes of this, and both inflate a position silently:
 *
 * A movement exists in a live feed *and* in a file someone uploaded — a
 * receipt in both the WMS and a packing list, or a sale in both Zoho and an
 * uploaded invoice. Each feed replaces only its own rows on refresh, so it
 * never collides with itself, but it has no way to know that the file beside it
 * describes the same pallet or the same invoice. Anything dated after the feed
 * went live is liable to be in both, which is why this affects some lines and
 * not others.
 *
 * A count date carrying more than one import. A count is a point-in-time
 * statement of what is on the shelf, so two of them on one date cannot be added
 * — a WMS cycle count plus an uploaded count sheet for the same day reads as
 * twice the stock, not two stocks.
 *
 * Reported rather than resolved: only someone who knows the shipment can say
 * whether a PDF and a WMS receipt are the same pallet or two deliveries a week
 * apart. Deleting the wrong one loses real history.
 */
const adminFindDoubleCounts = adminProcedure.query(async () => {
  const rows = await client<
    {
      skuId: string;
      wCode: string;
      productName: string;
      kind: string;
      asOfDate: string | null;
      sources: DoubleCountSource[];
      total: number;
      reason: string;
    }[]
  >`
    WITH contributions AS (
      SELECT
        l.sku_id,
        i.kind::text AS kind,
        i.id AS import_id,
        i.file_name,
        i.source_ref,
        i.as_of_date,
        SUM(l.quantity_bottles) AS bottles
      FROM tri_import_lines l
      JOIN tri_imports i ON i.id = l.import_id
      WHERE i.status = 'committed'
        AND l.sku_id IS NOT NULL
        AND l.status = 'mapped'
        AND i.kind IN ('cc_opening', 'cc_sales_to_cd', 'cc_count', 'cd_count')
      GROUP BY l.sku_id, i.kind, i.id, i.file_name, i.source_ref, i.as_of_date
      HAVING SUM(l.quantity_bottles) <> 0
    ),
    suspect AS (
      SELECT
        c.sku_id,
        c.kind,
        -- A count is point-in-time, so its sources only collide within one
        -- date. A flow accumulates, so every source collides with the rest.
        CASE
          WHEN c.kind IN ('cc_opening', 'cc_sales_to_cd') THEN NULL
          ELSE c.as_of_date
        END AS group_date,
        c.import_id,
        c.file_name,
        c.source_ref,
        c.as_of_date,
        c.bottles
      FROM contributions c
    ),
    grouped AS (
      SELECT
        sku_id,
        kind,
        group_date,
        COUNT(*)::int AS source_count,
        -- A flow is only suspect when a live feed and an upload describe the
        -- same SKU: two uploaded packing lists are ordinarily two shipments,
        -- and the feeds each replace their own rows so they never self-collide.
        COUNT(*) FILTER (
          WHERE source_ref IN ('wms-receipts', 'zoho-sales')
        )::int AS feed_sources,
        COUNT(*) FILTER (
          WHERE source_ref IS NULL
             OR source_ref NOT IN ('wms-receipts', 'zoho-sales')
        )::int AS upload_sources,
        SUM(bottles)::float8 AS total,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'fileName', file_name,
            'sourceRef', source_ref,
            'asOfDate', as_of_date::text,
            'bottles', bottles::float8
          )
          ORDER BY bottles DESC
        ) AS sources
      FROM suspect
      GROUP BY sku_id, kind, group_date
    )
    SELECT
      s.id AS "skuId",
      s.w_code AS "wCode",
      s.product_name AS "productName",
      g.kind,
      g.group_date::text AS "asOfDate",
      g.sources,
      g.total,
      CASE
        WHEN g.kind = 'cc_opening'
          THEN 'The WMS receipt and an uploaded packing list may describe the same pallet'
        WHEN g.kind = 'cc_sales_to_cd'
          THEN 'The Zoho feed and an uploaded invoice may describe the same sale'
        ELSE 'A count is a point-in-time position, so two on one date cannot be added together'
      END AS reason
    FROM grouped g
    JOIN tri_skus s ON s.id = g.sku_id
    WHERE (
        g.kind IN ('cc_opening', 'cc_sales_to_cd')
        AND g.feed_sources > 0
        AND g.upload_sources > 0
      )
       OR (
        g.kind NOT IN ('cc_opening', 'cc_sales_to_cd')
        AND g.source_count > 1
      )
    ORDER BY g.total DESC
    LIMIT 200
  `;

  return rows.map((row) => ({
    ...row,
    largest: row.sources.reduce(
      (highest, source) => Math.max(highest, source.bottles),
      0,
    ),
  }));
});

export default adminFindDoubleCounts;
