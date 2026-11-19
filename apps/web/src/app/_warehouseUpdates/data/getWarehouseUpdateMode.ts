import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

import { WAREHOUSE_UPDATE_MODE_SETTING } from '../constants';

export type WarehouseUpdateMode = 'off' | 'shadow' | 'live';

/**
 * Which way warehouse updates to distributors go: nowhere, Kevin's inbox, or
 * the distributors themselves
 *
 * Its own key, with no fallback. Off unless it says exactly "shadow" or
 * "live", so a missing row or a failed read never emails anyone.
 */
const getWarehouseUpdateMode = async (): Promise<WarehouseUpdateMode> => {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, WAREHOUSE_UPDATE_MODE_SETTING))
      .limit(1);
    return row?.value === 'shadow' || row?.value === 'live' ? row.value : 'off';
  } catch {
    return 'off';
  }
};

export default getWarehouseUpdateMode;
