import { and, eq, like, sql } from 'drizzle-orm';

import type db from '@/database/client';
import { wmsCaseLabels } from '@/database/schema';

import generateCaseLabelBarcode from './generateCaseLabelBarcode';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ClaimCaseLabelsParams {
  lwin18: string;
  productName: string;
  lotNumber: string | null;
  shipmentId: string;
  locationId: string;
  count: number;
}

/**
 * The case labels for cases being received: the ones already printed for THIS
 * shipment that no earlier receipt has used, topped up with new ones.
 *
 * Receiving used to take any label of the wine, so the second shipment of a
 * wine was booked in against the first shipment's barcodes — two physical cases
 * answering to one scan. Must run inside the receiving transaction.
 *
 * @returns One label per case
 */
const claimCaseLabels = async (
  tx: Tx,
  {
    lwin18,
    productName,
    lotNumber,
    shipmentId,
    locationId,
    count,
  }: ClaimCaseLabelsParams,
) => {
  // One receiver numbering a wine's labels at a time
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`case_labels_${lwin18}`}))`,
  );

  const barcodePrefix = `CASE-${lwin18}-`;

  const unused = await tx
    .select({ id: wmsCaseLabels.id, barcode: wmsCaseLabels.barcode })
    .from(wmsCaseLabels)
    .where(
      and(
        like(wmsCaseLabels.barcode, `${barcodePrefix}%`),
        eq(wmsCaseLabels.shipmentId, shipmentId),
        eq(wmsCaseLabels.isActive, true),
        sql`NOT EXISTS (
          SELECT 1 FROM wms_stock_movements m
           WHERE m.movement_type = 'receive'
             AND m.scanned_barcodes IS NOT NULL
             AND jsonb_exists(m.scanned_barcodes, ${wmsCaseLabels.barcode})
        )`,
      ),
    )
    .orderBy(wmsCaseLabels.barcode)
    .limit(count);

  const labels: Array<{ id: string; barcode: string }> = [...unused];

  if (labels.length >= count) return labels;

  // Numbered after every label the wine has ever had, from any shipment
  const [highest] = await tx
    .select({
      max: sql<number>`COALESCE(MAX(NULLIF(substring(${wmsCaseLabels.barcode} FROM '([0-9]+)$'), '')::int), 0)`,
    })
    .from(wmsCaseLabels)
    .where(like(wmsCaseLabels.barcode, `${barcodePrefix}%`));

  let sequence = Number(highest?.max ?? 0);

  while (labels.length < count) {
    sequence++;
    const inserted = await tx
      .insert(wmsCaseLabels)
      .values({
        barcode: generateCaseLabelBarcode(lwin18, sequence),
        lwin18,
        productName,
        lotNumber,
        shipmentId,
        currentLocationId: locationId,
        isActive: true,
      })
      .onConflictDoNothing({ target: wmsCaseLabels.barcode })
      .returning({ id: wmsCaseLabels.id, barcode: wmsCaseLabels.barcode });

    if (inserted[0]) labels.push(inserted[0]);
  }

  return labels;
};

export default claimCaseLabels;
