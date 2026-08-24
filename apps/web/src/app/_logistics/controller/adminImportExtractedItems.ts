import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';
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
    const { shipmentId, items, cargoSummary, overwriteCargoData } = input;
    const documentCurrency = (input.currency ?? 'USD').toUpperCase();

    logger.info('[ImportExtractedItems] Starting import:', {
      shipmentId,
      itemCount: items.length,
      hasCargoSummary: !!cargoSummary,
    });

    // Verify shipment exists using select instead of query API to avoid relation issues
    const [shipment] = await db
      .select()
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId))
      .limit(1);

    if (!shipment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shipment not found',
      });
    }

    // Update shipment cargo summary if provided
    if (cargoSummary) {
      const updateData: Partial<typeof logisticsShipments.$inferInsert> = {};

      // Only update fields that are provided AND (either overwrite is true OR existing value is null)
      if (cargoSummary.totalCases !== undefined) {
        if (overwriteCargoData || shipment.totalCases === null || shipment.totalCases === 0) {
          updateData.totalCases = cargoSummary.totalCases;
        }
      }
      if (cargoSummary.totalPallets !== undefined) {
        if (overwriteCargoData || shipment.totalPallets === null) {
          updateData.totalPallets = cargoSummary.totalPallets;
        }
      }
      if (cargoSummary.totalWeight !== undefined) {
        if (overwriteCargoData || shipment.totalWeightKg === null) {
          updateData.totalWeightKg = cargoSummary.totalWeight;
        }
      }
      if (cargoSummary.totalVolume !== undefined) {
        if (overwriteCargoData || shipment.totalVolumeM3 === null) {
          updateData.totalVolumeM3 = cargoSummary.totalVolume;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(logisticsShipments)
          .set(updateData)
          .where(eq(logisticsShipments.id, shipmentId));

        logger.info('[ImportExtractedItems] Updated shipment cargo data:', {
          shipmentId,
          updatedFields: Object.keys(updateData),
        });
      }
    }

    // Get current max sort order for this shipment
    const existingItems = await db
      .select({ sortOrder: logisticsShipmentItems.sortOrder })
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, shipmentId));

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

      // What the document counts in decides everything downstream, so it is
      // read rather than assumed. A bottle count is taken as given; where the
      // document prints total litres it proves itself, since total ÷ size is
      // the bottle count and disagreement means the line was misread.
      const statedBottles = item.bottles ?? null;
      const impliedBottles =
        item.productSizeL && item.totalSizeL && item.productSizeL > 0
          ? Math.round(item.totalSizeL / item.productSizeL)
          : null;

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

      /**
       * The pack is only ever what the document said it was.
       *
       * This used to fall back to 12, which is invisible and wrong on any
       * invoice that does not state a pack — and a supplier shipping 464
       * bottles as 97 mixed cases cannot state one per line. Every figure
       * built on an invented pack is wrong by a factor nobody chose.
       *
       * Unknown is recorded as 1, so cases × pack still equals the bottles
       * that were actually billed. The real pack arrives with the LWIN, which
       * carries it in its own digits.
       */
      const packFromDocument =
        item.bottlesPerCase && item.bottlesPerCase > 0
          ? item.bottlesPerCase
          : null;

      const totalBottles =
        statedBottles ??
        impliedBottles ??
        (item.cases != null ? item.cases * (packFromDocument ?? 1) : null) ??
        0;

      /**
       * A bottle-billed line is one pack of that many bottles.
       *
       * The supplier ships six bottles of a wine boxed together, so that is
       * how it is received and how it clears customs — 1 × 6, not 6 × 1. It is
       * also the shape someone correcting these by hand arrives at: every line
       * fixed manually on this shipment came out as one case of the billed
       * quantity.
       */
      const statedCases = item.cases ?? null;

      /*
        Where the document states both, they have to agree, and when they do
        not the bottle count is the one that was billed. This invoice bills two
        bottles of a wine whose pack is printed as six: honouring the pack
        would store six, three times what was paid for. So a pack that cannot
        be reconciled is dropped rather than trusted, and the line becomes one
        case of what was actually billed — the same shape as every line
        corrected by hand on this shipment.
      */
      const packAgrees =
        packFromDocument != null &&
        totalBottles > 0 &&
        totalBottles % packFromDocument === 0 &&
        (statedCases == null || statedCases * packFromDocument === totalBottles);

      const bottlesPerCase = packAgrees
        ? (packFromDocument as number)
        : totalBottles > 0
          ? totalBottles
          : 1;

      const cases = packAgrees
        ? (statedCases ?? totalBottles / (packFromDocument as number))
        : 1;

      // Prices stay in the currency they were billed in. Converting here was
      // how a rate of roughly 1.1666 came to be applied to a euro invoice with
      // nothing recording that it had happened, or at what rate. The shipment
      // is priced in USD later, once, at a rate someone chose.
      const sourceCurrency = documentCurrency;

      const sourceUnitPrice =
        item.unitPriceBasis === 'case' && item.unitPrice && bottlesPerCase > 0
          ? item.unitPrice / bottlesPerCase
          : (item.unitPrice ??
            (item.total && totalBottles ? item.total / totalBottles : undefined));

      const sourceTotal =
        item.total ??
        (sourceUnitPrice != null && totalBottles
          ? sourceUnitPrice * totalBottles
          : undefined);

      sortOrder += 1;

      const [newItem] = await db
        .insert(logisticsShipmentItems)
        .values({
          shipmentId,
          productName,
          lwin: normalizeLwin18(item.lwin),
          supplierSku: item.supplierSku,
          producer: item.producer,
          vintage: item.vintage,
          region: item.region,
          cases: Math.max(1, Math.round(cases)),
          bottlesPerCase,
          bottleSizeMl,
          totalBottles: Math.round(totalBottles),
          hsCode: item.hsCode,
          countryOfOrigin: item.countryOfOrigin,
          grossWeightKg: item.weight,
          sourceCurrency,
          sourceUnitPrice,
          sourceTotal,
          // Left unpriced until a rate is set, rather than quietly labelling
          // euros as dollars.
          declaredValueUsd: sourceCurrency === 'USD' ? sourceTotal : null,
          productCostPerBottle:
            sourceCurrency === 'USD' ? sourceUnitPrice : null,
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
      cargoSummaryUpdated: !!cargoSummary,
    });

    return {
      success: true,
      itemsImported: createdItems.length,
      itemsSkipped: items.length - createdItems.length,
      items: createdItems,
      cargoSummaryUpdated: !!cargoSummary,
    };
  });

export default adminImportExtractedItems;
