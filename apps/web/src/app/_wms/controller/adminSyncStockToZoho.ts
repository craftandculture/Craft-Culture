import { sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { createInventoryAdjustment } from '@/lib/zoho/inventoryAdjustments';
import { getAllItems, searchItems } from '@/lib/zoho/items';
import logger from '@/utils/logger';

/**
 * Sync WMS stock quantities to Zoho Inventory
 *
 * Compares WMS stock with Zoho items by SKU (lwin18) and creates
 * inventory adjustments to match the WMS quantities.
 *
 * @example
 *   await trpcClient.wms.admin.stock.syncToZoho.mutate({ dryRun: true });
 */
const adminSyncStockToZoho = adminProcedure
  .input(
    z.object({
      dryRun: z.boolean().default(false), // If true, only report what would change
    }),
  )
  .mutation(async ({ input }) => {
    const { dryRun } = input;

    // Get WMS stock grouped by lwin18 (total across all locations)
    const wmsStockByProduct = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: wmsStock.productName,
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})`.as('totalCases'),
      })
      .from(wmsStock)
      .where(sql`${wmsStock.quantityCases} > 0`)
      .groupBy(wmsStock.lwin18, wmsStock.productName);

    logger.info('[SyncStockToZoho] WMS products found:', {
      count: wmsStockByProduct.length,
    });

    // Fetch all Zoho items for comparison
    const zohoItems = await getAllItems();
    logger.info('[SyncStockToZoho] Zoho items fetched:', {
      count: zohoItems.length,
    });

    // Build a map of SKU -> Zoho item for quick lookup
    const zohoItemsBySku = new Map(
      zohoItems.map((item) => [item.sku, item]),
    );

    // Compare and find differences
    interface SyncResult {
      lwin18: string;
      productName: string;
      wmsQuantity: number;
      zohoQuantity: number;
      adjustment: number;
      zohoItemId: string | null;
      status: 'matched' | 'adjusted' | 'not_found' | 'skipped' | 'error';
      error?: string;
    }

    const results: SyncResult[] = [];
    const adjustmentsNeeded: Array<{
      item_id: string;
      quantity_adjusted: number;
      lwin18: string;
      productName: string;
    }> = [];

    for (const wmsProduct of wmsStockByProduct) {
      const { lwin18, productName, totalCases } = wmsProduct;

      // Try to find Zoho item by exact SKU match
      let zohoItem = zohoItemsBySku.get(lwin18);

      // If not found by exact match, try LWIN-11 prefix match
      if (!zohoItem && lwin18.length >= 11) {
        const lwin11Prefix = lwin18.substring(0, 11);
        zohoItem = zohoItems.find((item) => item.sku?.startsWith(lwin11Prefix));
      }

      // If still not found, try search by name
      if (!zohoItem) {
        try {
          const searchResults = await searchItems(productName);
          zohoItem = searchResults.find(
            (item) =>
              item.name.toLowerCase() === productName.toLowerCase() ||
              item.name.includes(productName.split(' ')[0]),
          );
        } catch {
          // Search failed, continue without match
        }
      }

      if (!zohoItem) {
        results.push({
          lwin18,
          productName,
          wmsQuantity: totalCases,
          zohoQuantity: 0,
          adjustment: 0,
          zohoItemId: null,
          status: 'not_found',
          error: 'No matching Zoho item found',
        });
        continue;
      }

      const zohoQuantity = zohoItem.stock_on_hand ?? 0;
      const adjustment = totalCases - zohoQuantity;

      if (adjustment === 0) {
        results.push({
          lwin18,
          productName,
          wmsQuantity: totalCases,
          zohoQuantity,
          adjustment: 0,
          zohoItemId: zohoItem.item_id,
          status: 'matched',
        });
        continue;
      }

      // Need adjustment
      adjustmentsNeeded.push({
        item_id: zohoItem.item_id,
        quantity_adjusted: adjustment,
        lwin18,
        productName,
      });

      results.push({
        lwin18,
        productName,
        wmsQuantity: totalCases,
        zohoQuantity,
        adjustment,
        zohoItemId: zohoItem.item_id,
        status: dryRun ? 'skipped' : 'adjusted',
      });
    }

    // Create inventory adjustment in Zoho (if not dry run and there are adjustments)
    let adjustmentId: string | null = null;
    if (!dryRun && adjustmentsNeeded.length > 0) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const adjustment = await createInventoryAdjustment({
          date: today,
          reason: 'Cycle Count',
          description: `WMS stock sync - ${adjustmentsNeeded.length} items adjusted`,
          line_items: adjustmentsNeeded.map((item) => ({
            item_id: item.item_id,
            quantity_adjusted: item.quantity_adjusted,
            description: `WMS sync: ${item.productName}`,
          })),
        });
        adjustmentId = adjustment.inventory_adjustment_id;

        logger.info('[SyncStockToZoho] Inventory adjustment created:', {
          adjustmentId,
          itemsAdjusted: adjustmentsNeeded.length,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[SyncStockToZoho] Failed to create inventory adjustment:', {
          error: errorMessage,
        });

        // Mark all adjusted items as error
        results.forEach((r) => {
          if (r.status === 'adjusted') {
            r.status = 'error';
            r.error = errorMessage;
          }
        });
      }
    }

    // Summary
    const matched = results.filter((r) => r.status === 'matched').length;
    const adjusted = results.filter((r) => r.status === 'adjusted').length;
    const notFound = results.filter((r) => r.status === 'not_found').length;
    const errors = results.filter((r) => r.status === 'error').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    return {
      success: errors === 0,
      dryRun,
      adjustmentId,
      summary: {
        total: results.length,
        matched,
        adjusted: dryRun ? skipped : adjusted,
        notFound,
        errors,
      },
      results,
    };
  });

export default adminSyncStockToZoho;
