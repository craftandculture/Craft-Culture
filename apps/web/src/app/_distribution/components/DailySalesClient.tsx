'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { AED_PER_USD } from '@/app/_exportInvoices/constants';
import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import LineFixPanel from './LineFixPanel';
import LinkWinePicker from './LinkWinePicker';
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
  const queryClient = useQueryClient();
  const sales = useQuery(api.distribution.staff.getDailySales.queryOptions({ days: 62 }));
  // Owner colours follow the order on Consignment & Distribution, so an owner looks the same on both
  const setup = useQuery(api.distribution.admin.getSetup.queryOptions());
  const chipFor = (name: string) =>
    ownerColour(setup.data?.owners.findIndex((owner) => owner.name === name) ?? -1).chip;
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  /*
    Several types at once: wine and sparkling are both wine, and are often
    wanted together. None selected means everything.
  */
  const [types, setTypes] = useState<DrinkCategory[]>([]);
  const [allWines, setAllWines] = useState(false);
  const [winesOpen, setWinesOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(true);
  const [period, setPeriod] = useState<'this' | 'last'>('this');
  const [display, setDisplay] = useState<'USD' | 'AED'>('USD');
  const [linking, setLinking] = useState<string | null>(null);

  const refresh = async () => {
    setLinking(null);
    await queryClient.invalidateQueries({ queryKey: api.distribution.staff.getDailySales.queryKey() });
  };

  /* Bought lines matched to our sales orders by name: preview, then apply */
  const autoLink = useMutation({
    ...api.distribution.admin.autoLinkCodes.mutationOptions(),
    onSuccess: async (result) => {
      if (result.mode === 'preview') {
        toast.info(`${result.proposals.length} bought wines can be linked by name; ${result.heldBack ?? 0} need a person.`);
        return;
      }
      toast.success(result.mode === 'undo' ? `Removed ${result.linked} automatic links` : `Linked ${result.linked} bought wines`);
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  /*
    Every amount on the page in the chosen currency, at the fixed dirham peg —
    the same constant the export invoices use, so the two never disagree.
  */
  const toDisplay = (value: number, from: string | null) => {
    const source = from ?? display;

    if (source === display) return value;

    return source === 'USD' ? value * AED_PER_USD : value / AED_PER_USD;
  };
  const show = (value: number, from: string | null) => money(toDisplay(value, from), display);
  const match = (category: DrinkCategory) => types.length === 0 || types.includes(category);
  const toggleType = (key: 'all' | DrinkCategory) => {
    if (key === 'all') return setTypes([]);
    const next = types.includes(key) ? types.filter((t) => t !== key) : [...types, key];
    setTypes(next.length === CATEGORIES.length - 1 ? [] : next);
  };


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
    if (types.length === 0) return all;

    return all.map((d) => {
      const lines = d.lines.filter((line) => types.includes(line.category));
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
  }, [data, types]);

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
  const notMoving = data.notMoving.filter((row) => match(row.category));
  const feed30 = data.check
    ? types.length === 0
      ? data.check.feed30
      : types.reduce((sum, t) => sum + (data.check?.feed30ByCategory[t] ?? 0), 0)
    : 0;
  const typeLabel =
    types.length === 0
      ? 'bottles'
      : CATEGORIES.filter((c) => c.key !== 'all' && types.includes(c.key as DrinkCategory))
          .map((c) => c.label.toLowerCase())
          .join(' + ');

  /* What the outlet holds at a count, narrowed by the type filter */
  const stockOf = (d: (typeof shown)[number] | undefined) => {
    const out = { consigned: { bottles: 0, value: 0 }, bought: { bottles: 0, value: 0 }, unvalued: 0 };
    for (const g of d?.stock ?? []) {
      if (!match(g.category)) continue;
      out[g.regime].bottles += g.bottles;
      out[g.regime].value += g.value;
      out.unvalued += g.unvalued;
    }
    return out;
  };
  const stockNow = stockOf(latest);
  const stockBefore = shown[1] ? stockOf(shown[1]) : null;
  const stockValue = (st: ReturnType<typeof stockOf>) => st.consigned.value + st.bought.value;
  const stockBottles = (st: ReturnType<typeof stockOf>) => st.consigned.bottles + st.bought.bottles;
  const stockTrend = days.map((d) => ({ date: d.salesDate, value: stockValue(stockOf(d)) }));
  const trendMax = Math.max(1, ...stockTrend.map((p) => p.value));

  const stockOwners = new Map<string, { consigned: number; consignedValue: number; bought: number; boughtValue: number }>();
  for (const g of latest.stock) {
    if (!match(g.category)) continue;
    const name = g.ownerName ?? 'Not linked';
    const row = stockOwners.get(name) ?? { consigned: 0, consignedValue: 0, bought: 0, boughtValue: 0 };
    if (g.regime === 'consigned') {
      row.consigned += g.bottles;
      row.consignedValue += g.value;
    } else {
      row.bought += g.bottles;
      row.boughtValue += g.value;
    }
    stockOwners.set(name, row);
  }
  const ownerRows = [...stockOwners.entries()].sort((a, b) =>
    a[0] === 'Not linked' ? 1 : b[0] === 'Not linked' ? -1 : b[1].consignedValue + b[1].boughtValue - (a[1].consignedValue + a[1].boughtValue),
  );
  const heldWines = data.stockWines.filter((w) => match(w.category));
  const heldTotal = heldWines.reduce((sum, w) => sum + (w.value ?? 0), 0);

  /*
    Settlement, consigned stock only: what sold in the month is due (the
    outlet pays C&C, and C&C settles the owner), and what is still on their
    shelf is pending. Bought stock is the outlet's own and owes nobody.
    A window is counted in the month its first day falls in.
  */
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  const [ty, tm] = today.split('-').map(Number) as [number, number];
  const monthKey =
    period === 'this'
      ? `${ty}-${String(tm).padStart(2, '0')}`
      : tm === 1
        ? `${ty - 1}-12`
        : `${ty}-${String(tm - 1).padStart(2, '0')}`;
  const monthName = new Date(`${monthKey}-15T12:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const inMonth = shown.filter((d) => d.salesDate.startsWith(monthKey));
  const monthDaysCovered = inMonth.reduce((sum, d) => sum + daysIn(d), 0);

  const settle = new Map<string, { soldBottles: number; soldValue: number; heldBottles: number; heldValue: number }>();
  const settleRow = (name: string) =>
    settle.get(name) ?? { soldBottles: 0, soldValue: 0, heldBottles: 0, heldValue: 0 };

  for (const d of inMonth) {
    for (const line of d.lines) {
      if (line.regime !== 'consigned') continue;
      const name = line.ownerName ?? 'Not linked';
      const row = settleRow(name);
      row.soldBottles += line.sold;
      row.soldValue += line.value !== null ? toDisplay(line.value, line.currency) : 0;
      settle.set(name, row);
    }
  }

  for (const [name, row] of stockOwners) {
    if (!row.consigned) continue;
    const entry = settleRow(name);
    entry.heldBottles += row.consigned;
    entry.heldValue += toDisplay(row.consignedValue, currency);
    settle.set(name, entry);
  }

  const settleRows = [...settle.entries()].sort((a, b) =>
    a[0] === 'Not linked' ? 1 : b[0] === 'Not linked' ? -1 : b[1].soldValue - a[1].soldValue || b[1].heldValue - a[1].heldValue,
  );
  const settleTotal = settleRows.reduce(
    (acc, [, r]) => ({
      soldBottles: acc.soldBottles + r.soldBottles,
      soldValue: acc.soldValue + r.soldValue,
      heldBottles: acc.heldBottles + r.heldBottles,
      heldValue: acc.heldValue + r.heldValue,
    }),
    { soldBottles: 0, soldValue: 0, heldBottles: 0, heldValue: 0 },
  );

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="border-border-primary flex overflow-hidden rounded-full border text-xs" role="group" aria-label="Currency">
            {(['USD', 'AED'] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={display === c}
                onClick={() => setDisplay(c)}
                className={`px-3 py-1 font-medium ${display === c ? 'bg-fill-brand text-text-brand-on-fill' : 'text-text-muted hover:text-text-primary'}`}
              >
                {c}
              </button>
            ))}
          </div>
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
            aria-pressed={c.key === 'all' ? types.length === 0 : types.includes(c.key)}
            onClick={() => toggleType(c.key)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              (c.key === 'all' ? types.length === 0 : types.includes(c.key))
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
          value={show(valueOf(latest), currency)}
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
          detail={show(monthValue, currency)}
        />
      </div>

      <div className="border-border-primary rounded-xl border">
        <button
          type="button"
          onClick={() => setSettleOpen(!settleOpen)}
          aria-expanded={settleOpen}
          className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span>
            <span className="text-text-primary text-sm font-semibold">Settlement · consigned stock</span>
            <span className="text-text-muted ml-2 text-xs tabular-nums">
              {monthName}: {show(settleTotal.soldValue, display)} to be paid · {show(settleTotal.heldValue, display)} pending
            </span>
          </span>
          <span className="text-text-muted text-xs">{settleOpen ? 'Hide' : 'Show'}</span>
        </button>

        {settleOpen ? (
          <div className="border-border-primary space-y-3 border-t px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5" role="group" aria-label="Month">
                {(['this', 'last'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={period === p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      period === p
                        ? 'border-border-brand bg-fill-brand/10 text-text-brand font-medium'
                        : 'border-border-primary text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {p === 'this' ? 'This month' : 'Last month'}
                  </button>
                ))}
              </div>
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <p className="tabular-nums">Daily counts cover {monthDaysCovered} days of {monthName}</p>
              </Typography>
            </div>

            <div className="border-border-primary overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[38rem] text-left text-sm">
                <thead className="text-text-muted border-border-primary border-b">
                  <tr>
                    <th className="py-2 pl-4 pr-3 font-medium">Owner</th>
                    <th className="border-border-primary border-l py-2 pl-3 pr-3 text-right font-medium" colSpan={2}>
                      To be paid · sold in {monthName.split(' ')[0]}
                    </th>
                    <th className="border-border-primary border-l py-2 pl-3 pr-4 text-right font-medium" colSpan={2}>
                      Pending · still held
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {settleRows.map(([name, r]) => (
                    <tr key={name} className="border-border-primary border-b last:border-0">
                      <td className="py-2 pl-4 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chipFor(name)}`}>{name}</span>
                      </td>
                      <td className="border-border-primary text-text-muted border-l py-2 pl-3 pr-3 text-right tabular-nums">
                        {r.soldBottles || '—'}
                      </td>
                      <td className="text-text-primary py-2 pr-3 text-right font-semibold tabular-nums">
                        {r.soldBottles ? show(r.soldValue, display) : '—'}
                      </td>
                      <td className="border-border-primary text-text-muted border-l py-2 pl-3 pr-3 text-right tabular-nums">
                        {r.heldBottles || '—'}
                      </td>
                      <td className="text-text-muted py-2 pr-4 text-right tabular-nums">
                        {r.heldBottles ? show(r.heldValue, display) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-fill-muted/30 font-medium">
                    <td className="py-2 pl-4 pr-3">Total</td>
                    <td className="border-border-primary border-l py-2 pl-3 pr-3 text-right tabular-nums">{settleTotal.soldBottles}</td>
                    <td className="text-text-primary py-2 pr-3 text-right font-semibold tabular-nums">
                      {show(settleTotal.soldValue, display)}
                    </td>
                    <td className="border-border-primary border-l py-2 pl-3 pr-3 text-right tabular-nums">{settleTotal.heldBottles}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{show(settleTotal.heldValue, display)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Typography variant="bodyXs" colorRole="muted" asChild>
              <p>
                <strong>To be paid:</strong> consigned bottles City Drinks sold in the month. City Drinks pay C&amp;C, and
                C&amp;C settles each owner; Craft &amp; Culture&apos;s own stock stays with us.{' '}
                <strong>Pending:</strong> consigned bottles still at City Drinks, not yet due. Valued at our invoice price
                to City Drinks; owners are settled at their agreed price.
              </p>
            </Typography>
          </div>
        ) : null}
      </div>

      {/*
        What they hold of ours, in money. The level is a line because it is
        one quantity over time; consigned is the part still owed to owners
        until it sells, so it is named on its own.
      */}
      <div className="border-border-primary space-y-4 rounded-xl border px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <Typography variant="labelSm" asChild>
              <h2>Stock at {data.outletName}</h2>
            </Typography>
            <p className="text-text-primary mt-1 text-3xl font-semibold tabular-nums">
              {show(stockValue(stockNow), currency)}
            </p>
            <Typography variant="bodyXs" colorRole="muted" asChild>
              <p className="mt-1 tabular-nums">
                {stockBottles(stockNow)} bottles at the latest count · consigned{' '}
                {show(stockNow.consigned.value, currency)} ({stockNow.consigned.bottles}) · bought{' '}
                {show(stockNow.bought.value, currency)} ({stockNow.bought.bottles})
              </p>
            </Typography>
            {stockBefore ? (
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <p className="mt-0.5 tabular-nums">
                  {stockValue(stockNow) >= stockValue(stockBefore) ? 'Up' : 'Down'}{' '}
                  {show(Math.abs(stockValue(stockNow) - stockValue(stockBefore)), currency)} since the previous
                  count
                </p>
              </Typography>
            ) : null}
            {stockNow.unvalued > 0 ? (
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <p className="mt-0.5">{stockNow.unvalued} bottles not valued: wines not linked to ours.</p>
              </Typography>
            ) : null}
          </div>

          {stockTrend.length > 1 ? (
            <div className="w-full max-w-md flex-1">
              <div className="text-text-muted mb-1 flex justify-between text-[10px] tabular-nums">
                <span>Value at each count</span>
                <span>{show(trendMax, currency)}</span>
              </div>
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-24 w-full" aria-hidden="true">
                <line x1="0" x2="100" y1="40" y2="40" className="stroke-border-primary" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <polyline
                  fill="none"
                  className="stroke-fill-brand"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  points={stockTrend
                    .map((pt, i) => `${(i / (stockTrend.length - 1)) * 100},${40 - (pt.value / trendMax) * 36}`)
                    .join(' ')}
                />
              </svg>
              <div className="text-text-muted mt-1 flex justify-between text-[10px] tabular-nums">
                <span>{shortDay(stockTrend[0]!.date)}</span>
                <span>{shortDay(stockTrend[stockTrend.length - 1]!.date)}</span>
              </div>
            </div>
          ) : null}
        </div>

        {ownerRows.length > 0 ? (
          <div className="border-border-primary overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-text-muted border-border-primary border-b">
                <tr>
                  <th className="py-2 pl-4 pr-3 font-medium">Owner</th>
                  <th className="py-2 pr-3 text-right font-medium">Consigned</th>
                  <th className="py-2 pr-3 text-right font-medium">Value</th>
                  <th className="py-2 pr-3 text-right font-medium">Bought</th>
                  <th className="py-2 pr-4 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {ownerRows.map(([name, row]) => (
                  <tr key={name} className="border-border-primary border-b last:border-0">
                    <td className="py-2 pl-4 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chipFor(name)}`}>{name}</span>
                    </td>
                    <td className="text-text-muted py-2 pr-3 text-right tabular-nums">{row.consigned || '—'}</td>
                    <td className="text-text-primary py-2 pr-3 text-right font-medium tabular-nums">
                      {row.consigned ? show(row.consignedValue, currency) : '—'}
                    </td>
                    <td className="text-text-muted py-2 pr-3 text-right tabular-nums">{row.bought || '—'}</td>
                    <td className="text-text-muted py-2 pr-4 text-right tabular-nums">
                      {row.bought ? show(row.boughtValue, currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {heldWines.length > 0 ? (
          <div className="border-border-primary rounded-lg border">
            <button
              type="button"
              onClick={() => setWinesOpen(!winesOpen)}
              aria-expanded={winesOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm"
            >
              <span className="text-text-primary font-medium">
                Wines held <span className="text-text-muted font-normal tabular-nums">· {heldWines.length} · {show(heldTotal, currency)}</span>
              </span>
              <span className="text-text-muted text-xs">{winesOpen ? 'Hide' : 'Show'}</span>
            </button>
            {winesOpen ? (
            <div className="border-border-primary divide-border-primary divide-y border-t">
              {(allWines ? heldWines : heldWines.slice(0, 10)).map((w) => (
                <div key={`${w.outletCode}-${w.regime}`}>
                <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className="text-text-primary min-w-0 truncate">{w.productName}</span>
                  <span className="text-text-muted flex shrink-0 items-center gap-3 tabular-nums">
                    <span className={`hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline ${chipFor(w.ownerName ?? 'Not linked')}`}>
                      {w.ownerName ?? (w.linked ? 'No invoice' : 'Not linked')}
                    </span>
                    {!w.linked || !w.ownerName ? (
                      <button
                        type="button"
                        onClick={() => setLinking(linking === `held-${w.outletCode}` ? null : `held-${w.outletCode}`)}
                        className="text-text-brand text-xs font-medium hover:underline"
                      >
                        {w.linked ? 'Fix' : 'Link'}
                      </button>
                    ) : null}
                    <span>{w.held} held</span>
                    <span className="text-text-primary w-24 text-right">{w.value !== null ? show(w.value, currency) : '—'}</span>
                  </span>
                </div>
                {linking === `held-${w.outletCode}` ? (
                  <div className="px-4 pb-3">
                    {w.linked ? (
                      <LineFixPanel
                        outletId={data.outletId}
                        outletCode={w.outletCode}
                        lwin={w.lwin}
                        productName={w.productName}
                        owners={setup.data?.owners ?? []}
                        ownerChip={chipFor}
                        onDone={refresh}
                        onCancel={() => setLinking(null)}
                      />
                    ) : (
                      <LinkWinePicker
                        outletId={data.outletId}
                        outletCode={w.outletCode}
                        productName={w.productName}
                        onLinked={refresh}
                        onCancel={() => setLinking(null)}
                      />
                    )}
                  </div>
                ) : null}
                </div>
              ))}
            </div>
            ) : null}
            {winesOpen && heldWines.length > 10 ? (
              <button
                type="button"
                onClick={() => setAllWines(!allWines)}
                className="text-text-brand border-border-primary w-full border-t px-4 py-2 text-left text-xs font-medium hover:underline"
              >
                {allWines ? 'Show the top 10' : `Show all ${heldWines.length} wines`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {data.check ? (
        <div className="border-border-primary bg-fill-muted/30 flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-xl border px-4 py-3 text-sm">
          <span className="text-text-primary">
            <span className="font-semibold tabular-nums">{feed30}</span>{' '}
            {typeLabel} sold in the last 30 days
            by City Drinks&apos; own figure
            {types.length === 0 ? <span className="text-text-muted"> · {data.check.feed30Consigned} consigned</span> : null}
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
              ? `${formatSalesPeriod(hover.salesDate, hover.spanHours)}: ${hover.consigned.bottles} consigned, ${hover.bought.bottles} bought · ${show(valueOf(hover), currency)}`
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
                What sold {formatSalesPeriod(day.salesDate, day.spanHours)} · {totalOf(day)} bottles · {show(valueOf(day), currency)}
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
                    <Fragment key={line.outletCode}>
                    <tr className="border-border-primary border-b last:border-0">
                      <td className="py-2 pl-4 pr-3">
                        <div className="text-text-primary">{line.productName}</div>
                        <div className="text-text-muted text-xs">{line.outletCode}</div>
                      </td>
                      <td className="text-text-muted py-2 pr-3">
                        {line.linked && line.ownerName ? (
                          line.ownerName
                        ) : line.linked ? (
                          <span className="flex items-center gap-2">
                            No invoice
                            <button
                              type="button"
                              onClick={() => setLinking(linking === `fix-${line.outletCode}` ? null : `fix-${line.outletCode}`)}
                              className="text-text-brand text-xs font-medium hover:underline"
                            >
                              Fix
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            Not linked
                            <button
                              type="button"
                              onClick={() => setLinking(linking === line.outletCode ? null : line.outletCode)}
                              className="text-text-brand text-xs font-medium hover:underline"
                            >
                              Link
                            </button>
                          </span>
                        )}
                      </td>
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
                        {line.value !== null ? show(line.value, line.currency) : '—'}
                      </td>
                    </tr>
                    {linking === `fix-${line.outletCode}` ? (
                      <tr className="border-border-primary border-b">
                        <td colSpan={6} className="px-4 py-3">
                          <LineFixPanel
                            outletId={data.outletId}
                            outletCode={line.outletCode}
                            lwin={line.lwin}
                            productName={line.productName}
                            owners={setup.data?.owners ?? []}
                            ownerChip={chipFor}
                            onDone={refresh}
                            onCancel={() => setLinking(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                    {linking === line.outletCode ? (
                      <tr className="border-border-primary border-b">
                        <td colSpan={6} className="px-4 py-3">
                          <LinkWinePicker
                            outletId={data.outletId}
                            outletCode={line.outletCode}
                            productName={line.productName}
                            onLinked={refresh}
                            onCancel={() => setLinking(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
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

      {data.unlinked > 0 ? (
        <div className="border-border-primary flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm">
          <span className="text-text-muted">
            {data.unlinked} wines at {data.outletName} are not linked to ours, so they show no owner or value. Use{' '}
            <strong>Link</strong> beside any of them, or link the bought ones from our sales orders by name.
          </span>
          <span className="flex flex-wrap gap-2">
            <Button
              colorRole="muted"
              size="sm"
              isDisabled={autoLink.isPending}
              onClick={() => autoLink.mutate({ outletId: data.outletId, mode: 'preview', scope: 'bought' })}
            >
              Preview auto-link
            </Button>
            <Button
              colorRole="brand"
              size="sm"
              isDisabled={autoLink.isPending}
              onClick={() => autoLink.mutate({ outletId: data.outletId, mode: 'apply', scope: 'bought' })}
            >
              {autoLink.isPending ? 'Linking…' : 'Auto-link bought wines'}
            </Button>
            <Button
              colorRole="muted"
              size="sm"
              isDisabled={autoLink.isPending}
              onClick={() => autoLink.mutate({ outletId: data.outletId, mode: 'undo', scope: 'bought' })}
            >
              Undo auto-links
            </Button>
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default DailySalesClient;
