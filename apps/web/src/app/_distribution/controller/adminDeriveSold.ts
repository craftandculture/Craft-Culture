import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

interface MovementRow {
  arrangementId: string;
  lwin18: string | null;
  productName: string;
  outletCode: string | null;
  code: string;
  heldFrom: number;
  heldTo: number;
  delivered: number;
  soldLast30d: number | null;
}

/**
 * Work out what sold between two positions
 *
 * The distributor's feed is a live position with no history and no date, so a
 * month cannot be asked for — but two positions and what we delivered between
 * them give the movement exactly:
 *
 *     sold = held at the start + delivered since − held at the end
 *
 * That is better than the feed's own `sold_last_30d`, which is a rolling
 * window and cannot be cut to a calendar month, and better than waiting for
 * their spreadsheet, which arrives when it arrives. The rolling figure is kept
 * alongside as an independent check rather than as the answer.
 *
 * A negative result means they hold more than they started with plus what we
 * sent, which is not a sale — it is a delivery we never invoiced, a pack read
 * wrongly, or a code matched to the wrong wine. Those are reported and not
 * written: a negative sale would credit an owner for bottles that never moved.
 *
 * @param outletId - Whose position to difference
 * @param from - The opening snapshot moment
 * @param to - The closing snapshot moment
 * @returns What sold, what could not be read as a sale, and the cross-check
 */
