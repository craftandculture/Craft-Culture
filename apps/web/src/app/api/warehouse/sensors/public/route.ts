import { and, desc, gte, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import db from '@/database/client';
import { warehouseSensorReadings } from '@/database/schema';
import logger from '@/utils/logger';

/** Cold room sensors only; Warehouse General and anything else stays private */
const TEMPERATURE_SENSORS = [
  'cold_room_front_temperature',
  'cold_room_middle_temperature',
  'cold_room_rear_temperature',
];
const HUMIDITY_SENSORS = [
  'cold_room_front_humidity',
  'cold_room_rear_humidity',
];

/** The published commitment (12–16 °C, 50–80 % RH), not the alert limits */
const RANGE = { temperature: [12, 16], humidity: [50, 80] } as const;

/** Readings older than this are not presented as the current condition */
const CURRENT_MAX_AGE_MINUTES = 120;

const PERIOD_DAYS = 30;

const average = (values: number[]) =>
  values.length === 0
    ? null
    : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

/**
 * GET /api/warehouse/sensors/public
 *
 * A public summary of cold room conditions for the website and the QR code on
 * business cards: the current average temperature and humidity, and the share
 * of readings inside the published range over the last 30 days. No sensor
 * names, locations or raw history.
 */
export const GET = async () => {
  try {
    const ids = [...TEMPERATURE_SENSORS, ...HUMIDITY_SENSORS];

    const latest = await db
      .selectDistinctOn([warehouseSensorReadings.sensorId], {
        sensorId: warehouseSensorReadings.sensorId,
        value: warehouseSensorReadings.value,
        timestamp: warehouseSensorReadings.timestamp,
      })
      .from(warehouseSensorReadings)
      .where(inArray(warehouseSensorReadings.sensorId, ids))
      .orderBy(
        warehouseSensorReadings.sensorId,
        desc(warehouseSensorReadings.timestamp),
      );

    const freshAfter = Date.now() - CURRENT_MAX_AGE_MINUTES * 60_000;
    const fresh = latest.filter((r) => r.timestamp.getTime() >= freshAfter);
    const temperature = average(
      fresh
        .filter((r) => TEMPERATURE_SENSORS.includes(r.sensorId))
        .map((r) => r.value),
    );
    const humidity = average(
      fresh
        .filter((r) => HUMIDITY_SENSORS.includes(r.sensorId))
        .map((r) => r.value),
    );
    const updatedAt = fresh.length
      ? new Date(
          Math.max(...fresh.map((r) => r.timestamp.getTime())),
        ).toISOString()
      : null;

    const since = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60_000);
    const [period] = await db
      .select({
        temperatureReadings:
          sql<number>`count(*) filter (where ${inArray(warehouseSensorReadings.sensorId, TEMPERATURE_SENSORS)})`.mapWith(
            Number,
          ),
        temperatureInRange:
          sql<number>`count(*) filter (where ${inArray(warehouseSensorReadings.sensorId, TEMPERATURE_SENSORS)} and ${warehouseSensorReadings.value} between ${RANGE.temperature[0]} and ${RANGE.temperature[1]})`.mapWith(
            Number,
          ),
        humidityReadings:
          sql<number>`count(*) filter (where ${inArray(warehouseSensorReadings.sensorId, HUMIDITY_SENSORS)})`.mapWith(
            Number,
          ),
        humidityInRange:
          sql<number>`count(*) filter (where ${inArray(warehouseSensorReadings.sensorId, HUMIDITY_SENSORS)} and ${warehouseSensorReadings.value} between ${RANGE.humidity[0]} and ${RANGE.humidity[1]})`.mapWith(
            Number,
          ),
      })
      .from(warehouseSensorReadings)
      .where(
        and(
          inArray(warehouseSensorReadings.sensorId, ids),
          gte(warehouseSensorReadings.timestamp, since),
        ),
      );

    const share = (inRange: number, total: number) =>
      total === 0 ? null : Math.round((inRange / total) * 1000) / 10;

    return NextResponse.json(
      {
        current: { temperature, humidity, updatedAt },
        range: RANGE,
        period: {
          days: PERIOD_DAYS,
          temperatureInRangePct: share(
            period?.temperatureInRange ?? 0,
            period?.temperatureReadings ?? 0,
          ),
          humidityInRangePct: share(
            period?.humidityInRange ?? 0,
            period?.humidityReadings ?? 0,
          ),
        },
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    logger.error('Error building public cold room summary:', { error });
    return NextResponse.json(
      { error: 'Unavailable' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }
};
