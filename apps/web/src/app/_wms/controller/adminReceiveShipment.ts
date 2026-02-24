import { TRPCError } from '@trpc/server';
import { and, eq, like, sql } from 'drizzle-orm';

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

import { receiveShipmentSchema } from '../schemas/receiveSchema';
import generateCaseLabelBarcode from '../utils/generateCaseLabelBarcode';
import generateLotNumber from '../utils/generateLotNumber';
import generateLwin18 from '../utils/generateLwin18';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Receive a shipment into the WMS
 * Creates stock records, case labels, and movement logs
 *
 * @example
 *   await trpcClient.wms.admin.receiving.receiveShipment.mutate({
 *     shipmentId: "uuid",
 *     receivingLocationId: "uuid",
 *     items: [{ shipmentItemId: "uuid", expectedCases: 10, receivedCases: 10 }],
 *   });
 */
const adminReceiveShipment = adminProcedure
  .input(receiveShipmentSchema)
  .mutation(async ({ input, ctx }) => {
    const { shipmentId, receivingLocationId, items, notes } = input;

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

    // Validate that the shipment has a partner (required for stock ownership)
    if (!partner) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Shipment must have a partner associated for stock ownership. Please edit the shipment and assign a partner before receiving.',
      });
    }

    // 2. Validate the receiving location exists
    const [receivingLocation] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.id, receivingLocationId));

    if (!receivingLocation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Receiving location not found',
      });
    }

    // 3. Get shipment items
    const shipmentItems = await db
      .select()
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, shipmentId));

    const shipmentItemMap = new Map(shipmentItems.map((item) => [item.id, item]));

    // 4. Generate lot number for this receiving
    const lotNumber = generateLotNumber(1);

    // Collect Zoho sync data to run after the transaction
    const zohoSyncItems: Array<{
      lwin18: string;
      productName: string;
      producer?: string;
      vintage?: string;
      hsCode?: string | null;
      countryOfOrigin?: string | null;
      bottlesPerCase: number;
      bottleSizeMl: number;
    }> = [];

    // 5. Wrap all stock writes in a transaction
    const createdStock = await db.transaction(async (tx) => {
      const txCreatedStock: Array<{
        stockId: string;
        lwin18: string;
        productName: string;
        cases: number;
        caseLabels: Array<{ id: string; barcode: string }>;
      }> = [];

      for (const receivedItem of items) {
        const shipmentItem = shipmentItemMap.get(receivedItem.shipmentItemId);

        if (!shipmentItem) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Shipment item ${receivedItem.shipmentItemId} not found`,
          });
        }

        if (receivedItem.receivedCases === 0) {
          continue; // Skip items with zero received
        }

        // Use received pack config if provided, otherwise use shipment item values
        const actualBottlesPerCase = receivedItem.receivedBottlesPerCase ?? shipmentItem.bottlesPerCase ?? 12;
        const actualBottleSizeMl = receivedItem.receivedBottleSizeMl ?? shipmentItem.bottleSizeMl ?? 750;

        // For added items, use the explicit product info if provided, otherwise fall back to shipment item
        const productName = receivedItem.productName ?? shipmentItem.productName;
        const producer = receivedItem.producer ?? shipmentItem.producer;
        const vintage = receivedItem.vintage ?? shipmentItem.vintage;
        // Supplier SKU comes from shipment item, or can be overridden
        const supplierSku = receivedItem.supplierSku ?? shipmentItem.supplierSku;
        // Customs data for Zoho sync
        const hsCode = receivedItem.hsCode ?? shipmentItem.hsCode;
        const countryOfOrigin = receivedItem.countryOfOrigin ?? shipmentItem.countryOfOrigin;

        // Determine LWIN-18 for this product:
        // 1. If receiver specified an LWIN (from lookup or using supplier SKU), use it
        // 2. Otherwise generate one from product details
        let lwin18: string;
        if (receivedItem.lwin) {
          // Use the LWIN specified during receiving (could be actual LWIN or supplier SKU used as identifier)
          lwin18 = receivedItem.lwin;
        } else {
          // Generate LWIN-18 from product details with actual received pack config
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

        // Use per-item location if provided, otherwise fall back to global receivingLocationId
        const itemLocationId = receivedItem.locationId ?? receivingLocationId;

        // Check if stock already exists for this product at this location from this shipment
        // This prevents duplicate stock records if receiving is retried after an error
        const [existingStock] = await tx
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
          // Stock already exists - this is a retry, skip creation
          // Use the existing stock record
          stock = existingStock;
        } else {
          // Create new stock record
          const [newStock] = await tx
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
              quantityCases: receivedItem.receivedCases,
              reservedCases: 0,
              availableCases: receivedItem.receivedCases,
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

        // Advisory lock on LWIN18 to prevent duplicate barcode sequences
        const lockKey = Buffer.from(lwin18).reduce((acc, byte) => acc + byte, 0) % 2147483647;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

        // Check for existing case labels with this barcode prefix
        // Labels may have been created during the print step
        const barcodePrefix = `CASE-${lwin18}-`;
        const existingLabels = await tx
          .select({ id: wmsCaseLabels.id, barcode: wmsCaseLabels.barcode })
          .from(wmsCaseLabels)
          .where(like(wmsCaseLabels.barcode, `${barcodePrefix}%`));

        const caseLabels: Array<{ id: string; barcode: string }> = [];

        // If labels already exist for this LWIN18, use them
        if (existingLabels.length >= receivedItem.receivedCases) {
          // Use existing labels (already created during print step)
          caseLabels.push(...existingLabels.slice(0, receivedItem.receivedCases));
        } else {
          // Some or no labels exist - find max sequence and create remaining
          let maxSeq = 0;
          for (const label of existingLabels) {
            const match = label.barcode.match(/(\d+)$/);
            if (match) {
              const seq = parseInt(match[1], 10);
              if (seq > maxSeq) maxSeq = seq;
            }
          }

          // Use existing labels first
          caseLabels.push(...existingLabels);

          // Create remaining labels needed
          const labelsNeeded = receivedItem.receivedCases - existingLabels.length;
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
              caseLabels.push({ id: inserted[0].id, barcode: inserted[0].barcode });
              created++;
            }
          }
        }

        // Only create movement record if we created new stock (not a retry)
        if (!existingStock) {
          const movementNumber = await generateMovementNumber();
          await tx.insert(wmsStockMovements).values({
            movementNumber,
            movementType: 'receive',
            lwin18,
            supplierSku,
            productName,
            quantityCases: receivedItem.receivedCases,
            toLocationId: itemLocationId,
            lotNumber,
            shipmentId,
            scannedBarcodes: caseLabels.map((l) => l.barcode),
            notes: notes ?? `Received from shipment ${shipment.shipmentNumber}`,
            performedBy: ctx.user.id,
            performedAt: new Date(),
          });
        }

        txCreatedStock.push({
          stockId: stock.id,
          lwin18,
          productName,
          cases: receivedItem.receivedCases,
          caseLabels,
        });

        // Collect Zoho sync data (will run after transaction)
        zohoSyncItems.push({
          lwin18,
          productName,
          producer: producer ?? undefined,
          vintage: vintage ?? undefined,
          hsCode,
          countryOfOrigin,
          bottlesPerCase: actualBottlesPerCase,
          bottleSizeMl: actualBottleSizeMl,
        });
      }

      // 6. Update shipment status to delivered
      await tx
        .update(logisticsShipments)
        .set({
          status: 'delivered',
          deliveredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(logisticsShipments.id, shipmentId));

      return txCreatedStock;
    });

    // 7. Sync products to Zoho (best-effort, outside transaction)
    for (const zohoItem of zohoSyncItems) {
      try {
        await findOrCreateWineItem(zohoItem);
      } catch (zohoError) {
        logger.error('[ReceiveShipment] Failed to sync item to Zoho:', {
          lwin18: zohoItem.lwin18,
          productName: zohoItem.productName,
          error: zohoError instanceof Error ? zohoError.message : zohoError,
        });
        // Continue - Zoho sync failure should not block WMS operations
      }
    }

    return {
      success: true,
      lotNumber,
      receivingLocation: {
        id: receivingLocation.id,
        locationCode: receivingLocation.locationCode,
      },
      stock: createdStock,
      totalCases: createdStock.reduce((sum, s) => sum + s.cases, 0),
      totalCaseLabels: createdStock.reduce((sum, s) => sum + s.caseLabels.length, 0),
    };
  });

export default adminReceiveShipment;
