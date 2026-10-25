'use client';

import {
  IconBuildingWarehouse,
  IconCamera,
  IconDroplet,
  IconLock,
  IconShieldCheck,
  IconTemperature,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';

import ConditionTrend from '@/app/_cellar/components/ConditionTrend';
import useTRPC from '@/lib/trpc/browser';

/** The conditions the membership commits to, everywhere it is stated */
const TEMPERATURE = { low: 12, high: 16 };
const HUMIDITY = { low: 50, high: 80 };

const range = (values: number[], unit: string) => {
  if (values.length === 0) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low.toFixed(1) === high.toFixed(1)
    ? `${low.toFixed(1)}${unit}`
    : `${low.toFixed(1)}–${high.toFixed(1)}${unit}`;
};

/**
 * Where a member's wine is kept, and the conditions it is kept in right now
 *
 * Replaces a strip of raw sensor names ("Cold Room – Front Humidity: 63.9%")
 * and a paragraph beneath it, which ran into each other and into the site
 * footer. A member wants two answers: is my wine being looked after, and how
 * do I know. So the cold rooms are read as one figure each for temperature
 * and humidity, set against what we commit to, with when it was last read;
 * the promises sit beside them. Only the cold rooms count: the general
 * warehouse is not where wine is kept.
 *
 * Wine at our UK bond is shown as its own place, without live figures: LCB
 * keep it and we do not read their sensors.
 */
const CellarConditions = () => {
  const api = useTRPC();
  const { data } = useQuery({
    ...api.warehouse.getLatestReadings.queryOptions(),
    refetchInterval: 60_000,
  });
  const { data: uk } = useQuery(api.cellar.member.getUkHoldings.queryOptions());
  const { data: history } = useQuery({
    ...api.warehouse.getConditionHistory.queryOptions(),
    staleTime: 30 * 60 * 1000,
  });
  const trendOf = (metric: 'temperature' | 'humidity') =>
    (history?.points ?? []).filter((point) => point.metric === metric);

  const coldRoom = (data?.readings ?? []).filter((reading) =>
    (reading.location ?? '').toLowerCase().includes('cold room'),
  );
  const isHumidity = (type: string) => /humid|moisture/i.test(type);
  const temperatures = coldRoom.filter((reading) => !isHumidity(reading.sensorType)).map((reading) => reading.value);
  const humidities = coldRoom.filter((reading) => isHumidity(reading.sensorType)).map((reading) => reading.value);

  const temperatureOk = temperatures.every((value) => value >= TEMPERATURE.low && value <= TEMPERATURE.high);
  const humidityOk = humidities.every((value) => value >= HUMIDITY.low && value <= HUMIDITY.high);
  const lastRead = coldRoom
    .map((reading) => new Date((reading as { timestamp?: Date | string }).timestamp ?? data?.timestamp ?? Date.now()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const hasUk = (uk?.holdings.length ?? 0) > 0;

  const promises = [
    { icon: IconShieldCheck, text: 'Licensed bonded warehouse' },
    { icon: IconLock, text: 'Duty and VAT suspended' },
    { icon: IconCamera, text: '24-hour monitoring' },
    { icon: IconUsers, text: 'Handled only by our staff' },
  ];

  return (
    <section className="container py-6">
      <p className="text-text-muted mb-3 text-[11px] font-semibold uppercase tracking-wider">Storage and conditions</p>
      <div className={`grid gap-3 ${hasUk ? 'lg:grid-cols-3' : ''}`}>
        <div className={`border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm sm:p-5 ${hasUk ? 'lg:col-span-2' : ''}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10">
                <IconBuildingWarehouse size={16} />
              </span>
              <div>
                <p className="text-text-primary text-sm font-semibold">Craft &amp; Culture bonded warehouse</p>
                <p className="text-text-muted text-xs">United Arab Emirates · dedicated temperature and humidity controlled cold rooms</p>
              </div>
            </div>
            {lastRead && (
              <span className="text-text-muted inline-flex items-center gap-1.5 text-[11px]">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live · updated {formatDistanceToNowStrict(lastRead, { addSuffix: true })}
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {[
              {
                icon: IconTemperature,
                label: 'Temperature',
                value: range(temperatures, '°C'),
                target: `${TEMPERATURE.low}–${TEMPERATURE.high}°C`,
                ok: temperatureOk,
                trend: trendOf('temperature'),
                range: TEMPERATURE,
                unit: '°C',
              },
              {
                icon: IconDroplet,
                label: 'Humidity',
                value: range(humidities, '%'),
                target: `${HUMIDITY.low}–${HUMIDITY.high}%`,
                ok: humidityOk,
                trend: trendOf('humidity'),
                range: HUMIDITY,
                unit: '%',
              },
            ].map((tile) => (
              <div key={tile.label} className="border-border-muted rounded-lg border px-3 py-2.5">
                <span className="text-text-muted flex items-center gap-1.5 text-[11px]">
                  <tile.icon size={13} />
                  {tile.label}
                </span>
                <span className="text-text-primary mt-0.5 block text-xl font-semibold tabular-nums">
                  {tile.value ?? '—'}
                </span>
                <span className="text-text-muted text-[11px]">
                  Target {tile.target}
                  {tile.value && tile.ok && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      Within range
                    </span>
                  )}
                </span>
                <ConditionTrend points={tile.trend} target={tile.range} unit={tile.unit} />
              </div>
            ))}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            {promises.map((promise) => (
              <li key={promise.text} className="text-text-muted flex items-center gap-1.5 text-xs">
                <promise.icon size={14} className="text-emerald-700 dark:text-emerald-400" />
                {promise.text}
              </li>
            ))}
          </ul>
        </div>

        {hasUk && (
          <div className="border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-500/20">
                <IconBuildingWarehouse size={16} />
              </span>
              <div>
                <p className="text-text-primary text-sm font-semibold">London City Bond</p>
                <p className="text-text-muted text-xs">Burton upon Trent · United Kingdom</p>
              </div>
            </div>
            <p className="text-text-muted mt-4 text-xs leading-5">
              Your wine is held under bond on the Craft &amp; Culture account, with duty and VAT suspended. Any of it can
              be moved to the UAE whenever you wish.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default CellarConditions;
