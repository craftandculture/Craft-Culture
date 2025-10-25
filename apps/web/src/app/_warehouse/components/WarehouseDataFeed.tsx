'use client';

import {
  IconDroplet,
  IconGauge,
  IconTemperature,
  IconWind,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Get icon for sensor type
 */
const getSensorIcon = (sensorType: string) => {
  const type = sensorType.toLowerCase();

  if (type.includes('temp')) {
    return IconTemperature;
  }
  if (type.includes('humidity') || type.includes('moisture')) {
    return IconDroplet;
  }
  if (type.includes('pressure') || type.includes('air_quality')) {
    return IconGauge;
  }
  return IconWind;
};

/**
 * Format sensor value with unit
 */
const formatValue = (value: number, unit: string) => {
  const formatted = value.toFixed(1);

  // Common unit formatting
  if (unit === 'celsius') return `${formatted}°C`;
  if (unit === 'fahrenheit') return `${formatted}°F`;
  if (unit === 'percent') return `${formatted}%`;

  return `${formatted} ${unit}`;
};

/**
 * Get display name for sensor
 */
const getSensorDisplayName = (sensorId: string, sensorType: string) => {
  // Try to extract location from sensor ID
  const parts = sensorId.split('_');
  if (parts.length > 2) {
    const location = parts.slice(2).join(' ');
    return `${sensorType} (${location})`;
  }

  return sensorType;
};

/**
 * Live warehouse sensor data feed component
 *
 * Displays real-time sensor readings from Home Assistant in the footer.
 * Auto-refreshes every 5 seconds to show live data.
 *
 * @example
 *   <WarehouseDataFeed />
 */
const WarehouseDataFeed = () => {
  const api = useTRPC();
  const { data, refetch } = useQuery({
    ...api.warehouse.getLatestReadings.queryOptions(),
    refetchInterval: 5000, // Refresh every 5 seconds
    refetchIntervalInBackground: true,
  });

  // Force refetch on mount
  useEffect(() => {
    void refetch();
  }, [refetch]);

  if (!data || data.readings.length === 0) {
    return null;
  }

  return (
    <div className="border-border-primary border-t bg-fill-tertiary py-2">
      <div className="container">
        <div className="flex items-center justify-between gap-4">
          <Typography
            variant="bodyXs"
            colorRole="muted"
            className="hidden font-semibold sm:block"
          >
            Warehouse Live Feed
          </Typography>

          {/* Scrolling sensor readings */}
          <div className="flex flex-1 items-center gap-6 overflow-x-auto scrollbar-hide">
            {data.readings.map((reading) => (
              <div
                key={reading.id}
                className="flex shrink-0 items-center gap-1.5"
              >
                <Icon
                  icon={getSensorIcon(reading.sensorType)}
                  size="xs"
                  colorRole="muted"
                />
                <Typography variant="bodyXs" colorRole="muted">
                  {getSensorDisplayName(reading.sensorId, reading.sensorType)}:
                </Typography>
                <Typography
                  variant="bodyXs"
                  colorRole="primary"
                  className="font-semibold"
                >
                  {formatValue(reading.value, reading.unit)}
                </Typography>
              </div>
            ))}
          </div>

          {/* Last updated indicator */}
          <Typography
            variant="bodyXs"
            colorRole="muted"
            className="hidden sm:block"
          >
            Live
          </Typography>
          <div className="hidden h-2 w-2 animate-pulse rounded-full bg-green-500 sm:block" />
        </div>
      </div>
    </div>
  );
};

export default WarehouseDataFeed;
