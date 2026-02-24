import { TRPCError } from '@trpc/server';
import { and, eq, inArray, like, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  partners,
  wmsCaseLabels,
  wmsLocations,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { findOrCreateWineItem } from '@/lib/zoho/items';
import logger from '@/utils/logger';

import receiveSingleItemSchema from '../schemas/receiveSingleItemSchema';
import generateCaseLabelBarcode from '../utils/generateCaseLabelBarcode';
import generateLwin18 from '../utils/generateLwin18';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Receive a single item from a shipment into the WMS (incremental receiving)
 *
 * Commits one product at a time as it's processed, creating stock records,
 * case labels, and movement logs immediately. The shipment transitions to
 * 'partially_received' on the first item and stays there until finalized.
 *
 * @example
 *   await trpcClient.wms.admin.receiving.receiveShipmentItem.mutate({
 *     shipmentId: 'uuid',
 *     lotNumber: '2026-02-14-001',
 *     item: {
 *       shipmentItemId: 'uuid',
 *       receivedCases: 15,
 *       locationAssignments: [
 *         { locationId: 'uuid', cases: 5 },
 *         { locationId: 'uuid', cases: 10 },
 *       ],
 *     },
 *   });
 */
const adminReceiveShipmentItem = adminProcedure
  .input(receiveSingleItemSchema)
  .mutation(async ({ input, ctx }) => {
    const { shipmentId, lotNumber, notes } = input;
    const receivedItem = input.item;

    // 1. Validate the shipment exists and get partner info
    const [shipmentResult] = await db
      .select({
        shipment: logisticsShipments,
        partner: partners,
      })
      .from(logisticsShipments)
      .leftJoin(partners, eq(logisticsShipments.partnerId, partners.id))
      .where(eq(logisticsShipments.id, shipmentId));

    if (!shipmentResult) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shipment not found',
      });
    }

    const { shipment, partner } = shipmentResult;

    if (!partner) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Shipment must have a partner associated for stock ownership. Please edit the shipment and assign a partner before receiving.',
      });
    }

    // 2. Validate all locations exist and build a code lookup map
    const locationIds = receivedItem.locationAssignments.map((a) => a.locationId);
    const uniqueLocationIds = [...new Set(locationIds)];

    const locations = await db
      .select({ id: wmsLocations.id, locationCode: wmsLocations.locationCode })
      .from(wmsLocations)
      .where(
        uniqueLocationIds.length === 1
          ? eq(wmsLocations.id, uniqueLocationIds[0]!)
          : inArray(wmsLocations.id, uniqueLocationIds),
      );

    if (locations.length !== uniqueLocationIds.length) {
      const foundIds = new Set(locations.map((l) => l.id));
      const missing = uniqueLocationIds.find((id) => !foundIds.has(id));
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Location ${missing} not found`,
      });
    }

    // 3. Get the shipment item
    const [shipmentItem] = await db
      .select()
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.id, receivedItem.shipmentItemId));

    if (!shipmentItem) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Shipment item ${receivedItem.shipmentItemId} not found`,
      });
    }

    // 4. Resolve product details
    const actualBottlesPerCase = receivedItem.receivedBottlesPerCase ?? shipmentItem.bottlesPerCase ?? 12;
    const actualBottleSizeMl = receivedItem.receivedBottleSizeMl ?? shipmentItem.bottleSizeMl ?? 750;
    const productName = receivedItem.productName ?? shipmentItem.productName;
    const producer = receivedItem.producer ?? shipmentItem.producer;
    const vintage = receivedItem.vintage ?? shipmentItem.vintage;
    const supplierSku = receivedItem.supplierSku ?? shipmentItem.supplierSku;
    const hsCode = receivedItem.hsCode ?? shipmentItem.hsCode;
    const countryOfOrigin = receivedItem.countryOfOrigin ?? shipmentItem.countryOfOrigin;

    // Determine LWIN-18
    let lwin18: string;
    if (receivedItem.lwin) {
      lwin18 = receivedItem.lwin;
    } else {
      lwin18 = generateLwin18({
        productName,
        producer: producer ?? undefined,
        vintage: vintage ?? undefined,
        bottlesPerCase: actualBottlesPerCase,
        bottleSizeMl: actualBottleSizeMl,
      });
    }

    // Build notes for the stock record
    let stockNotes = receivedItem.notes ?? '';
    if (receivedItem.isAddedItem) {
      stockNotes = `Added pack variant: ${actualBottlesPerCase}x${actualBottleSizeMl}ml. ${stockNotes}`;
    } else if (receivedItem.packChanged) {
      stockNotes = `Pack changed: expected ${shipmentItem.bottlesPerCase ?? 12}x${shipmentItem.bottleSizeMl ?? 750}ml, received ${actualBottlesPerCase}x${actualBottleSizeMl}ml. ${stockNotes}`;
    }

    // 5. Precompute split info for movement notes
    const totalReceivedCases = receivedItem.locationAssignments.reduce((sum, a) => sum + a.cases, 0);
    const isSplit = receivedItem.locationAssignments.length > 1;

    // 6. Process each location assignment (same product, split across locations)
    const createdStock: Array<{
      stockId: string;
      locationId: string;
      cases: number;
      caseLabels: Array<{ id: string; barcode: string }>;
    }> = [];

    for (const assignment of receivedItem.locationAssignments) {
      const itemLocationId = assignment.locationId;
      const assignmentCases = assignment.cases;

      // Check for existing stock (idempotency)
      const [existingStock] = await db
        .select()
        .from(wmsStock)
        .where(
          and(
            eq(wmsStock.lwin18, lwin18),
            eq(wmsStock.locationId, itemLocationId),
            eq(wmsStock.shipmentId, shipmentId),
          ),
        );

      let stock: typeof wmsStock.$inferSelect;

      if (existingStock) {
        stock = existingStock;
      } else {
        const [newStock] = await db
          .insert(wmsStock)
          .values({
            locationId: itemLocationId,
            ownerId: partner.id,
            ownerName: partner.businessName,
            lwin18,
            supplierSku,
            productName,
            producer,
            vintage,
            bottleSize: `${actualBottleSizeMl / 10}cl`,
            caseConfig: actualBottlesPerCase,
            quantityCases: assignmentCases,
            reservedCases: 0,
            availableCases: assignmentCases,
            lotNumber,
            receivedAt: new Date(),
            shipmentId,
            salesArrangement: 'consignment',
            expiryDate: receivedItem.expiryDate,
            isPerishable: !!receivedItem.expiryDate,
            notes: stockNotes || undefined,
          })
          .returning();
        stock = newStock;
      }

      // Create case labels inside a transaction with advisory lock to prevent duplicate barcodes
      const caseLabels = await db.transaction(async (tx) => {
        const lockKey = Buffer.from(lwin18).reduce((acc, byte) => acc + byte, 0) % 2147483647;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

        const barcodePrefix = `CASE-${lwin18}-`;
        const existingLabels = await tx
          .select({ id: wmsCaseLabels.id, barcode: wmsCaseLabels.barcode })
          .from(wmsCaseLabels)
          .where(like(wmsCaseLabels.barcode, `${barcodePrefix}%`));

        const labels: Array<{ id: string; barcode: string }> = [];

        if (existingLabels.length >= assignmentCases) {
          labels.push(...existingLabels.slice(0, assignmentCases));
        } else {
          let maxSeq = 0;
          for (const label of existingLabels) {
            const match = label.barcode.match(/(\d+)$/);
            if (match) {
              const seq = parseInt(match[1], 10);
              if (seq > maxSeq) maxSeq = seq;
            }
          }

          labels.push(...existingLabels);

          const labelsNeeded = assignmentCases - existingLabels.length;
          let created = 0;
          while (created < labelsNeeded) {
            maxSeq++;
            const barcode = generateCaseLabelBarcode(lwin18, maxSeq);

            const inserted = await tx
              .insert(wmsCaseLabels)
              .values({
                barcode,
                lwin18,
                productName,
                lotNumber,
                shipmentId,
                currentLocationId: itemLocationId,
                isActive: true,
              })
              .onConflictDoNothing({ target: wmsCaseLabels.barcode })
              .returning();

            if (inserted.length > 0) {
              labels.push({ id: inserted[0].id, barcode: inserted[0].barcode });
              created++;
            }
          }
        }

        return labels;
      });

      // Create movement record (only for new stock)
      if (!existingStock) {
        const movementNumber = await generateMovementNumber();
        const palletTag = assignment.isPalletized ? ' (pallet)' : '';
        const baseNote = notes
          ? `${notes}${palletTag}`
          : `Received from shipment ${shipment.shipmentNumber}${palletTag}`;
        const splitSuffix = isSplit
          ? ` [${assignmentCases} of ${totalReceivedCases} cases]`
          : '';
        const movementNote = `${baseNote}${splitSuffix}`;

        await db.insert(wmsStockMovements).values({
          movementNumber,
          movementType: 'receive',
          lwin18,
          supplierSku,
          productName,
          quantityCases: assignmentCases,
          toLocationId: itemLocationId,
          lotNumber,
          shipmentId,
          scannedBarcodes: caseLabels.map((l) => l.barcode),
          notes: movementNote,
          performedBy: ctx.user.id,
          performedAt: new Date(),
        });
      }

      createdStock.push({
        stockId: stock.id,
        locationId: itemLocationId,
        cases: assignmentCases,
        caseLabels,
      });
    }

    // 7. Update shipment status to 'partially_received' if not already
    if (
      shipment.status !== 'partially_received' &&
      shipment.status !== 'delivered'
    ) {
      await db
        .update(logisticsShipments)
        .set({
          status: 'partially_received',
          updatedAt: new Date(),
        })
        .where(eq(logisticsShipments.id, shipmentId));
    }

    // 8. Sync product to Zoho (non-blocking)
    try {
      await findOrCreateWineItem({
        lwin18,
        productName,
        producer: producer ?? undefined,
        vintage: vintage ?? undefined,
        hsCode,
        countryOfOrigin,
        bottlesPerCase: actualBottlesPerCase,
        bottleSizeMl: actualBottleSizeMl,
      });
    } catch (zohoError) {
      logger.error('[ReceiveShipmentItem] Failed to sync item to Zoho:', {
        lwin18,
        productName,
        error: zohoError instanceof Error ? zohoError.message : zohoError,
      });
    }

    return {
      success: true,
      lwin18,
      productName,
      totalCases: createdStock.reduce((sum, s) => sum + s.cases, 0),
      stock: createdStock,
    };
  });

export default adminReceiveShipmentItem;
