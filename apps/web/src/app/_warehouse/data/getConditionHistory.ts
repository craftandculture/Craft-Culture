import { sql } from 'drizzle-orm';

import db from '@/database/client';

/**
 * The cold rooms' last 30 days, one figure per six hours
 *
 * Each point is the median of every cold-room reading in its six hours, so a
 * door left open for a few minutes, or one sensor briefly misreading, moves
 * nothing: a median ignores a minority of outliers where an average would
 * take them in. Temperature and humidity are kept apart. Only the cold rooms
 * count, as on the live figures; the general warehouse is not where wine is
 * kept.
 *
 * @example
 *   const points = await getConditionHistory();
 *   // [{ at: '2026-09-26T00:00:00', metric: 'temperature', value: 12.5 }, …]
 *
 * @returns Six-hourly medians, oldest first
 */
const getConditionHistory = async () => {
  const result = await db.execute<{ at: string; metric: 'temperature' | 'humidity'; value: number }>(sql`
    SELECT
      date_trunc('hour', timestamp) - (EXTRACT(hour FROM timestamp)::int % 6) * interval '1 hour' AS at,
      CASE WHEN sensor_type ~* 'humid|moisture' THEN 'humidity' ELSE 'temperature' END AS metric,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY value)::float AS value
    FROM warehouse_sensor_readings
    WHERE timestamp >= now() - interval '30 days'
      AND lower(coalesce(location, '')) LIKE '%cold room%'
    GROUP BY 1, 2
    ORDER BY 1
  `);
  const rows = Array.isArray(result) ? result : (result as { rows: typeof result }).rows;

  return (rows as { at: string | Date; metric: 'temperature' | 'humidity'; value: number }[]).map((row) => ({
    at: new Date(row.at).toISOString(),
    metric: row.metric,
    value: Number(row.value),
  }));
};

export default getConditionHistory;
