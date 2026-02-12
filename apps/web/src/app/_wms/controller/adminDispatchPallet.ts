import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import db from '@/database/client';
import {
  wmsCaseLabels,
  wmsPalletCases,
  wmsPallets,
  wmsStockMovements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { dispatchPalletSchema } from '../schemas/palletSchema';
import generateMovementNumber from '../utils/generateMovementNumber';

/**
 * Dispatch a pallet - ship entire pallet to customer
 *
 * @example
 *   await trpcClient.wms.admin.pallets.dispatch.mutate({
 *     palletId: "pallet-uuid",
 *     notes: "Shipped to customer XYZ"
 *   });
 */
const adminDispatchPallet = adminProcedure
  .input(dispatchPalletSchema)
  .mutation(async ({ input, ctx }) => {
    const { palletId, notes } = input;

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
        message: `Cannot dispatch a ${pallet.status} pallet. Only sealed pallets can be dispatched.`,
      });
    }

    if (pallet.totalCases === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot dispatch an empty pallet',
      });
    }

    // Get all active cases for movement record
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

    // Dispatch the pallet (mark as retrieved)
    const [dispatchedPallet] = await db
      .update(wmsPallets)
      .set({
        status: 'retrieved',
        locationId: null, // No longer in a physical location
        updatedAt: new Date(),
        notes: pallet.notes
          ? `${pallet.notes}\n---\nDispatched: ${notes || 'No notes'}`
          : `Dispatched: ${notes || 'No notes'}`,
      })
      .where(eq(wmsPallets.id, palletId))
      .returning();

    // Mark case labels as inactive (they left the warehouse)
    const caseLabelIds = activeCases
      .map((c) => c.palletCase.caseLabelId)
      .filter((id): id is string => id !== null);

    if (caseLabelIds.length > 0) {
      await db
        .update(wmsCaseLabels)
        .set({
          isActive: false,
          currentLocationId: null,
          updatedAt: new Date(),
        })
        .where(inArray(wmsCaseLabels.id, caseLabelIds));
    }

    // Collect barcodes for movement record
    const scannedBarcodes = [
      pallet.barcode,
      ...activeCases.map((c) => c.caseLabel?.barcode).filter((b): b is string => !!b),
    ];

    // Create movement record
    const movementNumber = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber,
      movementType: 'pallet_dispatch',
      lwin18: 'PALLET',
      productName: `Pallet ${pallet.palletCode}`,
      quantityCases: pallet.totalCases,
      quantityBottles: 0,
      fromLocationId: pallet.locationId,
      ownerId: pallet.ownerId,
      ownerName: pallet.ownerName,
      performedBy: ctx.user.id,
      notes: `Pallet ${pallet.palletCode} dispatched with ${pallet.totalCases} cases${notes ? `: ${notes}` : ''}`,
      scannedBarcodes,
    });

    return {
      success: true,
      pallet: dispatchedPallet,
      totalCasesDispatched: pallet.totalCases,
      message: `Pallet ${pallet.palletCode} dispatched with ${pallet.totalCases} cases`,
    };
  });

export default adminDispatchPallet;