const adminDeriveSold = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      from: z.string().min(1),
      to: z.string().min(1),
    }),
  )
  .mutation(async ({ input }) => {
    if (input.from >= input.to) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The opening position must be earlier than the closing one.',
      });
    }

    /*
      Uploaded sales and derived sales for the same days would both count, and
      the total would silently double. The upload is the distributor's own
      word, so it wins — deriving is refused rather than quietly competing.
    */
    const [clash] = await client<{ months: string }[]>`
      SELECT STRING_AGG(DISTINCT TO_CHAR(m.doc_date, 'YYYY-MM'), ', ') AS months
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      WHERE a.outlet_id = ${input.outletId}
        AND m.kind = 'sold'
        AND m.source = 'outlet-sales-report'
        AND m.doc_date BETWEEN ${input.from}::date AND ${input.to}::date
    `;

    if (clash?.months) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `The distributor's own report already covers ${clash.months}. Their figure is the one to settle from — delete that import first if you want this derived instead.`,
      });
    }

    const rows = await client<MovementRow[]>`
      WITH code_map AS (
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
        City Drinks' own code, mapped to a wine by hand in the old tool.

        This is the path the W-code bridge cannot reach. The code they hold
        for us is only genuinely ours for Crurated, who issue W codes; for
        everyone else it is a label City Drinks invented (CCW73CON) and no
        table of ours has ever held it. But their own CDR code HAS been mapped,
        one wine at a time, in tri_sku_aliases, and that work should not be
        repeated just because it was done somewhere else.
      */
      outlet_code_map AS (
        SELECT DISTINCT
          UPPER(REGEXP_REPLACE(a.alias_code, '[^A-Za-z0-9]', '', 'g')) AS outlet_code,
          UPPER(REGEXP_REPLACE(s.lwin18, '[^A-Za-z0-9]', '', 'g')) AS lwin
        FROM tri_sku_aliases a
        JOIN tri_skus s ON s.id = a.sku_id
        WHERE a.source = 'city_drinks'
          AND NULLIF(TRIM(s.lwin18), '') IS NOT NULL
      ),
      position AS (
        SELECT
          COALESCE(
            cm.lwin,
            ocm.lwin,
            UPPER(REGEXP_REPLACE(s.our_code, '[^A-Za-z0-9]', '', 'g'))
          ) AS code,
          MIN(s.outlet_code) AS outlet_code,
          SUM(s.bottles_on_hand) FILTER (WHERE s.taken_at = ${input.from}::timestamp)::float8
            AS held_from,
          SUM(s.bottles_on_hand) FILTER (WHERE s.taken_at = ${input.to}::timestamp)::float8
            AS held_to,
          MAX(s.sold_last_30d) FILTER (WHERE s.taken_at = ${input.to}::timestamp)::float8
            AS sold_last_30d
        FROM cons_snapshots s
        LEFT JOIN code_map cm
          ON cm.w_code = REGEXP_REPLACE(
               UPPER(REGEXP_REPLACE(s.our_code, '[^A-Za-z0-9]', '', 'g')), 'CON$', ''
             )
        LEFT JOIN outlet_code_map ocm
          ON ocm.outlet_code =
             UPPER(REGEXP_REPLACE(s.outlet_code, '[^A-Za-z0-9]', '', 'g'))
        WHERE s.outlet_id = ${input.outletId}
          AND s.regime = 'consigned'
          AND s.taken_at IN (${input.from}::timestamp, ${input.to}::timestamp)
          AND NULLIF(TRIM(s.our_code), '') IS NOT NULL
        GROUP BY 1
      ),
      ours AS (
        SELECT DISTINCT ON (code) code, arrangement_id, lwin18, product_name
        FROM (
          SELECT UPPER(REGEXP_REPLACE(COALESCE(m.lwin18, m.product_name), '[^A-Za-z0-9]', '', 'g')) AS code,
                 m.arrangement_id, m.lwin18, m.product_name, m.doc_date
          FROM cons_movements m
          JOIN cons_arrangements a ON a.id = m.arrangement_id
          WHERE a.outlet_id = ${input.outletId} AND m.kind = 'out'
        ) lines
        ORDER BY code, doc_date DESC NULLS LAST
      ),
      delivered AS (
        SELECT UPPER(REGEXP_REPLACE(COALESCE(m.lwin18, m.product_name), '[^A-Za-z0-9]', '', 'g')) AS code,
               SUM(m.bottles)::float8 AS bottles
        FROM cons_movements m
        JOIN cons_arrangements a ON a.id = m.arrangement_id
        WHERE a.outlet_id = ${input.outletId}
          AND m.kind = 'out'
          AND m.doc_date > ${input.from}::date
          AND m.doc_date <= ${input.to}::date
        GROUP BY 1
      )
      SELECT o.arrangement_id AS "arrangementId", o.lwin18,
             o.product_name AS "productName",
             p.outlet_code AS "outletCode", p.code,
             COALESCE(p.held_from, 0) AS "heldFrom",
             COALESCE(p.held_to, 0) AS "heldTo",
             COALESCE(d.bottles, 0) AS "delivered",
             p.sold_last_30d AS "soldLast30d"
      FROM position p
      JOIN ours o ON o.code = p.code
      LEFT JOIN delivered d ON d.code = p.code
    `;

    const movements: Record<string, unknown>[] = [];
    const impossible: string[] = [];
    let checkedAgainstFeed = 0;
    let feedDisagrees = 0;

    for (const row of rows) {
      const sold = row.heldFrom + row.delivered - row.heldTo;

      if (sold < 0) {
        impossible.push(
          `${row.productName} — held ${row.heldFrom}, we delivered ${row.delivered}, they now hold ${row.heldTo}`,
        );
        continue;
      }

      if (sold === 0) continue;

      /*
        The feed's own rolling thirty days, as a second opinion. It covers a
        different window so it will rarely agree exactly; it is worth knowing
        when it disagrees by more than everything.
      */
      if (row.soldLast30d !== null) {
        checkedAgainstFeed += 1;

        if (sold > row.soldLast30d) feedDisagrees += 1;
      }

      movements.push({
        arrangement_id: row.arrangementId,
        kind: 'sold',
        lwin18: row.lwin18,
        product_name: row.productName,
        outlet_code: row.outletCode,
        bottles: sold,
        source_qty: sold,
        source_unit: 'bottle',
        pack: 1,
        pack_assumed: false,
        doc_ref: `Derived ${input.from.slice(0, 10)} → ${input.to.slice(0, 10)}`,
        doc_date: input.to.slice(0, 10),
        source: 'cd-api-derived',
      });
    }

    await client`
      DELETE FROM cons_movements m
      USING cons_arrangements a
      WHERE m.arrangement_id = a.id
        AND a.outlet_id = ${input.outletId}
        AND m.kind = 'sold'
        AND m.source = 'cd-api-derived'
        AND m.doc_date = ${input.to.slice(0, 10)}::date
    `;

    if (movements.length > 0) {
      await client`INSERT INTO cons_movements ${client(movements)}`;
    }

    return {
      from: input.from,
      to: input.to,
      wines: movements.length,
      bottles: movements.reduce((sum, row) => sum + Number(row.bottles ?? 0), 0),
      /** Positions that cannot be read as a sale — a delivery or a bad match */
      impossible: impossible.slice(0, 25),
      impossibleCount: impossible.length,
      checkedAgainstFeed,
      feedDisagrees,
    };
  });

export default adminDeriveSold;
