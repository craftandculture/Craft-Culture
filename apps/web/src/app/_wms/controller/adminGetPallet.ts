import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsPalletCases, wmsPallets } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getPalletSchema } from '../schemas/palletSchema';

/**
 * Get pallet details with all cases
 *
 * @example
 *   await trpcClient.wms.admin.pallets.getOne.query({
 *     palletId: "pallet-uuid"
 *   });
 */
const adminGetPallet = adminProcedure.input(getPalletSchema).query(async ({ input }) => {
  const { palletId } = input;

  // Get pallet with location
  const [pallet] = await db
    .select({
      id: wmsPallets.id,
      palletCode: wmsPallets.palletCode,
      barcode: wmsPallets.barcode,
      ownerId: wmsPallets.ownerId,
      ownerName: wmsPallets.ownerName,
      locationId: wmsPallets.locationId,
      locationCode: wmsLocations.locationCode,
      totalCases: wmsPallets.totalCases,
      storageType: wmsPallets.storageType,
      status: wmsPallets.status,
      isSealed: wmsPallets.isSealed,
      sealedAt: wmsPallets.sealedAt,
      notes: wmsPallets.notes,
      createdAt: wmsPallets.createdAt,
      updatedAt: wmsPallets.updatedAt,
    })
    .from(wmsPallets)
    .leftJoin(wmsLocations, eq(wmsPallets.locationId, wmsLocations.id))
    .where(eq(wmsPallets.id, palletId));

  if (!pallet) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Pallet not found',
    });
  }

  // Get all active cases on pallet
  const cases = await db
    .select({
      id: wmsPalletCases.id,
      lwin18: wmsPalletCases.lwin18,
      productName: wmsPalletCases.productName,
      addedAt: wmsPalletCases.addedAt,
      caseLabelId: wmsPalletCases.caseLabelId,
    })
    .from(wmsPalletCases)
    .where(and(eq(wmsPalletCases.palletId, palletId), isNull(wmsPalletCases.removedAt)))
    .orderBy(wmsPalletCases.addedAt);

  // Group cases by product for summary
  const productSummary = cases.reduce(
    (acc, c) => {
      const key = c.lwin18;
      if (!acc[key]) {
        acc[key] = {
          lwin18: c.lwin18,
          productName: c.productName,
          quantity: 0,
        };
      }
      acc[key].quantity++;
      return acc;
    },
    {} as Record<string, { lwin18: string; productName: string; quantity: number }>,
  );

  return {
    pallet,
    cases,
    productSummary: Object.values(productSummary).sort((a, b) => b.quantity - a.quantity),
    totalCases: cases.length,
  };
});

export default adminGetPallet;
