import { sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

interface GhostRow extends Record<string, unknown> {
  id: string;
  lwin18: string;
  product_name: string;
  owner_name: string | null;
  location_code: string | null;
  quantity_cases: number;
  reserved_cases: number;
  available_cases: number;
}

/**
 * Bring available back down to what is on the shelf less what is held
 *
 * A hold given back after a pick had already taken its case (5 Nov: 27 rows,
 * mostly from PL-2026-0166 and PL-2026-0170) left rows with nothing on the
 * shelf still counted as available, and the price lists offered them. This
 * sets available to GREATEST(quantity - reserved, 0) on exactly the rows where
 * it is higher, and changes nothing else: no hold, no shelf quantity, no
 * reserved figure, no movement. Rows held for more than is on the shelf are
 * listed too (`overHeld`), as they need a person to decide which order goes
 * short.
 *
 * Preview first (`dryRun`, the default), then save.
 *
 * @example
 *   await trpcClient.wms.admin.stock.repairAvailability.mutate({ dryRun: true });
 */
const adminRepairStockAvailability = adminProcedure
  .input(z.object({ dryRun: z.boolean().default(true) }))
  .mutation(async ({ input }) =>
    db.transaction(async (tx) => {
      const found = await tx.execute<GhostRow>(sql`
        SELECT s.id, s.lwin18, s.product_name, s.owner_name, l.location_code,
               s.quantity_cases, s.reserved_cases, s.available_cases
          FROM wms_stock s
          LEFT JOIN wms_locations l ON l.id = s.location_id
         WHERE s.available_cases > GREATEST(s.quantity_cases - s.reserved_cases, 0)
            OR s.reserved_cases > s.quantity_cases
         ORDER BY s.product_name
           FOR UPDATE OF s
      `);

      const rows = found.map((row) => {
        const quantity = Number(row.quantity_cases);
        const reserved = Number(row.reserved_cases);
        const available = Number(row.available_cases);
        const corrected = Math.max(quantity - reserved, 0);
        return {
          stockId: row.id,
          lwin18: row.lwin18,
          productName: row.product_name,
          ownerName: row.owner_name,
          location: row.location_code,
          quantity,
          reserved,
          available,
          corrected: Math.min(available, corrected),
          overstated: available > corrected,
          overHeld: reserved > quantity,
        };
      });

      const toFix = rows.filter((row) => row.overstated);

      if (!input.dryRun && toFix.length > 0) {
        const ids = sql.join(
          toFix.map((row) => sql`${row.stockId}::uuid`),
          sql`, `,
        );
        await tx.execute(sql`
          UPDATE wms_stock
             SET available_cases = GREATEST(quantity_cases - reserved_cases, 0)
           WHERE id IN (${ids})
             AND available_cases > GREATEST(quantity_cases - reserved_cases, 0)
        `);
      }

      return {
        dryRun: input.dryRun,
        corrected: input.dryRun ? 0 : toFix.length,
        overstated: toFix.length,
        overstatedCases: toFix.reduce((sum, row) => sum + row.available - row.corrected, 0),
        overHeld: rows.filter((row) => row.overHeld).length,
        rows,
      };
    }),
  );

export default adminRepairStockAvailability;
