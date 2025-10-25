# Warehouse Sensor Integration

This document explains how to integrate Home Assistant warehouse sensors with the Craft & Culture web application.

## Overview

The system allows Home Assistant to send real-time sensor data (temperature, humidity, air quality, etc.) to the web application, where it's displayed live in the footer.

## Architecture

```
Home Assistant → Webhook API → PostgreSQL → tRPC → React Component → Footer Display
```

## Setup Instructions

### 1. Database Migration

First, you need to apply the database schema changes to create the `warehouse_sensor_readings` table.

**Using Drizzle Kit:**

```bash
cd apps/web
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

Or manually run the migration SQL against your Neon database.

### 2. Environment Variables

Add the following environment variable to your `.env` file:

```env
WAREHOUSE_API_KEY=your-secure-random-api-key-here
```

**Generate a secure API key:**

```bash
openssl rand -base64 32
```

### 3. Home Assistant Configuration

Configure Home Assistant to send sensor data to the webhook endpoint.

#### Option A: Using RESTful Command (Recommended for Real-time Updates)

Add to your `configuration.yaml`:

```yaml
rest_command:
  send_warehouse_sensors:
    url: 'https://your-domain.vercel.app/api/warehouse/sensors'
    method: POST
    headers:
      Authorization: 'Bearer YOUR_API_KEY'
      Content-Type: 'application/json'
    payload: >
      {
        "sensors": [
          {
            "sensor_id": "{{ sensor_id }}",
            "sensor_type": "{{ sensor_type }}",
            "value": {{ value }},
            "unit": "{{ unit }}",
            "location": "{{ location }}",
            "timestamp": "{{ now().isoformat() }}"
          }
        ]
      }
```

#### Create Automation for Each Sensor

Example for temperature sensor:

```yaml
automation:
  - alias: 'Send Warehouse Temperature'
    trigger:
      - platform: state
        entity_id: sensor.warehouse_temp_1
    action:
      - service: rest_command.send_warehouse_sensors
        data:
          sensor_id: 'warehouse_temp_1'
          sensor_type: 'temperature'
          value: '{{ states("sensor.warehouse_temp_1") }}'
          unit: 'celsius'
          location: 'wine_storage_zone_a'
```

#### Option B: Using Shell Command (for Batch Updates)

For sending multiple sensors at once:

```yaml
shell_command:
  send_all_warehouse_sensors: >
    curl -X POST https://your-domain.vercel.app/api/warehouse/sensors \
      -H "Authorization: Bearer YOUR_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "sensors": [
          {
            "sensor_id": "warehouse_temp_1",
            "sensor_type": "temperature",
            "value": {{ states("sensor.warehouse_temp_1") }},
            "unit": "celsius",
            "location": "wine_storage_zone_a"
          },
          {
            "sensor_id": "warehouse_humidity_1",
            "sensor_type": "humidity",
            "value": {{ states("sensor.warehouse_humidity_1") }},
            "unit": "percent",
            "location": "wine_storage_zone_a"
          }
        ]
      }'
```

Then create an automation to run this periodically:

```yaml
automation:
  - alias: 'Send All Warehouse Sensors'
    trigger:
      - platform: time_pattern
        seconds: '/5' # Every 5 seconds
    action:
      - service: shell_command.send_all_warehouse_sensors
```

## Webhook API Endpoint

**Endpoint:** `POST /api/warehouse/sensors`

**Authentication:** Bearer token in Authorization header

**Request Body:**

```json
{
  "sensors": [
    {
      "sensor_id": "warehouse_temp_1",
      "sensor_type": "temperature",
      "value": 16.5,
      "unit": "celsius",
      "location": "wine_storage_zone_a",
      "timestamp": "2025-01-15T10:30:00Z", // Optional
      "metadata": {} // Optional
    }
  ]
}
```

**Response (Success):**

```json
{
  "success": true,
  "inserted": 1,
  "readings": [...]
}
```

**Response (Error):**

```json
{
  "error": "Unauthorized"
}
```

## Sensor Types

Recommended sensor types for automatic icon display:

- `temperature` - Shows temperature icon
- `humidity` - Shows droplet icon
- `air_quality` / `pressure` - Shows gauge icon
- Other types - Shows wind/generic icon

## Supported Units

Common units with automatic formatting:

- `celsius` → Displays as `16.5°C`
- `fahrenheit` → Displays as `61.7°F`
- `percent` → Displays as `65.2%`
- Custom units → Displays as `value unit`

## Frontend Display

The warehouse data feed appears at the top of the footer with:

- Live sensor readings scrolling horizontally
- Auto-refresh every 5 seconds
- Sensor icons based on type
- Green "Live" indicator
- Responsive design (hides labels on mobile)

## Testing

### 1. Test the Webhook Endpoint

```bash
curl -X POST https://your-domain.vercel.app/api/warehouse/sensors \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sensors": [
      {
        "sensor_id": "test_temp",
        "sensor_type": "temperature",
        "value": 18.5,
        "unit": "celsius",
        "location": "test_zone"
      }
    ]
  }'
```

Expected response:

```json
{
  "success": true,
  "inserted": 1,
  "readings": [...]
}
```

### 2. Verify Database

Check that data was inserted:

```sql
SELECT * FROM warehouse_sensor_readings ORDER BY timestamp DESC LIMIT 10;
```

### 3. Check Frontend

Visit your site and scroll to the footer. You should see the live sensor data feed with your test data.

## Troubleshooting

### No data appearing in footer

1. Check that `WAREHOUSE_API_KEY` is set in environment variables
2. Verify webhook endpoint is receiving data (check logs)
3. Confirm database table exists
4. Check browser console for errors

### Authentication errors

- Ensure API key matches between `.env` and Home Assistant config
- Check that Authorization header includes `Bearer` prefix

### Data not refreshing

- Component auto-refreshes every 5 seconds
- Check browser network tab for failed requests
- Verify tRPC endpoint is working: `/api/trpc/warehouse.getLatestReadings`

## Security Considerations

- Keep your `WAREHOUSE_API_KEY` secret
- Use HTTPS for all webhook calls
- Consider rate limiting if needed
- Review who has access to environment variables

## Performance

- Database indexed on `sensor_id`, `timestamp`, and `sensor_type`
- Frontend queries only latest reading per sensor
- Auto-refresh interval: 5 seconds (configurable)
- Maximum 100 sensors displayed at once

## Future Enhancements

Possible improvements:

- Historical data charts
- Alert thresholds
- Sensor health monitoring
- Multiple warehouse locations
- Mobile app notifications
