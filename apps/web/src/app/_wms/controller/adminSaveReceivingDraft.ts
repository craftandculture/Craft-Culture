import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { wmsReceivingDrafts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Schema for a single draft item
 */
const draftItemSchema = z.object({
  id: z.string(),
  shipmentItemId: z.string().nullable(),
  baseItemId: z.string().nullable(),
  productName: z.string(),
  producer: z.string().nullable().optional(),
  vintage: z.number().nullable().optional(),
  lwin: z.string().nullable().optional(),
  expectedCases: z.number().int().min(0),
  receivedCases: z.number().int().min(0),
  expectedBottlesPerCase: z.number().int().min(1),
  expectedBottleSizeMl: z.number().int().min(1),
  receivedBottlesPerCase: z.number().int().min(1),
  receivedBottleSizeMl: z.number().int().min(1),
  packChanged: z.boolean(),
  isAddedItem: z.boolean(),
  isChecked: z.boolean(),
  locationId: z.string().uuid().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
  photos: z.array(z.string().url()).optional(),
});

/**
 * Save or update a receiving draft for a shipment
 *
 * Allows receiving to be done over multiple sessions (can take hours)
 * Called automatically when items are checked off
 *
 * @example
 *   await trpcClient.wms.admin.receiving.saveDraft.mutate({
 *     shipmentId: 'uuid',
 *     items: [...],
 *     notes: 'Some notes',
 *   });
 */
const adminSaveReceivingDraft = adminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      items: z.array(draftItemSchema),
      notes: z.string().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { shipmentId, items, notes } = input;

    // Check if draft already exists
    const [existing] = await db
      .select({ id: wmsReceivingDrafts.id })
      .from(wmsReceivingDrafts)
      .where(eq(wmsReceivingDrafts.shipmentId, shipmentId));

    if (existing) {
      // Update existing draft
      await db
        .update(wmsReceivingDrafts)
        .set({
          items,
          notes,
          lastModifiedBy: ctx.user.id,
          lastModifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wmsReceivingDrafts.id, existing.id));

      return { success: true, draftId: existing.id, action: 'updated' as const };
    }

    // Create new draft
    const [draft] = await db
      .insert(wmsReceivingDrafts)
      .values({
        shipmentId,
        items,
        notes,
        lastModifiedBy: ctx.user.id,
        lastModifiedAt: new Date(),
      })
      .returning({ id: wmsReceivingDrafts.id });

    return { success: true, draftId: draft.id, action: 'created' as const };
  });

export default adminSaveReceivingDraft;
