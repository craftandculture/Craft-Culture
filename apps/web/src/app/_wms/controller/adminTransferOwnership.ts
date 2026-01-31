import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners, wmsStock, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { transferOwnershipSchema } from '../schemas/ownershipSchema';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Transfer stock ownership from one partner to another
 * Supports partial transfers (transferring some cases to a new owner)
 *
 * @example
 *   await trpcClient.wms.admin.ownership.transfer.mutate({
 *     stockId: "uuid",
 *     newOwnerId: "uuid",
 *     quantityCases: 10,
 *     salesArrangement: "consignment",
 *     notes: "Transfer to new distributor"
 *   });
 */
const adminTransferOwnership = adminProcedure
  .input(transferOwnershipSchema)
  .mutation(async ({ input, ctx }) => {
    const {
      stockId,
      newOwnerId,
      quantityCases,
      salesArrangement,
      consignmentCommissionPercent,
      notes,
    } = input;

    // Get the source stock record
    const [sourceStock] = await db
      .select()
      .from(wmsStock)
      .where(eq(wmsStock.id, stockId));

    if (!sourceStock) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Stock record not found',
      });
    }

    // Check available quantity
    if (sourceStock.availableCases < quantityCases) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Insufficient available stock. Available: ${sourceStock.availableCases}, Requested: ${quantityCases}`,
      });
    }

    // Get the new owner details
    const [newOwner] = await db.select().from(partners).where(eq(partners.id, newOwnerId));

    if (!newOwner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'New owner partner not found',
      });
    }

    // Generate movement number
    const movementNumber = await generateMovementNumber();

    // Perform the transfer in a transaction
    const result = await db.transaction(async (tx) => {
      // Decrease source stock quantity
      if (sourceStock.quantityCases === quantityCases) {
        // Full transfer - update the stock record with new owner
        await tx
          .update(wmsStock)
          .set({
            ownerId: newOwnerId,
            ownerName: newOwner.name,
            salesArrangement: salesArrangement ?? sourceStock.salesArrangement,
            consignmentCommissionPercent:
              consignmentCommissionPercent ?? sourceStock.consignmentCommissionPercent,
            updatedAt: new Date(),
          })
          .where(eq(wmsStock.id, stockId));
      } else {
        // Partial transfer - reduce source and create new record for new owner
        await tx
          .update(wmsStock)
          .set({
            quantityCases: sql`${wmsStock.quantityCases} - ${quantityCases}`,
            availableCases: sql`${wmsStock.availableCases} - ${quantityCases}`,
            updatedAt: new Date(),
          })
          .where(eq(wmsStock.id, stockId));

        // Check if new owner already has stock of this product at this location
        const [existingStock] = await tx
          .select()
          .from(wmsStock)
          .where(
            sql`${wmsStock.locationId} = ${sourceStock.locationId}
                AND ${wmsStock.lwin18} = ${sourceStock.lwin18}
                AND ${wmsStock.ownerId} = ${newOwnerId}
                AND ${wmsStock.lotNumber} = ${sourceStock.lotNumber}`,
          );

        if (existingStock) {
          // Add to existing stock record
          await tx
            .update(wmsStock)
            .set({
              quantityCases: sql`${wmsStock.quantityCases} + ${quantityCases}`,
              availableCases: sql`${wmsStock.availableCases} + ${quantityCases}`,
              updatedAt: new Date(),
            })
            .where(eq(wmsStock.id, existingStock.id));
        } else {
          // Create new stock record for new owner
          await tx.insert(wmsStock).values({
            locationId: sourceStock.locationId,
            ownerId: newOwnerId,
            ownerName: newOwner.name,
            lwin18: sourceStock.lwin18,
            productName: sourceStock.productName,
            producer: sourceStock.producer,
            vintage: sourceStock.vintage,
            bottleSize: sourceStock.bottleSize,
            caseConfig: sourceStock.caseConfig,
            quantityCases: quantityCases,
            reservedCases: 0,
            availableCases: quantityCases,
            lotNumber: sourceStock.lotNumber,
            receivedAt: sourceStock.receivedAt,
            shipmentId: sourceStock.shipmentId,
            salesArrangement: salesArrangement ?? 'consignment',
            consignmentCommissionPercent: consignmentCommissionPercent ?? null,
            expiryDate: sourceStock.expiryDate,
            isPerishable: sourceStock.isPerishable,
          });
        }
      }

      // Create movement record
      const [movement] = await tx
        .insert(wmsStockMovements)
        .values({
          movementNumber,
          movementType: 'ownership_transfer',
          lwin18: sourceStock.lwin18,
          productName: sourceStock.productName,
          quantityCases,
          fromLocationId: sourceStock.locationId,
          toLocationId: sourceStock.locationId, // Same location
          fromOwnerId: sourceStock.ownerId,
          toOwnerId: newOwnerId,
          lotNumber: sourceStock.lotNumber,
          notes,
          performedBy: ctx.session.user.id,
          performedAt: new Date(),
        })
        .returning();

      return movement;
    });

    return {
      success: true,
      movement: result,
      message: `Transferred ${quantityCases} cases from ${sourceStock.ownerName} to ${newOwner.name}`,
    };
  });

export default adminTransferOwnership;
