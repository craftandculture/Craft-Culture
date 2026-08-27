import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';
import db from '@/database/client';
import { logisticsShipmentItems, lwinWines } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import packFromLwin from '../utils/packFromLwin';
import recalcShipmentTotals from '../utils/recalcShipmentTotals';

const updateItemSchema = z.object({
  itemId: z.string().uuid(),
  productName: z.string().min(1).optional(),
  lwin: z.string().nullable().optional(),
  supplierSku: z.string().nullable().optional(),
  hsCode: z.string().nullable().optional(),
  countryOfOrigin: z.string().nullable().optional(),
  producer: z.string().nullable().optional(),
  vintage: z.number().nullable().optional(),
  region: z.string().nullable().optional(),
  /**
   * Zero is meaningful: a line billed as loose bottles has no case of its own.
   *
   * A minimum of one made the shape unsettable, so every correction to such a
   * line was rejected by the schema before it reached the table.
   */
  cases: z.number().int().min(0).optional(),
  bottlesPerCase: z.number().int().min(1).nullable().optional(),
  bottleSizeMl: z.number().int().min(1).nullable().optional(),
  productCostPerBottle: z.number().nullable().optional(),
  overrideOwnerId: z.string().uuid().nullable().optional(),
  overrideOwnerName: z.string().nullable().optional(),
  /** Null inherits the shipment's setting rather than forcing a choice */
  notForSale: z.boolean().nullable().optional(),
});

/**
 * Update a shipment item's product identification fields
 *
 * Used by Head of Logistics to map LWIN codes and supplier SKUs
 * before goods arrive at warehouse.
 */
const adminUpdateItem = adminProcedure.input(updateItemSchema).mutation(async ({ input }) => {
  const { itemId, ...updateFields } = input;

  // Verify item exists
  const [existingItem] = await db
    .select()
    .from(logisticsShipmentItems)
    .where(eq(logisticsShipmentItems.id, itemId));

  if (!existingItem) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Shipment item not found',
    });
  }

  // Build update object — only include provided fields
  const updateData: Partial<typeof logisticsShipmentItems.$inferInsert> = {
    updatedAt: new Date(),
  };

  const fieldMap = [
    'productName', 'lwin', 'supplierSku', 'hsCode', 'countryOfOrigin',
    'producer', 'vintage', 'region', 'bottlesPerCase', 'bottleSizeMl', 'cases', 'productCostPerBottle',
    'overrideOwnerId', 'overrideOwnerName', 'notForSale',
  ] as const;

  for (const key of fieldMap) {
    if (updateFields[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updateData as any)[key] = updateFields[key];
    }
  }

  // Normalize LWIN to the canonical dashed form (raw 18-digit supplier codes
  // like Cult Wines' would otherwise create duplicate stock lines)
  if (updateData.lwin != null) {
    updateData.lwin = normalizeLwin18(updateData.lwin);
  }

  /**
   * Latching a LWIN settles the pack, because the LWIN already states it.
   *
   * `1148811-0000-02-00750` is a two-bottle pack of 75cl. Reading that off by
   * eye and typing it back in was the manual pass over this shipment — 163
   * lines of transcribing a number the code already carried.
   *
   * The bottle count is held and the cases recomputed, not the other way
   * round: the supplier billed bottles, so bottles are the fact. Anything the
   * caller set explicitly wins, since a correction should not be undone by
   * the code it is correcting.
   */
  const derived =
    updateFields.lwin !== undefined ? packFromLwin(updateData.lwin) : null;

  if (derived) {
    if (updateFields.bottlesPerCase === undefined) {
      updateData.bottlesPerCase = derived.bottlesPerCase;
    }

    if (updateFields.bottleSizeMl === undefined) {
      updateData.bottleSizeMl = derived.bottleSizeMl;
    }

    const bottles = existingItem.totalBottles ?? 0;
    const pack = updateData.bottlesPerCase ?? derived.bottlesPerCase;

    if (bottles > 0 && pack > 0 && updateFields.cases === undefined) {
      /*
        A line carrying no case keeps none.

        Three bottles out of a twelve-pack travel in a mixed carton shared with
        other lines, and only the packer knows how many cartons that makes — so
        the line records zero and the cartons are declared on the shipment.
        Rounding up to one here re-invented exactly the boxes that were removed
        this morning, and did it invisibly: mapping two wines to their LWINs
        walked a reconciled shipment from 11 cases to 13.

        Where the line does have cases, a pack that fails to divide the billed
        bottles is a real finding — a wrong LWIN format or a misread invoice —
        so it rounds up and leaves the bottles alone for someone to see.
      */
      updateData.cases =
        existingItem.cases === 0 ? 0 : Math.max(1, Math.ceil(bottles / pack));
    }

    /*
      A LWIN carries the wine's identity, so latching one fills it in.

      Only the sheet's own search did this, because it had the record in hand
      and passed the producer and region along with the code. Every other way
      of setting a LWIN — the matcher's shortlist, "same wine as the 2003" —
      sends the code alone, so lines mapped that way sat with the right LWIN
      and no producer, region or country, and looked less mapped than their
      neighbours.

      Only blanks are filled. A person who has typed a producer is not
      corrected by a lookup.
    */
    const wineLwin = updateData.lwin?.slice(0, 7);

    if (wineLwin && /^\d{7}$/.test(wineLwin)) {
      const [record] = await db
        .select({
          producerTitle: lwinWines.producerTitle,
          producerName: lwinWines.producerName,
          region: lwinWines.region,
          subRegion: lwinWines.subRegion,
          country: lwinWines.country,
        })
        .from(lwinWines)
        .where(eq(lwinWines.lwin, wineLwin))
        .limit(1);

      if (record) {
        const producer = [record.producerTitle, record.producerName]
          .filter(Boolean)
          .join(' ');

        if (producer && !existingItem.producer && updateFields.producer === undefined) {
          updateData.producer = producer;
        }

        const region = record.subRegion ?? record.region;

        if (region && !existingItem.region && updateFields.region === undefined) {
          updateData.region = region;
        }

        if (
          record.country &&
          !existingItem.countryOfOrigin &&
          updateFields.countryOfOrigin === undefined
        ) {
          updateData.countryOfOrigin = record.country;
        }
      }
    }

    // The vintage is in the code's second field, and a line without one is
    // unsellable — it cannot be matched to stock or priced.
    const codedVintage = Number(updateData.lwin?.split('-')[1] ?? 0);

    if (
      codedVintage > 1000 &&
      !existingItem.vintage &&
      updateFields.vintage === undefined
    ) {
      updateData.vintage = codedVintage;
    }
  }

  // Recalculate totalBottles if cases or bottlesPerCase changed
  const newCases = updateFields.cases ?? existingItem.cases;
  const newBpc = updateFields.bottlesPerCase ?? existingItem.bottlesPerCase ?? 12;
  if (
    !derived &&
    (updateFields.cases !== undefined || updateFields.bottlesPerCase !== undefined) &&
    // Cases times pack is zero for a line billed as loose bottles, and the
    // bottles on it were the one thing the invoice was certain about.
    newCases > 0
  ) {
    updateData.totalBottles = newCases * newBpc;
  }

  // Update the item
  const [updatedItem] = await db
    .update(logisticsShipmentItems)
    .set(updateData)
    .where(eq(logisticsShipmentItems.id, itemId))
    .returning();

  // Recompute shipment totals from line items when cases/pack changed
  if (updateFields.cases !== undefined || updateFields.bottlesPerCase !== undefined) {
    await recalcShipmentTotals(existingItem.shipmentId);
  }

  return updatedItem;
});

export default adminUpdateItem;
