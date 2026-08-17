import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock, wmsStockMovements } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Auto-fix stock reconciliation issues
 * Compares movements vs stock and fixes discrepancies automatically:
 * - Deletes stock records that have no corresponding receive movement
 * - Merges duplicate stock records
 *
 * @example
 *   await trpcClient.wms.admin.stock.autoFix.mutate();
 */
const adminAutoFixStock = wmsOperatorProcedure.mutation(async ({ ctx }) => {
  const fixes: Array<{
    type: 'recorded_orphan' | 'merged_duplicate';
    lwin18: string;
    productName: string;
    casesBefore: number;
    casesAfter: number;
    detail: string;
  }> = [];

  // 1. Find and delete orphan stock records (stock with no matching receive movement)
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
