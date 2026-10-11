import { desc, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { warehouseSensorReadings } from '@/database/schema';
import postSlackWebhook from '@/lib/slack/postSlackWebhook';
import logger from '@/utils/logger';

import {
  SENSOR_LIMITS,
  SENSOR_STALE_MINUTES,
  WAREHOUSE_DATA_WEBHOOK_ENV,
} from '../constants/sensorLimits';
import sensorStatus from '../utils/sensorStatus';

/**
 * Tell #warehouse-data when a reading crosses its limit, or comes back
 *
 * Called with the readings just received, before they are stored, so each is
 * compared with that sensor's previous reading. A message goes only when the
 * state changes — out of range, back in range, or reporting again after going
 * silent — never on every reading, so the channel stays worth reading.
 *
 * Never throws: a Slack failure must not lose the readings.
 *
 * @param readings - The readings in this delivery
 */
const alertSensorChanges = async (
  readings: Array<{ sensor_id: string; value: number }>,
) => {
  try {
    const watched = readings.filter((r) => SENSOR_LIMITS[r.sensor_id]);
    if (watched.length === 0) return;

    const previous = await db
      .selectDistinctOn([warehouseSensorReadings.sensorId], {
        sensorId: warehouseSensorReadings.sensorId,
        value: warehouseSensorReadings.value,
        timestamp: warehouseSensorReadings.timestamp,
      })
      .from(warehouseSensorReadings)
      .where(
        inArray(
          warehouseSensorReadings.sensorId,
          watched.map((r) => r.sensor_id),
        ),
      )
      .orderBy(warehouseSensorReadings.sensorId, desc(warehouseSensorReadings.timestamp));

    const lastBy = new Map(previous.map((p) => [p.sensorId, p]));
    const staleBefore = Date.now() - SENSOR_STALE_MINUTES * 60_000;
    const lines: string[] = [];

    for (const reading of watched) {
      const limits = SENSOR_LIMITS[reading.sensor_id]!;
      const value = `${reading.value.toFixed(1)} ${limits.unit}`;
      const now = sensorStatus(reading.sensor_id, reading.value);
      const last = lastBy.get(reading.sensor_id);
      const before = last ? sensorStatus(reading.sensor_id, last.value) : 'ok';

      if (last && last.timestamp.getTime() < staleBefore) {
        lines.push(`🔌 *${limits.name}* is reporting again: ${value}`);
      }

      if (now !== before) {
        lines.push(
          now === 'high'
            ? `⚠️ *${limits.name}* is ${value}, above ${limits.max} ${limits.unit}`
            : now === 'low'
              ? `⚠️ *${limits.name}* is ${value}, below ${limits.min} ${limits.unit}`
              : `✅ *${limits.name}* is back in range: ${value}`,
        );
      }
    }

    if (lines.length > 0) {
      await postSlackWebhook(WAREHOUSE_DATA_WEBHOOK_ENV, { text: lines.join('\n') });
    }
  } catch (error) {
    logger.error('Warehouse sensors: Slack alert failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export default alertSensorChanges;
