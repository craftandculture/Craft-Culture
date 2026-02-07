import { eq, like, sql } from 'drizzle-orm';
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
      vintage: z.number().optional(),
      lotNumber: z.string().optional(),
      locationId: z.string().uuid(),
      quantity: z.number().int().min(1).max(100),
    }),
  )
  .mutation(async ({ input }) => {
    const { shipmentId, productName, lwin18, packSize, vintage, lotNumber, locationId, quantity } = input;

    console.log('[createCaseLabels] Starting label creation', { lwin18, quantity, shipmentId });

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
      console.log('[createCaseLabels] Acquiring advisory lock', { lockKey, lwin18 });
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
      console.log('[createCaseLabels] Advisory lock acquired');

      // Query by BARCODE PREFIX instead of lwin18 field to catch all potential conflicts
      // This is more robust because the unique constraint is on barcode, not on lwin18
      const barcodePrefix = `CASE-${lwin18}-`;

      console.log('[createCaseLabels] Searching for existing labels with barcode prefix', { barcodePrefix });

      // Find all existing labels that START WITH this barcode prefix
      const existingLabels = await tx
        .select({
          barcode: wmsCaseLabels.barcode,
          lwin18: wmsCaseLabels.lwin18,
        })
        .from(wmsCaseLabels)
        .where(like(wmsCaseLabels.barcode, `${barcodePrefix}%`));

      console.log('[createCaseLabels] Existing labels with matching barcode prefix', {
        barcodePrefix,
        count: existingLabels.length,
        barcodes: existingLabels.map((l) => l.barcode),
        lwin18Values: existingLabels.map((l) => l.lwin18),
      });

      // Get max sequence from barcodes that match the prefix
      // This catches ALL labels that would conflict, regardless of their lwin18 field value
      const [maxSeqResult] = await tx
        .select({
          maxSeq: sql<number>`COALESCE(MAX(CAST(SUBSTRING(${wmsCaseLabels.barcode} FROM '[0-9]+$') AS INTEGER)), 0)`,
        })
        .from(wmsCaseLabels)
        .where(like(wmsCaseLabels.barcode, `${barcodePrefix}%`));

      console.log('[createCaseLabels] Max sequence query result', { maxSeqResult, rawMaxSeq: maxSeqResult?.maxSeq });

      // Also calculate max sequence in JavaScript as a backup/verification
      let jsMaxSeq = 0;
      for (const label of existingLabels) {
        const match = label.barcode.match(/(\d+)$/);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > jsMaxSeq) jsMaxSeq = seq;
        }
      }

      const sqlMaxSeq = maxSeqResult?.maxSeq ?? 0;

      // Use the higher of the two to be safe
      let currentSeq = Math.max(sqlMaxSeq, jsMaxSeq);

      console.log('[createCaseLabels] Sequence comparison', {
        sqlMaxSeq,
        jsMaxSeq,
        usingSeq: currentSeq,
        willGenerate: `${currentSeq + 1} to ${currentSeq + quantity}`,
      });

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
          vintage,
          lotNumber,
          locationCode,
        });
      }

      console.log('[createCaseLabels] Barcodes to insert', {
        barcodes: labelsToInsert.map((l) => l.barcode),
      });

      // Insert all labels within the transaction
      try {
        const insertedLabels = await tx.insert(wmsCaseLabels).values(labelsToInsert).returning({
          id: wmsCaseLabels.id,
          barcode: wmsCaseLabels.barcode,
        });

        console.log('[createCaseLabels] Successfully inserted labels', {
          count: insertedLabels.length,
          barcodes: insertedLabels.map((l) => l.barcode),
        });

        return { insertedLabels, labelDataForZpl };
      } catch (insertError) {
        console.error('[createCaseLabels] INSERT FAILED', {
          error: insertError,
          attemptedBarcodes: labelsToInsert.map((l) => l.barcode),
          lwin18,
          existingBarcodes: existingLabels.map((l) => l.barcode),
          maxSeqFound: maxSeqResult?.maxSeq,
        });
        throw insertError;
      }
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
