import { SENSOR_LIMITS } from '../constants/sensorLimits';

/**
 * Whether a reading is inside its sensor's band
 *
 * @example
 *   sensorStatus('cold_room_rear_temperature', 15.2); // 'high'
 *
 * @param sensorId - The sensor_id Home Assistant sent
 * @param value - The reading
 * @returns 'ok', 'high' or 'low'; 'ok' for a sensor with no limits
 */
const sensorStatus = (sensorId: string, value: number) => {
  const limits = SENSOR_LIMITS[sensorId];
  if (limits?.max !== undefined && value > limits.max) return 'high' as const;
  if (limits?.min !== undefined && value < limits.min) return 'low' as const;
  return 'ok' as const;
};

export default sensorStatus;
