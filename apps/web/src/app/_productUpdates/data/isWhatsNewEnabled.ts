import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

/** The settings key that shows What's New to Private Cellar members */
export const WHATS_NEW_SETTING = 'whats_new.cellar_enabled';

/**
 * Whether members see What's New
 *
 * Off unless the setting says exactly "true", so a missing row or a typo keeps
 * the page hidden. Only Kevin turns it on, from the Member Updates screen.
 */
const isWhatsNewEnabled = async () => {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, WHATS_NEW_SETTING))
    .limit(1);

  return row?.value === 'true';
};

export default isWhatsNewEnabled;
