import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsCaseLabels, wmsStock } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import generateLabelZpl, { type LabelData } from '../utils/generateLabelZpl';

/**
 * Reprint case labels for existing stock at a location
 *
 * Finds existing case labels by lwin18 and location, and generates ZPL for reprinting.
 * Does NOT create new labels - only reprints existing ones.
 *
 * @example
 *   await trpcClient.wms.admin.labels.reprintCaseLabels.mutate({
 *     stockId: "uuid",
 *   });
 */
const adminReprintCaseLabels = adminProcedure
  .input(
    z.object({
      stockId: z.string().uuid(),
    }),
  )
  .mutation(async ({ input }) => {
    const { stockId } = input;

    // Get the stock record to find lwin18 and locationId
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
        success: false,
        error: 'Stock record not found',
        labels: [],
        quantity: 0,
        zpl: '',
      };
    }

    // Find existing case labels for this product at this location
    const existingLabels = await db
      .select({
        id: wmsCaseLabels.id,
        barcode: wmsCaseLabels.barcode,
        lwin18: wmsCaseLabels.lwin18,
        productName: wmsCaseLabels.productName,
        lotNumber: wmsCaseLabels.lotNumber,
      })
      .from(wmsCaseLabels)
      .where(
        and(
          eq(wmsCaseLabels.lwin18, stock.lwin18),
          eq(wmsCaseLabels.currentLocationId, stock.locationId),
        ),
      )
      .orderBy(wmsCaseLabels.barcode);

    if (existingLabels.length === 0) {
      return {
        success: false,
        error: 'No case labels found for this stock. Labels may have been created before the labeling system was implemented.',
        labels: [],
        quantity: 0,
        zpl: '',
      };
    }

    // Build pack size string
    const packSize = stock.caseConfig && stock.bottleSize
      ? `${stock.caseConfig}x${stock.bottleSize}`
      : '';

    // Generate ZPL for all existing labels
    const labelDataForZpl: LabelData[] = existingLabels.map((label) => ({
      barcode: label.barcode,
      productName: label.productName,
      lwin18: label.lwin18,
      packSize,
      vintage: stock.vintage ?? undefined,
      lotNumber: label.lotNumber ?? undefined,
      owner: stock.ownerName,
    }));

    const zplCommands = labelDataForZpl.map((data) => generateLabelZpl(data));
    const combinedZpl = zplCommands.join('\n');

    return {
      success: true,
      labels: existingLabels.map((l) => ({ id: l.id, barcode: l.barcode })),
      quantity: existingLabels.length,
      zpl: combinedZpl,
    };
  });

export default adminReprintCaseLabels;
