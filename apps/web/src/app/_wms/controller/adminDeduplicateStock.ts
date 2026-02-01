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
        COUNT(*) as count,
        (ARRAY_AGG(id ORDER BY created_at))[1] as keep_id,
        SUM(quantity_cases) as total_cases,
        ARRAY_AGG(id ORDER BY created_at) as all_ids
      FROM wms_stock
      WHERE shipment_id IS NOT NULL
      GROUP BY lwin18, location_id, shipment_id
      HAVING COUNT(*) > 1
    )
    SELECT * FROM duplicates
  `);

  const duplicateRows = duplicates.rows as Array<{
    lwin18: string;
    location_id: string;
    shipment_id: string;
    count: number;
    keep_id: string;
    total_cases: number;
    all_ids: string[];
  }>;

  if (duplicateRows.length === 0) {
    return {
      success: true,
      message: 'No duplicate stock records found',
      deduplicatedCount: 0,
      deletedCount: 0,
    };
  }

  let totalDeleted = 0;
  const deduplicatedProducts: Array<{
    lwin18: string;
    originalCount: number;
    keptRecord: string;
    deletedCount: number;
    correctQuantity: number;
  }> = [];

  for (const dup of duplicateRows) {
    // The correct quantity should be quantity_cases from the first record
    // (since all records were created with the same quantity, just duplicated)
    const [firstRecord] = await db
      .select({ quantityCases: wmsStock.quantityCases })
      .from(wmsStock)
      .where(eq(wmsStock.id, dup.keep_id));

    const correctQuantity = firstRecord?.quantityCases ?? 0;

    // Delete all records except the one we're keeping
    const idsToDelete = dup.all_ids.filter((id) => id !== dup.keep_id);

    for (const idToDelete of idsToDelete) {
      await db.delete(wmsStock).where(eq(wmsStock.id, idToDelete));
      totalDeleted++;
    }

    deduplicatedProducts.push({
      lwin18: dup.lwin18,
      originalCount: dup.count,
      keptRecord: dup.keep_id,
      deletedCount: idsToDelete.length,
      correctQuantity,
    });
  }

  return {
    success: true,
    message: `Deduplicated ${duplicateRows.length} products, deleted ${totalDeleted} duplicate records`,
    deduplicatedCount: duplicateRows.length,
    deletedCount: totalDeleted,
    details: deduplicatedProducts,
  };
});

export default adminDeduplicateStock;
