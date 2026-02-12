import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsPallets, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { unsealPalletSchema } from '../schemas/palletSchema';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Unseal a pallet (allow modifications again)
 *
 * @example
 *   await trpcClient.wms.admin.pallets.unseal.mutate({
 *     palletId: "pallet-uuid",
 *     reason: "Need to add more cases"
 *   });
 */
const adminUnsealPallet = adminProcedure
  .input(unsealPalletSchema)
  .mutation(async ({ input, ctx }) => {
    const { palletId, reason } = input;

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

    if (pallet.status !== 'sealed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot unseal a ${pallet.status} pallet. Only sealed pallets can be unsealed.`,
      });
    }

    // Unseal the pallet
    const [unsealedPallet] = await db
      .update(wmsPallets)
      .set({
        status: 'active',
        isSealed: false,
        sealedAt: null,
        sealedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(wmsPallets.id, palletId))
      .returning();

    // Create movement record
    const movementNumber = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber,
      movementType: 'pallet_unseal',
      lwin18: 'PALLET',
      productName: `Pallet ${pallet.palletCode}`,
      quantityCases: pallet.totalCases,
      quantityBottles: 0,
      toLocationId: pallet.locationId,
      ownerId: pallet.ownerId,
      ownerName: pallet.ownerName,
      performedBy: ctx.user.id,
      notes: `Pallet ${pallet.palletCode} unsealed: ${reason}`,
      scannedBarcodes: [pallet.barcode],
    });

    return {
      success: true,
      pallet: unsealedPallet,
      message: `Pallet ${pallet.palletCode} unsealed`,
    };
  });

export default adminUnsealPallet;
