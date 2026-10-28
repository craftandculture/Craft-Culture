import { createTRPCRouter } from '@/lib/trpc/trpc';

import warehouseGetConditionHistory from './controller/warehouseGetConditionHistory';
import warehouseGetLatestReadings from './controller/warehouseGetLatestReadings';

const warehouseRouter = createTRPCRouter({
  getLatestReadings: warehouseGetLatestReadings,
  getConditionHistory: warehouseGetConditionHistory,
});

export default warehouseRouter;
