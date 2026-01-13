import crypto from 'crypto';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import db from '@/database/client';
import { warehouseSensorReadings } from '@/database/schema';
import logger from '@/utils/logger';

import { sensorDataSchema } from './schema';

/**
 * POST /api/warehouse/sensors
 *
 * Webhook endpoint for Home Assistant to send sensor data
 *
 * @example
 *   POST /api/warehouse/sensors
 *   Authorization: Bearer YOUR_API_KEY
 *   {
 *     "sensors": [
 *       {
 *         "sensor_id": "warehouse_temp_1",
 *         "sensor_type": "temperature",
 *         "value": 16.5,
 *         "unit": "celsius",
 *         "location": "wine_storage_zone_a"
 *       }
 *     ]
 *   }
 */
export const POST = async (request: NextRequest) => {
  try {
    // Verify API key from Authorization header
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.WAREHOUSE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Use constant-time comparison to prevent timing attacks
    const tokenBuffer = Buffer.from(token);
    const apiKeyBuffer = Buffer.from(apiKey);
    const isValidKey =
      tokenBuffer.length === apiKeyBuffer.length &&
      crypto.timingSafeEqual(tokenBuffer, apiKeyBuffer);

    if (!isValidKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = sensorDataSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error },
        { status: 400 },
      );
    }

    const { sensors } = validationResult.data;

    // Insert sensor readings into database
    const insertedReadings = await db
      .insert(warehouseSensorReadings)
      .values(
        sensors.map((sensor) => ({
          sensorId: sensor.sensor_id,
          sensorType: sensor.sensor_type,
          value: sensor.value,
          unit: sensor.unit,
          location: sensor.location || null,
          timestamp: sensor.timestamp ? new Date(sensor.timestamp) : new Date(),
          metadata: sensor.metadata || null,
        })),
      )
      .returning();

    return NextResponse.json({
      success: true,
      inserted: insertedReadings.length,
      readings: insertedReadings,
    });
  } catch (error) {
    logger.error('Error processing sensor data:', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
};
