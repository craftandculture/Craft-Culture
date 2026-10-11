import { desc, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { warehouseSensorReadings } from '@/database/schema';
import postSlackWebhook from '@/lib/slack/postSlackWebhook';

import {
  SENSOR_LIMITS,
  SENSOR_STALE_MINUTES,
  WAREHOUSE_DATA_WEBHOOK_ENV,
} from '../constants/sensorLimits';

/** How often the scheduled check runs, which is also the alert window */
const CHECK_EVERY_MINUTES = 15;

/**
 * Tell #warehouse-data when a sensor stops reporting
 *
 * Run every 15 minutes. A sensor is reported once, on the first check after
 * its last reading passes 30 minutes old — the window is one check wide, so
 * the next run does not repeat it. It is announced again when it reports
 * (see alertSensorChanges). A sensor that has never reported is ignored:
 * that is set-up, not an outage.
 *
 * @returns The sensors reported as silent
 */
const alertSilentSensors = async () => {
  const ids = Object.keys(SENSOR_LIMITS);

  const latest = await db
    .selectDistinctOn([warehouseSensorReadings.sensorId], {
      sensorId: warehouseSensorReadings.sensorId,
      timestamp: warehouseSensorReadings.timestamp,
    })
    .from(warehouseSensorReadings)
    .where(inArray(warehouseSensorReadings.sensorId, ids))
    .orderBy(warehouseSensorReadings.sensorId, desc(warehouseSensorReadings.timestamp));

  const now = Date.now();
  const from = SENSOR_STALE_MINUTES * 60_000;
  const to = (SENSOR_STALE_MINUTES + CHECK_EVERY_MINUTES) * 60_000;

  const silent = latest.filter((row) => {
    const age = now - row.timestamp.getTime();
    return age >= from && age < to;
  });

  if (silent.length === 0) return [];

  const names = silent.map((row) => SENSOR_LIMITS[row.sensorId]!.name);
  const text =
    silent.length === ids.length
      ? `🔌 No cold room sensor has reported for ${SENSOR_STALE_MINUTES} minutes. Check Home Assistant and its internet connection.`
      : `🔌 No reading for ${SENSOR_STALE_MINUTES} minutes from: ${names.join(', ')}. Check the sensor's battery and Wi-Fi.`;

  await postSlackWebhook(WAREHOUSE_DATA_WEBHOOK_ENV, { text });

  return names;
};

export default alertSilentSensors;
