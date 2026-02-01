import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsCaseLabels, wmsLocations } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import generateCaseLabelBarcode from '../utils/generateCaseLabelBarcode';
import generateLabelZpl, { type LabelData } from '../utils/generateLabelZpl';

/**
 * Create case labels for a product during receiving
 *
 * Generates unique barcodes, stores labels in database, and returns ZPL for printing.
 *
 * @example
 *   await trpcClient.wms.admin.labels.createCaseLabels.mutate({
 *     shipmentId: "uuid",
 *     productName: "Château Margaux 2015",
 *     lwin18: "1010279-2015-06-00750",
 *     packSize: "6x75cl",
 *     lotNumber: "2026-01-31-001",
 *     locationId: "uuid",
 *     quantity: 3,
 *   });
 */
const adminCreateCaseLabels = adminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      productName: z.string().min(1),
      lwin18: z.string().min(1),
      packSize: z.string().optional(),
      lotNumber: z.string().optional(),
      locationId: z.string().uuid(),
      quantity: z.number().int().min(1).max(100),
    }),
  )
  .mutation(async ({ input }) => {
    const { shipmentId, productName, lwin18, packSize, lotNumber, locationId, quantity } = input;

    // Get the location code for the label
    const [location] = await db
      .select({ locationCode: wmsLocations.locationCode })
      .from(wmsLocations)
      .where(eq(wmsLocations.id, locationId));

    const locationCode = location?.locationCode ?? '';

    // Get the current max sequence for this LWIN across ALL labels (globally unique)
    const [maxSeqResult] = await db
      .select({
        maxSeq: sql<number>`COALESCE(MAX(CAST(SPLIT_PART(${wmsCaseLabels.barcode}, '-', -1) AS INTEGER)), 0)`,
      })
      .from(wmsCaseLabels)
      .where(eq(wmsCaseLabels.lwin18, lwin18));

    let currentSeq = maxSeqResult?.maxSeq ?? 0;

    // Create labels
    const labelsToInsert: Array<{
      barcode: string;
      lwin18: string;
      productName: string;
      lotNumber: string | null;
      shipmentId: string;
      currentLocationId: string;
      printedAt: Date;
    }> = [];

    const labelDataForZpl: LabelData[] = [];

    for (let i = 0; i < quantity; i++) {
      currentSeq += 1;
      const barcode = generateCaseLabelBarcode(lwin18, currentSeq);

      labelsToInsert.push({
        barcode,
        lwin18,
        productName,
        lotNumber: lotNumber ?? null,
        shipmentId,
        currentLocationId: locationId,
        printedAt: new Date(),
      });

      labelDataForZpl.push({
        barcode,
        productName,
        lwin18,
        packSize: packSize ?? '',
        lotNumber,
        locationCode,
      });
    }

    // Insert all labels
    const insertedLabels = await db.insert(wmsCaseLabels).values(labelsToInsert).returning({
      id: wmsCaseLabels.id,
      barcode: wmsCaseLabels.barcode,
    });

    // Generate ZPL for all labels
    const zplCommands = labelDataForZpl.map((data) => generateLabelZpl(data));
    const combinedZpl = zplCommands.join('\n');

    return {
      success: true,
      labels: insertedLabels,
      quantity: insertedLabels.length,
      zpl: combinedZpl,
    };
  });

export default adminCreateCaseLabels;
