import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';

import advanceShipmentIntakes from '@/app/_onboarding/data/advanceShipmentIntakes';
import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  partners,
  wmsLocations,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';
import { findOrCreateWineItem } from '@/lib/zoho/items';
import logger from '@/utils/logger';

import { receiveShipmentSchema } from '../schemas/receiveSchema';
import claimCaseLabels from '../utils/claimCaseLabels';
import generateLotNumber from '../utils/generateLotNumber';
import generateLwin18 from '../utils/generateLwin18';
import generateMovementNumber from '../utils/generateMovementNumber';
import getCategoryFromHsCode from '../utils/getCategoryFromHsCode';

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
const adminReceiveShipment = wmsOperatorProcedure
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

    // Block receiving for export shipments — stock was already dispatched
    if (shipment.type !== 'inbound') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only import (inbound) shipments can be received into WMS.',
      });
    }

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

      /*
        The shipment row is locked and must not already be received. A second
        tap or a resend used to book the whole shipment in again.
      */
      const [locked] = await tx
        .select({ status: logisticsShipments.status })
        .from(logisticsShipments)
        .where(eq(logisticsShipments.id, shipmentId))
        .for('update');

      if (locked?.status === 'delivered') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Shipment ${shipment.shipmentNumber} has already been received.`,
        });
      }

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
        // An added wine never borrows the blanks of the line it is filed under
        const line = receivedItem.isAddedItem ? null : shipmentItem;
        const productName = receivedItem.productName ?? shipmentItem.productName;
        const producer = receivedItem.producer ?? line?.producer ?? null;
        const vintage = receivedItem.vintage ?? line?.vintage ?? null;
        // Supplier SKU comes from shipment item, or can be overridden
        const supplierSku = receivedItem.supplierSku ?? line?.supplierSku ?? null;
        // Customs data for Zoho sync
        const hsCode = receivedItem.hsCode ?? line?.hsCode ?? null;
        const countryOfOrigin = receivedItem.countryOfOrigin ?? line?.countryOfOrigin ?? null;

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

        // Check for existing stock at this location with same LWIN18 and owner
        const resolvedOwnerId = shipmentItem.overrideOwnerId ?? partner.id;
        const [existingStock] = await tx
          .select()
          .from(wmsStock)
          .where(
            and(
              eq(wmsStock.lwin18, lwin18),
              eq(wmsStock.locationId, itemLocationId),
              eq(wmsStock.ownerId, resolvedOwnerId),
              // Held wine never merges into a listed row
              eq(wmsStock.notForSale, shipmentItem.notForSale ?? shipment.notForSale),
            ),
          )
          .limit(1)
          .for('update');

        let stock: typeof wmsStock.$inferSelect;

        /*
          Never treated as a retry: the shipment lock above already refuses a
          second receipt, and the old "same shipment in this bay = retry" rule
          dropped the second of two lines of one wine into one bay.
        */
        if (existingStock) {
          // Same product/location/owner from a different source — increment qty
          const [updatedStock] = await tx
            .update(wmsStock)
            .set({
              quantityCases: sql`${wmsStock.quantityCases} + ${receivedItem.receivedCases}`,
              availableCases: sql`${wmsStock.availableCases} + ${receivedItem.receivedCases}`,
              updatedAt: new Date(),
            })
            .where(eq(wmsStock.id, existingStock.id))
            .returning();
          stock = updatedStock;
        } else {
          // Create new stock record
          const [newStock] = await tx
            .insert(wmsStock)
            .values({
              locationId: itemLocationId,
              ownerId: resolvedOwnerId,
              ownerName: shipmentItem.overrideOwnerName ?? partner.businessName,
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
              // The line decides, falling back to the shipment.
              notForSale: shipmentItem.notForSale ?? shipment.notForSale,
              expiryDate: receivedItem.expiryDate,
              isPerishable: !!receivedItem.expiryDate,
              category: getCategoryFromHsCode(hsCode),
              notes: stockNotes || undefined,
            })
            .returning();
          stock = newStock;
        }

        // This shipment's printed labels first, then new ones
        const caseLabels = await claimCaseLabels(tx, {
          lwin18,
          productName,
          lotNumber,
          shipmentId,
          locationId: itemLocationId,
          count: receivedItem.receivedCases,
        });

        {
          const movementNumber = await generateMovementNumber(tx);
          await tx.insert(wmsStockMovements).values({
            movementNumber,
            movementType: 'receive',
            lwin18,
            supplierSku,
            productName,
            quantityCases: receivedItem.receivedCases,
            toLocationId: itemLocationId,
            /* Whose wine arrived, so a member's statement can list it */
            toOwnerId: resolvedOwnerId,
            stockId: stock.id,
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

    // Members' transfers on this shipment are now in their cellars
    await advanceShipmentIntakes(shipmentId);

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
