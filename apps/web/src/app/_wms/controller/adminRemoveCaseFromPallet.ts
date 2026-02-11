import { TRPCError } from '@trpc/server';
import { and, eq, isNull, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsCaseLabels, wmsPalletCases, wmsPallets, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { removeCaseFromPalletSchema } from '../schemas/palletSchema';

/**
 * Remove a case from a pallet
 *
 * @example
 *   await trpcClient.wms.admin.pallets.removeCase.mutate({
 *     palletId: "pallet-uuid",
 *     caseId: "pallet-case-uuid",
 *     reason: "Wrong product"
 *   });
 */
const adminRemoveCaseFromPallet = adminProcedure
  .input(removeCaseFromPalletSchema)
  .mutation(async ({ input, ctx }) => {
    const { palletId, caseId, reason } = input;

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
        message: `Cannot remove cases from a ${pallet.status} pallet. Only active pallets can be modified.`,
      });
    }

    // Find the pallet case record
    const [palletCase] = await db
      .select()
      .from(wmsPalletCases)
      .where(
        and(
          eq(wmsPalletCases.id, caseId),
          eq(wmsPalletCases.palletId, palletId),
          isNull(wmsPalletCases.removedAt),
        ),
      );

    if (!palletCase) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'This case is not on this pallet',
      });
    }

    // Get case label for movement record
    let caseLabel = null;
    if (palletCase.caseLabelId) {
      [caseLabel] = await db
        .select()
        .from(wmsCaseLabels)
        .where(eq(wmsCaseLabels.id, palletCase.caseLabelId));
    }

    // Mark case as removed
    await db
      .update(wmsPalletCases)
      .set({
        removedAt: new Date(),
        removedBy: ctx.user.id,
        removalReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(wmsPalletCases.id, palletCase.id));

    // Update pallet total cases
    await db
      .update(wmsPallets)
      .set({
        totalCases: sql`GREATEST(${wmsPallets.totalCases} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(wmsPallets.id, palletId));

    // Create movement record
    await db.insert(wmsStockMovements).values({
      movementType: 'pallet_remove',
      lwin18: palletCase.lwin18,
      productName: palletCase.productName,
      quantityCases: 1,
      quantityBottles: 0,
      fromLocationId: pallet.locationId,
      ownerId: pallet.ownerId,
      ownerName: pallet.ownerName,
      performedBy: ctx.user.id,
      notes: `Removed from pallet ${pallet.palletCode}${reason ? `: ${reason}` : ''}`,
      scannedBarcodes: caseLabel ? [caseLabel.barcode] : [],
    });

    // Get updated pallet
    const [updatedPallet] = await db
      .select()
      .from(wmsPallets)
      .where(eq(wmsPallets.id, palletId));

    return {
      success: true,
      pallet: updatedPallet,
      removedCase: {
        lwin18: palletCase.lwin18,
        productName: palletCase.productName,
      },
      message: `Removed ${palletCase.productName} from pallet ${pallet.palletCode}`,
    };
  });

export default adminRemoveCaseFromPallet;
