import { and, gte, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import { warehouseSensorReadings } from '@/database/schema';
import postSlackWebhook from '@/lib/slack/postSlackWebhook';

import { SENSOR_LIMITS, WAREHOUSE_DATA_WEBHOOK_ENV } from '../constants/sensorLimits';

/** Shown for reference beside the cold room; never alerted on */
const REFERENCE_SENSORS: Record<string, { name: string; unit: string }> = {
  warehouse_general_temperature: { name: 'Warehouse – General', unit: '°C' },
};

/**
 * The cold room's last 24 hours in one #warehouse-data message
 *
 * Low, average and high for each sensor, ticked when it stayed inside its
 * limits all day and flagged with how much of the day it spent outside them.
 * Warehouse – General is listed as a reference only.
 *
 * No reading-count check: a sensor that is not changing sends nothing new, so
 * fewer readings is not missing data. A sensor that truly goes quiet is
 * reported within 45 minutes by alertSilentSensors.
 *
 * @returns The message posted
 */
const sendDailySensorSummary = async () => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ids = [...Object.keys(SENSOR_LIMITS), ...Object.keys(REFERENCE_SENSORS)];

  const rows = await db
    .select({
      sensorId: warehouseSensorReadings.sensorId,
      low: sql<number>`min(${warehouseSensorReadings.value})`,
      high: sql<number>`max(${warehouseSensorReadings.value})`,
      avg: sql<number>`avg(${warehouseSensorReadings.value})`,
      values: sql<number[]>`array_agg(${warehouseSensorReadings.value})`,
    })
    .from(warehouseSensorReadings)
    .where(
      and(
        inArray(warehouseSensorReadings.sensorId, ids),
        gte(warehouseSensorReadings.timestamp, since),
      ),
    )
    .groupBy(warehouseSensorReadings.sensorId);

  const by = new Map(rows.map((r) => [r.sensorId, r]));
  const fmt = (n: number) => Number(n).toFixed(1);

  const lines = Object.entries(SENSOR_LIMITS).map(([id, limits]) => {
    const r = by.get(id);
    if (!r) return `🔌 *${limits.name}*: no readings in the last 24 hours`;

    const outside = (r.values ?? []).filter(
      (v) =>
        (limits.max !== undefined && v > limits.max) ||
        (limits.min !== undefined && v < limits.min),
    ).length;
    const range = `${fmt(r.low)}–${fmt(r.high)} ${limits.unit} (avg ${fmt(r.avg)})`;

    return outside === 0
      ? `✅ *${limits.name}*: ${range}`
      : `⚠️ *${limits.name}*: ${range}, outside ${limits.min ?? '–'}–${limits.max ?? '–'} ${limits.unit} for about ${outside * 5} min`;
  });

  const reference = Object.entries(REFERENCE_SENSORS).map(([id, s]) => {
    const r = by.get(id);
    return r
      ? `${s.name} (reference, not air conditioned): ${fmt(r.low)}–${fmt(r.high)} ${s.unit}`
      : `${s.name} (reference): no readings`;
  });

  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date());

  const text = [
    `*Cold room — last 24 hours* · ${day}`,
    ...lines,
    '',
    ...reference,
  ].join('\n');

  await postSlackWebhook(WAREHOUSE_DATA_WEBHOOK_ENV, { text });

  return text;
};

export default sendDailySensorSummary;
