import db from '@/database/client';
import { wmsOwnerPricingSettings } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { setOwnerPricingSettingsSchema } from '../schemas/pricingManagerSchema';

/**
 * Upsert an owner's pricing settings — logistics $/btl, in-bond margin % and
 * PC margin %. These drive that owner's landed cost and selling tiers in the
 * Pricing Manager (e.g. Crurated at low logistics + 3% margins, Cru higher).
 *
 * @param ownerId - The partner/owner UUID
 * @param logisticsPerBottle - Flat logistics cost per bottle
 * @param inbondMarginPct - In-bond (B2B) margin percentage on landed cost
 * @param pcMarginPct - Private-client margin percentage on landed cost (optional)
 */
const adminSetOwnerPricingSettings = wmsOperatorProcedure
  .input(setOwnerPricingSettingsSchema)
  .mutation(async ({ input, ctx }) => {
    const { ownerId, logisticsPerBottle, inbondMarginPct, pcMarginPct } = input;

    await db
      .insert(wmsOwnerPricingSettings)
      .values({
        ownerId,
        logisticsPerBottle,
        inbondMarginPct,
        pcMarginPct: pcMarginPct ?? null,
        updatedBy: ctx.user.id,
      })
      .onConflictDoUpdate({
        target: wmsOwnerPricingSettings.ownerId,
        set: {
          logisticsPerBottle,
          inbondMarginPct,
          pcMarginPct: pcMarginPct ?? null,
          updatedBy: ctx.user.id,
          updatedAt: new Date(),
        },
      });

    return { ownerId, logisticsPerBottle, inbondMarginPct, pcMarginPct: pcMarginPct ?? null };
  });

export default adminSetOwnerPricingSettings;
