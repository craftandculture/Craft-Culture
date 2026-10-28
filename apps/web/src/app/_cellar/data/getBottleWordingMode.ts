import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

/** The settings key for the cellar's bottles-not-cases wording */
export const BOTTLE_WORDING_MODE_SETTING = 'cellar_bottle_wording.mode';

export const BOTTLE_WORDING_MODES = ['off', 'staff', 'live'] as const;

export type BottleWordingMode = (typeof BOTTLE_WORDING_MODES)[number];

/**
 * Who sees the cellar counted in bottles rather than cases
 *
 * Staff only unless the setting says exactly "off" or "live", so a missing
 * row, a typo or a failed read never changes what a member sees. Members get
 * the new wording only once Kevin turns it to live on the Member Emails screen.
 */
const getBottleWordingMode = async (): Promise<BottleWordingMode> => {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, BOTTLE_WORDING_MODE_SETTING))
      .limit(1);

    return row?.value === 'off' || row?.value === 'live' ? row.value : 'staff';
  } catch {
    return 'staff';
  }
};

export default getBottleWordingMode;
