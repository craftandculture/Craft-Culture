import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

const clean = (value: string | null | undefined) => value?.trim() || null;

/**
 * Update the details a member maintains about themselves
 *
 * Writes to the member's own partner record and nowhere else — the id comes
 * from the session rather than the request, so a member cannot edit an account
 * that is not theirs.
 *
 * Every field is optional and only applied when present, so the delivery panel
 * in the cellar can save an address without blanking the phone number it never
 * showed.
 */
const memberSaveProfile = stockOwnerProcedure
  .input(
    z.object({
      phone: z.string().max(60).nullable().optional(),
      deliveryAddress: z.string().max(500).nullable().optional(),
      deliveryInstructions: z.string().max(500).nullable().optional(),
      eidNumber: z.string().max(60).nullable().optional(),
      /** ISO date; the card's own expiry, so we can warn before it lapses */
      eidExpiry: z.string().nullable().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (input.phone !== undefined) updates.businessPhone = clean(input.phone);
    if (input.deliveryAddress !== undefined)
      updates.deliveryAddress = clean(input.deliveryAddress);
    if (input.deliveryInstructions !== undefined)
      updates.deliveryInstructions = clean(input.deliveryInstructions);
    if (input.eidNumber !== undefined)
      updates.eidNumber = clean(input.eidNumber);
    if (input.eidExpiry !== undefined) {
      const parsed = input.eidExpiry ? new Date(input.eidExpiry) : null;
      updates.eidExpiry =
        parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }

    await db
      .update(partners)
      .set(updates)
      .where(eq(partners.id, ctx.partner.id));

    return { saved: true };
  });

export default memberSaveProfile;
