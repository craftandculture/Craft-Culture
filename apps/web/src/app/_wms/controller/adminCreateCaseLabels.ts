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
 * Uses a database transaction with row-level locking to prevent race conditions.
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

    // Use a transaction with advisory lock to prevent race conditions
    // Advisory locks are lightweight and perfect for preventing concurrent sequence generation
    const result = await db.transaction(async (tx) => {
      // Get an advisory lock based on the LWIN18 hash to prevent concurrent inserts for same product
      // This ensures only one request at a time can generate sequences for a specific LWIN18
      const lockKey = Buffer.from(lwin18).reduce((acc, byte) => acc + byte, 0) % 2147483647;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

      // Now safely get the current max sequence for this LWIN across ALL labels
      // Barcode format: CASE-{LWIN18}-{SEQ} where SEQ is the last segment
      const [maxSeqResult] = await tx
        .select({
          maxSeq: sql<number>`COALESCE(MAX(CAST(SUBSTRING(${wmsCaseLabels.barcode} FROM '[0-9]+$') AS INTEGER)), 0)`,
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

      // Insert all labels within the transaction
      const insertedLabels = await tx.insert(wmsCaseLabels).values(labelsToInsert).returning({
        id: wmsCaseLabels.id,
        barcode: wmsCaseLabels.barcode,
      });

      return { insertedLabels, labelDataForZpl };
    });

    // Generate ZPL for all labels (outside transaction for performance)
    const zplCommands = result.labelDataForZpl.map((data) => generateLabelZpl(data));
    const combinedZpl = zplCommands.join('\n');

    return {
      success: true,
      labels: result.insertedLabels,
      quantity: result.insertedLabels.length,
      zpl: combinedZpl,
    };
  });

export default adminCreateCaseLabels;
