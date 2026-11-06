import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

/** The settings key for the stock transfer summary switch, set on Order Emails */
export const TRANSFER_SUMMARY_MODE_SETTING = 'transfer_emails.mode';

export type TransferSummaryMode = 'off' | 'shadow' | 'live';

/**
 * Which way the daily stock transfer summaries go: nowhere, Kevin's inbox,
 * or the owners themselves
 *
 * Its own key, with no fallback, because these reach Private Cellar members:
 * nothing goes to a member until Kevin sets it live. Off unless it says
 * exactly "shadow" or "live".
 */
const getTransferSummaryMode = async (): Promise<TransferSummaryMode> => {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, TRANSFER_SUMMARY_MODE_SETTING))
      .limit(1);
    return row?.value === 'shadow' || row?.value === 'live' ? row.value : 'off';
  } catch {
    return 'off';
  }
};

export default getTransferSummaryMode;
