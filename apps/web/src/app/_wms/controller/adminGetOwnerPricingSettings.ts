import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { wmsOwnerPricingSettings } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { getOwnerPricingSettingsSchema } from '../schemas/pricingManagerSchema';

/** Global fallback settings when an owner has no stored row */
const DEFAULT_SETTINGS = {
  logisticsPerBottle: 25,
  inbondMarginPct: 10,
  pcMarginPct: null as number | null,
};

/**
 * Get an owner's pricing settings (logistics $/btl, in-bond margin %, PC margin %).
 * Returns global defaults when the owner has no stored settings.
 *
 * @param ownerId - The partner/owner UUID
 */
const adminGetOwnerPricingSettings = wmsOperatorProcedure
  .input(getOwnerPricingSettingsSchema)
  .query(async ({ input }) => {
    const [row] = await db
      .select()
      .from(wmsOwnerPricingSettings)
      .where(eq(wmsOwnerPricingSettings.ownerId, input.ownerId))
      .limit(1);

    if (!row) {
      return { ownerId: input.ownerId, ...DEFAULT_SETTINGS, isDefault: true };
    }

    return {
      ownerId: row.ownerId,
      logisticsPerBottle: row.logisticsPerBottle,
      inbondMarginPct: row.inbondMarginPct,
      pcMarginPct: row.pcMarginPct,
      isDefault: false,
    };
  });

export default adminGetOwnerPricingSettings;
