'use client';

import { useState } from 'react';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';

type Currency = 'USD' | 'AED';

export interface RevenueMonth {
  month: string;
  isCurrent: boolean;
  usd: number;
  aed: number;
  yearAgoUsd: number;
  yearAgoAed: number;
}

interface HomeRevenueChartProps {
  months: RevenueMonth[];
  currency: Currency;
  redacted: boolean;
}

/** Short money for labels: "1.2M", "209k", "850" */
const short = (val: number) => {
  const size = Math.abs(val);
  if (size >= 1_000_000)
    return `${(val / 1_000_000).toFixed(size >= 10_000_000 ? 0 : 1)}M`;
  if (size >= 1000) return `${Math.round(val / 1000)}k`;
  return `${Math.round(val)}`;
};

/** Full money for the tooltip: "USD 209,050" */
const full = (val: number, currency: Currency) =>
  `${currency} ${val.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

const monthLabel = (key: string, withYear = false) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1, 1));
  return d.toLocaleDateString('en-GB', {
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
};

/**
 * Invoiced revenue per month for the last 13 months as a slim line, the stretch
 * into this month dashed because the month isn't over. Hover a month for its
 * total and the same month a year ago.
 */
const HomeRevenueChart = ({
  months,
  currency,
  redacted,
}: HomeRevenueChartProps) => {
  const [hover, setHover] = useState<number | null>(null);

  const value = (m: RevenueMonth) => (currency === 'USD' ? m.usd : m.aed);
  const yearAgo = (m: RevenueMonth) =>
    currency === 'USD' ? m.yearAgoUsd : m.yearAgoAed;

  const last = months.length - 1;
  const top = Math.max(...months.map(value), 1) * 1.1;
  const x = (i: number) => (i / last) * 100;
  const y = (v: number) => 100 - (v / top) * 100;
  const points = months.map((m, i) => `${x(i)},${y(value(m))}`);

  // Solid through the last complete month, dashed into the current one
  const completeEnd = months[last]?.isCurrent ? last - 1 : last;
  const solid = `M${points.slice(0, completeEnd + 1).join(' L')}`;
  const dashed =
    completeEnd < last ? `M${points[completeEnd]} L${points[last]}` : null;
  const area = `M0,100 L${points.join(' L')} L100,100 Z`;

  const complete = months.filter((m) => !m.isCurrent);
  const best = complete.reduce<RevenueMonth | null>(
    (a, m) => (a == null || value(m) > value(a) ? m : a),
    null,
  );
  const last12 = complete.reduce((sum, m) => sum + value(m), 0);
  const average = complete.length > 0 ? last12 / complete.length : 0;

  const marker = hover ?? last;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:gap-8">
        <div className="shrink-0 lg:w-60">
          <p className="text-[13px] font-semibold">Revenue by month</p>
          <p className="text-text-muted text-[11px]">
            Invoiced in Zoho, last 13 months
          </p>
          {!redacted && (
            <dl className="mt-3 grid grid-cols-3 gap-3 text-[11px] lg:grid-cols-1 lg:gap-1.5">
              <div className="lg:flex lg:justify-between">
                <dt className="text-text-muted">Last 12 months</dt>
                <dd className="font-semibold tabular-nums">
                  {full(last12, currency)}
                </dd>
              </div>
              <div className="lg:flex lg:justify-between">
                <dt className="text-text-muted">Monthly average</dt>
                <dd className="font-semibold tabular-nums">
                  {full(average, currency)}
                </dd>
              </div>
              {best && (
                <div className="lg:flex lg:justify-between">
                  <dt className="text-text-muted">Best month</dt>
                  <dd className="font-semibold tabular-nums">
                    {monthLabel(best.month, true)} · {short(value(best))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-24">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="text-text-primary absolute inset-0 h-full w-full overflow-visible"
              aria-hidden
            >
              <line
                x1="0"
                x2="100"
                y1="100"
                y2="100"
                stroke="currentColor"
                opacity="0.15"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              {!redacted && (
                <line
                  x1="0"
                  x2="100"
                  y1={y(average)}
                  y2={y(average)}
                  stroke="currentColor"
                  opacity="0.35"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <path d={area} fill="currentColor" opacity="0.05" />
              <path
                d={solid}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity="0.75"
                vectorEffect="non-scaling-stroke"
              />
              {dashed && (
                <path
                  d={dashed}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity="0.4"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {/* Marker on the hovered month, otherwise this month */}
            <span
              className="border-surface-primary bg-text-primary pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{
                left: `${x(marker)}%`,
                top: `${y(value(months[marker]!))}%`,
              }}
            />

            {/* Hover targets, one per month, centred on its point */}
            {months.map((m, i) => {
              const v = value(m);
              const prior = yearAgo(m);
              const pct =
                prior > 0 ? Math.round(((v - prior) / prior) * 100) : null;
              return (
                <div
                  key={m.month}
                  className="absolute inset-y-0 -translate-x-1/2"
                  style={{ left: `${x(i)}%`, width: `${100 / last}%` }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {hover === i && (
                    <>
                      <div className="border-border-muted pointer-events-none absolute inset-y-0 left-1/2 border-l" />
                      <div
                        className={`border-border-muted bg-surface-primary pointer-events-none absolute top-0 z-10 w-max rounded-lg border px-2.5 py-1.5 text-[11px] shadow-md ${
                          i < last / 2 ? 'left-1/2 ml-3' : 'right-1/2 mr-3'
                        }`}
                      >
                        <p className="font-semibold">
                          {monthLabel(m.month, true)}
                          {m.isCurrent ? ' so far' : ''}
                        </p>
                        <p className="tabular-nums">
                          {redacted ? '•••' : full(v, currency)}
                        </p>
                        {!redacted && (
                          <p className="text-text-muted tabular-nums">
                            {monthLabel(m.month)} last year:{' '}
                            {prior > 0 ? short(prior) : 'none'}
                            {pct != null && !m.isCurrent && (
                              <span
                                className={
                                  pct >= 0 ? 'text-emerald-600' : 'text-red-600'
                                }
                              >
                                {' '}
                                ({pct >= 0 ? '+' : ''}
                                {pct}%)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Month labels, every third so they stay quiet */}
          <div className="text-text-muted relative mt-1.5 h-3 text-[10px]">
            {months.map((m, i) =>
              (last - i) % 3 === 0 ? (
                <span
                  key={m.month}
                  className={`absolute ${i === 0 ? '' : i === last ? '-translate-x-full' : '-translate-x-1/2'}`}
                  style={{ left: `${x(i)}%` }}
                >
                  {monthLabel(m.month)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HomeRevenueChart;
