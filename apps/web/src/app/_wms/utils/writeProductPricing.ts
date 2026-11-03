import { and, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  wmsOwnerProductPricing,
  wmsProductPricing,
  wmsStock,
} from '@/database/schema';

import lwinPakKey from './lwinPakKey';
import ownerPricingReady from './ownerPricingReady';
import pakKeyOf from './pakKeyOf';

type PricingFields = Partial<typeof wmsProductPricing.$inferInsert>;

/** The fields an owner can hold their own value of */
const OWNER_FIELDS = [
  'importPricePerBottle',
  'costOverridePerBottle',
  'logisticsPerBottle',
  'transferPricePerBottle',
  'sellingPricePerBottle',
  'sellMarginPct',
  'b2bMarginPct',
  'pcMarginPct',
] as const;

type OwnerField = (typeof OWNER_FIELDS)[number];

/**
 * Write a wine's pricing to the row that reads will find
 *
 * Reads join `wms_product_pricing` pack-agnostically; writing by exact LWIN18
 * landed edits on a row nobody read. So the row matching the pack-agnostic key
 * is updated, and one is created only when none exists.
 *
 * With an owner, and a wine more than one owner holds, the write is that
 * owner's alone. The first such write gives every holder their own row,
 * copied from the shared one, so nobody's price moves when it is forked;
 * from then on each owner's row is the one read and written. A wine held by
 * one owner keeps its single shared row exactly as before.
 *
 * @example
 *   await writeProductPricing({ lwin18, ownerId, set: { costOverridePerBottle: 11.64 }, userId });
 *
 * @param lwin18 - Any pack of the wine
 * @param set - The fields to write
 * @param userId - Who is writing
 * @param ownerId - The partner whose holding this is, where known
 * @returns How many rows were written, and whether it was one owner's own
 */
const writeProductPricing = async ({
  lwin18,
  set,
  userId,
  ownerId,
}: {
  lwin18: string;
  set: PricingFields;
  userId: string;
  ownerId?: string | null;
}) => {
  const pakKey = pakKeyOf(lwin18);

  if (ownerId && (await ownerPricingReady())) {
    const holders = await db
      .selectDistinct({ ownerId: wmsStock.ownerId })
      .from(wmsStock)
      .where(sql`${lwinPakKey(wmsStock.lwin18)} = ${pakKey}`);
    const forked = await db
      .select({ ownerId: wmsOwnerProductPricing.ownerId })
      .from(wmsOwnerProductPricing)
      .where(eq(wmsOwnerProductPricing.pakKey, pakKey));

    const owners = new Set(
      [...holders, ...forked]
        .map((row) => row.ownerId)
        .filter((id): id is string => Boolean(id)),
    );

    owners.add(ownerId);

    if (owners.size > 1 || forked.length > 0) {
      const [shared] = await db
        .select()
        .from(wmsProductPricing)
        .where(sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${pakKey}`)
        .limit(1);

      /* Every holder starts from the shared figures, so the fork moves nothing */
      const seed = Object.fromEntries(
        OWNER_FIELDS.map((field) => [field, shared?.[field] ?? null]),
      ) as Record<OwnerField, number | null>;

      for (const holder of owners) {
        await db
          .insert(wmsOwnerProductPricing)
          .values({ ownerId: holder, pakKey, lwin18, ...seed, updatedBy: userId })
          .onConflictDoNothing();
      }

      const own = Object.fromEntries(
        OWNER_FIELDS.filter((field) => field in set).map((field) => [
          field,
          set[field] ?? null,
        ]),
      );

      if (Object.keys(own).length > 0) {
        await db
          .update(wmsOwnerProductPricing)
          .set({ ...own, updatedBy: userId, updatedAt: new Date() })
          .where(
            and(
              eq(wmsOwnerProductPricing.ownerId, ownerId),
              eq(wmsOwnerProductPricing.pakKey, pakKey),
            ),
          );
      }

      /*
        Anything that is not an owner's own (release, notes, the import's
        source) still belongs to the wine, on the shared row.
      */
      const rest = Object.fromEntries(
        Object.entries(set).filter(
          ([field]) => !(OWNER_FIELDS as readonly string[]).includes(field),
        ),
      ) as PricingFields;

      if (Object.keys(rest).length > 0) {
        await writeProductPricing({ lwin18, set: rest, userId });
      }

      return { rows: 1, ownerOnly: true, sharedWith: owners.size - 1 };
    }
  }

  const updated = await db
    .update(wmsProductPricing)
    .set({ ...set, updatedBy: userId, updatedAt: new Date() })
    .where(sql`${lwinPakKey(wmsProductPricing.lwin18)} = ${pakKey}`)
    .returning({ lwin18: wmsProductPricing.lwin18 });

  if (updated.length > 0) {
    return { rows: updated.length, ownerOnly: false, sharedWith: 0 };
  }

  await db.insert(wmsProductPricing).values({
    lwin18,
    // Required by the table; a real import price arrives with its own write.
    importPricePerBottle: 0,
    ...set,
    updatedBy: userId,
  });

  return { rows: 1, ownerOnly: false, sharedWith: 0 };
};

export default writeProductPricing;
