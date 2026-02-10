import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsPallets, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { movePalletSchema } from '../schemas/palletSchema';

/**
 * Move a sealed pallet to a location (bay)
 *
 * @example
 *   await trpcClient.wms.admin.pallets.move.mutate({
 *     palletId: "pallet-uuid",
 *     toLocationId: "location-uuid"
 *   });
 */
const adminMovePallet = adminProcedure
  .input(movePalletSchema)
  .mutation(async ({ input, ctx }) => {
    const { palletId, toLocationId } = input;

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

    if (pallet.status !== 'sealed' && pallet.status !== 'active') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot move a ${pallet.status} pallet`,
      });
    }

    // Get destination location
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

    // Get previous location for movement record
    let fromLocation = null;
    if (pallet.locationId) {
      [fromLocation] = await db
        .select()
        .from(wmsLocations)
        .where(eq(wmsLocations.id, pallet.locationId));
    }

    // Update pallet location
    const [movedPallet] = await db
      .update(wmsPallets)
      .set({
        locationId: toLocationId,
        updatedAt: new Date(),
      })
      .where(eq(wmsPallets.id, palletId))
      .returning();

    // Create movement record
    await db.insert(wmsStockMovements).values({
      movementType: 'pallet_move',
      lwin18: 'PALLET',
      productName: `Pallet ${pallet.palletCode}`,
      quantityCases: pallet.totalCases,
      quantityBottles: 0,
      fromLocationId: pallet.locationId,
      toLocationId,
      ownerId: pallet.ownerId,
      ownerName: pallet.ownerName,
      performedBy: ctx.user.id,
      notes: `Pallet ${pallet.palletCode} moved to ${toLocation.locationCode}`,
      scannedBarcodes: [pallet.barcode],
    });

    return {
      success: true,
      pallet: movedPallet,
      fromLocation: fromLocation?.locationCode || null,
      toLocation: toLocation.locationCode,
      message: `Pallet ${pallet.palletCode} moved to ${toLocation.locationCode}`,
    };
  });

export default adminMovePallet;
