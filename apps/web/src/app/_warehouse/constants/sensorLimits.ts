/**
 * The incoming webhook for #warehouse-data, where sensor alerts go. Set on the
 * craft-culture Vercel project; a changed value needs a fresh deployment.
 */
export const WAREHOUSE_DATA_WEBHOOK_ENV = 'SLACK_WAREHOUSE_DATA_WEBHOOK_URL';

/** A sensor with no reading for this long is reported as silent */
export const SENSOR_STALE_MINUTES = 30;

/**
 * The sensors Home Assistant sends, with the band each should stay inside
 *
 * Keyed by the `sensor_id` Home Assistant posts. Wine in the cold room is kept
 * at 10–14 °C and 55–75 % humidity; the general warehouse only has a ceiling,
 * because it holds nothing that a cool day harms.
 */
export const SENSOR_LIMITS: Record<
  string,
  { name: string; unit: string; min?: number; max?: number }
> = {
  cold_room_front_temperature: { name: 'Cold Room – Front', unit: '°C', min: 10, max: 14 },
  cold_room_middle_temperature: { name: 'Cold Room – Middle', unit: '°C', min: 10, max: 14 },
  cold_room_rear_temperature: { name: 'Cold Room – Rear', unit: '°C', min: 10, max: 14 },
  cold_room_front_humidity: { name: 'Cold Room – Front Humidity', unit: '%', min: 55, max: 75 },
  cold_room_rear_humidity: { name: 'Cold Room – Rear Humidity', unit: '%', min: 55, max: 75 },
  warehouse_general_temperature: { name: 'Warehouse – General', unit: '°C', max: 35 },
};
