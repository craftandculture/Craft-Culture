import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsLocations, wmsStock } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import generateLabelZpl from '../utils/generateLabelZpl';

/**
 * Print stock labels for a stock record
 *
 * Generates WMS labels (4"x2") showing the product name, location, owner,
 * and lot number. Supports printing multiple copies (one per case).
 *
 * @example
 *   await trpcClient.wms.admin.labels.printStockLabel.mutate({
 *     stockId: "uuid",
 *     copies: 4,
 *   });
 */
const adminPrintStockLabel = wmsOperatorProcedure
  .input(
    z.object({
      stockId: z.string().uuid(),
      copies: z.number().int().min(1).max(100).optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const { stockId, copies } = input;

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

    const labelCount = copies ?? 1;

    // Build pack size — per-case when printing multiple, summary when single
    const basePack =
      stock.caseConfig && stock.bottleSize
        ? `${stock.caseConfig}x${stock.bottleSize}`
        : '';
    const packSize =
      labelCount > 1
        ? basePack
          ? `${basePack} | 1 Case`
          : '1 Case'
        : basePack
          ? `${basePack} | ${stock.quantityCases} Cases`
          : `${stock.quantityCases} Cases`;

    // Use LWIN18 as barcode — stable product identifier scannable across the system
    const barcode = stock.lwin18;

    const singleLabel = generateLabelZpl({
      barcode,
      productName: stock.productName,
      lwin18: stock.lwin18,
      packSize,
      vintage: stock.vintage ?? undefined,
      lotNumber: stock.lotNumber ?? undefined,
      locationCode: location?.locationCode ?? undefined,
      owner: stock.ownerName ?? undefined,
    });

    // Repeat label for requested copies
    const zpl = Array.from({ length: labelCount }, () => singleLabel).join(
      '\n',
    );

    return {
      success: true as const,
      zpl,
      productName: stock.productName,
      quantityCases: stock.quantityCases,
    };
  });

export default adminPrintStockLabel;
