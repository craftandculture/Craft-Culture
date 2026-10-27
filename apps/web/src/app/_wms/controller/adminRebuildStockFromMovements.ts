import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Compare stock in each bay with what the movement ledger says should be there.
 *
 * Read only. This used to "rebuild" stock rows from the ledger, and in doing so
 * ignored repacks and counts, gave wine with no shipment to whichever partner
 * the database listed first, and created every row as for sale — so a
 * member's held wine could come back listed under somebody else. It now only
 * reports the gaps; a gap is corrected by counting the bay and adjusting the
 * row, which records who did it and why.
 *
 * Pallet movements are not included (they move cases already on a stock row).
 *
 * @example
 *   await trpcClient.wms.admin.stock.rebuildFromMovements.mutate({});
 */
const adminRebuildStockFromMovements = adminProcedure.mutation(async () => {
  const result = await db.execute(sql`
    WITH movement_effects AS (
      SELECT lwin18, product_name, to_location_id AS location_id, quantity_cases AS effect
        FROM wms_stock_movements
       WHERE movement_type IN ('receive', 'transfer', 'repack_in') AND to_location_id IS NOT NULL
      UNION ALL
      SELECT lwin18, product_name, from_location_id AS location_id, -quantity_cases AS effect
        FROM wms_stock_movements
       WHERE movement_type IN ('pick', 'transfer', 'repack_out') AND from_location_id IS NOT NULL
      UNION ALL
      SELECT lwin18, product_name, COALESCE(to_location_id, from_location_id) AS location_id, quantity_cases AS effect
        FROM wms_stock_movements
       WHERE movement_type IN ('adjust', 'count')
         AND reason_code IS DISTINCT FROM 'stock_correction'
    ),
    ledger AS (
      SELECT lwin18, location_id, MAX(product_name) AS product_name, SUM(effect)::int AS ledger_cases
        FROM movement_effects
       WHERE location_id IS NOT NULL
       GROUP BY lwin18, location_id
    ),
    shelf AS (
      SELECT lwin18, location_id, MAX(product_name) AS product_name, SUM(quantity_cases)::int AS stock_cases
        FROM wms_stock
       GROUP BY lwin18, location_id
    )
    SELECT COALESCE(l.lwin18, s.lwin18) AS lwin18,
           COALESCE(s.product_name, l.product_name, '') AS product_name,
           loc.location_code,
           COALESCE(l.ledger_cases, 0) AS ledger_cases,
           COALESCE(s.stock_cases, 0) AS stock_cases
      FROM ledger l
      FULL OUTER JOIN shelf s ON s.lwin18 = l.lwin18 AND s.location_id = l.location_id
      LEFT JOIN wms_locations loc ON loc.id = COALESCE(l.location_id, s.location_id)
     WHERE COALESCE(l.ledger_cases, 0) > COALESCE(s.stock_cases, 0)
     ORDER BY (COALESCE(l.ledger_cases, 0) - COALESCE(s.stock_cases, 0)) DESC
     LIMIT 500
  `);

  const rows = (
    Array.isArray(result)
      ? result
      : ((result as { rows?: unknown[] }).rows ?? [])
  ) as Array<{
    lwin18: string;
    product_name: string;
    location_code: string | null;
    ledger_cases: number | string;
    stock_cases: number | string;
  }>;

  const gaps = rows.map((row) => ({
    lwin18: String(row.lwin18),
    productName: String(row.product_name ?? ''),
    locationCode: row.location_code ?? '—',
    ledgerCases: Number(row.ledger_cases),
    stockCases: Number(row.stock_cases),
  }));

  return {
    success: true,
    dryRun: true as const,
    message:
      gaps.length === 0
        ? 'No bay holds less than the ledger says. Nothing to count.'
        : `${gaps.length} bay${gaps.length === 1 ? '' : 's'} hold less than the ledger says. Nothing was changed — count each one and adjust the stock row.`,
    created: 0,
    updated: 0,
    errors: gaps.map(
      (gap) =>
        `${gap.productName || gap.lwin18} at ${gap.locationCode}: ledger ${gap.ledgerCases}, in stock ${gap.stockCases}`,
    ),
    gaps,
  };
});

export default adminRebuildStockFromMovements;
