import { sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Write back the details a repacked stock row never inherited
 *
 * A repack copies the source row's details, so a split case inherits whatever
 * the original carried — and nothing where the original carried nothing. Rows
 * repacked before that copying existed lost more than that.
 *
 * Showing a fallback at read time is not enough for these two. The **re-export
 * BOE** is a customs record and has to be *on* the row that clears, not derived
 * for a screen; and an **import price** is what a quote and a valuation are
 * built from. Both belong in the data.
 *
 * Additive and idempotent: only blanks are filled, and the sources are the
 * wine's own LWIN record and the shipment the stock arrived on — nothing is
 * invented. Safe to run repeatedly.
 *
 * @example
 *   await trpcClient.wms.admin.stock.backfillDetails.mutate({ dryRun: true });
 */
const adminBackfillStockDetails = wmsOperatorProcedure
  .input(z.object({ dryRun: z.boolean().default(true) }))
  .mutation(async ({ input }) => {
    const { dryRun } = input;

    /** Blank producers the LWIN reference can answer */
    const producerWhere = sql`
      (${sql.raw('wms_stock.producer')} IS NULL OR TRIM(${sql.raw('wms_stock.producer')}) = '')
      AND w.lwin = SUBSTRING(wms_stock.lwin18 FROM 1 FOR 7)
      AND COALESCE(w.producer_name, w.producer_title) IS NOT NULL
    `;

    /** Blank BOEs the shipment can answer */
    const boeWhere = sql`
      (wms_stock.re_export_boe_number IS NULL OR TRIM(wms_stock.re_export_boe_number) = '')
      AND s.id = wms_stock.shipment_id
      AND s.re_export_boe_number IS NOT NULL
      AND TRIM(s.re_export_boe_number) <> ''
    `;

    if (dryRun) {
      const [counts] = await db.execute<{ producers: number; boes: number }>(sql`
        SELECT
          (SELECT COUNT(*)::int FROM wms_stock, lwin_wines w WHERE ${producerWhere}) AS producers,
          (SELECT COUNT(*)::int FROM wms_stock, logistics_shipments s WHERE ${boeWhere}) AS boes
      `);

      return {
        dryRun: true,
        producers: Number(counts?.producers ?? 0),
        boes: Number(counts?.boes ?? 0),
      };
    }

    const producers = await db.execute(sql`
      UPDATE wms_stock
         SET producer = TRIM(COALESCE(w.producer_title, '') || ' ' || COALESCE(w.producer_name, '')),
             updated_at = NOW()
        FROM lwin_wines w
       WHERE ${producerWhere}
    `);

    const boes = await db.execute(sql`
      UPDATE wms_stock
         SET re_export_boe_number = s.re_export_boe_number,
             updated_at = NOW()
        FROM logistics_shipments s
       WHERE ${boeWhere}
    `);

    /*
      Import prices are not copied onto stock — they live in
      wms_product_pricing, keyed pack-agnostically, so a repacked pack already
      resolves to the wine's price without a row of its own. Writing a
      per-pack copy would create exactly the duplicate rows that made cost
      overrides unclearable.
    */
    const result = {
      dryRun: false,
      producers: (producers as unknown as { count?: number }).count ?? 0,
      boes: (boes as unknown as { count?: number }).count ?? 0,
    };

    logger.info('[BackfillStockDetails] Filled blanks on repacked stock', result);

    return result;
  });

export default adminBackfillStockDetails;
