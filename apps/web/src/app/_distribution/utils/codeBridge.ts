import { client } from '@/database/client';

/**
 * The one place the two sides' codes are joined
 *
 * Three code systems meet at every wine and no two of them share a key:
 *
 * - **Our invoices carry LWINs**, because that is what Zoho's item SKU holds
 * - **City Drinks carry a CDR code** of their own — CDR00123 — which is the
 *   stable key on their side and the only one their sales report prints
 * - **Beside it they carry a code they call ours**: a real W code where
 *   Crurated issued one, and otherwise a label they invented (CCW73CON)
 *
 * So there are four ways across, tried strongest first:
 *
 * 1. **A confirmed link**, CDR to LWIN, made once by a person. Beats
 *    everything, including a contradicting automatic match — that is the point
 *    of confirming it.
 * 2. **Their CDR code, through the mapping already done by hand** in the old
 *    tool's aliases. Those rows point at a wine which usually knows its own
 *    LWIN, and where it does not it knows its W code, which the warehouse can
 *    translate. Reading only the first of those is why this path returned
 *    nothing for anyone but Crurated.
 * 3. **The W code they hold for us**, through the warehouse, which is the one
 *    place a W code and a LWIN appear against the same wine.
 * 4. **The raw string**, for the case where what they hold is already a LWIN.
 *
 * Kept as one definition rather than written out per query because this
 * project has already lost a day to a key derived slightly differently in two
 * places — and when it happened here, every owner but Crurated showed a blank
 * position for weeks with nothing looking broken.
 *
 * Each export builds a fresh fragment per call rather than sharing one, since
 * a query may use the same piece twice and a shared builder is not worth the
 * bet.
 */

/** The CTEs every query over distributor positions needs */
export const codeBridgeCtes = (outletId: string) => client`
  code_map AS (
    SELECT DISTINCT
      UPPER(REGEXP_REPLACE(w.supplier_sku, '[^A-Za-z0-9]', '', 'g')) AS w_code,
      UPPER(REGEXP_REPLACE(w.lwin18, '[^A-Za-z0-9]', '', 'g')) AS lwin
    FROM wms_stock w
    WHERE NULLIF(TRIM(w.supplier_sku), '') IS NOT NULL
      AND NULLIF(TRIM(w.lwin18), '') IS NOT NULL
    UNION
    SELECT DISTINCT
      UPPER(REGEXP_REPLACE(t.w_code, '[^A-Za-z0-9]', '', 'g')),
      UPPER(REGEXP_REPLACE(t.lwin18, '[^A-Za-z0-9]', '', 'g'))
    FROM tri_skus t
    WHERE NULLIF(TRIM(t.w_code), '') IS NOT NULL
      AND NULLIF(TRIM(t.lwin18), '') IS NOT NULL
  ),
  /*
    Their own CDR code, mapped to a wine by hand in the old tool.

    Two ways off that wine: its LWIN if it has one, and otherwise its W code
    through the warehouse. Crurated's wines have the LWIN; everyone else's
    have only the W code, which is precisely the set this bridge exists for.
  */
  outlet_code_map AS (
    SELECT outlet_code, MIN(lwin) AS lwin
    FROM (
      SELECT
        UPPER(REGEXP_REPLACE(a.alias_code, '[^A-Za-z0-9]', '', 'g')) AS outlet_code,
        COALESCE(
          NULLIF(UPPER(REGEXP_REPLACE(COALESCE(s.lwin18, ''), '[^A-Za-z0-9]', '', 'g')), ''),
          cm.lwin
        ) AS lwin
      FROM tri_sku_aliases a
      JOIN tri_skus s ON s.id = a.sku_id
      LEFT JOIN code_map cm
        ON cm.w_code = UPPER(REGEXP_REPLACE(COALESCE(s.w_code, ''), '[^A-Za-z0-9]', '', 'g'))
      WHERE a.source = 'city_drinks'
    ) resolved
    WHERE lwin IS NOT NULL
    GROUP BY outlet_code
  ),
  /* Confirmed by a person, and therefore final */
  confirmed_map AS (
    SELECT
      UPPER(REGEXP_REPLACE(l.outlet_code, '[^A-Za-z0-9]', '', 'g')) AS outlet_code,
      UPPER(REGEXP_REPLACE(l.lwin18, '[^A-Za-z0-9]', '', 'g')) AS lwin
    FROM cons_code_links l
    WHERE l.outlet_id = ${outletId}
  )
`;

/**
 * A snapshot row's wine, as a code our invoices can be joined on
 *
 * Expects `s` to be cons_snapshots and the three CTEs above to be in scope.
 * The trailing CON marks the consignment copy of a wine City Drinks also
 * stock outright, so it is stripped before matching — it has already done its
 * work in the regime filter.
 */
export const resolvedSnapshotCode = () => client`
  COALESCE(
    conf.lwin,
    ocm.lwin,
    cm.lwin,
    UPPER(REGEXP_REPLACE(s.our_code, '[^A-Za-z0-9]', '', 'g'))
  )
`;

/** The joins `resolvedSnapshotCode` needs, in the order it reads them */
export const codeBridgeJoins = () => client`
  LEFT JOIN confirmed_map conf
    ON conf.outlet_code =
       UPPER(REGEXP_REPLACE(s.outlet_code, '[^A-Za-z0-9]', '', 'g'))
  LEFT JOIN outlet_code_map ocm
    ON ocm.outlet_code =
       UPPER(REGEXP_REPLACE(s.outlet_code, '[^A-Za-z0-9]', '', 'g'))
  LEFT JOIN code_map cm
    ON cm.w_code = REGEXP_REPLACE(
         UPPER(REGEXP_REPLACE(COALESCE(s.our_code, ''), '[^A-Za-z0-9]', '', 'g')),
         'CON$', ''
       )
`;
