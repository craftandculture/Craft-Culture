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
 *     caseBarcode: "CASE-1010279-2015-06-00750-001",
 *     reason: "Wrong product"
 *   });
 */
const adminRemoveCaseFromPallet = adminProcedure
  .input(removeCaseFromPalletSchema)
  .mutation(async ({ input, ctx }) => {
    const { palletId, caseBarcode, reason } = input;

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

    // Get case label by barcode
    const [caseLabel] = await db
      .select()
      .from(wmsCaseLabels)
      .where(eq(wmsCaseLabels.barcode, caseBarcode));

    if (!caseLabel) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Case with barcode ${caseBarcode} not found`,
      });
    }

    // Find the pallet case record
    const [palletCase] = await db
      .select()
      .from(wmsPalletCases)
      .where(
        and(
          eq(wmsPalletCases.palletId, palletId),
          eq(wmsPalletCases.caseLabelId, caseLabel.id),
          isNull(wmsPalletCases.removedAt),
        ),
      );

    if (!palletCase) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'This case is not on this pallet',
      });
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
      lwin18: caseLabel.lwin18,
      productName: caseLabel.productName,
      quantityCases: 1,
      quantityBottles: 0,
      fromLocationId: pallet.locationId,
      ownerId: pallet.ownerId,
      ownerName: pallet.ownerName,
      performedBy: ctx.user.id,
      notes: `Removed from pallet ${pallet.palletCode}${reason ? `: ${reason}` : ''}`,
      scannedBarcodes: [caseBarcode],
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
        barcode: caseLabel.barcode,
        lwin18: caseLabel.lwin18,
        productName: caseLabel.productName,
      },
      message: `Removed ${caseLabel.productName} from pallet ${pallet.palletCode}`,
    };
  });

export default adminRemoveCaseFromPallet;
