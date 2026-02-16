import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import generateLabelZpl from '../utils/generateLabelZpl';

/**
 * Print a single stock summary label for a stock record
 *
 * Generates a pallet-style label (4"x2") showing the product name,
 * current case count, location, owner, and lot number. Used after
 * transfers or from stock check to get an updated label.
 *
 * @example
 *   await trpcClient.wms.admin.labels.printStockLabel.mutate({
 *     stockId: "uuid",
 *   });
 */
const adminPrintStockLabel = adminProcedure
  .input(
    z.object({
      stockId: z.string().uuid(),
    }),
  )
  .mutation(async ({ input }) => {
    const { stockId } = input;

    // Fetch stock record
    const [stock] = await db
      .select({
        lwin18: wmsStock.lwin18,
        locationId: wmsStock.locationId,
        productName: wmsStock.productName,
        caseConfig: wmsStock.caseConfig,
        bottleSize: wmsStock.bottleSize,
        vintage: wmsStock.vintage,
        ownerName: wmsStock.ownerName,
        lotNumber: wmsStock.lotNumber,
        quantityCases: wmsStock.quantityCases,
      })
      .from(wmsStock)
      .where(eq(wmsStock.id, stockId));

    if (!stock) {
      return {
        success: false as const,
        error: 'Stock record not found',
        zpl: '',
        productName: '',
        quantityCases: 0,
      };
    }

    // Fetch location code
    const [location] = await db
      .select({ locationCode: wmsLocations.locationCode })
      .from(wmsLocations)
      .where(eq(wmsLocations.id, stock.locationId));

    // Build pack size
    const packSize =
      stock.caseConfig && stock.bottleSize
        ? `${stock.caseConfig}x${stock.bottleSize}`
        : '';

    // Build barcode for the label
    const safeName = stock.productName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 20);
    const barcode = `PLT-${safeName}-${stock.quantityCases}C`;

    const zpl = generateLabelZpl({
      barcode,
      productName: stock.productName,
      lwin18: stock.lwin18,
      packSize,
      vintage: stock.vintage ?? undefined,
      lotNumber: stock.lotNumber ?? undefined,
      locationCode: location?.locationCode ?? undefined,
      owner: stock.ownerName ?? undefined,
      labelType: 'pallet',
      palletCaseCount: stock.quantityCases,
    });

    return {
      success: true as const,
      zpl,
      productName: stock.productName,
      quantityCases: stock.quantityCases,
    };
  });

export default adminPrintStockLabel;
