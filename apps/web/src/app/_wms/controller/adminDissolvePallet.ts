import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import db from '@/database/client';
import {
  wmsCaseLabels,
  wmsLocations,
  wmsPalletCases,
  wmsPallets,
  wmsStockMovements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { dissolvePalletSchema } from '../schemas/palletSchema';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Dissolve a pallet - return all cases to inventory and archive the pallet
 *
 * @example
 *   await trpcClient.wms.admin.pallets.dissolve.mutate({
 *     palletId: "pallet-uuid",
 *     toLocationId: "staging-location-uuid",
 *     reason: "Pallet no longer needed"
 *   });
 */
const adminDissolvePallet = adminProcedure
  .input(dissolvePalletSchema)
  .mutation(async ({ input, ctx }) => {
    const { palletId, toLocationId, reason } = input;

    // Get pallet
    const [pallet] = await db
      .select()
      .from(wmsPallets)
      .where(eq(wmsPallets.id, palletId));

    if (!pallet) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pallet not found',
      });
    }

    if (pallet.status === 'archived') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Pallet is already archived',
      });
    }

    // Verify destination location exists
    const [toLocation] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.id, toLocationId));

    if (!toLocation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Destination location not found',
      });
    }

    // Get all active cases on pallet
    const activeCases = await db
      .select({
        palletCase: wmsPalletCases,
        caseLabel: wmsCaseLabels,
      })
      .from(wmsPalletCases)
      .leftJoin(wmsCaseLabels, eq(wmsPalletCases.caseLabelId, wmsCaseLabels.id))
      .where(
        and(eq(wmsPalletCases.palletId, palletId), isNull(wmsPalletCases.removedAt)),
      );

    const casesCount = activeCases.length;

    // Mark all cases as removed
    if (casesCount > 0) {
      await db
        .update(wmsPalletCases)
        .set({
          removedAt: new Date(),
          removedBy: ctx.user.id,
          removalReason: reason || 'Pallet dissolved',
          updatedAt: new Date(),
        })
        .where(
          and(eq(wmsPalletCases.palletId, palletId), isNull(wmsPalletCases.removedAt)),
        );

      // Update case label locations to destination
      const caseLabelIds = activeCases
        .map((c) => c.palletCase.caseLabelId)
        .filter((id): id is string => id !== null);

      if (caseLabelIds.length > 0) {
        await db
          .update(wmsCaseLabels)
          .set({
            currentLocationId: toLocationId,
            updatedAt: new Date(),
          })
          .where(inArray(wmsCaseLabels.id, caseLabelIds));
      }
    }

    // Archive the pallet
    const [archivedPallet] = await db
      .update(wmsPallets)
      .set({
        status: 'archived',
        totalCases: 0,
        updatedAt: new Date(),
      })
      .where(eq(wmsPallets.id, palletId))
      .returning();

    // Collect barcodes for movement record
    const scannedBarcodes = [
      pallet.barcode,
      ...activeCases.map((c) => c.caseLabel?.barcode).filter((b): b is string => !!b),
    ];

    // Create movement record
    const movementNumber = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber,
      movementType: 'pallet_dissolve',
      lwin18: 'PALLET',
      productName: `Pallet ${pallet.palletCode}`,
      quantityCases: casesCount,
      quantityBottles: 0,
      fromLocationId: pallet.locationId,
      toLocationId,
      ownerId: pallet.ownerId,
      ownerName: pallet.ownerName,
      performedBy: ctx.user.id,
      notes: `Pallet ${pallet.palletCode} dissolved, ${casesCount} cases moved to ${toLocation.locationCode}${reason ? `: ${reason}` : ''}`,
      scannedBarcodes,
    });

    return {
      success: true,
      pallet: archivedPallet,
      casesReleased: casesCount,
      toLocation: toLocation.locationCode,
      message: `Pallet ${pallet.palletCode} dissolved, ${casesCount} cases returned to ${toLocation.locationCode}`,
    };
  });

export default adminDissolvePallet;
