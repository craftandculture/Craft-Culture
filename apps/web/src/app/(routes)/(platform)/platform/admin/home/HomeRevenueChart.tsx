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

/** Short money for axis and labels: "1.2M", "209k", "850" */
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

/** Round the axis top up to 1, 2 or 5 × a power of ten, split into 4 steps */
const niceTop = (max: number) => {
  if (max <= 0) return 1;
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= rough)! * power;
  return step * 4;
};

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
 * Invoiced revenue per month for the last 13 months, this month so far drawn
 * lighter. Hover a month for its total and the same month a year ago.
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

  const top = niceTop(Math.max(...months.map(value)));
  const ticks = [4, 3, 2, 1, 0].map((i) => (top / 4) * i);

  const complete = months.filter((m) => !m.isCurrent);
  const best = complete.reduce<RevenueMonth | null>(
    (a, m) => (a == null || value(m) > value(a) ? m : a),
    null,
  );
  const last12 = complete.reduce((sum, m) => sum + value(m), 0);
  const average = complete.length > 0 ? last12 / complete.length : 0;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 px-6 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[15px] font-bold">Revenue by month</p>
            <p className="text-text-muted mt-0.5 text-[12px]">
              Invoiced in Zoho, excluding drafts and voids. This month so far
              shown lighter.
            </p>
          </div>
          {!redacted && (
            <dl className="flex gap-6 text-[12px]">
              <div>
                <dt className="text-text-muted">Last 12 months</dt>
                <dd className="font-semibold tabular-nums">
                  {full(last12, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Monthly average</dt>
                <dd className="font-semibold tabular-nums">
                  {full(average, currency)}
                </dd>
              </div>
              {best && (
                <div className="hidden sm:block">
                  <dt className="text-text-muted">Best month</dt>
                  <dd className="font-semibold tabular-nums">
                    {monthLabel(best.month, true)} · {short(value(best))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="flex px-6 pb-4 pt-5">
          {/* Y axis */}
          <div className="text-text-muted relative mr-2 h-48 w-9 shrink-0 text-right text-[10px] tabular-nums">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute right-0 -translate-y-1/2"
                style={{ top: `${(1 - t / top) * 100}%` }}
              >
                {redacted ? '' : short(t)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            {/* Plot */}
            <div className="relative h-48">
              {ticks.map((t) => (
                <div
                  key={t}
                  className={`absolute inset-x-0 border-t ${t === 0 ? 'border-border-primary' : 'border-border-muted border-dashed'}`}
                  style={{ top: `${(1 - t / top) * 100}%` }}
                />
              ))}

              <div className="absolute inset-0 flex items-end gap-0.5 sm:gap-1.5">
                {months.map((m, i) => {
                  const v = value(m);
                  const prior = yearAgo(m);
                  const pct =
                    prior > 0 ? Math.round(((v - prior) / prior) * 100) : null;
                  const isHover = hover === i;
                  return (
                    <div
                      key={m.month}
                      className="relative flex h-full flex-1 cursor-default items-end justify-center"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <div
                        className={`bg-text-primary w-full max-w-9 rounded-t transition-opacity ${
                          m.isCurrent
                            ? 'opacity-35'
                            : hover != null && !isHover
                              ? 'opacity-60'
                              : 'opacity-90'
                        }`}
                        style={{
                          height: v > 0 ? `max(2px, ${(v / top) * 100}%)` : 0,
                        }}
                      />
                      {isHover && (
                        <div
                          className={`border-border-muted bg-surface-primary pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-lg border px-3 py-2 text-[12px] shadow-md ${
                            i < 3
                              ? 'left-0'
                              : i > months.length - 4
                                ? 'right-0'
                                : 'left-1/2 -translate-x-1/2'
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
                                    pct >= 0
                                      ? 'text-emerald-600'
                                      : 'text-red-600'
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
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X axis */}
            <div className="text-text-muted mt-1.5 flex gap-0.5 text-center text-[10px] sm:gap-1.5">
              {months.map((m, i) => (
                <span
                  key={m.month}
                  className={`flex-1 truncate ${i % 2 === 1 ? 'invisible sm:visible' : ''} ${m.isCurrent ? 'text-text-primary font-semibold' : ''}`}
                >
                  {monthLabel(m.month)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HomeRevenueChart;
