import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { findOrCreateWineItem } from '@/lib/zoho/items';
import logger from '@/utils/logger';

const syncItemsToZohoSchema = z.object({
  shipmentId: z.string().uuid(),
});

/**
 * Sync shipment items to Zoho inventory
 *
 * Creates Zoho inventory items for all shipment items that have an LWIN/SKU.
 * Should be called after Head of Logistics has mapped all SKUs.
 *
 * Field mapping:
 * - SKU = lwin (the primary product identifier)
 * - UPC = hsCode (for customs paperwork)
 * - ISBN = countryOfOrigin (for customs paperwork)
 * - Manufacturer/Brand = producer
 */
const adminSyncItemsToZoho = adminProcedure
  .input(syncItemsToZohoSchema)
  .mutation(async ({ input }) => {
    const { shipmentId } = input;

    // Get shipment with items
    const [shipment] = await db
      .select()
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId));

    if (!shipment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shipment not found',
      });
    }

    // Get all items for this shipment
    const items = await db
      .select()
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, shipmentId));

    if (!items.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Shipment has no items to sync',
      });
    }

    const results: Array<{
      itemId: string;
      productName: string;
      sku: string | null;
      status: 'created' | 'exists' | 'skipped' | 'error';
      error?: string;
    }> = [];

    for (const item of items) {
      // Skip items without LWIN/SKU
      if (!item.lwin) {
        results.push({
          itemId: item.id,
          productName: item.productName,
          sku: null,
          status: 'skipped',
          error: 'No LWIN/SKU mapped',
        });
        continue;
      }

      try {
        const { item: zohoItem, created } = await findOrCreateWineItem({
          lwin18: item.lwin,
          productName: item.productName,
          producer: item.producer,
          vintage: item.vintage,
          hsCode: item.hsCode,
          countryOfOrigin: item.countryOfOrigin,
          bottlesPerCase: item.bottlesPerCase ?? 12,
          bottleSizeMl: item.bottleSizeMl ?? 750,
        });

        results.push({
          itemId: item.id,
          productName: item.productName,
          sku: item.lwin,
          status: created ? 'created' : 'exists',
        });

        logger.info('[SyncItemsToZoho] Synced item:', {
          itemId: item.id,
          productName: item.productName,
          sku: item.lwin,
          zohoItemId: zohoItem.item_id,
          created,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          itemId: item.id,
          productName: item.productName,
          sku: item.lwin,
          status: 'error',
          error: errorMessage,
        });

        logger.error('[SyncItemsToZoho] Failed to sync item:', {
          itemId: item.id,
          productName: item.productName,
          error: errorMessage,
        });
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    const exists = results.filter((r) => r.status === 'exists').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const errors = results.filter((r) => r.status === 'error').length;

    return {
      success: errors === 0,
      summary: {
        total: items.length,
        created,
        exists,
        skipped,
        errors,
      },
      results,
    };
  });

export default adminSyncItemsToZoho;
