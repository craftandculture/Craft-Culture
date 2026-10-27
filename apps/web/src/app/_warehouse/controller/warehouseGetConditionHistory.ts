import { publicProcedure } from '@/lib/trpc/procedures';

import getConditionHistory from '../data/getConditionHistory';

/**
 * The cold rooms' temperature and humidity over the last 30 days
 *
 * Public, like the live readings: the conditions are a commitment we make to
 * everyone, not a member's private record.
 *
 * @example
 *   const { points } = await api.warehouse.getConditionHistory.query();
 */
const warehouseGetConditionHistory = publicProcedure.query(async () => ({
  points: await getConditionHistory(),
}));

export default warehouseGetConditionHistory;
