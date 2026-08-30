import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsProductPricing } from '@/database/schema';

import lwinPakKey from './lwinPakKey';
import pakKeyOf from './pakKeyOf';

type PricingFields = Partial<typeof wmsProductPricing.$inferInsert>;

/**
 * Write a pricing change to the row the screen is actually reading
 *
 * Every read joins `wms_product_pricing` pack-agnostically — a price is per
 * bottle, so it belongs to the wine, vintage and bottle size rather than to the
 * pack it happens to sit in, and a repacked six into singles must inherit it.
 * Every write, though, keyed on the exact LWIN18 and upserted on that
 * conflict.
 *
 * So a wine whose price row was created as a 6-pack could not be edited from
 * its 2-pack line: the write minted a second row nobody read, the read took
 * MAX() across both and kept returning the old figure, and the edit appeared to
 * be rejected. Clearing a cost override did nothing at all, because the value
 * being displayed lived on the row the write never touched.
 *
 * The change is applied to every row sharing the pack-agnostic key, and a row
 * is created only when there is none — so the duplicates already minted are
 * brought into line rather than left to shadow the correct value.
 *
 * @example
 *   await writeProductPricing({
 *     lwin18: '1104653-2020-02-00750',
 *     set: { costOverridePerBottle: null },
 *     userId: ctx.user.id,
 *   });
 *
 * @param input - The line, the fields to set, and who set them
 * @returns How many pricing rows the change reached
 */
const writeProductPricing = async ({
  lwin18,
  set,
  userId,
}: {
  lwin18: string;
  set: PricingFields;
  userId: string;
}) => {
  const updated = await db
    .update(wmsProductPricing)
    .set({ ...set, updatedBy: userId, updatedAt: new Date() })
    .where(sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${pakKeyOf(lwin18)}`)
    .returning({ lwin18: wmsProductPricing.lwin18 });

  if (updated.length > 0) return updated.length;

  await db.insert(wmsProductPricing).values({
    lwin18,
    // Required by the table; a real import price arrives with its own write.
    importPricePerBottle: 0,
    ...set,
    updatedBy: userId,
  });

  return 1;
};

export default writeProductPricing;
