import { TRPCError } from '@trpc/server';
import { eq, inArray, like, sql } from 'drizzle-orm';
import { z } from 'zod';

import buildLwin18 from '@/app/_lwin/utils/buildLwin18';
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
  lwin7: z.string().regex(/^\d{7}$/).optional(),
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

        // Generate identifier: real LWIN18 for wines, SKU-based for spirits
        let lwin18: string;
        if (item.lwin7) {
          // Wine with real LWIN from validation step
          const vintageNum = item.vintage ? parseInt(item.vintage, 10) : null;
          const result = buildLwin18({
            lwin7: item.lwin7,
            vintage: isNaN(vintageNum as number) ? null : vintageNum,
            caseSize: bottlesPerCase,
            bottleSizeMl,
          });
          lwin18 = result.lwin18;
        } else {
          // Spirit/non-wine: product-name-based identifier
          // Always derive from productName (not SKU) because multiple
          // products from the same producer often share an SKU prefix,
          // causing collisions at short truncation lengths.
          const namePart = item.productName
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 10)
            .toUpperCase();
          const vintagePart = item.vintage ?? '0000';
          const casePart = bottlesPerCase.toString().padStart(2, '0');
          const sizePart = bottleSizeMl.toString().padStart(5, '0');
          lwin18 = `${namePart}-${vintagePart}-${casePart}-${sizePart}`;
        }

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
            category: item.category,
            salesArrangement: 'consignment',
            notes: notes ?? 'Bulk import from Zoho Inventory',
          })
          .returning();

        // Create case labels with advisory lock to prevent duplicate barcodes
        const lockKey = Buffer.from(lwin18).reduce((acc, byte) => acc + byte, 0) % 2147483647;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

        // Find max existing sequence for this LWIN18
        const barcodePrefix = `CASE-${lwin18}-`;
        const existingLabels = await tx
          .select({ barcode: wmsCaseLabels.barcode })
          .from(wmsCaseLabels)
          .where(like(wmsCaseLabels.barcode, `${barcodePrefix}%`));

        let maxSeq = 0;
        for (const label of existingLabels) {
          const seqMatch = label.barcode.match(/(\d+)$/);
          if (seqMatch) {
            const seq = parseInt(seqMatch[1], 10);
            if (seq > maxSeq) maxSeq = seq;
          }
        }

        // Insert labels one-by-one with conflict handling
        const caseLabels: Array<{ id: string; barcode: string }> = [];
        let created = 0;
        while (created < item.quantity) {
          maxSeq++;
          const barcode = generateCaseLabelBarcode(lwin18, maxSeq);
          const inserted = await tx
            .insert(wmsCaseLabels)
            .values({
              barcode,
              lwin18,
              productName: item.productName,
              lotNumber,
              currentLocationId: itemLocation.id,
              isActive: true,
            })
            .onConflictDoNothing({ target: wmsCaseLabels.barcode })
            .returning({ id: wmsCaseLabels.id, barcode: wmsCaseLabels.barcode });

          if (inserted.length > 0) {
            caseLabels.push(inserted[0]!);
            created++;
          }
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
