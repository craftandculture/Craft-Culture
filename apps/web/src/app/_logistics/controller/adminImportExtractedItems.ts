import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import importExtractedItemsSchema from '../schemas/importExtractedItemsSchema';

/**
 * Import extracted line items from a document into a shipment
 *
 * Takes extracted data from the document extraction tool and creates
 * shipment items from the line items.
 */
const adminImportExtractedItems = adminProcedure
  .input(importExtractedItemsSchema)
  .mutation(async ({ input }) => {
    const { shipmentId, items } = input;

    logger.info('[ImportExtractedItems] Starting import:', {
      shipmentId,
      itemCount: items.length,
    });

    // Verify shipment exists
    const shipment = await db.query.logisticsShipments.findFirst({
      where: eq(logisticsShipments.id, shipmentId),
    });

    if (!shipment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shipment not found',
      });
    }

    // Get current max sort order for this shipment
    const existingItems = await db.query.logisticsShipmentItems.findMany({
      where: eq(logisticsShipmentItems.shipmentId, shipmentId),
      columns: { sortOrder: true },
    });

    let maxSortOrder = 0;
    for (const item of existingItems) {
      if (item.sortOrder && item.sortOrder > maxSortOrder) {
        maxSortOrder = item.sortOrder;
      }
    }

    // Create shipment items from extracted data
    const createdItems = [];
    let sortOrder = maxSortOrder;

    for (const item of items) {
      // Use productName or description as the product name
      const productName = item.productName || item.description;

      if (!productName) {
        logger.warn('[ImportExtractedItems] Skipping item without name:', { item });
        continue;
      }

      // Determine cases - use cases field or fall back to quantity
      const cases = item.cases || item.quantity || 1;

      // Parse bottle size from string like "750ml" or "1.5L" to integer ml
      let bottleSizeMl = 750; // Default
      if (item.bottleSize) {
        const sizeStr = item.bottleSize.toLowerCase();
        if (sizeStr.includes('ml')) {
          bottleSizeMl = parseInt(sizeStr.replace(/[^0-9]/g, ''), 10) || 750;
        } else if (sizeStr.includes('l')) {
          const liters = parseFloat(sizeStr.replace(/[^0-9.]/g, ''));
          bottleSizeMl = Math.round(liters * 1000) || 750;
        }
      }

      // Determine bottles per case
      const bottlesPerCase = item.bottlesPerCase || 12;

      // Calculate total bottles
      const totalBottles = cases * bottlesPerCase;

      // Calculate cost per bottle if we have total and cases
      let productCostPerBottle: number | undefined;
      if (item.total && totalBottles) {
        productCostPerBottle = item.total / totalBottles;
      } else if (item.unitPrice) {
        productCostPerBottle = item.unitPrice;
      }

      sortOrder += 1;

      const [newItem] = await db
        .insert(logisticsShipmentItems)
        .values({
          shipmentId,
          productName,
          lwin: item.lwin,
          producer: item.producer,
          vintage: item.vintage,
          region: item.region,
          cases,
          bottlesPerCase,
          bottleSizeMl,
          totalBottles,
          hsCode: item.hsCode,
          countryOfOrigin: item.countryOfOrigin,
          grossWeightKg: item.weight,
          declaredValueUsd: item.total,
          productCostPerBottle,
          sortOrder,
        })
        .returning();

      if (newItem) {
        createdItems.push(newItem);
      }
    }

    logger.info('[ImportExtractedItems] Import complete:', {
      shipmentId,
      itemsImported: createdItems.length,
      itemsSkipped: items.length - createdItems.length,
    });

    return {
      success: true,
      itemsImported: createdItems.length,
      itemsSkipped: items.length - createdItems.length,
      items: createdItems,
    };
  });

export default adminImportExtractedItems;
