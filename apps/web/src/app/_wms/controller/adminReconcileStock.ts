import { asc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsStock, wmsStockMovements } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/**
 * Reconcile stock records against movement history
 * Compares what was received (movements) vs what's in stock
 * Identifies discrepancies that need to be fixed
 *
 * @example
 *   await trpcClient.wms.admin.stock.reconcile.query();
 */
const adminReconcileStock = wmsOperatorProcedure.query(async () => {
  // Get total cases from movements (all movement types that affect stock)
  // Exclude 'stock_correction' adjustments - those are data fixes, not physical inventory changes
  // Repack movements: repack_out removes stock, repack_in adds stock (net neutral for total bottles)
  const [movementTotals] = await db
    .select({
      totalReceived: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'receive' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
      totalPicked: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'pick' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
      totalAdjusted: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'adjust' AND ${wmsStockMovements.reasonCode} != 'stock_correction' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
      totalRepackIn: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'repack_in' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
      totalRepackOut: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'repack_out' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
      totalCounted: sql<number>`COALESCE(SUM(CASE WHEN ${wmsStockMovements.movementType} = 'count' THEN ${wmsStockMovements.quantityCases} ELSE 0 END), 0)::int`,
      receiveCount: sql<number>`COUNT(*) FILTER (WHERE ${wmsStockMovements.movementType} = 'receive')::int`,
    })
    .from(wmsStockMovements);

  // Get total cases from stock records
  const [stockTotals] = await db
    .select({
      totalCases: sql<number>`COALESCE(SUM(${wmsStock.quantityCases}), 0)::int`,
      recordCount: sql<number>`COUNT(*)::int`,
    })
    .from(wmsStock);

  // Expected stock = received - picked + adjustments + repack_in - repack_out + count
  // Note: repack_in and repack_out should balance out in terms of total bottles,
  // but case counts may differ (e.g., 1x12-pack becomes 2x6-packs)
  const expectedStock =
    (movementTotals?.totalReceived ?? 0) -
    (movementTotals?.totalPicked ?? 0) +
    (movementTotals?.totalAdjusted ?? 0) +
    (movementTotals?.totalRepackIn ?? 0) -
    (movementTotals?.totalRepackOut ?? 0) +
    (movementTotals?.totalCounted ?? 0);

  const actualStock = stockTotals?.totalCases ?? 0;
  const discrepancy = actualStock - expectedStock;

  // Find stock records that don't have a corresponding receive or repack_in movement
  // This helps identify orphan records
  // Stock can come from either receiving (receive movement) or repacking (repack_in movement)
  const orphanStock = await db
    .select({
      id: wmsStock.id,
      lwin18: wmsStock.lwin18,
      productName: wmsStock.productName,
      locationId: wmsStock.locationId,
      quantityCases: wmsStock.quantityCases,
      shipmentId: wmsStock.shipmentId,
      receivedAt: wmsStock.receivedAt,
    })
    .from(wmsStock)
    .where(
      sql`NOT EXISTS (
        SELECT 1 FROM ${wmsStockMovements} m
        WHERE m.lwin18 = ${wmsStock.lwin18}
        AND m.movement_type IN ('receive', 'repack_in', 'count')
        AND (m.shipment_id = ${wmsStock.shipmentId} OR m.shipment_id IS NULL OR ${wmsStock.shipmentId} IS NULL)
      )`,
    );

  // Find potential duplicates (same lwin18 + location + shipment)
  const duplicates = await db.execute(sql`
    SELECT
      lwin18,
      location_id,
      shipment_id,
      COUNT(*) as record_count,
      SUM(quantity_cases) as total_cases,
      ARRAY_AGG(id::text) as stock_ids
    FROM wms_stock
    GROUP BY lwin18, location_id, shipment_id
    HAVING COUNT(*) > 1
  `);

  const duplicateRows = Array.isArray(duplicates)
    ? duplicates
    : (duplicates as { rows?: unknown[] }).rows ?? [];

  // Per-LWIN culprits: which wines actually drive the discrepancy (movement
  // ledger cases vs physical stock cases). Surfaced on the dashboard banner so a
  // mismatch points straight at the offending wine instead of a blanket number.
  const discrepancyRows = await db.execute(sql`
    SELECT lwin18, product_name, expected_cases, actual_cases,
           (actual_cases - expected_cases) AS diff
    FROM (
      SELECT COALESCE(m.lwin18, s.lwin18) AS lwin18,
             s.product_name,
             COALESCE(m.expected_cases, 0) AS expected_cases,
             COALESCE(s.actual_cases, 0) AS actual_cases
      FROM (
        SELECT lwin18, SUM(CASE movement_type
          WHEN 'receive' THEN quantity_cases WHEN 'count' THEN quantity_cases
          WHEN 'repack_in' THEN quantity_cases
          WHEN 'adjust' THEN CASE WHEN reason_code IS DISTINCT FROM 'stock_correction' THEN quantity_cases ELSE 0 END
          WHEN 'pick' THEN -quantity_cases WHEN 'repack_out' THEN -quantity_cases
          ELSE 0 END) AS expected_cases
        FROM ${wmsStockMovements} GROUP BY lwin18
      ) m
      FULL OUTER JOIN (
        SELECT lwin18, SUM(quantity_cases) AS actual_cases, MAX(product_name) AS product_name
        FROM ${wmsStock} GROUP BY lwin18
      ) s ON s.lwin18 = m.lwin18
    ) x
    WHERE (actual_cases - expected_cases) <> 0
    ORDER BY ABS(actual_cases - expected_cases) DESC
    LIMIT 8
  `);
  const discRows = (
    Array.isArray(discrepancyRows)
      ? discrepancyRows
      : (discrepancyRows as { rows?: unknown[] }).rows ?? []
  ) as Record<string, unknown>[];
  const topDiscrepancies = discRows.map((r) => ({
    lwin18: String(r.lwin18 ?? ''),
    productName: r.product_name ? String(r.product_name) : null,
    expectedCases: Number(r.expected_cases ?? 0),
    actualCases: Number(r.actual_cases ?? 0),
    diff: Number(r.diff ?? 0),
  }));

  // Get all stock records for manual inspection when there's a discrepancy
  const allStockRecords = await db
    .select({
      id: wmsStock.id,
      lwin18: wmsStock.lwin18,
      productName: wmsStock.productName,
      quantityCases: wmsStock.quantityCases,
      locationCode: wmsLocations.locationCode,
      shipmentId: wmsStock.shipmentId,
      receivedAt: wmsStock.receivedAt,
      createdAt: wmsStock.createdAt,
    })
    .from(wmsStock)
    .innerJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
    .orderBy(asc(wmsStock.productName), asc(wmsStock.createdAt));

  // Get all receive movements for comparison
  const allReceiveMovements = await db
    .select({
      id: wmsStockMovements.id,
      lwin18: wmsStockMovements.lwin18,
      productName: wmsStockMovements.productName,
      quantityCases: wmsStockMovements.quantityCases,
      shipmentId: wmsStockMovements.shipmentId,
      performedAt: wmsStockMovements.performedAt,
    })
    .from(wmsStockMovements)
    .where(eq(wmsStockMovements.movementType, 'receive'))
    .orderBy(asc(wmsStockMovements.productName), asc(wmsStockMovements.performedAt));

  return {
    summary: {
      movementsReceived: movementTotals?.totalReceived ?? 0,
      movementsPicked: movementTotals?.totalPicked ?? 0,
      movementsAdjusted: movementTotals?.totalAdjusted ?? 0,
      movementsRepackIn: movementTotals?.totalRepackIn ?? 0,
      movementsRepackOut: movementTotals?.totalRepackOut ?? 0,
      expectedStock,
      actualStock,
      discrepancy,
      isReconciled: discrepancy === 0,
    },
    counts: {
      receiveMovements: movementTotals?.receiveCount ?? 0,
      stockRecords: stockTotals?.recordCount ?? 0,
    },
    issues: {
      orphanRecords: orphanStock,
      duplicateGroups: duplicateRows,
      hasOrphans: orphanStock.length > 0,
      hasDuplicates: duplicateRows.length > 0,
    },
    // The specific wines driving any discrepancy (largest first).
    topDiscrepancies,
    // For manual inspection
    allStockRecords,
    allReceiveMovements,
  };
});

export default adminReconcileStock;
