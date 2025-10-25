# Simple Setup Guide for Warehouse Sensors

This guide will help you set up warehouse sensor monitoring with **zero technical knowledge required**. Just follow these steps in order.

## What This Does

Your Home Assistant will send temperature, humidity, and other sensor data to your website. The data will appear live at the bottom of your website (in the footer).

---

## Step 1: Create a Secret Password (API Key)

This is like a password that Home Assistant will use to send data to your website.

### On Mac/Linux:
1. Open **Terminal** (search for "Terminal" in Spotlight)
2. Copy and paste this exact command:
   ```bash
   openssl rand -base64 32
   ```
3. Press Enter
4. You'll see a long random string like: `XyZ123abc...`
5. **Copy this entire string** - you'll need it in the next steps

### On Windows:
1. Use this website instead: https://randomkeygen.com/
2. Look for "504-bit WPA Key"
3. **Copy that key** - you'll need it in the next steps

---

## Step 2: Add the Secret Password to Your Website

1. Open the file `.env` in your project folder (`apps/web/.env`)
2. If the file doesn't exist, create a new file called `.env`
3. Add this line at the bottom:
   ```
   WAREHOUSE_API_KEY=PASTE_YOUR_KEY_HERE
   ```
4. Replace `PASTE_YOUR_KEY_HERE` with the key you copied in Step 1
5. Save the file

**Example:**
```
WAREHOUSE_API_KEY=XyZ123abc456def789ghi012jkl345==
```

---

## Step 3: Update the Database

This creates a place in your database to store sensor readings.

### Option A: Using Neon MCP (Easiest)

Since you have Neon MCP connected, I can help you run the migration directly:

1. Tell me when you're ready
2. I'll use the Neon MCP to create the table for you
3. Done!

### Option B: Manual Commands (If Option A doesn't work)

1. Open **Terminal**
2. Navigate to your project:
   ```bash
   cd /Users/kevinbradford/Projects/Craft-Culture/apps/web
   ```
3. Run these two commands:
   ```bash
   pnpm drizzle-kit generate
   pnpm drizzle-kit push
   ```
4. Wait for them to finish (you'll see "Done" or similar)

---

## Step 4: Configure Home Assistant

Now we need to tell Home Assistant to send data to your website.

### Finding Your Home Assistant Configuration

1. Open Home Assistant
2. Go to **Settings** → **Add-ons** → **File editor** (or use your favorite editor)
3. Open the file `configuration.yaml`

### What to Add

Copy and paste this entire block **at the bottom** of your `configuration.yaml`:

```yaml
# Warehouse Sensor Integration for Craft & Culture
rest_command:
  send_warehouse_sensors:
    url: 'https://YOUR-WEBSITE-URL.vercel.app/api/warehouse/sensors'
    method: POST
    headers:
      Authorization: 'Bearer YOUR_API_KEY_HERE'
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

### Replace These Parts:

1. **`YOUR-WEBSITE-URL.vercel.app`** → Replace with your actual website URL
   - Example: `craft-culture.vercel.app`

2. **`YOUR_API_KEY_HERE`** → Replace with the key from Step 1
   - Example: `XyZ123abc456def789ghi012jkl345==`

---

## Step 5: Add Your Sensors

Now tell Home Assistant which sensors to send. Add this to your `configuration.yaml` (or better yet, create a file called `automations.yaml`):

### Example: Temperature Sensor

```yaml
automation:
  - alias: 'Send Warehouse Temperature to Website'
    trigger:
      - platform: state
        entity_id: sensor.warehouse_temperature  # ← Change this to YOUR sensor name
    action:
      - service: rest_command.send_warehouse_sensors
        data:
          sensor_id: 'warehouse_temp_1'
          sensor_type: 'temperature'
          value: '{{ states("sensor.warehouse_temperature") }}'  # ← Change to YOUR sensor
          unit: 'celsius'
          location: 'wine_storage'
```

### Example: Humidity Sensor

```yaml
  - alias: 'Send Warehouse Humidity to Website'
    trigger:
      - platform: state
        entity_id: sensor.warehouse_humidity  # ← Change this to YOUR sensor name
    action:
      - service: rest_command.send_warehouse_sensors
        data:
          sensor_id: 'warehouse_humidity_1'
          sensor_type: 'humidity'
          value: '{{ states("sensor.warehouse_humidity") }}'  # ← Change to YOUR sensor
          unit: 'percent'
          location: 'wine_storage'
```

### What to Change:

- **`sensor.warehouse_temperature`** → Your actual sensor entity ID (find this in Home Assistant → Developer Tools → States)
- **`wine_storage`** → The location name you want to display
- Add more sensors by copying the pattern above

---

## Step 6: Restart Home Assistant

1. Go to **Settings** → **System**
2. Click **Restart**
3. Wait for it to come back online

---

## Step 7: Test It!

### Test the Website Endpoint

1. Open Terminal
2. Run this command (replace the parts in CAPS):

```bash
curl -X POST https://YOUR-WEBSITE-URL.vercel.app/api/warehouse/sensors \
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

**What you should see:**
```json
{
  "success": true,
  "inserted": 1,
  "readings": [...]
}
```

If you see `"success": true`, it's working! 🎉

### Check Your Website

1. Open your website in a browser
2. Scroll down to the footer (bottom of the page)
3. You should see a bar with live sensor data at the top of the footer
4. It will show icons and values like: `🌡️ temperature: 18.5°C`

---

## Troubleshooting

### "Unauthorized" Error
- Double-check that the API key in `.env` matches the one in `configuration.yaml`
- Make sure you added `Bearer` before the key in Home Assistant
- Restart your website after adding the `.env` variable

### No Data Showing on Website
- Check that the database migration ran (Step 3)
- Make sure you deployed the website after adding the code
- Look in your browser's Developer Console (F12) for errors

### Home Assistant Not Sending Data
- Check the Home Assistant logs for errors
- Verify your sensor entity IDs are correct
- Make sure Home Assistant can reach your website URL

---

## Need Help?

If you get stuck on any step, just let me know which step number you're on and what error you're seeing. I'll help you fix it!

---

## What Each Sensor Type Shows

- `temperature` → 🌡️ Thermometer icon
- `humidity` → 💧 Water droplet icon
- `air_quality` or `pressure` → 📊 Gauge icon
- Anything else → 🌀 Wind icon

## Supported Units

- `celsius` → Shows as `°C`
- `fahrenheit` → Shows as `°F`
- `percent` → Shows as `%`
- Custom units → Shows as-is
