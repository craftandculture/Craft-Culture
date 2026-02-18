import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  wmsCaseLabels,
  wmsLocations,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import generateCaseLabelBarcode from '../utils/generateCaseLabelBarcode';
import generateLotNumber from '../utils/generateLotNumber';
import generateLwin18 from '../utils/generateLwin18';
import generateMovementNumber from '../utils/generateMovementNumber';

const importItemSchema = z.object({
  sku: z.string().optional(),
  productName: z.string().min(1),
  producer: z.string().optional(),
  vintage: z.string().optional(),
  quantity: z.number().int().positive(),
  unit: z.enum(['case', 'bottle']).default('case'),
  bottlesPerCase: z.number().int().positive().default(6),
  bottleSizeMl: z.number().int().positive().default(750),
  category: z.string().optional(),
});

const importStockSchema = z.object({
  ownerId: z.string().uuid(),
  locationId: z.string().uuid(),
  items: z.array(importItemSchema).min(1).max(500),
  notes: z.string().optional(),
});

/**
 * Bulk import stock from external inventory system
 *
 * Creates stock records, case labels, and movement logs for each item.
 * Designed to import from Zoho Inventory exports.
 *
 * @example
 *   await trpcClient.wms.admin.stock.import.mutate({
 *     ownerId: "partner-uuid",
 *     locationId: "location-uuid",
 *     items: [
 *       { productName: "Opus One 2018", quantity: 5, bottlesPerCase: 6 },
 *     ],
 *   });
 */
const adminImportStock = adminProcedure
  .input(importStockSchema)
  .mutation(async ({ input, ctx }) => {
    const { ownerId, locationId, items, notes } = input;

    // Validate owner exists
    const [owner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, ownerId));

    if (!owner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Owner/partner not found',
      });
    }

    // Validate location exists
    const [location] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.id, locationId));

    if (!location) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Location not found',
      });
    }

    // Generate lot number for this import batch
    const lotNumber = generateLotNumber(1);
    const importedAt = new Date();

    // Wrap all stock writes in a transaction to prevent partial imports
    const { results, totalCases, totalLabels } = await db.transaction(async (tx) => {
      const txResults: Array<{
        productName: string;
        lwin18: string;
        quantity: number;
        caseLabelsCreated: number;
      }> = [];

      let txTotalCases = 0;
      let txTotalLabels = 0;

      for (const item of items) {
        // Skip bottles for now - only import cases
        if (item.unit === 'bottle') {
          continue;
        }

        // Parse case config from SKU if it looks like LWIN
        let bottlesPerCase = item.bottlesPerCase;
        let bottleSizeMl = item.bottleSizeMl;

        if (item.sku && /^\d{15,18}$/.test(item.sku)) {
          // SKU looks like LWIN - extract pack config
          // Format: LWIN7 + VVVV + PP + SSSS (7 + 4 + 2 + 4 = 17-18 digits)
          // PP = bottles per case (2 digits)
          // SSSS = bottle size (4 digits, e.g., 0750 for 750ml)
          const packConfig = item.sku.slice(-6); // Last 6 digits
          const extractedBpc = parseInt(packConfig.slice(0, 2), 10);
          const extractedSize = parseInt(packConfig.slice(2), 10);

          if (extractedBpc > 0 && extractedBpc <= 24) {
            bottlesPerCase = extractedBpc;
          }
          if (extractedSize > 0) {
            bottleSizeMl = extractedSize;
          }
        }

        // Also try to extract from product name (e.g., "6x75cl", "12x750ml")
        const packMatch = item.productName.match(/(\d+)\s*x\s*(\d+)\s*(cl|ml)/i);
        if (packMatch) {
          const extractedBpc = parseInt(packMatch[1], 10);
          let extractedSize = parseInt(packMatch[2], 10);
          if (packMatch[3].toLowerCase() === 'cl') {
            extractedSize *= 10; // Convert cl to ml
          }
          if (extractedBpc > 0 && extractedBpc <= 24) {
            bottlesPerCase = extractedBpc;
          }
          if (extractedSize > 0) {
            bottleSizeMl = extractedSize;
          }
        }

        // Generate LWIN18
        const lwin18 = generateLwin18({
          productName: item.productName,
          producer: item.producer,
          vintage: item.vintage,
          bottlesPerCase,
          bottleSizeMl,
        });

        // Create stock record
        await tx
          .insert(wmsStock)
          .values({
            locationId,
            ownerId: owner.id,
            ownerName: owner.businessName,
            lwin18,
            productName: item.productName,
            producer: item.producer,
            vintage: item.vintage,
            bottleSize: `${bottleSizeMl}ml`,
            caseConfig: bottlesPerCase,
            quantityCases: item.quantity,
            reservedCases: 0,
            availableCases: item.quantity,
            lotNumber,
            receivedAt: importedAt,
            salesArrangement: 'consignment',
            notes: notes ?? 'Bulk import from Zoho Inventory',
          })
          .returning();

        // Create case labels
        const caseLabels: Array<{ id: string; barcode: string }> = [];
        for (let i = 1; i <= item.quantity; i++) {
          const barcode = generateCaseLabelBarcode(lwin18, i);

          const [caseLabel] = await tx
            .insert(wmsCaseLabels)
            .values({
              barcode,
              lwin18,
              productName: item.productName,
              lotNumber,
              currentLocationId: locationId,
              isActive: true,
            })
            .returning();

          caseLabels.push({ id: caseLabel.id, barcode: caseLabel.barcode });
        }

        // Create movement record
        const movementNumber = await generateMovementNumber();
        await tx.insert(wmsStockMovements).values({
          movementNumber,
          movementType: 'receive',
          lwin18,
          productName: item.productName,
          quantityCases: item.quantity,
          toLocationId: locationId,
          lotNumber,
          scannedBarcodes: caseLabels.map((l) => l.barcode),
          notes: 'Bulk import from Zoho Inventory',
          performedBy: ctx.user.id,
          performedAt: importedAt,
        });

        txResults.push({
          productName: item.productName,
          lwin18,
          quantity: item.quantity,
          caseLabelsCreated: caseLabels.length,
        });

        txTotalCases += item.quantity;
        txTotalLabels += caseLabels.length;
      }

      return { results: txResults, totalCases: txTotalCases, totalLabels: txTotalLabels };
    });

    return {
      success: true,
      lotNumber,
      location: {
        id: location.id,
        locationCode: location.locationCode,
      },
      owner: {
        id: owner.id,
        name: owner.businessName,
      },
      itemsImported: results.length,
      totalCases,
      totalLabels,
      results,
    };
  });

export default adminImportStock;
