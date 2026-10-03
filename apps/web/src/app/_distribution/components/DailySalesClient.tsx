'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import type { DrinkCategory } from '../utils/classifyDrink';
import formatSalesPeriod from '../utils/formatSalesPeriod';
import ownerColour from '../utils/ownerColour';

const money = (value: number, currency: string | null) =>
  `${currency ? `${currency} ` : ''}${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(value)}`;

const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

const longDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

const CATEGORIES: { key: 'all' | DrinkCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'wine', label: 'Wine' },
  { key: 'sparkling', label: 'Sparkling' },
  { key: 'spirits', label: 'Spirits' },
  { key: 'rtd', label: 'RTD' },
];

const Stat = ({ label, value, detail }: { label: string; value: string; detail?: string }) => (
  <div className="border-border-primary rounded-xl border px-4 py-3">
    <Typography variant="bodyXs" colorRole="muted" asChild>
      <p>{label}</p>
    </Typography>
    <p className="text-text-primary mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    {detail ? (
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p className="mt-0.5 tabular-nums">{detail}</p>
      </Typography>
    ) : null}
  </div>
);

/**
 * Daily sales — a visual check of what moved at the outlet each day
 *
 * One chart of the last thirty days, consigned stacked under bought because
 * consignment is what is settled with owners, then the selected day's wines,
 * then consigned stock that has not moved in thirty days. Selecting a bar
 * changes the day below it, so the table is the chart's data view as well as
 * the detail.
 */
