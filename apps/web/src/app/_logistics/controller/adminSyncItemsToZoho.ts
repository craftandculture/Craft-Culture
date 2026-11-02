import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsShipmentActivityLogs,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { findOrCreateWineItem } from '@/lib/zoho/items';
import logger from '@/utils/logger';

import type { ZohoSyncLine, ZohoSyncRecord } from '../utils/zohoSyncLog';
import { ZOHO_SYNC_ACTION, describeZohoSync } from '../utils/zohoSyncLog';

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
 *
 * Every press is recorded in the shipment's activity log with each line's
 * outcome, so who synced, when, and which lines failed and why survive the
 * toast. The shipment page reads that record back for its sync status.
 */
const adminSyncItemsToZoho = adminProcedure
  .input(syncItemsToZohoSchema)
  .mutation(async ({ input, ctx: { user } }) => {
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

    const results: ZohoSyncLine[] = [];

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
        const {
          item: zohoItem,
          created,
          updated,
        } = await findOrCreateWineItem({
          lwin18: item.lwin,
          productName: item.productName,
          producer: item.producer,
          vintage: item.vintage,
          hsCode: item.hsCode,
          countryOfOrigin: item.countryOfOrigin,
          bottlesPerCase: item.bottlesPerCase ?? 12,
          bottleSizeMl: item.bottleSizeMl ?? 750,
        });

        const status = created ? 'created' : updated ? 'updated' : 'exists';

        results.push({
          itemId: item.id,
          productName: item.productName,
          sku: item.lwin,
          status,
          zohoItemId: zohoItem.item_id,
        });

        logger.info('[SyncItemsToZoho] Synced item:', {
          itemId: item.id,
          productName: item.productName,
          sku: item.lwin,
          zohoItemId: zohoItem.item_id,
          created,
          updated,
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
    const updated = results.filter((r) => r.status === 'updated').length;
    const exists = results.filter((r) => r.status === 'exists').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const errors = results.filter((r) => r.status === 'error').length;

    const record: ZohoSyncRecord = {
      total: items.length,
      created,
      updated,
      exists,
      skipped,
      errors,
      lines: results,
    };

    // The Zoho writes have happened by now, so a failed log write must not
    // report the sync itself as failed
    try {
      await db.insert(logisticsShipmentActivityLogs).values({
        shipmentId,
        userId: user.id,
        action: ZOHO_SYNC_ACTION,
        notes: describeZohoSync(record),
        metadata: { zohoSync: record },
      });
    } catch (error) {
      logger.error('[SyncItemsToZoho] Failed to record sync in activity log:', {
        shipmentId,
        error: error instanceof Error ? error.message : error,
      });
    }

    return {
      success: errors === 0,
      summary: {
        total: items.length,
        created,
        updated,
        exists,
        skipped,
        errors,
      },
      results,
    };
  });

export default adminSyncItemsToZoho;
