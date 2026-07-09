import { client } from '@/database/client';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { bulkApplyMarginSchema } from '../schemas/pricingManagerSchema';

/**
 * Bulk-apply a margin percentage to products, calculating the selling price from
 * the landed cost (import price + flat logistics per bottle).
 *
 * Formula: sellingPrice = (importPrice + logistics) / (1 - marginPercent / 100)
 *
 * When `ownerId` is provided the result is written as a per-owner PC price in
 * `wms_owner_pricing` (e.g. Crurated at 3%, Cru Wine at a higher margin);
 * otherwise it updates the default selling price in `wms_product_pricing`.
 *
 * @param marginPercent - The target margin percentage (e.g., 20 for 20%)
 * @param category - Optional category filter (Wine, Spirits, RTD)
 * @param ownerId - Optional owner; writes owner-specific PC prices when set
 * @param logisticsPerBottle - Flat logistics cost added to import before margin
 * @param overwriteExisting - Whether to overwrite products that already have a price
 */
const adminBulkApplyMargin = wmsOperatorProcedure
  .input(bulkApplyMarginSchema)
  .mutation(async ({ input, ctx }) => {
    const { marginPercent, category, ownerId, logisticsPerBottle, overwriteExisting } = input;

    const divisor = 1 - marginPercent / 100;
    const logistics = logisticsPerBottle;

    // LWIN18 set in scope: has stock, optional category, optional owner
    const categoryFilter =
      category === 'Wine'
        ? `AND (category = 'Wine' OR category IS NULL)`
        : category
          ? `AND category = '${category}'`
          : '';
    const ownerFilter = ownerId ? `AND owner_id = '${ownerId}'` : '';
    const stockScope = `SELECT DISTINCT lwin18 FROM wms_stock WHERE quantity_cases > 0 ${categoryFilter} ${ownerFilter}`;

    // Landed cost per bottle = import + override + flat logistics
    // PC price = landed / (1 - pc%), computed off the (2dp-rounded) landed cost
    const landedExpr = `ROUND((p.import_price_per_bottle + COALESCE(p.cost_override_per_bottle, 0) + ${logistics})::numeric, 2)`;
    const sellExpr = `ROUND((${landedExpr} / ${divisor})::numeric, 2)`;

    const totalEligibleRows = await client.unsafe(`
      SELECT COUNT(*) as count FROM wms_product_pricing p
      WHERE p.import_price_per_bottle > 0 AND p.lwin18 IN (${stockScope})
    `);
    const total = parseInt(totalEligibleRows[0]?.count ?? '0', 10);

    let updated: number;

    if (ownerId) {
      // Per-owner PC pricing → upsert into wms_owner_pricing
      const conflict = overwriteExisting
        ? `ON CONFLICT (lwin18, owner_id) DO UPDATE SET
             pc_selling_price_per_bottle = EXCLUDED.pc_selling_price_per_bottle,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()`
        : `ON CONFLICT (lwin18, owner_id) DO NOTHING`;

      const result = await client.unsafe(`
        INSERT INTO wms_owner_pricing (lwin18, owner_id, pc_selling_price_per_bottle, updated_by)
        SELECT p.lwin18, '${ownerId}', ${sellExpr}, '${ctx.user.id}'
        FROM wms_product_pricing p
        WHERE p.import_price_per_bottle > 0
          AND p.lwin18 IN (${stockScope})
        ${conflict}
      `);
      updated = result.count;
    } else {
      // Default PC price → wms_product_pricing.selling_price_per_bottle
      const overwriteCondition = overwriteExisting
        ? ''
        : 'AND (p.selling_price_per_bottle IS NULL OR p.selling_price_per_bottle = 0)';

      const result = await client.unsafe(`
        UPDATE wms_product_pricing p
        SET
          selling_price_per_bottle = ${sellExpr},
          updated_by = '${ctx.user.id}',
          updated_at = NOW()
        WHERE p.import_price_per_bottle > 0
          AND p.lwin18 IN (${stockScope})
          ${overwriteCondition}
      `);
      updated = result.count;
    }

    return { updated, skipped: Math.max(0, total - updated) };
  });

export default adminBulkApplyMargin;
