import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import deriveLwinFromCodes from '../utils/deriveLwinFromCodes';
import type { DerivedLwin } from '../utils/deriveLwinFromCodes';
import tokenizeMatch from '../utils/tokenizeMatch';
import wineIdentity from '../utils/wineIdentity';

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

export interface ReferenceSuggestion {
  lwin7: string;
  displayName: string;
  producerName: string | null;
  region: string | null;
  country: string | null;
  score: number;
  /** The full code this LWIN7 becomes once the wine's own details are added */
  lwin18: string;
}

export interface SkuNeedingLwin {
  skuId: string;
  wCode: string;
  productName: string;
  vintage: number | null;
  caseConfig: number;
  bottleSize: string | null;
  /** Pack read off the invoice text, when the SKU's own is only a default */
  packFromInvoice: number | null;
  suggestions: LwinSuggestion[];
  /** LWIN7s from the reference list, for wines the warehouse never held */
  reference: ReferenceSuggestion[];
  /** Codes Zoho already carries for this wine, dashed LWIN or not */
  zohoCodes: { code: string; bottles: number }[];
  /** The LWIN implied by those codes, which is usually the whole answer */
  derived: DerivedLwin | null;
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
        -- Only genuine dashed LWINs are offered. The warehouse holds supplier
        -- references in this column too, and adopting one would spread a bad
        -- code into Zoho rather than out of it.
        AND s.lwin18 ~ '^[0-9]{7}-[0-9]{4}-[0-9]{2}-[0-9]{5}$'
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
      k.case_config AS "caseConfig",
      k.bottle_size AS "bottleSize",
      -- The pack is printed on the invoice line — "(6x75cl)" — even when the
      -- SKU carries nothing but a default. Reading it there is the only source
      -- for a wine the warehouse never received.
      (
        SELECT MAX(NULLIF(SUBSTRING(l.raw_description FROM '(\d+)\s*[xX]\s*\d'), '')::int)
        FROM tri_import_lines l
        WHERE l.sku_id = k.id
          AND l.raw_description IS NOT NULL
      ) AS "packFromInvoice",
      COALESCE(m.suggestions, '[]'::json) AS suggestions,
      COALESCE(r.reference, '[]'::json) AS reference,
      COALESCE(z.codes, '[]'::json) AS "zohoCodes"
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
    -- The reference list, for wines that were invoiced but never received:
    -- the warehouse cannot suggest a code for stock it has never held, and
    -- those are exactly the ones left stuck at the end.
    LEFT JOIN LATERAL (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'lwin7', y.lwin,
          'displayName', y.display_name,
          'producerName', y.producer_name,
          'region', y.region,
          'country', y.country,
          'score', y.score
        )
        ORDER BY y.score DESC
      ) AS reference
      FROM (
        SELECT
          w.lwin, w.display_name, w.producer_name, w.region, w.country,
          similarity(w.display_name, k.product_name)::float8 AS score
        FROM lwin_wines w
        WHERE w.status = 'live'
          AND similarity(w.display_name, k.product_name) > 0.3
        ORDER BY similarity(w.display_name, k.product_name) DESC
        LIMIT 5
      ) y
    ) r ON TRUE
    -- The codes already on the wine's own invoices. Often one of them is a
    -- dashed LWIN with a typo in it, and the fix is arithmetic rather than a
    -- search of anything.
    LEFT JOIN LATERAL (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT('code', c.code, 'bottles', c.bottles)
        ORDER BY c.bottles DESC
      ) AS codes
      FROM (
        SELECT
          MIN(l.raw_code) AS code,
          COALESCE(SUM(l.quantity_bottles), 0)::float8 AS bottles
        FROM tri_import_lines l
        WHERE l.sku_id = k.id
          AND COALESCE(l.raw_code, '') <> ''
        GROUP BY l.normalized_code
      ) c
    ) z ON TRUE
    WHERE k.lwin18 IS NULL OR TRIM(k.lwin18) = ''
    ORDER BY k.product_name
    LIMIT 300
  `;

  /**
   * A reference LWIN7 names the wine; the last three fields are the bottle.
   *
   * The reference list holds one entry per wine, not per bottling, so a LWIN7
   * picked from it still needs the vintage, the pack and the size before it is
   * a code anything can be filed under. All three are already known here — the
   * vintage from the SKU or its name, the pack from the invoice text, the size
   * from the name — so the choice put in front of someone is a whole code they
   * can check, rather than a seven-digit stem they would have to assemble.
   */
  const completeLwin7 = (row: SkuNeedingLwin, lwin7: string) => {
    const identity = wineIdentity(row.productName, row.vintage, row.bottleSize);
    const vintage = identity.vintage
      ? String(identity.vintage).padStart(4, '0')
      : // 1000 is the reference list's own non-vintage marker.
        '1000';
    const pack = row.packFromInvoice ?? row.caseConfig ?? 6;
    const size = identity.sizeMl ?? 750;

    return `${lwin7}-${vintage}-${String(pack).padStart(2, '0')}-${String(size).padStart(5, '0')}`;
  };

  return rows.map((row) => ({
    ...row,
    derived: deriveLwinFromCodes(
      row.zohoCodes,
      row.packFromInvoice,
      wineIdentity(row.productName, row.vintage, row.bottleSize).vintage,
      wineIdentity(row.productName, row.vintage, row.bottleSize).sizeMl,
    ),
    // Name similarity alone offered Les Fillottes 2019 against a Terre Elysee
    // 2021 — same grower, different wine, different year. A stated vintage or
    // size that contradicts settles it, and it is the same test used
    // everywhere else. Stock on hand is deliberately not a filter: a wine
    // received and sold out reads zero and its LWIN is still the right one.
    suggestions: row.suggestions
      .filter((entry) => {
        const wine = wineIdentity(row.productName, row.vintage, row.bottleSize);
        const candidate = wineIdentity(
          entry.productName ?? '',
          entry.vintage,
          null,
        );

        if (
          wine.vintage !== null &&
          candidate.vintage !== null &&
          wine.vintage !== candidate.vintage
        ) {
          return false;
        }

        return !(
          wine.sizeMl !== null &&
          candidate.sizeMl !== null &&
          wine.sizeMl !== candidate.sizeMl
        );
      })
      // Stock on hand first: it corroborates, even though its absence proves
      // nothing.
      .sort((a, b) => b.bottles - a.bottles),
    reference: row.reference.map((entry) => ({
      ...entry,
      lwin18: completeLwin7(row, entry.lwin7),
    })),
  }));
});

export default adminSuggestLwinFromWms;
