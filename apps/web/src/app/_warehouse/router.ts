import { router } from '@/lib/trpc';

import warehouseGetLatestReadings from './controller/warehouseGetLatestReadings';

const warehouseRouter = router({
  getLatestReadings: warehouseGetLatestReadings,
});

export default warehouseRouter;
