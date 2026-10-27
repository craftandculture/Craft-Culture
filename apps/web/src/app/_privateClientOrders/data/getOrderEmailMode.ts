import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

/** The settings key for the order email switch */
export const ORDER_EMAIL_MODE_SETTING = 'pco_emails.mode';

export const ORDER_EMAIL_MODES = ['off', 'shadow', 'live'] as const;

export type OrderEmailMode = (typeof ORDER_EMAIL_MODES)[number];

/** Where shadow emails go: Kevin's inbox, never a partner or distributor */
export const ORDER_EMAIL_SHADOW_INBOX = 'kevin@craftculture.xyz';

/**
 * Which way the new order emails go: nowhere, Kevin's inbox, or the parties
 *
 * Off unless the setting says exactly "shadow" or "live", so a missing row or
 * a failed read never emails a partner. While it is anything but live, the
 * older per-event emails keep sending as they always have; going live switches
 * those off (isLegacyOrderEmailOn) so nobody receives both.
 */
const getOrderEmailMode = async (): Promise<OrderEmailMode> => {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, ORDER_EMAIL_MODE_SETTING))
      .limit(1);

    return row?.value === 'shadow' || row?.value === 'live' ? row.value : 'off';
  } catch {
    return 'off';
  }
};

export default getOrderEmailMode;
