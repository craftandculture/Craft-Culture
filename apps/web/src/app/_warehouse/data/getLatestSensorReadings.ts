import { desc, gte, sql } from 'drizzle-orm';

import db from '@/database/client';
import { warehouseSensorReadings } from '@/database/schema';

/**
 * Get the latest reading for each sensor that has reported recently
 *
 * One row per sensor via DISTINCT ON. This used to take the first 100 rows in
 * sensor-id order and pick the newest per sensor from those, so once a sensor
 * had 100 readings stored, every sensor after it alphabetically fell off the
 * feed. Only readings from the last two hours count: a sensor that has gone
 * quiet, or been dropped from Home Assistant, stops showing a stale value.
 *
 * @example
 *   const latest = await getLatestSensorReadings();
 *   // [{ sensorId: 'cold_room_front_temperature', location: 'Cold Room – Front', value: 12.9, ... }]
 */
const getLatestSensorReadings = async () => {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);

  return db
    .selectDistinctOn([warehouseSensorReadings.sensorId])
    .from(warehouseSensorReadings)
    .where(gte(warehouseSensorReadings.timestamp, since))
    .orderBy(
      warehouseSensorReadings.sensorId,
      desc(warehouseSensorReadings.timestamp),
      sql`${warehouseSensorReadings.id}`,
    );
};

export default getLatestSensorReadings;
