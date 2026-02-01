import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Deduplicate stock records that were created due to retry errors
 *
 * When receiving was retried after errors, duplicate stock records were created
 * for the same lwin18 + locationId + shipmentId combination. This controller
 * finds those duplicates and keeps only one record per combination, deleting
 * the rest.
 *
 * @example
 *   await trpcClient.wms.admin.stock.deduplicate.mutate({});
 */
const adminDeduplicateStock = adminProcedure.mutation(async () => {
  // Find all duplicate combinations
  // Note: Using (ARRAY_AGG(id ORDER BY created_at))[1] instead of MIN(id)
  // because PostgreSQL doesn't support MIN() on UUID type
  const duplicates = await db.execute(sql`
    WITH duplicates AS (
      SELECT
        lwin18,
        location_id,
        shipment_id,
        COUNT(*)::int as count,
        (ARRAY_AGG(id ORDER BY created_at))[1]::text as keep_id,
        SUM(quantity_cases)::int as total_cases,
        ARRAY_AGG(id::text ORDER BY created_at) as all_ids
      FROM wms_stock
      WHERE shipment_id IS NOT NULL
      GROUP BY lwin18, location_id, shipment_id
      HAVING COUNT(*) > 1
    )
    SELECT * FROM duplicates
  `);

  console.log('[WMS Dedupe] Raw result:', JSON.stringify(duplicates));

  // Handle both array and object with rows property
  const rows = Array.isArray(duplicates) ? duplicates : duplicates.rows;

  if (!rows || rows.length === 0) {
    return {
      success: true,
      message: 'No duplicate stock records found',
      deduplicatedCount: 0,
      deletedCount: 0,
    };
  }

  console.log('[WMS Dedupe] Found duplicates:', rows.length);

  let totalDeleted = 0;
  const deduplicatedProducts: Array<{
    lwin18: string;
    originalCount: number;
    keptRecord: string;
    deletedCount: number;
    correctQuantity: number;
  }> = [];

  for (const dup of rows) {
    const allIds: string[] = dup.all_ids ?? [];
    const keepId: string = dup.keep_id ?? allIds[0];

    console.log('[WMS Dedupe] Processing:', {
      lwin18: dup.lwin18,
      keepId,
      allIdsCount: allIds.length,
    });

    if (!keepId || allIds.length === 0) {
      console.log('[WMS Dedupe] Skipping - no valid IDs');
      continue;
    }

    // The correct quantity should be quantity_cases from the first record
    // (since all records were created with the same quantity, just duplicated)
    const [firstRecord] = await db
      .select({ quantityCases: wmsStock.quantityCases })
      .from(wmsStock)
      .where(eq(wmsStock.id, keepId));

    const correctQuantity = firstRecord?.quantityCases ?? 0;

    // Delete all records except the one we're keeping
    const idsToDelete = allIds.filter((id) => id !== keepId);

    for (const idToDelete of idsToDelete) {
      await db.delete(wmsStock).where(eq(wmsStock.id, idToDelete));
      totalDeleted++;
    }

    deduplicatedProducts.push({
      lwin18: dup.lwin18,
      originalCount: Number(dup.count) || allIds.length,
      keptRecord: keepId,
      deletedCount: idsToDelete.length,
      correctQuantity,
    });
  }

  return {
    success: true,
    message: `Deduplicated ${deduplicatedProducts.length} products, deleted ${totalDeleted} duplicate records`,
    deduplicatedCount: deduplicatedProducts.length,
    deletedCount: totalDeleted,
    details: deduplicatedProducts,
  };
});

export default adminDeduplicateStock;
