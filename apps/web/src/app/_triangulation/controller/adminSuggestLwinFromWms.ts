import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import tokenizeMatch from '../utils/tokenizeMatch';

export interface LwinSuggestion {
  lwin18: string;
  productName: string | null;
  producer: string | null;
  vintage: number | null;
  supplierSku: string | null;
  /** Bottles the warehouse holds under it, as corroboration */
  bottles: number;
  /** How closely the warehouse's name matches the SKU's */
  score: number;
}

export interface SkuNeedingLwin {
  skuId: string;
  wCode: string;
  productName: string;
  vintage: number | null;
  suggestions: LwinSuggestion[];
}

/**
 * Candidate LWINs from the warehouse for every SKU that has none
 *
 * The bulk pass takes only what it is certain of — the W code matches, or
 * exactly one warehouse wine has the same identity. What it declines is not
 * unknowable, just not decidable without someone who knows the range: two
 * vintages, a magnum beside a bottle, a grower with four cuvées whose names
 * differ by one word.
 *
 * So the rest are offered rather than guessed. Each candidate carries the
 * warehouse's own name for the wine, its vintage, the code it was received
 * under and how many bottles sit under it, which between them are enough to
 * recognise the right one at a glance — and the bottle count is the tell, since
 * the wine you are looking at is the one you actually hold.
 */
const adminSuggestLwinFromWms = adminProcedure.query(async () => {
  const rows = await client<SkuNeedingLwin[]>`
    WITH stock AS (
      SELECT
        s.lwin18,
        MIN(s.supplier_sku) AS supplier_sku,
        MIN(s.product_name) AS product_name,
        MIN(s.producer) AS producer,
        MIN(s.vintage) AS vintage,
        -- quantity_cases counts sealed cases; open_bottles holds the loose
        -- bottles from cracked ones. Neither alone is the stock on hand.
        COALESCE(SUM(
          s.quantity_cases * COALESCE(NULLIF(s.case_config, 0), 6)
          + COALESCE(s.open_bottles, 0)
        ), 0)::float8 AS bottles
      FROM wms_stock s
      WHERE s.lwin18 IS NOT NULL
        AND TRIM(s.lwin18) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM UNNEST(${tokenizeMatch('Crurated')}::text[]) AS t(tok)
          WHERE POSITION(
            tok IN REGEXP_REPLACE(UPPER(COALESCE(s.owner_name, '')), '[^A-Z0-9]', '', 'g')
          ) = 0
        )
      GROUP BY s.lwin18
    )
    SELECT
      k.id AS "skuId",
      k.w_code AS "wCode",
      k.product_name AS "productName",
      k.vintage,
      COALESCE(m.suggestions, '[]'::json) AS suggestions
    FROM tri_skus k
    LEFT JOIN LATERAL (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'lwin18', x.lwin18,
          'productName', x.product_name,
          'producer', x.producer,
          'vintage', x.vintage,
          'supplierSku', x.supplier_sku,
          'bottles', x.bottles,
          'score', x.score
        )
        ORDER BY x.score DESC, x.bottles DESC
      ) AS suggestions
      FROM (
        SELECT
          st.*,
          similarity(COALESCE(st.product_name, ''), k.product_name)::float8
            AS score
        FROM stock st
        -- Deliberately generous: this is a list to choose from, not a decision.
        -- Too tight and the right wine is simply absent, which is the failure
        -- that leaves someone stuck with no way forward.
        WHERE similarity(COALESCE(st.product_name, ''), k.product_name) > 0.2
        ORDER BY similarity(COALESCE(st.product_name, ''), k.product_name) DESC
        LIMIT 5
      ) x
    ) m ON TRUE
    WHERE k.lwin18 IS NULL OR TRIM(k.lwin18) = ''
    ORDER BY k.product_name
    LIMIT 300
  `;

  return rows;
});

export default adminSuggestLwinFromWms;
