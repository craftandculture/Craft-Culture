import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { createInventoryAdjustment } from '@/lib/zoho/inventoryAdjustments';
import { getAllItems } from '@/lib/zoho/items';
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
      // Report only, unless the caller has seen the preview and says go
      dryRun: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input }) => {
    const { dryRun } = input;

    // Get WMS stock grouped by lwin18 (total across all locations)
    /*
      One line per code (grouping by name too gave two lines, and two
      adjustments, for one item whose rows were named differently), and only
      stock that is ours to sell: wine held for its owner and members' cellar
      stock are not Zoho inventory.
    */
    const wmsStockByProduct = await db
      .select({
        lwin18: wmsStock.lwin18,
        productName: sql<string>`MAX(${wmsStock.productName})`,
        totalCases: sql<number>`SUM(${wmsStock.quantityCases})::int`.as('totalCases'),
      })
      .from(wmsStock)
      .leftJoin(partners, eq(partners.id, wmsStock.ownerId))
      .where(
        and(
          sql`${wmsStock.quantityCases} > 0`,
          eq(wmsStock.notForSale, false),
          sql`${partners.type} IS DISTINCT FROM 'private_collector'`,
        ),
      )
      .groupBy(wmsStock.lwin18);

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

      /*
      Exact SKU only. The old fallbacks matched any item sharing the first
      11 characters (another vintage or pack of the wine) or a name search on
      the first word, and then overwrote that item's stock.
    */
      const zohoItem =
        zohoItemsBySku.get(lwin18) ?? zohoItemsBySku.get(lwin18.replace(/-/g, ''));

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
