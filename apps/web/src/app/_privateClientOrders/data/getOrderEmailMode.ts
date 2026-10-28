import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

import type { OrderEmailAudience } from '../utils/orderEmailTypes';

/**
 * The settings key for the order email switch. Each audience has its own,
 * `pco_emails.mode.partner` and `pco_emails.mode.distributor`; this shared key
 * is what either falls back to when its own is unset.
 */
export const ORDER_EMAIL_MODE_SETTING = 'pco_emails.mode';

export const ORDER_EMAIL_MODES = ['off', 'shadow', 'live'] as const;

export type OrderEmailMode = (typeof ORDER_EMAIL_MODES)[number];

/** Where shadow emails go: Kevin's inbox, never a partner or distributor */
export const ORDER_EMAIL_SHADOW_INBOX = 'kevin@craftculture.xyz';

/**
 * Which way the new order emails to one audience go: nowhere, Kevin's inbox,
 * or the wine partners (or distributors) themselves
 *
 * Wine partners and distributors have a switch each, so one can be live while
 * the other is still checked in shadow. Off unless the setting says exactly
 * "shadow" or "live", so a missing row or a failed read never emails anyone.
 * While an audience is anything but live, the older per-event emails keep
 * reaching it; going live switches those off (isLegacyOrderEmailOn).
 *
 * @param audience - Wine partners or distributors
 */
const getOrderEmailMode = async (audience: OrderEmailAudience): Promise<OrderEmailMode> => {
  try {
    const own = `${ORDER_EMAIL_MODE_SETTING}.${audience}`;
    const rows = await db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(inArray(settings.key, [own, ORDER_EMAIL_MODE_SETTING]));

    const value = rows.find((row) => row.key === own)?.value ?? rows.find((row) => row.key === ORDER_EMAIL_MODE_SETTING)?.value;
    return value === 'shadow' || value === 'live' ? value : 'off';
  } catch {
    return 'off';
  }
};

export default getOrderEmailMode;
