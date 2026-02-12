import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsPallets, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { sealPalletSchema } from '../schemas/palletSchema';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Seal a pallet (lock contents, ready for storage)
 *
 * @example
 *   await trpcClient.wms.admin.pallets.seal.mutate({
 *     palletId: "pallet-uuid"
 *   });
 */
const adminSealPallet = adminProcedure
  .input(sealPalletSchema)
  .mutation(async ({ input, ctx }) => {
    const { palletId } = input;

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

    if (pallet.status !== 'active') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Pallet is already ${pallet.status}`,
      });
    }

    if (pallet.totalCases === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot seal an empty pallet. Add cases first.',
      });
    }

    // Seal the pallet
    const [sealedPallet] = await db
      .update(wmsPallets)
      .set({
        status: 'sealed',
        isSealed: true,
        sealedAt: new Date(),
        sealedBy: ctx.user.id,
        updatedAt: new Date(),
      })
      .where(eq(wmsPallets.id, palletId))
      .returning();

    // Create movement record
    const movementNumber = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber,
      movementType: 'pallet_move',
      lwin18: 'PALLET',
      productName: `Pallet ${pallet.palletCode}`,
      quantityCases: pallet.totalCases,
      quantityBottles: 0,
      toLocationId: pallet.locationId,
      ownerId: pallet.ownerId,
      ownerName: pallet.ownerName,
      performedBy: ctx.user.id,
      notes: `Pallet ${pallet.palletCode} sealed with ${pallet.totalCases} cases`,
      scannedBarcodes: [pallet.barcode],
    });

    return {
      success: true,
      pallet: sealedPallet,
      message: `Pallet ${pallet.palletCode} sealed with ${pallet.totalCases} cases`,
    };
  });

export default adminSealPallet;
