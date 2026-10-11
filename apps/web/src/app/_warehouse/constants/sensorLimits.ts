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
 * Keyed by the `sensor_id` Home Assistant posts. The cold room alerts above
 * 16 °C or 80 % humidity (Kevin's limits), and below 10 °C or 55 %.
 *
 * Warehouse – General is deliberately absent. The main floor is not air
 * conditioned, so its temperature is a reference shown in the live feed, not
 * something to be alerted on.
 */
export const SENSOR_LIMITS: Record<
  string,
  { name: string; unit: string; min?: number; max?: number }
> = {
  cold_room_front_temperature: { name: 'Cold Room – Front', unit: '°C', min: 10, max: 16 },
  cold_room_middle_temperature: { name: 'Cold Room – Middle', unit: '°C', min: 10, max: 16 },
  cold_room_rear_temperature: { name: 'Cold Room – Rear', unit: '°C', min: 10, max: 16 },
  cold_room_front_humidity: { name: 'Cold Room – Front Humidity', unit: '%', min: 55, max: 80 },
  cold_room_rear_humidity: { name: 'Cold Room – Rear Humidity', unit: '%', min: 55, max: 80 },
};
