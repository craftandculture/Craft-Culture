import { createTRPCRouter } from '@/lib/trpc/trpc';

import warehouseGetLatestReadings from './controller/warehouseGetLatestReadings';

const warehouseRouter = createTRPCRouter({
  getLatestReadings: warehouseGetLatestReadings,
});

export default warehouseRouter;
