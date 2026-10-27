import { TRPCError } from '@trpc/server';
import { and, eq, inArray, like, sql } from 'drizzle-orm';

import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';
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

import receiveSingleItemSchema from '../schemas/receiveSingleItemSchema';
import claimCaseLabels from '../utils/claimCaseLabels';
import generateLwin18 from '../utils/generateLwin18';
import generateMovementNumber from '../utils/generateMovementNumber';
import getCategoryFromHsCode from '../utils/getCategoryFromHsCode';
import notifyOwnerOfArrival from '../utils/notifyOwnerOfArrival';

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
const adminReceiveShipmentItem = wmsOperatorProcedure
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

    // Block receiving for export shipments — stock was already dispatched
    if (shipment.type !== 'inbound') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only import (inbound) shipments can be received into WMS.',
      });
    }

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
    /*
      A wine added on the dock is not the logistics line it is filed under —
      the screen sends the first line's id only because one is required. Its
      blanks stay blank rather than being filled from that other wine.
    */
    const line = receivedItem.isAddedItem ? null : shipmentItem;
    const actualBottlesPerCase = receivedItem.receivedBottlesPerCase ?? line?.bottlesPerCase ?? 12;
    const actualBottleSizeMl = receivedItem.receivedBottleSizeMl ?? line?.bottleSizeMl ?? 750;
    const productName = receivedItem.productName ?? shipmentItem.productName;
    const producer = receivedItem.producer ?? line?.producer ?? null;
    const vintage = receivedItem.vintage ?? line?.vintage ?? null;
    const supplierSku = receivedItem.supplierSku ?? line?.supplierSku ?? null;
    const hsCode = receivedItem.hsCode ?? line?.hsCode ?? null;
    const countryOfOrigin = receivedItem.countryOfOrigin ?? line?.countryOfOrigin ?? null;

    // Determine LWIN-18 — normalize to the canonical dashed form so a raw
    // 18-digit supplier LWIN (e.g. Cult Wines) matches the existing dashed
    // stock record instead of creating a duplicate.
    let lwin18: string;
    if (receivedItem.lwin) {
      lwin18 = normalizeLwin18(receivedItem.lwin) ?? receivedItem.lwin;
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
    /* Captured for the arrival notice, which is sent once the item is booked in. */
    const receivedOwnerId = shipmentItem.overrideOwnerId ?? partner.id;
    const notForSale = (line?.notForSale ?? null) ?? shipment.notForSale;
    const idempotencyKey = input.idempotencyKey ?? null;

    /*
      One transaction for the whole line. A retry of the same line (same key)
      finds its own movements and returns what was booked the first time.
      Before, any receipt to a bay already holding this shipment's wine was
      taken for a retry, so a second line of the same wine was silently
      dropped, while a genuine retry into a bay holding older stock was
      booked in twice.
    */
    const { createdStock, isRetry } = await db.transaction(async (tx) => {
      const created: Array<{
        stockId: string;
        locationId: string;
        cases: number;
        caseLabels: Array<{ id: string; barcode: string }>;
      }> = [];

      if (idempotencyKey) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${idempotencyKey}))`);

        const earlier = await tx
          .select({
            idempotencyKey: wmsStockMovements.idempotencyKey,
            toLocationId: wmsStockMovements.toLocationId,
            quantityCases: wmsStockMovements.quantityCases,
            scannedBarcodes: wmsStockMovements.scannedBarcodes,
            stockId: wmsStockMovements.stockId,
          })
          .from(wmsStockMovements)
          .where(like(wmsStockMovements.idempotencyKey, `${idempotencyKey}:%`));

        if (earlier.length > 0) {
          for (const movement of earlier) {
            created.push({
              stockId: movement.stockId ?? '',
              locationId: movement.toLocationId ?? '',
              cases: movement.quantityCases,
              caseLabels: ((movement.scannedBarcodes as string[] | null) ?? []).map(
                (barcode) => ({ id: barcode, barcode }),
              ),
            });
          }
          return { createdStock: created, isRetry: true };
        }
      }

      for (const [index, assignment] of receivedItem.locationAssignments.entries()) {
        const itemLocationId = assignment.locationId;
        const assignmentCases = assignment.cases;

        // The row for this wine, bay and owner, held the same way. This
        // shipment's own row first, so its BOE and lot stay together.
        const [existingStock] = await tx
          .select()
          .from(wmsStock)
          .where(
            and(
              eq(wmsStock.lwin18, lwin18),
              eq(wmsStock.locationId, itemLocationId),
              eq(wmsStock.ownerId, receivedOwnerId),
              eq(wmsStock.notForSale, notForSale),
            ),
          )
          .orderBy(sql`(${wmsStock.shipmentId} IS NOT DISTINCT FROM ${shipmentId}) DESC`)
          .limit(1)
          .for('update');

        let stock: typeof wmsStock.$inferSelect | undefined;

        if (existingStock) {
          const [updatedStock] = await tx
            .update(wmsStock)
            .set({
              quantityCases: sql`${wmsStock.quantityCases} + ${assignmentCases}`,
              availableCases: sql`${wmsStock.availableCases} + ${assignmentCases}`,
              // This row may already hold stock from another shipment, so its BOE
              // is only unambiguous while it has none — never overwrite one
              reExportBoeNumber:
                existingStock.reExportBoeNumber ?? shipment.reExportBoeNumber,
              updatedAt: new Date(),
            })
            .where(eq(wmsStock.id, existingStock.id))
            .returning();
          stock = updatedStock;
        } else {
          const [newStock] = await tx
            .insert(wmsStock)
            .values({
              locationId: itemLocationId,
              ownerId: receivedOwnerId,
              ownerName: shipmentItem.overrideOwnerName ?? partner.businessName,
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
              reExportBoeNumber: shipment.reExportBoeNumber,
              salesArrangement: 'consignment',
              /*
                The line decides, falling back to the shipment. Receiving is the
                last point where the distinction is still recorded anywhere — a
                stock row that arrives without it is indistinguishable from
                goods we bought to sell.
              */
              notForSale,
              expiryDate: receivedItem.expiryDate,
              isPerishable: !!receivedItem.expiryDate,
              category: getCategoryFromHsCode(hsCode),
              notes: stockNotes || undefined,
              photos: receivedItem.photos ?? [],
            })
            .returning();
          stock = newStock;
        }

        if (!stock) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not book the stock in. Nothing was saved — try again.',
          });
        }

        const caseLabels = await claimCaseLabels(tx, {
          lwin18,
          productName,
          lotNumber,
          shipmentId,
          locationId: itemLocationId,
          count: assignmentCases,
        });

        const movementNumber = await generateMovementNumber(tx);
        const palletTag = assignment.isPalletized ? ' (pallet)' : '';
        const baseNote = notes
          ? `${notes}${palletTag}`
          : `Received from shipment ${shipment.shipmentNumber}${palletTag}`;
        const splitSuffix = isSplit
          ? ` [${assignmentCases} of ${totalReceivedCases} cases]`
          : '';

        await tx.insert(wmsStockMovements).values({
          movementNumber,
          movementType: 'receive',
          lwin18,
          supplierSku,
          productName,
          quantityCases: assignmentCases,
          toLocationId: itemLocationId,
          /* Whose wine arrived, so a member's statement can list it */
          toOwnerId: receivedOwnerId,
          stockId: stock.id,
          lotNumber,
          shipmentId,
          scannedBarcodes: caseLabels.map((l) => l.barcode),
          notes: `${baseNote}${splitSuffix}`,
          idempotencyKey: idempotencyKey ? `${idempotencyKey}:${index}` : null,
          performedBy: ctx.user.id,
          performedAt: new Date(),
        });

        created.push({
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
        await tx
          .update(logisticsShipments)
          .set({
            status: 'partially_received',
            updatedAt: new Date(),
          })
          .where(eq(logisticsShipments.id, shipmentId));
      }

      return { createdStock: created, isRetry: false };
    });

    const casesReceived = createdStock.reduce((sum, s) => sum + s.cases, 0);

    // A retry booked nothing new: no Zoho call, no second arrival notice
    if (isRetry) {
      return {
        success: true,
        lwin18,
        productName,
        totalCases: casesReceived,
        stock: createdStock,
        alreadyReceived: true,
      };
    }

    if (
      shipment.status !== 'partially_received' &&
      shipment.status !== 'delivered'
    ) {
      await advanceShipmentIntakes(shipmentId);
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

    /*
      Tell the owner their wine has landed.

      Arrival is the moment an owner most wants to hear from us and the one
      they hear nothing about — the cellar just gains a line the next time
      they happen to look. Deliberately after the stock is written and
      deliberately unable to fail the receipt.
    */
    await notifyOwnerOfArrival({
      ownerId: receivedOwnerId,
      productName,
      cases: casesReceived,
      bottles: casesReceived * actualBottlesPerCase,
      shipmentNumber: shipment.shipmentNumber,
      stockId: createdStock[0]?.stockId ?? null,
      lwin18,
    });

    return {
      success: true,
      lwin18,
      productName,
      totalCases: casesReceived,
      stock: createdStock,
    };
  });

export default adminReceiveShipmentItem;
