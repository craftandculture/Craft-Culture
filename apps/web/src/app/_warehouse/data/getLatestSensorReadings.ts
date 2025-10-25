import { desc } from 'drizzle-orm';

import db from '@/database/client';
import { warehouseSensorReadings } from '@/database/schema';

/**
 * Get the latest sensor reading for each unique sensor
 *
 * Returns the most recent reading for each sensor_id, useful for
 * displaying current warehouse conditions in real-time
 *
 * @example
 *   const latest = await getLatestSensorReadings();
 *   // Returns: [
 *   //   { sensor_id: 'warehouse_temp_1', value: 16.5, ... },
 *   //   { sensor_id: 'warehouse_humidity_1', value: 65.2, ... }
 *   // ]
 */
const getLatestSensorReadings = async () => {
  // Use DISTINCT ON to get latest reading per sensor
  const latestReadings = await db
    .select()
    .from(warehouseSensorReadings)
    .orderBy(
      warehouseSensorReadings.sensorId,
      desc(warehouseSensorReadings.timestamp),
    )
    .limit(100);

  // Group by sensor_id and keep only the latest
  const uniqueReadings = latestReadings.reduce(
    (acc, reading) => {
      if (!acc[reading.sensorId]) {
        acc[reading.sensorId] = reading;
      }
      return acc;
    },
    {} as Record<string, typeof latestReadings[0]>,
  );

  return Object.values(uniqueReadings);
};

export default getLatestSensorReadings;
