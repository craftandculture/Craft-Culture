import { publicProcedure } from '@/lib/trpc/procedures';

import getLatestSensorReadings from '../data/getLatestSensorReadings';

/**
 * Get latest sensor readings from warehouse
 *
 * Public endpoint that returns the most recent reading for each sensor.
 * Updates in real-time as Home Assistant pushes new data.
 *
 * @example
 *   const readings = await api.warehouse.getLatestReadings.query();
 */
const warehouseGetLatestReadings = publicProcedure.query(async () => {
  const readings = await getLatestSensorReadings();

  return {
    readings,
    timestamp: new Date(),
  };
});

export default warehouseGetLatestReadings;
