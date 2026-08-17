import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock, wmsStockMovements } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Reconcile the ledger to the stock that is physically on the shelf.
 *
 * Never deletes stock. The bay is the truth; a gap in the movements means the
 * paperwork is incomplete. Three things are recorded:
 *
 * 1. A wine that is over on one code and under by the SAME amount on another —
 *    the fingerprint of a pack re-designation — is written as the repack pair
 *    it always was (out of the old code, into the new one).
 * 2. Stock with no arrival on the ledger gets its arrival recorded.
 * 3. Duplicate rows for the same wine/bay/shipment are merged.
 *
 * @example
 *   await trpcClient.wms.admin.stock.autoFix.mutate();
 */
const adminAutoFixStock = wmsOperatorProcedure.mutation(async ({ ctx }) => {
  const fixes: Array<{
    type: 'recorded_orphan' | 'merged_duplicate' | 'recorded_repack';
    lwin18: string;
    productName: string;
    casesBefore: number;
    casesAfter: number;
    detail: string;
  }> = [];

  // 0. A wine over on one code and under by exactly the same on another is one
  // event, not two: its pack was re-designated and the stock row's LWIN was
  // rewritten while the ledger kept crediting the old code. Recording the
  // repack pair clears BOTH lines and tells the truth about what happened —
  // whereas treating the over-count alone as a fresh arrival would leave the
  // old code permanently short.
  const ledgerVsStock = await db.execute(sql`
    SELECT COALESCE(m.lwin18, s.lwin18) AS lwin18,
           COALESCE(s.product_name, '') AS product_name,
           COALESCE(s.actual_cases, 0) - COALESCE(m.expected_cases, 0) AS diff,
           s.location_id
      FROM (
        SELECT lwin18, SUM(CASE movement_type
          WHEN 'receive' THEN quantity_cases WHEN 'count' THEN quantity_cases
          WHEN 'repack_in' THEN quantity_cases
          WHEN 'adjust' THEN CASE WHEN reason_code IS DISTINCT FROM 'stock_correction' THEN quantity_cases ELSE 0 END
          WHEN 'pick' THEN -quantity_cases WHEN 'repack_out' THEN -quantity_cases
          ELSE 0 END) AS expected_cases
        FROM wms_stock_movements GROUP BY lwin18
      ) m
      FULL OUTER JOIN (
        SELECT lwin18, SUM(quantity_cases) AS actual_cases,
               MAX(product_name) AS product_name, MIN(location_id) AS location_id
        FROM wms_stock GROUP BY lwin18
      ) s ON s.lwin18 = m.lwin18
     WHERE COALESCE(s.actual_cases, 0) - COALESCE(m.expected_cases, 0) <> 0
  `);

  const diffRows = (
    Array.isArray(ledgerVsStock)
      ? ledgerVsStock
      : ((ledgerVsStock as { rows?: unknown[] }).rows ?? [])
  ) as Array<{
    lwin18: string;
    product_name: string;
    diff: number | string;
    location_id: string | null;
  }>;

  /** Same wine, vintage and bottle size — the pack segment is what moved. */
  const wineKey = (lwin18: string) => {
    const parts = String(lwin18).split('-');
    return parts.length === 4
      ? `${parts[0]}-${parts[1]}-${parts[3]}`
      : String(lwin18);
  };

  const pairedLwins = new Set<string>();
  const byWine = new Map<string, typeof diffRows>();
  for (const row of diffRows) {
    const key = wineKey(row.lwin18);
    byWine.set(key, [...(byWine.get(key) ?? []), row]);
  }

  for (const rows of byWine.values()) {
    const over = rows.filter((r) => Number(r.diff) > 0);
    const under = rows.filter((r) => Number(r.diff) < 0);

    for (const gained of over) {
      const cases = Number(gained.diff);
      const lost = under.find(
        (u) => Math.abs(Number(u.diff)) === cases && !pairedLwins.has(u.lwin18),
      );
      if (!lost || pairedLwins.has(gained.lwin18)) continue;

      pairedLwins.add(gained.lwin18);
      pairedLwins.add(lost.lwin18);

      await db.insert(wmsStockMovements).values({
        movementNumber: await generateMovementNumber(),
        movementType: 'repack_out',
        lwin18: lost.lwin18,
        productName: lost.product_name || gained.product_name,
        quantityCases: cases,
        fromLocationId: gained.location_id ?? undefined,
        notes: `RECONCILE: pack re-designated to ${gained.lwin18} — recorded as a repack, stock untouched`,
        reasonCode: 'pack_change',
        performedBy: ctx.user.id,
        performedAt: new Date(),
      });

      await db.insert(wmsStockMovements).values({
        movementNumber: await generateMovementNumber(),
        movementType: 'repack_in',
        lwin18: gained.lwin18,
        productName: gained.product_name || lost.product_name,
        quantityCases: cases,
        toLocationId: gained.location_id ?? undefined,
        notes: `RECONCILE: pack re-designated from ${lost.lwin18} — recorded as a repack, stock untouched`,
        reasonCode: 'pack_change',
        performedBy: ctx.user.id,
        performedAt: new Date(),
      });

      fixes.push({
        type: 'recorded_repack',
        lwin18: gained.lwin18,
        productName: gained.product_name || lost.product_name,
        casesBefore: cases,
        casesAfter: cases,
        detail: `Recorded ${cases} case(s) moving from ${lost.lwin18} to ${gained.lwin18} (pack re-designation) — CHECK the bottle count, the pack size changed`,
      });
    }
  }

  // 1. Find orphan stock records (stock with no matching receive movement)
  const orphanStock = await db
    .select({
      id: wmsStock.id,
      lwin18: wmsStock.lwin18,
      productName: wmsStock.productName,
      locationId: wmsStock.locationId,
      quantityCases: wmsStock.quantityCases,
      shipmentId: wmsStock.shipmentId,
    })
    .from(wmsStock)
    .where(
      sql`NOT EXISTS (
        SELECT 1 FROM ${wmsStockMovements} m
        WHERE m.lwin18 = ${wmsStock.lwin18}
        AND m.movement_type IN ('receive', 'repack_in')
        AND (m.shipment_id = ${wmsStock.shipmentId} OR (m.shipment_id IS NULL AND ${wmsStock.shipmentId} IS NULL))
      )`,
    );

  for (const orphan of orphanStock) {
    // Record the arrival the ledger is missing. It does NOT delete the stock.
    //
    // This used to delete any stock row with no matching receive movement,
    // which is backwards: the shelf is the truth and the ledger is derived from
    // it. A gap means the paperwork is incomplete, not that the wine is
    // imaginary — and a missing movement is exactly what a repack, a pack
    // correction or a split case leaves behind. Pressed once, it would have
    // destroyed 18 cases of San Polo sitting in A-02-01.
    //
    // The reason code must NOT be 'stock_correction': the reconciliation
    // excludes those from the ledger, so the discrepancy would never clear.
    if (orphan.quantityCases <= 0) continue;
    // Already accounted for by the repack pair above.
    if (pairedLwins.has(orphan.lwin18)) continue;

    const movementNumber = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber,
      movementType: 'adjust',
      lwin18: orphan.lwin18,
      productName: orphan.productName,
      quantityCases: orphan.quantityCases,
      toLocationId: orphan.locationId,
      notes:
        'RECONCILE: stock counted in the bay with no arrival on the ledger — arrival recorded, stock left alone',
      reasonCode: 'reconciliation',
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    fixes.push({
      type: 'recorded_orphan',
      lwin18: orphan.lwin18,
      productName: orphan.productName,
      casesBefore: orphan.quantityCases,
      casesAfter: orphan.quantityCases,
      detail: `Recorded ${orphan.quantityCases} case(s) onto the ledger (stock untouched)`,
    });
  }

  // 2. Find and merge duplicate stock records (same lwin18 + location + shipment)
  // Note: This shouldn't happen with the unique constraint, but handle legacy data
  const duplicateGroups = await db.execute(sql`
    SELECT
      lwin18,
      location_id,
      shipment_id,
      COUNT(*) as record_count,
      SUM(quantity_cases) as total_cases,
      ARRAY_AGG(id::text ORDER BY created_at) as stock_ids
    FROM wms_stock
    GROUP BY lwin18, location_id, shipment_id
    HAVING COUNT(*) > 1
  `);

  const duplicateRows = Array.isArray(duplicateGroups)
    ? duplicateGroups
    : duplicateGroups.rows ?? [];

  for (const group of duplicateRows) {
    const stockIds = group.stock_ids as string[];
    const totalCases = Number(group.total_cases);
    const keepId = stockIds[0]; // Keep the oldest record
    const deleteIds = stockIds.slice(1); // Delete the rest

    // Get details of the record we're keeping
    const [keepRecord] = await db
      .select()
      .from(wmsStock)
      .where(eq(wmsStock.id, keepId));

    if (!keepRecord) continue;

    // Sum the cases from records we're deleting
    let deletedCases = 0;
    for (const deleteId of deleteIds) {
      const [deleteRecord] = await db
        .select()
        .from(wmsStock)
        .where(eq(wmsStock.id, deleteId));

      if (deleteRecord) {
        deletedCases += deleteRecord.quantityCases;

        // Create adjustment movement for deleted duplicate
        const movementNumber = await generateMovementNumber();
        await db.insert(wmsStockMovements).values({
          movementNumber,
          movementType: 'adjust',
          lwin18: deleteRecord.lwin18,
          productName: deleteRecord.productName,
          quantityCases: -deleteRecord.quantityCases,
          fromLocationId: deleteRecord.locationId,
          notes: `AUTO-FIX: Merged duplicate into ${keepId}`,
          reasonCode: 'stock_correction',
          performedBy: ctx.user.id,
          performedAt: new Date(),
        });

        // Delete the duplicate
        await db.delete(wmsStock).where(eq(wmsStock.id, deleteId));
      }
    }

    fixes.push({
      type: 'merged_duplicate',
      lwin18: keepRecord.lwin18,
      productName: keepRecord.productName,
      casesBefore: totalCases,
      casesAfter: keepRecord.quantityCases,
      detail: `Merged ${deleteIds.length} duplicate records (deleted ${deletedCases} duplicate cases)`,
    });
  }

  // 3. Verify final reconciliation
  const [movementTotals] = await db
    .select({
      totalReceived: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'receive' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
      totalPicked: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'pick' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
      totalAdjusted: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'adjust' AND ${wmsStockMovements.reasonCode} != 'stock_correction' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
      totalCounted: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'count' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
      totalRepackIn: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'repack_in' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
      totalRepackOut: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'repack_out' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
    })
    .from(wmsStockMovements);

  const [stockTotals] = await db
    .select({
      totalCases: sql<number>`COALESCE(SUM(${wmsStock.quantityCases}), 0)::int`,
    })
    .from(wmsStock);

  const expectedStock =
    (movementTotals?.totalReceived ?? 0) -
    (movementTotals?.totalPicked ?? 0) +
    (movementTotals?.totalAdjusted ?? 0) +
    (movementTotals?.totalCounted ?? 0) +
    (movementTotals?.totalRepackIn ?? 0) -
    (movementTotals?.totalRepackOut ?? 0);

  const actualStock = stockTotals?.totalCases ?? 0;
  const isReconciled = expectedStock === actualStock;

  return {
    success: true,
    fixes,
    totalFixes: fixes.length,
    finalState: {
      expectedStock,
      actualStock,
      isReconciled,
      discrepancy: actualStock - expectedStock,
    },
  };
});

export default adminAutoFixStock;
