import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';

import db from '@/database/client';
import { wmsLocations, wmsPalletCases, wmsPallets } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getPalletByBarcodeSchema } from '../schemas/palletSchema';

/**
 * Get pallet by scanning its barcode
 *
 * @example
 *   await trpcClient.wms.admin.pallets.getByBarcode.query({
 *     barcode: "PALLET-2026-0001"
 *   });
 */
const adminGetPalletByBarcode = adminProcedure
  .input(getPalletByBarcodeSchema)
  .query(async ({ input }) => {
    const { barcode } = input;

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
      .where(eq(wmsPallets.barcode, barcode));

    if (!pallet) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Pallet with barcode ${barcode} not found`,
      });
    }

    // Get product summary for display
    const cases = await db
      .select({
        lwin18: wmsPalletCases.lwin18,
        productName: wmsPalletCases.productName,
      })
      .from(wmsPalletCases)
      .where(and(eq(wmsPalletCases.palletId, pallet.id), isNull(wmsPalletCases.removedAt)));

    // Group by product
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
      productSummary: Object.values(productSummary).sort((a, b) => b.quantity - a.quantity),
      totalCases: cases.length,
    };
  });

export default adminGetPalletByBarcode;
