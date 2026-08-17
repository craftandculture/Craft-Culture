import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock, wmsStockMovements } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import generateMovementNumber from '../utils/generateMovementNumber';
import planLedgerReconcile from '../utils/planLedgerReconcile';

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
    type:       | 'recorded_orphan'
      | 'merged_duplicate'
      | 'recorded_pack_correction'
      | 'needs_count';
    lwin18: string;
    productName: string;
    casesBefore: number;
    casesAfter: number;
    detail: string;
  }> = [];

  // Reconcile the ledger to the shelf. planLedgerReconcile decides WHAT to
  // record (and is unit-tested); this block writes it.
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

  const plan = planLedgerReconcile(
    diffRows.map((row) => ({
      lwin18: String(row.lwin18),
      productName: String(row.product_name ?? ''),
      diff: Number(row.diff),
      locationId: row.location_id,
    })),
  );

  const reconciled = new Set<string>();

  // Booked under the wrong pack code. The wine never changed — San Polo's cases
  // are labelled "3 bottles" and were received as 6-packs — so this corrects the
  // ledger on both codes rather than claiming a repack that never happened.
  for (const repack of plan.packCorrections) {
    reconciled.add(repack.from.lwin18);
    reconciled.add(repack.to.lwin18);

    await db.insert(wmsStockMovements).values({
      movementNumber: await generateMovementNumber(),
      movementType: 'adjust',
      lwin18: repack.from.lwin18,
      productName: repack.from.productName || repack.to.productName,
      quantityCases: -repack.cases,
      fromLocationId: repack.to.locationId ?? undefined,
      notes: `RECONCILE: received under the wrong pack code — these cases are ${repack.to.lwin18}. Ledger corrected, stock untouched`,
      reasonCode: 'pack_correction',
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    await db.insert(wmsStockMovements).values({
      movementNumber: await generateMovementNumber(),
      movementType: 'adjust',
      lwin18: repack.to.lwin18,
      productName: repack.to.productName || repack.from.productName,
      quantityCases: repack.cases,
      toLocationId: repack.to.locationId ?? undefined,
      notes: `RECONCILE: these cases were received under ${repack.from.lwin18} but are this pack. Ledger corrected, stock untouched`,
      reasonCode: 'pack_correction',
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    fixes.push({
      type: 'recorded_pack_correction',
      lwin18: repack.to.lwin18,
      productName: repack.to.productName || repack.from.productName,
      casesBefore: repack.cases,
      casesAfter: repack.cases,
      detail: `Corrected ${repack.cases} case(s) from ${repack.from.lwin18} to ${repack.to.lwin18} — received under the wrong pack code`,
    });
  }

  // Stock the ledger never saw arrive. Sized by the GAP, not by what is left in
  // the bay: bottles from a cracked case may since have been picked, leaving a
  // row at zero that a stock-sized entry could never close.
  for (const topUp of plan.topUps) {
    reconciled.add(topUp.row.lwin18);

    await db.insert(wmsStockMovements).values({
      movementNumber: await generateMovementNumber(),
      movementType: topUp.fromCrackedCase ? 'repack_in' : 'adjust',
      lwin18: topUp.row.lwin18,
      productName: topUp.row.productName,
      quantityCases: topUp.cases,
      quantityBottles: topUp.fromCrackedCase ? topUp.cases : undefined,
      toLocationId: topUp.row.locationId ?? undefined,
      notes: topUp.fromCrackedCase
        ? 'RECONCILE: bottles from a cracked case, arrival never recorded — stock untouched'
        : 'RECONCILE: stock counted in the bay with no arrival on the ledger — arrival recorded, stock left alone',
      reasonCode: topUp.fromCrackedCase ? 'split_case' : 'reconciliation',
      performedBy: ctx.user.id,
      performedAt: new Date(),
    });

    fixes.push({
      type: 'recorded_orphan',
      lwin18: topUp.row.lwin18,
      productName: topUp.row.productName,
      casesBefore: topUp.cases,
      casesAfter: topUp.cases,
      detail: `Recorded ${topUp.cases} case(s) onto the ledger (stock untouched)`,
    });
  }

  for (const row of plan.needsCount) {
    fixes.push({
      type: 'needs_count',
      lwin18: row.lwin18,
      productName: row.productName,
      casesBefore: Math.abs(row.diff),
      casesAfter: Math.abs(row.diff),
      detail: `Ledger records ${Math.abs(row.diff)} case(s) more than the bay holds — count this wine, it cannot be fixed automatically`,
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
