import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';

import { WAREHOUSE_UPDATE_PARTNERS_SETTING } from '../constants';
import parseWarehouseUpdatePartners from '../utils/parseWarehouseUpdatePartners';

/**
 * The distributors switched on for warehouse updates, with how each receives
 * them (Partners > edit > Warehouse updates)
 *
 * @returns Preferences by partner id; empty when nobody is switched on
 */
const getWarehouseUpdatePartners = async () => {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, WAREHOUSE_UPDATE_PARTNERS_SETTING))
    .limit(1);
  return parseWarehouseUpdatePartners(row?.value);
};

export default getWarehouseUpdatePartners;
