import { TRPCError } from '@trpc/server';
import { and, eq, isNull, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsCaseLabels, wmsPalletCases, wmsPallets, wmsStockMovements } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { addCaseToPalletSchema } from '../schemas/palletSchema';

/**
 * Add a case to a pallet by scanning the case barcode
 *
 * @example
 *   await trpcClient.wms.admin.pallets.addCase.mutate({
 *     palletId: "pallet-uuid",
 *     caseBarcode: "CASE-1010279-2015-06-00750-001"
 *   });
 */
const adminAddCaseToPallet = adminProcedure
  .input(addCaseToPalletSchema)
  .mutation(async ({ input, ctx }) => {
    const { palletId, caseBarcode } = input;

    // Get pallet and verify it's active
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
        message: `Cannot add cases to a ${pallet.status} pallet. Only active pallets can receive cases.`,
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

    if (!caseLabel.isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This case is no longer active',
      });
    }

    // Check if case is already on a pallet (and not removed)
    const [existingPalletCase] = await db
      .select()
      .from(wmsPalletCases)
      .where(
        and(
          eq(wmsPalletCases.caseLabelId, caseLabel.id),
          isNull(wmsPalletCases.removedAt),
        ),
      );

    if (existingPalletCase) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This case is already on a pallet. Remove it first before adding to another pallet.',
      });
    }

    // Add case to pallet
    const [palletCase] = await db
      .insert(wmsPalletCases)
      .values({
        palletId,
        caseLabelId: caseLabel.id,
        lwin18: caseLabel.lwin18,
        productName: caseLabel.productName,
        addedBy: ctx.user.id,
      })
      .returning();

    // Update pallet total cases
    await db
      .update(wmsPallets)
      .set({
        totalCases: sql`${wmsPallets.totalCases} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(wmsPallets.id, palletId));

    // Create movement record
    await db.insert(wmsStockMovements).values({
      movementType: 'pallet_add',
      lwin18: caseLabel.lwin18,
      productName: caseLabel.productName,
      quantityCases: 1,
      quantityBottles: 0,
      toLocationId: pallet.locationId,
      ownerId: pallet.ownerId,
      ownerName: pallet.ownerName,
      performedBy: ctx.user.id,
      notes: `Added to pallet ${pallet.palletCode}`,
      scannedBarcodes: [caseBarcode],
    });

    // Get updated pallet
    const [updatedPallet] = await db
      .select()
      .from(wmsPallets)
      .where(eq(wmsPallets.id, palletId));

    return {
      success: true,
      palletCase,
      pallet: updatedPallet,
      caseDetails: {
        barcode: caseLabel.barcode,
        lwin18: caseLabel.lwin18,
        productName: caseLabel.productName,
      },
      message: `Added ${caseLabel.productName} to pallet ${pallet.palletCode}`,
    };
  });

export default adminAddCaseToPallet;
