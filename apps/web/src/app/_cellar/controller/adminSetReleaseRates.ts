import { eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarReleaseRates } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Set the rate card a member's releases are priced from
 *
 * Passing no partner sets the house default, which every member without a card
 * of their own falls back to.
 */
const adminSetReleaseRates = adminProcedure
  .input(
    z.object({
      partnerId: z.string().uuid().nullable(),
      version: z.string().min(1).max(60).default('v1'),
      dutyPct: z.number().min(0).max(200).default(0),
      vatPct: z.number().min(0).max(100).default(0),
      distributorMarginPct: z.number().min(0).max(200).default(0),
      ccMarginPct: z.number().min(0).max(200).default(0),
      transferPerBottle: z.number().min(0).default(0),
      deliveryFlat: z.number().min(0).default(0),
      deliveryPerCase: z.number().min(0).default(0),
      notes: z.string().max(500).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { partnerId, ...rates } = input;

    const [existing] = await db
      .select({ id: cellarReleaseRates.id })
      .from(cellarReleaseRates)
      .where(
        partnerId
          ? eq(cellarReleaseRates.partnerId, partnerId)
          : isNull(cellarReleaseRates.partnerId),
      )
      .limit(1);

    if (existing) {
      await db
        .update(cellarReleaseRates)
        .set({ ...rates, updatedBy: ctx.user.id, updatedAt: new Date() })
        .where(eq(cellarReleaseRates.id, existing.id));

      return { updated: true };
    }

    await db
      .insert(cellarReleaseRates)
      .values({ partnerId, ...rates, updatedBy: ctx.user.id });

    return { updated: false };
  });

export default adminSetReleaseRates;
