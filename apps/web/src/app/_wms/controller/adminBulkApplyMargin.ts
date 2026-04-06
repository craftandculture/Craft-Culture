import { client } from '@/database/client';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { bulkApplyMarginSchema } from '../schemas/pricingManagerSchema';

/**
 * Bulk-apply a margin percentage to products, calculating selling price from import price
 *
 * Formula: sellingPrice = importPrice / (1 - marginPercent / 100)
 *
 * @param marginPercent - The target margin percentage (e.g., 20 for 20%)
 * @param category - Optional category filter (Wine, Spirits, RTD)
 * @param overwriteExisting - Whether to overwrite products that already have a selling price
 */
const adminBulkApplyMargin = wmsOperatorProcedure
  .input(bulkApplyMarginSchema)
  .mutation(async ({ input, ctx }) => {
    const { marginPercent, category, overwriteExisting } = input;

    // Build category filter condition
    let categoryCondition = '';
    if (category) {
      if (category === 'Wine') {
        categoryCondition = `AND p.lwin18 IN (SELECT DISTINCT lwin18 FROM wms_stock WHERE quantity_cases > 0 AND (category = 'Wine' OR category IS NULL))`;
      } else {
        categoryCondition = `AND p.lwin18 IN (SELECT DISTINCT lwin18 FROM wms_stock WHERE quantity_cases > 0 AND category = '${category}')`;
      }
    } else {
      categoryCondition = `AND p.lwin18 IN (SELECT DISTINCT lwin18 FROM wms_stock WHERE quantity_cases > 0)`;
    }

    // Build overwrite condition
    const overwriteCondition = overwriteExisting
      ? ''
      : 'AND (p.selling_price_per_bottle IS NULL OR p.selling_price_per_bottle = 0)';

    const divisor = 1 - marginPercent / 100;

    const result = await client.unsafe(`
      UPDATE wms_product_pricing p
      SET
        selling_price_per_bottle = ROUND((p.import_price_per_bottle / ${divisor})::numeric, 2),
        updated_by = '${ctx.user.id}',
        updated_at = NOW()
      WHERE p.import_price_per_bottle > 0
        ${categoryCondition}
        ${overwriteCondition}
    `);

    // Count how many would have been skipped
    const totalEligible = await client.unsafe(`
      SELECT COUNT(*) as count FROM wms_product_pricing p
      WHERE p.import_price_per_bottle > 0
        ${categoryCondition}
    `);

    const updated = result.count;
    const total = parseInt(totalEligible[0]?.count ?? '0', 10);
    const skipped = total - updated;

    return { updated, skipped };
  });

export default adminBulkApplyMargin;
