import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
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
  locationCode: z.string().optional(),
});

const importStockSchema = z.object({
  ownerId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
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

    // Build location code → id map for per-row locations
    const locationCodes = [
      ...new Set(items.map((i) => i.locationCode).filter(Boolean) as string[]),
    ];
    const locationCodeMap = new Map<string, { id: string; locationCode: string }>();

    if (locationCodes.length > 0) {
      const matchedLocations = await db
        .select({ id: wmsLocations.id, locationCode: wmsLocations.locationCode })
        .from(wmsLocations)
        .where(inArray(wmsLocations.locationCode, locationCodes));

      for (const loc of matchedLocations) {
        locationCodeMap.set(loc.locationCode, loc);
      }

      // Check for unrecognized codes
      const unrecognized = locationCodes.filter((c) => !locationCodeMap.has(c));
      if (unrecognized.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unrecognized location codes: ${unrecognized.join(', ')}`,
        });
      }
    }

    // Validate global location if provided
    let globalLocation: { id: string; locationCode: string } | null = null;
    if (locationId) {
      const [loc] = await db
        .select({ id: wmsLocations.id, locationCode: wmsLocations.locationCode })
        .from(wmsLocations)
        .where(eq(wmsLocations.id, locationId));

      if (!loc) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Location not found',
        });
      }
      globalLocation = loc;
    }

    // Ensure every item has a location (either per-row or global)
    if (!globalLocation && locationCodes.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Each item must have a location_code, or select a global location',
      });
    }

    // Generate lot number for this import batch
    const lotNumber = generateLotNumber(1);
    const importedAt = new Date();

    // Pre-generate the base movement number before the transaction
    // so each item gets a unique sequential number
    const baseMovementNumber = await generateMovementNumber();
    const basePrefix = baseMovementNumber.slice(0, baseMovementNumber.lastIndexOf('-') + 1);
    const baseSequence = parseInt(baseMovementNumber.slice(baseMovementNumber.lastIndexOf('-') + 1), 10);

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
      let movementOffset = 0;

      for (const item of items) {
        // Skip bottles for now - only import cases
        if (item.unit === 'bottle') {
          continue;
        }

        // Case config is already parsed by the frontend (explicit columns > name > SKU > defaults)
        const bottlesPerCase = item.bottlesPerCase;
        const bottleSizeMl = item.bottleSizeMl;

        // Generate LWIN18
        const lwin18 = generateLwin18({
          productName: item.productName,
          producer: item.producer,
          vintage: item.vintage,
          bottlesPerCase,
          bottleSizeMl,
        });

        // Resolve location for this item
        const itemLocation = item.locationCode
          ? locationCodeMap.get(item.locationCode)
          : globalLocation;

        if (!itemLocation) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `No location for item "${item.productName}". Provide a location_code or select a global location.`,
          });
        }

        // Create stock record
        await tx
          .insert(wmsStock)
          .values({
            locationId: itemLocation.id,
            ownerId: owner.id,
            ownerName: owner.businessName,
            lwin18,
            productName: item.productName,
            producer: item.producer,
            vintage: item.vintage,
            bottleSize: `${bottleSizeMl / 10}cl`,
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
              currentLocationId: itemLocation.id,
              isActive: true,
            })
            .returning();

          caseLabels.push({ id: caseLabel.id, barcode: caseLabel.barcode });
        }

        // Create movement record
        const movementNumber = `${basePrefix}${(baseSequence + movementOffset).toString().padStart(4, '0')}`;
        movementOffset++;
        await tx.insert(wmsStockMovements).values({
          movementNumber,
          movementType: 'receive',
          lwin18,
          productName: item.productName,
          quantityCases: item.quantity,
          toLocationId: itemLocation.id,
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
      location: globalLocation
        ? { id: globalLocation.id, locationCode: globalLocation.locationCode }
        : null,
      locationCount: locationCodes.length || (globalLocation ? 1 : 0),
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
