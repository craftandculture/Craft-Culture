import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

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

    // 5. Process each received item
    const createdStock: Array<{
      stockId: string;
      lwin18: string;
      productName: string;
      cases: number;
      caseLabels: Array<{ id: string; barcode: string }>;
    }> = [];

    let totalCaseLabelSequence = 1;

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

      // Generate LWIN-18 for this product with actual received pack config
      const lwin18 = generateLwin18({
        productName: shipmentItem.productName,
        producer: shipmentItem.producer ?? undefined,
        vintage: shipmentItem.vintage ?? undefined,
        bottlesPerCase: actualBottlesPerCase,
        bottleSizeMl: actualBottleSizeMl,
      });

      // Create stock record with actual received pack configuration
      const [stock] = await db
        .insert(wmsStock)
        .values({
          locationId: receivingLocationId,
          ownerId: partner?.id ?? ctx.user.id, // Partner owns the stock, fallback to admin
          ownerName: partner?.businessName ?? 'Craft & Culture',
          lwin18,
          productName: shipmentItem.productName,
          producer: shipmentItem.producer,
          vintage: shipmentItem.vintage,
          bottleSize: `${actualBottleSizeMl}ml`,
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
          notes: receivedItem.packChanged
            ? `Pack changed: expected ${shipmentItem.bottlesPerCase ?? 12}x${shipmentItem.bottleSizeMl ?? 750}ml, received ${actualBottlesPerCase}x${actualBottleSizeMl}ml. ${receivedItem.notes ?? ''}`
            : receivedItem.notes,
        })
        .returning();

      // Create case labels for each case
      const caseLabels: Array<{ id: string; barcode: string }> = [];
      for (let i = 0; i < receivedItem.receivedCases; i++) {
        const barcode = generateCaseLabelBarcode(lwin18, totalCaseLabelSequence);
        totalCaseLabelSequence++;

        const [caseLabel] = await db
          .insert(wmsCaseLabels)
          .values({
            barcode,
            lwin18,
            productName: shipmentItem.productName,
            lotNumber,
            shipmentId,
            currentLocationId: receivingLocationId,
            isActive: true,
          })
          .returning();

        caseLabels.push({ id: caseLabel.id, barcode: caseLabel.barcode });
      }

      // Create movement record
      const movementNumber = await generateMovementNumber();
      await db.insert(wmsStockMovements).values({
        movementNumber,
        movementType: 'receive',
        lwin18,
        productName: shipmentItem.productName,
        quantityCases: receivedItem.receivedCases,
        toLocationId: receivingLocationId,
        lotNumber,
        shipmentId,
        scannedBarcodes: caseLabels.map((l) => l.barcode),
        notes: notes ?? `Received from shipment ${shipment.shipmentNumber}`,
        performedBy: ctx.user.id,
        performedAt: new Date(),
      });

      createdStock.push({
        stockId: stock.id,
        lwin18,
        productName: shipmentItem.productName,
        cases: receivedItem.receivedCases,
        caseLabels,
      });
    }

    // 6. Update shipment status to delivered
    await db
      .update(logisticsShipments)
      .set({
        status: 'delivered',
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(logisticsShipments.id, shipmentId));

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
