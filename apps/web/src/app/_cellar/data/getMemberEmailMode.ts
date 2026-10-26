import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

/** The settings key for the member email switch */
export const MEMBER_EMAIL_MODE_SETTING = 'cellar_emails.mode';

export const MEMBER_EMAIL_MODES = ['off', 'shadow', 'live'] as const;

export type MemberEmailMode = (typeof MEMBER_EMAIL_MODES)[number];

/** Where shadow emails go: the team inbox, never a member */
export const MEMBER_EMAIL_SHADOW_INBOX = 'cellar@craftculture.xyz';

/**
 * Which way member emails go: nowhere, the team inbox, or the member
 *
 * Off unless the setting says exactly "shadow" or "live", so a missing row, a
 * typo or a failed read keeps members' inboxes untouched. A deploy never
 * changes it; only Kevin does, from the Member Emails screen.
 */
const getMemberEmailMode = async (): Promise<MemberEmailMode> => {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, MEMBER_EMAIL_MODE_SETTING))
      .limit(1);

    return row?.value === 'shadow' || row?.value === 'live' ? row.value : 'off';
  } catch {
    return 'off';
  }
};

export default getMemberEmailMode;
