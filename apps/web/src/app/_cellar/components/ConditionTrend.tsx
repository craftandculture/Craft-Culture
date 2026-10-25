'use client';

import { format } from 'date-fns';
import { useId, useState } from 'react';

export interface ConditionTrendProps {
  /** Six-hourly medians, oldest first */
  points: { at: string; value: number }[];
  /** The range we commit to, drawn as a band the line sits within */
  target: { low: number; high: number };
  unit: string;
}

const WIDTH = 320;
const HEIGHT = 72;

/* A centred rolling mean over five six-hour points (about 30 hours) */
const smooth = (values: number[]) =>
  values.map((_, index) => {
    const window = values.slice(Math.max(0, index - 2), index + 3);
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  });

/* A curve through the points (Catmull-Rom as cubic Béziers), not a zigzag */
const curve = (xy: [number, number][]) =>
  xy
    .map(([x, y], index) => {
      if (index === 0) return `M${x},${y}`;
      const p0 = xy[index - 2] ?? xy[index - 1]!;
      const p1 = xy[index - 1]!;
      const p3 = xy[index + 1] ?? [x, y];
      const c1 = [p1[0] + (x - p0[0]) / 6, p1[1] + (y - p0[1]) / 6];
      const c2 = [x - (p3[0] - p1[0]) / 6, y - (p3[1] - p1[1]) / 6];
      return `C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${x},${y}`;
    })
    .join(' ');

/**
 * Thirty days of one cold-room condition, against the range we commit to
 *
 * The points are already six-hourly medians, so a door opening never reaches
 * them; a rolling mean on top gives the steady line a collector expects of a
 * cellar. The vertical scale is the committed range itself, so a line inside
 * the band reads, at a glance, as within it.
 */
const ConditionTrend = ({ points, target, unit }: ConditionTrendProps) => {
  const gradientId = useId();
  // The point under the pointer, by index; null when not scrubbing
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < 4) return null;

  const pad = (target.high - target.low) * 0.15;
  const low = target.low - pad;
  const high = target.high + pad;
  const values = smooth(points.map((point) => point.value));
  const first = new Date(points[0]!.at).getTime();
  const last = new Date(points[points.length - 1]!.at).getTime();
  const span = Math.max(1, last - first);

  const yOf = (value: number) =>
    HEIGHT - ((Math.min(high, Math.max(low, value)) - low) / (high - low)) * HEIGHT;
  const xy = points.map((point, index): [number, number] => [
    Math.round(((new Date(point.at).getTime() - first) / span) * WIDTH * 10) / 10,
    Math.round(yOf(values[index]!) * 10) / 10,
  ]);
  const line = curve(xy);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const days = Math.max(1, Math.round(span / (24 * 60 * 60 * 1000)));

  /* The nearest point to the pointer, from where it is across the chart */
  const scrub = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    let nearest = 0;
    xy.forEach(([px], index) => {
      if (Math.abs(px - x) < Math.abs(xy[nearest]![0] - x)) nearest = index;
    });
    setHover(nearest);
  };
  const active = hover != null ? { point: points[hover]!, value: values[hover]!, xy: xy[hover]! } : null;

  return (
    <div className="mt-3">
      <div
        className="relative cursor-crosshair touch-none"
        onPointerMove={scrub}
        onPointerDown={scrub}
        onPointerLeave={() => setHover(null)}
        onPointerUp={(event) => event.pointerType !== 'mouse' && setHover(null)}
      >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-16 w-full overflow-visible"
        role="img"
        aria-label={`Last 30 days, averaging ${average.toFixed(1)}${unit}, within ${target.low}–${target.high}${unit}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* The committed range */}
        <rect
          x="0"
          y={yOf(target.high)}
          width={WIDTH}
          height={yOf(target.low) - yOf(target.high)}
          className="fill-emerald-500/[0.06]"
        />
        <path
          d={`${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`}
          fill={`url(#${gradientId})`}
        />
        <path
          d={line}
          fill="none"
          vectorEffect="non-scaling-stroke"
          strokeWidth="1.75"
          strokeLinecap="round"
          className="stroke-emerald-600 dark:stroke-emerald-400"
        />
        {active && (
          <line
            x1={active.xy[0]}
            x2={active.xy[0]}
            y1="0"
            y2={HEIGHT}
            vectorEffect="non-scaling-stroke"
            strokeWidth="1"
            strokeDasharray="3 3"
            className="stroke-text-muted"
          />
        )}
      </svg>
      {active && (
        <>
          {/* The dot is HTML so it stays round when the chart stretches */}
          <span
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-600 shadow dark:border-neutral-900 dark:bg-emerald-400"
            style={{ left: `${(active.xy[0] / WIDTH) * 100}%`, top: `${(active.xy[1] / HEIGHT) * 100}%` }}
          />
          <span
            className="bg-text-primary text-surface-primary pointer-events-none absolute -top-9 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium tabular-nums shadow-lg"
            style={{
              left: `${(active.xy[0] / WIDTH) * 100}%`,
              transform: `translateX(${active.xy[0] < WIDTH * 0.15 ? '0' : active.xy[0] > WIDTH * 0.85 ? '-100%' : '-50%'})`,
            }}
          >
            {active.value.toFixed(1)}
            {unit} · {format(new Date(active.point.at), 'd MMM, HH:mm')}
          </span>
        </>
      )}
      </div>
      <div className="text-text-muted mt-1 flex justify-between text-[10px] tabular-nums">
        <span>{format(new Date(first), 'd MMM')}</span>
        <span>
          {days}-day average {average.toFixed(1)}
          {unit}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
};

export default ConditionTrend;
