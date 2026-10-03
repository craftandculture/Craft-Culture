'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

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
  const days = useMemo(() => [...(data?.days ?? [])].reverse(), [data]);
  const currency = data?.currency ?? null;
  const day = data?.days.find((d) => d.closedAt === selected) ?? data?.days[0] ?? null;
  const hover = data?.days.find((d) => d.closedAt === hovered) ?? null;

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

  const latest = data.days[0]!;
  const totalOf = (d: (typeof data.days)[number]) => d.consigned.bottles + d.bought.bottles;
  const valueOf = (d: (typeof data.days)[number]) => d.consigned.value + d.bought.value;
  const week = data.days.slice(0, 7);
  const weekAvg = week.reduce((sum, d) => sum + totalOf(d), 0) / week.length;
  const month = data.days.reduce((sum, d) => sum + totalOf(d), 0);
  const monthValue = data.days.reduce((sum, d) => sum + valueOf(d), 0);

  // Chart geometry: one slot per day, bars rounded at the top only
  const max = Math.max(1, ...days.map(totalOf));
  const slot = 28;
  const barW = 18;
  const plotH = 160;
  const width = days.length * slot;
  const y = (bottles: number) => (bottles / max) * plotH;

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
        <Button colorRole="muted" size="sm" isDisabled={send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? 'Posting…' : 'Post to #cd-sales now'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={`Sold ${longDay(latest.salesDate)}`}
          value={`${totalOf(latest)} bottles`}
          detail={`${latest.consigned.bottles} consigned · ${latest.bought.bottles} bought`}
        />
        <Stat label="Value that day" value={money(valueOf(latest), currency)} detail="at our invoice price" />
        <Stat label="7-day average" value={`${weekAvg.toFixed(1)} a day`} detail={`over ${week.length} days`} />
        <Stat
          label={`Last ${data.days.length} days`}
          value={`${month} bottles`}
          detail={money(monthValue, currency)}
        />
      </div>

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
              ? `${longDay(hover.salesDate)}: ${hover.consigned.bottles} consigned, ${hover.bought.bottles} bought · ${money(valueOf(hover), currency)}`
              : 'Select a day to see what sold.'}
          </p>
        </Typography>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${plotH + 22}`}
            className="block h-auto w-full"
            style={{ minWidth: `${Math.max(width, 320)}px` }}
            role="img"
            aria-label={`Bottles sold per day over the last ${days.length} days`}
          >
            <line
              x1={0}
              x2={width}
              y1={plotH}
              y2={plotH}
              className="stroke-border-primary"
              strokeWidth={1}
            />
            {days.map((d, i) => {
              const x = i * slot + (slot - barW) / 2;
              const cH = y(d.consigned.bottles);
              const bH = y(d.bought.bottles);
              const isOn = (day?.closedAt ?? null) === d.closedAt;

              return (
                <g
                  key={d.closedAt}
                  role="button"
                  tabIndex={0}
                  aria-label={`${longDay(d.salesDate)}: ${totalOf(d)} bottles`}
                  className="cursor-pointer outline-none"
                  onClick={() => setSelected(d.closedAt)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(d.closedAt)}
                  onMouseEnter={() => setHovered(d.closedAt)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(d.closedAt)}
                  onBlur={() => setHovered(null)}
                >
                  {/* Hit target taller and wider than the bar */}
                  <rect x={i * slot} y={0} width={slot} height={plotH + 22} fill="transparent" />
                  {cH > 0 ? (
                    <rect
                      x={x}
                      y={plotH - cH}
                      width={barW}
                      height={cH}
                      rx={bH > 0 ? 0 : 4}
                      className="fill-fill-brand"
                      opacity={isOn || !selected ? 1 : 0.55}
                    />
                  ) : null}
                  {bH > 0 ? (
                    <rect
                      x={x}
                      y={plotH - cH - bH - (cH > 0 ? 2 : 0)}
                      width={barW}
                      height={bH}
                      rx={4}
                      className="fill-text-muted"
                      opacity={isOn || !selected ? 0.6 : 0.35}
                    />
                  ) : null}
                  {isOn ? (
                    <rect
                      x={x - 3}
                      y={plotH + 4}
                      width={barW + 6}
                      height={2}
                      rx={1}
                      className="fill-fill-brand"
                    />
                  ) : null}
                  {i % 5 === days.length % 5 || i === days.length - 1 ? (
                    <text
                      x={i * slot + slot / 2}
                      y={plotH + 18}
                      textAnchor="middle"
                      className="fill-text-muted"
                      fontSize={9}
                    >
                      {shortDay(d.salesDate)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {day ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Typography variant="labelSm" asChild>
              <h2>
                What sold on {longDay(day.salesDate)} · {totalOf(day)} bottles · {money(valueOf(day), currency)}
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
                .sort((a, b) => b[1] - a[1])
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
        {data.notMoving.length === 0 ? (
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p>Every consigned wine at the outlet has sold in the last 30 days.</p>
          </Typography>
        ) : (
          <div className="border-border-primary divide-border-primary divide-y rounded-xl border">
            {data.notMoving.map((row) => (
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
          {data.check
            ? `Check: ${data.check.derived30} bottles derived over 30 days, against ${data.check.feed30} in the outlet's own 30-day figure. `
            : 'The 30-day check against the outlet’s own figure appears once 30 daily counts exist. '}
          {data.unlinked > 0
            ? `${data.unlinked} wines on their feed are not linked to ours, so show no owner or value — link them on Consignment & Distribution.`
            : ''}
        </p>
      </Typography>
    </div>
  );
};

export default DailySalesClient;
