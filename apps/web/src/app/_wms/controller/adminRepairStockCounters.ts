import { sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

interface CounterRow extends Record<string, unknown> {
  id: string;
  lwin18: string;
  product_name: string;
  location_code: string | null;
  owner_name: string | null;
  quantity_cases: number;
  reserved_cases: number;
  available_cases: number;
  held: number;
}

/**
 * Put each stock row's reserved and available counts back in line with the
 * holds that actually exist
 *
 * Available is what the price lists and order desk offer, so it must never
 * exceed what is on the shelf less what active holds promise. A hold given back
 * twice (two Zoho syncs of one order at once, 4 Nov 2026) left 39 rows offering
 * a case already picked, Mouton 2010 12x75cl among them, with reserved at -1.
 *
 * Counts only: the shelf quantity is the truth and is not touched, and no hold
 * is created or released. A row whose holds promise more than the shelf holds
 * is reported, not changed, since that needs a person to decide which order
 * goes short.
 *
 * Preview first (`dryRun`), then save.
 *
 * @example
 *   await trpcClient.wms.admin.stock.repairCounters.mutate({ dryRun: true });
 */
const adminRepairStockCounters = staffAdminProcedure
  .input(z.object({ dryRun: z.boolean().default(true) }))
  .mutation(async ({ input }) => {
    const result = await db.execute<CounterRow>(sql`
      SELECT s.id, s.lwin18, s.product_name, l.location_code, s.owner_name,
             s.quantity_cases, s.reserved_cases, s.available_cases,
             COALESCE(h.held, 0)::int AS held
        FROM wms_stock s
        LEFT JOIN wms_locations l ON l.id = s.location_id
        LEFT JOIN (
          SELECT stock_id, SUM(quantity_cases)::int AS held
            FROM wms_stock_reservations
           WHERE status = 'active'
           GROUP BY stock_id
        ) h ON h.stock_id = s.id
       WHERE s.reserved_cases IS DISTINCT FROM COALESCE(h.held, 0)
          OR s.available_cases IS DISTINCT FROM GREATEST(s.quantity_cases - COALESCE(h.held, 0), 0)
       ORDER BY s.product_name
    `);

    const rows = result.map((row) => ({
      stockId: row.id,
      lwin18: row.lwin18,
      productName: row.product_name,
      locationCode: row.location_code,
      ownerName: row.owner_name,
      onShelf: Number(row.quantity_cases),
      reservedBefore: Number(row.reserved_cases),
      availableBefore: Number(row.available_cases),
      held: Number(row.held),
      reservedAfter: Number(row.held),
      availableAfter: Math.max(Number(row.quantity_cases) - Number(row.held), 0),
      overHeld: Number(row.held) > Number(row.quantity_cases),
    }));

    if (!input.dryRun && rows.length > 0) {
      await db.execute(sql`
        UPDATE wms_stock s
           SET reserved_cases = COALESCE(h.held, 0),
               available_cases = GREATEST(s.quantity_cases - COALESCE(h.held, 0), 0),
               updated_at = NOW()
          FROM wms_stock s2
          LEFT JOIN (
            SELECT stock_id, SUM(quantity_cases)::int AS held
              FROM wms_stock_reservations
             WHERE status = 'active'
             GROUP BY stock_id
          ) h ON h.stock_id = s2.id
         WHERE s.id = s2.id
           AND (s.reserved_cases IS DISTINCT FROM COALESCE(h.held, 0)
             OR s.available_cases IS DISTINCT FROM GREATEST(s.quantity_cases - COALESCE(h.held, 0), 0))
      `);
    }

    return {
      dryRun: input.dryRun,
      changed: rows.length,
      overstated: rows.filter((r) => r.availableBefore > r.availableAfter).length,
      overHeld: rows.filter((r) => r.overHeld).length,
      rows,
    };
  });

export default adminRepairStockCounters;
