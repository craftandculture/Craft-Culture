import { z } from 'zod';

/**
 * Schema for validating sensor data from Home Assistant
 *
 * @example
 *   {
 *     sensors: [
 *       {
 *         sensor_id: 'warehouse_temp_1',
 *         sensor_type: 'temperature',
 *         value: 16.5,
 *         unit: 'celsius',
 *         location: 'wine_storage_zone_a',
 *         timestamp: '2025-01-15T10:30:00Z',
 *         metadata: { zone: 'A', rack: '12' }
 *       }
 *     ]
 *   }
 */
export const sensorDataSchema = z.object({
  sensors: z.array(
    z.object({
      sensor_id: z.string().min(1),
      sensor_type: z.string().min(1),
      value: z.number(),
      unit: z.string().min(1),
      location: z.string().optional(),
      timestamp: z.string().datetime().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

export type SensorData = z.infer<typeof sensorDataSchema>;
