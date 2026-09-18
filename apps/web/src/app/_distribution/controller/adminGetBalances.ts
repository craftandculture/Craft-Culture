import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface BalanceRow {
  ownerName: string;
  ownerId: string;
  outletName: string;
  lwin18: string | null;
  outletCode: string | null;
  productName: string;
  pack: number | null;
  packAssumed: boolean;
  /** Bottles we invoiced to the outlet */
  outBottles: number;
  /** What we billed them, in the invoice's own currency */
  outValue: number;
  currency: string | null;
  /** Bottles the outlet declares it still holds, from its latest position */
  heldDeclared: number | null;
  /** Their word for it: consigned, or bought outright */
  regime: string | null;
}

/**
 * The four positions per wine, per owner
 *
 * Out comes from our invoices; Held from the outlet's own latest position.
 * Sold is not here yet — it needs either two snapshot boundaries to difference
 * or the distributor's monthly report, and neither exists for a full month.
 *
 * Held joins on the outlet's code for the wine, because that is the only key
 * the two sides share: City Drinks publish our code beside theirs, so the
 * snapshot carries both. A wine we invoiced that they have never coded shows
 * Held as null rather than zero — an unknown position and an empty one are
 * different facts, and reading one as the other invents a variance.
 *
 * @param outletId - The outlet to reconcile
 * @returns One row per wine per owner, heaviest position first
 */
const adminGetBalances = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      ownerId: z.string().uuid().optional().nullable(),
      search: z.string().max(200).optional(),
    }),
  )
  .query(async ({ input }) => {
    const term = input.search?.trim() ? `%${input.search.trim()}%` : null;

    const rows = await client<BalanceRow[]>`
      WITH latest AS (
        SELECT MAX(taken_at) AS taken_at
        FROM cons_snapshots WHERE outlet_id = ${input.outletId}
      ),
      /*
        The bridge between the two code systems.

        Our invoices carry LWINs, because that is what Zoho's item SKU holds.
        City Drinks carry our W codes — W2104324, CCW73CON — because that is
        what we gave them. Neither side can join to the other directly, and
        the only place both appear against one wine is our own warehouse.

        tri_skus is included because its W-code-to-LWIN pairs were curated by
        hand for exactly these wines; it is read as data, not as a dependency
        on the tool being replaced.
      */
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
      held AS (
        SELECT
          /*
            Their code, translated to a LWIN where we can. The trailing CON
            marks the consignment copy of a wine they also stock outright —
            fifty codes exist as both CCW101 and CCW101CON — so it is stripped
            before matching, having already done its job in the regime filter.
          */
          COALESCE(
            cm.lwin,
            UPPER(REGEXP_REPLACE(s.our_code, '[^A-Za-z0-9]', '', 'g'))
          ) AS code,
               SUM(s.bottles_on_hand)::float8 AS bottles,
               MIN(s.outlet_code) AS outlet_code,
               MIN(s.regime) AS regime
        FROM cons_snapshots s
        CROSS JOIN latest
        LEFT JOIN code_map cm
          ON cm.w_code = REGEXP_REPLACE(
               UPPER(REGEXP_REPLACE(s.our_code, '[^A-Za-z0-9]', '', 'g')),
               'CON$', ''
             )
        WHERE s.outlet_id = ${input.outletId}
          AND s.taken_at = latest.taken_at
          AND s.regime = 'consigned'
          AND NULLIF(TRIM(s.our_code), '') IS NOT NULL
        GROUP BY 1
      ),
      out_lines AS (
        SELECT a.owner_id, o.name AS owner_name, ou.name AS outlet_name,
               m.lwin18,
               UPPER(REGEXP_REPLACE(COALESCE(m.lwin18, m.product_name), '[^A-Za-z0-9]', '', 'g')) AS code,
               MIN(m.product_name) AS product_name,
               MAX(m.pack) AS pack,
               BOOL_OR(m.pack_assumed) AS pack_assumed,
               SUM(m.bottles)::float8 AS out_bottles,
               SUM(COALESCE(m.unit_price, 0) * COALESCE(m.source_qty, 0))::float8 AS out_value,
               MIN(m.currency) AS currency
        FROM cons_movements m
        JOIN cons_arrangements a ON a.id = m.arrangement_id
        JOIN cons_owners o ON o.id = a.owner_id
        JOIN cons_outlets ou ON ou.id = a.outlet_id
        WHERE a.outlet_id = ${input.outletId}
          AND m.kind = 'out'
          ${input.ownerId ? client`AND a.owner_id = ${input.ownerId}` : client``}
        GROUP BY a.owner_id, o.name, ou.name, m.lwin18,
                 UPPER(REGEXP_REPLACE(COALESCE(m.lwin18, m.product_name), '[^A-Za-z0-9]', '', 'g'))
      )
      SELECT l.owner_name AS "ownerName", l.owner_id AS "ownerId",
             l.outlet_name AS "outletName", l.lwin18,
             h.outlet_code AS "outletCode", l.product_name AS "productName",
             l.pack, l.pack_assumed AS "packAssumed",
             l.out_bottles AS "outBottles", l.out_value AS "outValue",
             l.currency,
             h.bottles AS "heldDeclared", h.regime
      FROM out_lines l
      LEFT JOIN held h ON h.code = l.code
      ${term ? client`WHERE l.product_name ILIKE ${term} OR l.lwin18 ILIKE ${term}` : client``}
      ORDER BY l.out_bottles DESC, l.product_name
      LIMIT 500
    `;

    const summary = rows.reduce(
      (totals, row) => ({
        wines: totals.wines + 1,
        outBottles: totals.outBottles + row.outBottles,
        outValue: totals.outValue + row.outValue,
        heldDeclared: totals.heldDeclared + (row.heldDeclared ?? 0),
        unmatched: totals.unmatched + (row.heldDeclared === null ? 1 : 0),
        /*
          What has left their shelf across the wines we can see: everything we
          sent, less what they still hold. Only counted where their position is
          known — an unknown position would otherwise read as everything gone.
        */
        gone:
          totals.gone +
          (row.heldDeclared === null ? 0 : row.outBottles - row.heldDeclared),
        packAssumed: totals.packAssumed + (row.packAssumed ? 1 : 0),
      }),
      {
        wines: 0,
        outBottles: 0,
        outValue: 0,
        heldDeclared: 0,
        unmatched: 0,
        gone: 0,
        packAssumed: 0,
      },
    );

    return { rows, summary };
  });

export default adminGetBalances;