const DailySalesClient = () => {
  const api = useTRPC();
  const sales = useQuery(api.distribution.staff.getDailySales.queryOptions({ days: 30 }));
  // Owner colours follow the order on Consignment & Distribution, so an owner looks the same on both
  const setup = useQuery(api.distribution.admin.getSetup.queryOptions());
  const chipFor = (name: string) =>
    ownerColour(setup.data?.owners.findIndex((owner) => owner.name === name) ?? -1).chip;
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [category, setCategory] = useState<'all' | DrinkCategory>('all');

  const queryClient = useQueryClient();

  /*
    The daily pull runs on Trigger.dev, which has gone days without deploying
    before. Pulling here is the way out when the latest count is stale.
  */
  const pull = useMutation({
    ...api.distribution.admin.pullOutletStock.mutationOptions(),
    onSuccess: async (result) => {
      for (const outcome of result.results) {
        if (outcome.ok) toast.success(`${outcome.outlet}: latest count pulled`);
        else toast.error(`${outcome.outlet}: ${outcome.reason}`);
      }
      await queryClient.invalidateQueries({
        queryKey: api.distribution.staff.getDailySales.queryKey(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const send = useMutation({
    ...api.distribution.staff.sendDailySales.mutationOptions(),
    onSuccess: (result) => {
      for (const outlet of result.outlets) {
        toast.success(`Posted ${outlet.outlet} to #cd-sales — ${outlet.bottles} bottles`);
        if (outlet.note) toast.warning(outlet.note);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const data = sales.data;
  /*
    The type filter narrows every figure on the page, so each day is rebuilt
    from its own lines rather than filtering the table alone — a total that
    disagreed with the rows beneath it would be worse than no filter.
  */
  const shown = useMemo(() => {
    const all = data?.days ?? [];
    if (category === 'all') return all;

    return all.map((d) => {
      const lines = d.lines.filter((line) => line.category === category);
      const sum = (regime: 'consigned' | 'bought') => {
        const of = lines.filter((line) => line.regime === regime);
        return {
          bottles: of.reduce((acc, line) => acc + line.sold, 0),
          value: of
            .filter((line) => !data?.currency || line.currency === data.currency)
            .reduce((acc, line) => acc + (line.value ?? 0), 0),
        };
      };
      return { ...d, lines, consigned: sum('consigned'), bought: sum('bought') };
    });
  }, [data, category]);

  const days = useMemo(() => [...shown].reverse(), [shown]);
  const currency = data?.currency ?? null;
  const day = shown.find((d) => d.closedAt === selected) ?? shown[0] ?? null;
  const hover = shown.find((d) => d.closedAt === hovered) ?? null;

  if (sales.isLoading) {
    return (
      <Typography variant="bodySm" colorRole="muted" asChild>
        <p>Loading daily sales…</p>
      </Typography>
    );
  }

  if (sales.error) {
    return (
      <Typography variant="bodySm" colorRole="danger" asChild>
        <p>{sales.error.message}</p>
      </Typography>
    );
  }

  if (!data || data.days.length === 0) {
    return (
      <Typography variant="bodySm" colorRole="muted" asChild>
        <p>No daily sales yet. At least two daily stock counts are needed.</p>
      </Typography>
    );
  }

  const latest = shown[0]!;
  const ageHours = (Date.now() - new Date(latest.closedAt).getTime()) / 36e5;
  const stale = ageHours > 30;
  const totalOf = (d: (typeof shown)[number]) => d.consigned.bottles + d.bought.bottles;
  const valueOf = (d: (typeof shown)[number]) => d.consigned.value + d.bought.value;
  /*
    Rates per calendar day, not per window. A window that spans a missed pull
    covers several days, and dividing by the number of windows overstates the
    daily rate by exactly that much.
  */
  const daysIn = (d: (typeof shown)[number]) => Math.max(1, Math.round(d.spanHours / 24));
  const week: typeof shown = [];
  for (const d of shown) {
    if (week.reduce((sum, w) => sum + daysIn(w), 0) >= 7) break;
    week.push(d);
  }
  const weekDays = week.reduce((sum, d) => sum + daysIn(d), 0);
  const weekAvg = week.reduce((sum, d) => sum + totalOf(d), 0) / weekDays;
  const month = shown.reduce((sum, d) => sum + totalOf(d), 0);
  const monthValue = shown.reduce((sum, d) => sum + valueOf(d), 0);
  const coveredDays = shown.reduce((sum, d) => sum + daysIn(d), 0);
  const firstDay = shown[shown.length - 1]!.salesDate;
  const notMoving = data.notMoving.filter((row) => category === 'all' || row.category === category);
  const feed30 = data.check
    ? category === 'all'
      ? data.check.feed30
      : data.check.feed30ByCategory[category]
    : 0;

  // One scale for every bar, so heights compare across days
  const max = Math.max(1, ...days.map(totalOf));
  const pct = (bottles: number) => `${(bottles / max) * 100}%`;
  const showValues = days.length <= 14;

  const owners = new Map<string, number>();
  for (const line of day?.lines ?? []) {
    const name = line.ownerName ?? 'Not linked';
    owners.set(name, (owners.get(name) ?? 0) + line.sold);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>
            {data.outletName} · latest count {new Date(latest.closedAt).toLocaleString('en-GB', {
              timeZone: 'Asia/Dubai',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            Dubai · posts to #cd-sales at 07:00 daily
          </p>
        </Typography>
        <div className="flex gap-2">
          <Button colorRole="muted" size="sm" isDisabled={pull.isPending} onClick={() => pull.mutate({})}>
            {pull.isPending ? 'Pulling…' : 'Pull latest count'}
          </Button>
          <Button colorRole="muted" size="sm" isDisabled={send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? 'Posting…' : 'Post to #cd-sales now'}
          </Button>
        </div>
      </div>

      {stale ? (
        <div className="border-border-warning bg-fill-warning/10 text-text-warning flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm">
          <span>
            The latest count is {Math.round(ageHours / 24)} days old, so the days since are missing. The daily
            pull has not run — pull now to catch up. Sales since then will land on one combined day.
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by type">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={category === c.key}
            onClick={() => setCategory(c.key)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              category === c.key
                ? 'border-border-brand bg-fill-brand/10 text-text-brand font-medium'
                : 'border-border-primary text-text-muted hover:text-text-primary'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={`Sold ${formatSalesPeriod(latest.salesDate, latest.spanHours)}`}
          value={`${totalOf(latest)} bottles`}
          detail={`${latest.consigned.bottles} consigned · ${latest.bought.bottles} bought`}
        />
        <Stat
          label="Value"
          value={money(valueOf(latest), currency)}
          detail={
            latest.lines.some((line) => line.value === null)
              ? 'at our invoice price · unlinked wines not valued'
              : 'at our invoice price'
          }
        />
        <Stat label="Daily average" value={`${weekAvg.toFixed(1)} a day`} detail={`over the last ${weekDays} days`} />
        <Stat
          label={`Since ${shortDay(firstDay)} · ${coveredDays} days`}
          value={`${month} bottles`}
          detail={money(monthValue, currency)}
        />
      </div>

      {data.check ? (
        <div className="border-border-primary bg-fill-muted/30 flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-xl border px-4 py-3 text-sm">
          <span className="text-text-primary">
            <span className="font-semibold tabular-nums">{feed30}</span>{' '}
            {category === 'all' ? 'bottles' : CATEGORIES.find((c) => c.key === category)?.label.toLowerCase()} sold in the last 30 days
            by City Drinks&apos; own figure
            {category === 'all' ? <span className="text-text-muted"> · {data.check.feed30Consigned} consigned</span> : null}
          </span>
          <span className="text-text-muted">
            Our daily counts cover {data.check.daysCovered} of those 30 days and find{' '}
            <span className="tabular-nums">{month}</span>. Gaps between counts, and restocks inside
            them, make ours lower until a full month of daily counts exists.
          </span>
        </div>
      ) : null}

      <div className="border-border-primary rounded-xl border px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Typography variant="labelSm" asChild>
            <h2>Bottles sold per day</h2>
          </Typography>
          <div className="text-text-muted flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="bg-fill-brand inline-block size-2.5 rounded-sm" /> Consigned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-text-muted inline-block size-2.5 rounded-sm opacity-60" /> Bought
            </span>
          </div>
        </div>

        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mb-2 min-h-4 tabular-nums">
            {hover
              ? `${formatSalesPeriod(hover.salesDate, hover.spanHours)}: ${hover.consigned.bottles} consigned, ${hover.bought.bottles} bought · ${money(valueOf(hover), currency)}`
              : 'Select a day to see what sold.'}
          </p>
        </Typography>

        {/*
          Plain HTML bars rather than a scaled SVG: the plot keeps a fixed
          height and each bar a capped width whether there are five days or
          thirty, where a viewBox stretched to the container made five days
          into five slabs.
        */}
        <div className="flex gap-3">
          <div className="text-text-muted flex h-48 w-8 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums">
            <span>{max}</span>
            <span>{Math.round(max / 2)}</span>
            <span>0</span>
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div
              className="border-border-primary relative flex h-48 items-end gap-1 border-b sm:gap-1.5"
              style={{ minWidth: `${days.length * 14}px` }}
            >
              <div className="border-border-primary pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed opacity-60" />
              {days.map((d) => {
                const isOn = (day?.closedAt ?? null) === d.closedAt;
                const dim = selected && !isOn ? 'opacity-50' : '';

                return (
                  <button
                    key={d.closedAt}
                    type="button"
                    aria-label={`${longDay(d.salesDate)}: ${totalOf(d)} bottles`}
                    aria-pressed={isOn}
                    onClick={() => setSelected(d.closedAt)}
                    onMouseEnter={() => setHovered(d.closedAt)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(d.closedAt)}
                    onBlur={() => setHovered(null)}
                    className={`group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-border-brand ${
                      isOn ? 'bg-fill-muted/60' : 'hover:bg-fill-muted/40'
                    }`}
                  >
                    {showValues && totalOf(d) > 0 ? (
                      <span className="text-text-muted mb-1 text-[10px] font-medium tabular-nums">
                        {totalOf(d)}
                      </span>
                    ) : null}
                    <span
                      className={`bg-text-muted w-3/5 max-w-8 rounded-t-[4px] opacity-60 ${dim}`}
                      style={{ height: pct(d.bought.bottles) }}
                    />
                    <span
                      className={`bg-fill-brand w-3/5 max-w-8 ${d.bought.bottles > 0 ? 'mt-0.5' : 'rounded-t-[4px]'} ${dim}`}
                      style={{ height: pct(d.consigned.bottles) }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-1 sm:gap-1.5" style={{ minWidth: `${days.length * 14}px` }}>
              {days.map((d, i) => (
                <span
                  key={d.closedAt}
                  className="text-text-muted min-w-0 flex-1 text-center text-[10px] leading-tight tabular-nums"
                >
                  {days.length <= 14 || i % 5 === (days.length - 1) % 5 ? shortDay(d.salesDate) : ''}
                  {daysIn(d) > 1 ? (
                    <span className="text-text-warning block font-medium" title="Covers several days: a daily pull was missed">
                      {daysIn(d)}d
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {day ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Typography variant="labelSm" asChild>
              <h2>
                What sold {formatSalesPeriod(day.salesDate, day.spanHours)} · {totalOf(day)} bottles · {money(valueOf(day), currency)}
              </h2>
            </Typography>
            {day.spanHours > 30 ? (
              <Badge size="xs" colorRole="warning">
                covers {Math.round(day.spanHours / 24)} days — a pull was missed
              </Badge>
            ) : null}
          </div>

          {owners.size > 0 ? (
            <div className="flex flex-wrap gap-2">
              {[...owners.entries()]
                .sort((a, b) => (a[0] === 'Not linked' ? 1 : b[0] === 'Not linked' ? -1 : b[1] - a[1]))
                .map(([name, bottles]) => (
                  <span
                    key={name}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chipFor(name)}`}
                  >
                    {name} <span className="tabular-nums opacity-70">{bottles}</span>
                  </span>
                ))}
            </div>
          ) : null}

          {day.lines.length === 0 ? (
            <Typography variant="bodySm" colorRole="muted" asChild>
              <p>Nothing sold that day.</p>
            </Typography>
          ) : (
            <div className="border-border-primary overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-text-muted border-border-primary border-b">
                  <tr>
                    <th className="py-2 pl-4 pr-3 font-medium">Wine</th>
                    <th className="py-2 pr-3 font-medium">Owner</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 text-right font-medium">Sold</th>
                    <th className="py-2 pr-3 text-right font-medium">Left at outlet</th>
                    <th className="py-2 pr-4 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {day.lines.map((line) => (
                    <tr key={line.outletCode} className="border-border-primary border-b last:border-0">
                      <td className="py-2 pl-4 pr-3">
                        <div className="text-text-primary">{line.productName}</div>
                        <div className="text-text-muted text-xs">{line.outletCode}</div>
                      </td>
                      <td className="text-text-muted py-2 pr-3">{line.ownerName ?? 'Not linked'}</td>
                      <td className="py-2 pr-3">
                        <Badge size="xs" colorRole={line.regime === 'consigned' ? 'brand' : 'muted'}>
                          {line.regime}
                        </Badge>
                      </td>
                      <td className="text-text-primary py-2 pr-3 text-right font-medium tabular-nums">
                        {line.sold}
                      </td>
                      <td className="text-text-muted py-2 pr-3 text-right tabular-nums">{line.heldAfter}</td>
                      <td className="text-text-muted py-2 pr-4 text-right tabular-nums">
                        {line.value !== null ? money(line.value, line.currency) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {day.restocks.length > 0 ? (
            <Typography variant="bodyXs" colorRole="muted" asChild>
              <p>
                Restocked beyond our invoices: {day.restocks.map((r) => `${r.productName} (+${r.bottles})`).join(', ')}.
                Not counted as sales.
              </p>
            </Typography>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Typography variant="labelSm" asChild>
          <h2>Consigned stock not moving · no sale in 30 days</h2>
        </Typography>
        {notMoving.length === 0 ? (
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p>Every consigned wine at the outlet has sold in the last 30 days.</p>
          </Typography>
        ) : (
          <div className="border-border-primary divide-border-primary divide-y rounded-xl border">
            {notMoving.map((row) => (
              <div key={`${row.productName}-${row.ownerName}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-text-primary">{row.productName}</span>
                <span className="text-text-muted flex shrink-0 items-center gap-3">
                  <span>{row.ownerName ?? 'Not linked'}</span>
                  <span className="tabular-nums">{row.held} held</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Typography variant="bodyXs" colorRole="muted" asChild>
        <p>
          {data.unlinked > 0
            ? `${data.unlinked} wines on their feed are not linked to ours, so show no owner or value — link them on Consignment & Distribution.`
            : ''}
        </p>
      </Typography>
    </div>
  );
};

export default DailySalesClient;
