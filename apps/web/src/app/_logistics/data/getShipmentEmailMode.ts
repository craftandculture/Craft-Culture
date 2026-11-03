import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

/** The settings key for the shipment email switch, set on Order Emails */
export const SHIPMENT_EMAIL_MODE_SETTING = 'logistics_emails.mode.partner';

export type ShipmentEmailMode = 'off' | 'shadow' | 'live';

/**
 * Which way wine partners' shipment emails and notices go: nowhere, Kevin's
 * inbox, or the partners themselves
 *
 * Its own key, with no fallback: the order emails' shared key being live must
 * never switch these on. Off unless it says exactly "shadow" or "live".
 */
const getShipmentEmailMode = async (): Promise<ShipmentEmailMode> => {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, SHIPMENT_EMAIL_MODE_SETTING))
      .limit(1);
    return row?.value === 'shadow' || row?.value === 'live' ? row.value : 'off';
  } catch {
    return 'off';
  }
};

export default getShipmentEmailMode;
