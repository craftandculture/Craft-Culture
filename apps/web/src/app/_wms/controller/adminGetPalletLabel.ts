import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsPalletCases, wmsPallets } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getPalletSchema } from '../schemas/palletSchema';
import generatePalletLabelZpl from '../utils/generatePalletLabelZpl';

/**
 * Generate ZPL label for a pallet
 *
 * @example
 *   await trpcClient.wms.admin.pallets.getLabel.query({
 *     palletId: "pallet-uuid"
 *   });
 */
const adminGetPalletLabel = adminProcedure.input(getPalletSchema).query(async ({ input }) => {
  const { palletId } = input;

  // Get pallet with location
  const [pallet] = await db
    .select({
      id: wmsPallets.id,
      palletCode: wmsPallets.palletCode,
      barcode: wmsPallets.barcode,
      ownerName: wmsPallets.ownerName,
      totalCases: wmsPallets.totalCases,
      status: wmsPallets.status,
      sealedAt: wmsPallets.sealedAt,
      locationCode: wmsLocations.locationCode,
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

  // Get product summary
  const cases = await db
    .select({
      lwin18: wmsPalletCases.lwin18,
      productName: wmsPalletCases.productName,
    })
    .from(wmsPalletCases)
    .where(and(eq(wmsPalletCases.palletId, palletId), isNull(wmsPalletCases.removedAt)));

  // Group by product
  const productMap = cases.reduce(
    (acc, c) => {
      const key = c.lwin18;
      if (!acc[key]) {
        acc[key] = {
          productName: c.productName,
          quantity: 0,
        };
      }
      acc[key].quantity++;
      return acc;
    },
    {} as Record<string, { productName: string; quantity: number }>,
  );

  const productSummary = Object.values(productMap).sort((a, b) => b.quantity - a.quantity);

  // Generate ZPL
  const zpl = generatePalletLabelZpl({
    barcode: pallet.barcode,
    palletCode: pallet.palletCode,
    ownerName: pallet.ownerName,
    totalCases: pallet.totalCases,
    status: pallet.status as 'active' | 'sealed' | 'retrieved' | 'archived',
    sealedAt: pallet.sealedAt,
    locationCode: pallet.locationCode,
    productSummary,
  });

  return {
    zpl,
    palletCode: pallet.palletCode,
    barcode: pallet.barcode,
  };
});

export default adminGetPalletLabel;
