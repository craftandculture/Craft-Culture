'use client';

import {
  IconBottle,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconGift,
  IconHome,
  IconTruckDelivery,
} from '@tabler/icons-react';
import type { inferRouterOutputs } from '@trpc/server';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

import bottleName from '@/app/_cellar/utils/bottleName';
import collectorWineName from '@/app/_cellar/utils/collectorWineName';
import deliveryStage, { DELIVERY_STAGES } from '@/app/_cellar/utils/deliveryStage';
import describePreferredDelivery from '@/app/_cellar/utils/describePreferredDelivery';
import type { AppRouter } from '@/trpc-router';

type Request =
  inferRouterOutputs<AppRouter>['cellar']['member']['getReleases']['requests'][number];

export interface DeliveriesPanelProps {
  requests: Request[];
  /** Deliveries under way sit above the wine; ones already made sit below it */
  section: 'live' | 'past';
  /** Lets the member fold live deliveries to one line; remembered on the device */
  collapsible?: boolean;
}

/** How far a delivery has got, from the warehouse's own stages */
const stepOf = (request: Request) => deliveryStage(request);

/** When each stage was reached, where the Index records it */
const reachedAt = (request: Request): (Date | null)[] =>
  [
    request.confirmedAt,
    request.pickStartedAt,
    request.packedAt,
    request.collectedAt,
    null,
    request.deliveredAt,
  ].map((value) => (value ? new Date(value) : null));

const stamp = (date: Date) => format(date, 'd MMM, HH:mm');

/*
  One step per stage of the team's own process: confirmed, picked, packed,
  collected, out for delivery, delivered. Done steps carry a tick and the time
  they happened; the current one is ringed. On a phone only the current stage
  is named, or six labels would not fit.
*/
const ProgressSteps = ({ step, times }: { step: number; times: (Date | null)[] }) => (
  <ol className="grid grid-cols-6" aria-label="Delivery progress">
    {DELIVERY_STAGES.map(({ label }, index) => {
      const done = index < step || (index === step && step === DELIVERY_STAGES.length - 1);
      const current = index === step && !done;
      const time = index <= step ? times[index] : null;

      return (
        <li key={label} className="min-w-0" aria-current={current ? 'step' : undefined}>
          <div className="flex items-center">
            <span
              className={`flex size-6 flex-shrink-0 items-center justify-center rounded-full ${
                done
                  ? 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-black'
                  : current
                    ? 'bg-surface-primary ring-2 ring-emerald-600 shadow-[0_0_0_6px_rgba(16,185,129,0.15)] dark:ring-emerald-400'
                    : 'bg-fill-muted'
              }`}
            >
              {done && <IconCheck size={12} stroke={3} />}
              {current && <span className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
            </span>
            {index < DELIVERY_STAGES.length - 1 && (
              <span
                className={`mx-1.5 h-1 flex-1 rounded-full ${
                  index < step ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-fill-muted'
                }`}
              />
            )}
          </div>
          <p
            className={`mt-2.5 truncate pr-2 text-[13px] ${
              index === step
                ? 'block font-semibold text-emerald-700 dark:text-emerald-300'
                : index < step
                  ? 'text-text-secondary hidden sm:block'
                  : 'text-text-muted hidden sm:block'
            }`}
          >
            {label}
          </p>
          {time && (
            <p
              className={`text-text-muted truncate pr-2 text-[11px] tabular-nums ${
                index === step ? 'block' : 'hidden sm:block'
              }`}
            >
              {stamp(time)}
            </p>
          )}
        </li>
      );
    })}
  </ol>
);

const isFinished = (request: Request) =>
  request.orderStatus === 'delivered' || request.orderStatus === 'cancelled';

/*
  How many wines a delivery shows before folding the rest away. Run together
  in one line, five catalogue names with their sizes and strengths could not
  be read; one wine per line, three at a time, can.
*/
const WINES_SHOWN = 6;

/** "5 wines · 6 bottles", the delivery at a glance */
const summaryOf = (request: Request) => {
  const wines = request.items.length;
  const bottles = request.items.reduce((sum, item) => sum + item.bottles, 0);

  return `${wines} ${wines === 1 ? 'wine' : 'wines'} · ${bottles} ${bottles === 1 ? 'bottle' : 'bottles'}`;
};

const PAST_SHOWN = 5;

/**
 * Deliveries the member has accepted, from preparation to their door
 *
 * Requests still being priced live in the panel above; this is what happens
 * after they say yes. Live deliveries sit above the wine. Past ones are history,
 * so they fold away below it.
 *
 * Past means delivered. A withdrawn request, or an order we cancelled, never
 * left the cellar, and listing it under "Past deliveries" told a member wine
 * had gone that was still on the shelf.
 */
const COLLAPSED_KEY = 'cc-cellar-deliveries-collapsed';

const DeliveriesPanel = ({ requests, section, collapsible = false }: DeliveriesPanelProps) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!collapsible) return;
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === '1');
    } catch {
      // Storage blocked: start open
    }
  }, [collapsible]);

  const toggleCollapsed = () =>
    setCollapsed((current) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, current ? '0' : '1');
      } catch {
        // Remembered for this visit only
      }
      return !current;
    });
  const [showPast, setShowPast] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [openWines, setOpenWines] = useState<Set<string>>(new Set());

  const toggleWines = (id: string) =>
    setOpenWines((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const accepted = requests.filter((request) => request.status === 'confirmed');
  const live =
    section === 'live' ? accepted.filter((request) => !isFinished(request)) : [];
  const past =
    section === 'past'
      ? accepted.filter((request) => request.orderStatus === 'delivered')
      : [];

  if (live.length === 0 && past.length === 0) return null;

  const row = (request: Request) => {
    const when =
      request.orderStatus === 'delivered' && request.deliveredAt
        ? `Delivered ${format(new Date(request.deliveredAt), 'd MMM yyyy')}`
        : request.scheduledDeliveryDate && !isFinished(request)
          ? `Arranged for ${format(new Date(request.scheduledDeliveryDate), 'EEE d MMM')}`
          : null;

    /* Until a day is arranged, the member's own preference is the best guide */
    const preferred =
      !request.scheduledDeliveryDate && !isFinished(request)
        ? describePreferredDelivery(
            request.delivery?.preferredDate,
            request.delivery?.preferredWindow,
          )
        : null;

    const recipient = request.delivery?.isGift
      ? `A gift for ${request.delivery.recipientName ?? 'someone else'}`
      : request.delivery?.addressLabel
        ? `To ${request.delivery.addressLabel}`
        : null;

    const isOpen = openWines.has(request.id);
    const wines = isOpen ? request.items : request.items.slice(0, WINES_SHOWN);
    const hidden = request.items.length - WINES_SHOWN;

    const step = stepOf(request);
    const stage = DELIVERY_STAGES[step];
    const details = [
      { icon: IconBottle, text: summaryOf(request) },
      recipient && { icon: request.delivery?.isGift ? IconGift : IconHome, text: recipient },
      when && { icon: IconCalendar, text: when },
      preferred && { icon: IconCalendar, text: `You asked for ${preferred}` },
    ].filter(Boolean) as { icon: typeof IconBottle; text: string }[];
    const isLive = section === 'live';

    return (
      <li
        key={request.id}
        className={
          isLive
            ? 'bg-background-primary overflow-hidden rounded-xl border border-black/[0.07] shadow-sm dark:border-white/10 dark:bg-white/[0.03]'
            : 'px-4 py-5 sm:px-6'
        }
      >
        <div
          className={
            isLive
              ? 'border-border-muted border-b bg-gradient-to-r from-emerald-50/80 to-transparent px-4 py-4 sm:px-5 dark:from-emerald-500/[0.08]'
              : ''
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <p className="text-text-primary text-lg font-semibold">
                {step === 5 && request.deliveredAt
                  ? `Delivered ${format(new Date(request.deliveredAt), 'd MMMM')}`
                  : stage?.headline}
              </p>
              {isLive && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums dark:bg-emerald-500">
                  Step {step + 1} of {DELIVERY_STAGES.length}
                </span>
              )}
            </div>
            <span className="text-text-muted flex-shrink-0 font-mono text-[11px]">
              {request.requestNumber}
              {request.orderNumber ? ` · ${request.orderNumber}` : ''}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {details.map((detail) => (
              <span
                key={detail.text}
                className="bg-background-primary/80 text-text-secondary inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] px-2.5 py-1 text-xs font-medium dark:border-white/10 dark:bg-white/[0.04]"
              >
                <detail.icon size={13} className="text-text-muted" />
                {detail.text}
              </span>
            ))}
          </div>
        </div>

        <div className={isLive ? 'px-4 pt-5 pb-4 sm:px-5' : ''}>
        {isLive && <ProgressSteps step={step} times={reachedAt(request)} />}

        {/*
          The wine in a compact grid, so a delivery of thirty bottles stays on
          one screen: the name as a collector reads it, its vintage and bottle
          underneath, and how many on the right. Two columns on a laptop,
          three on a wide screen, one on a phone.
        */}
        <div className={isLive ? 'mt-5' : 'mt-4'}>
          <p className="text-text-muted mb-2 text-[11px] font-semibold tracking-[0.1em] uppercase">In this delivery</p>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {wines.map((item, index) => (
              <li
                key={`${item.productName}-${index}`}
                className="bg-surface-muted/60 flex min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2.5 dark:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p
                    className="text-text-primary truncate text-sm font-medium"
                    title={collectorWineName(item.productName)}
                  >
                    {collectorWineName(item.productName)}
                  </p>
                  <p className="text-text-muted text-xs tabular-nums">
                    {item.vintage ?? 'NV'} · {bottleName(item.bottleSize)}
                  </p>
                </div>
                <span className="text-text-secondary flex-shrink-0 text-xs font-semibold whitespace-nowrap tabular-nums">
                  {item.bottles} {item.bottles === 1 ? 'bottle' : 'bottles'}
                </span>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => toggleWines(request.id)}
              aria-expanded={isOpen}
              className="text-text-muted hover:text-text-primary mt-3 inline-flex items-center gap-1 text-sm font-semibold"
            >
              {isOpen ? 'Show fewer' : `Show all ${request.items.length} wines`}
              <IconChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        </div>
      </li>
    );
  };

  return (
    <section
      className={`border-border-muted bg-surface-quiet overflow-hidden rounded-xl border ${section === 'live' ? 'mb-5' : 'mt-6'}`}
    >
      {live.length > 0 && (
        <>
          {(() => {
            const heading = (
              <>
                <IconTruckDelivery size={18} className="text-text-muted flex-shrink-0" />
                <p className="text-text-primary text-base font-semibold">In progress</p>
                <span className="bg-surface-muted text-text-muted rounded-full px-2 text-xs font-semibold tabular-nums">
                  {live.length}
                </span>
                {/* Folded, the line still says where the delivery is */}
                {collapsible && collapsed && (
                  <span className="text-text-muted min-w-0 truncate text-sm">
                    ·{' '}
                    {/* One mention per stage: two deliveries at the same stage read as a stutter */}
                    {[
                      ...new Set(
                        live
                          .map((request) => DELIVERY_STAGES[stepOf(request)]?.headline)
                          .filter(Boolean),
                      ),
                    ].join(' · ')}
                  </span>
                )}
              </>
            );
            return collapsible ? (
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-expanded={!collapsed}
                className={`hover:bg-surface-muted/50 flex w-full items-center gap-2 px-4 py-3 text-left transition-colors sm:px-6 ${
                  collapsed ? '' : 'border-border-muted border-b'
                }`}
              >
                {heading}
                <span className="text-text-muted ml-auto flex flex-shrink-0 items-center gap-1 text-sm font-medium">
                  {collapsed ? 'Show' : 'Hide'}
                  <IconChevronDown
                    size={16}
                    className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}
                  />
                </span>
              </button>
            ) : (
              <header className="border-border-muted flex items-center gap-2 border-b px-4 py-3 sm:px-6">
                {heading}
              </header>
            );
          })()}
          {!(collapsible && collapsed) && (
            <ul className="bg-surface-muted/40 flex flex-col gap-4 p-3 sm:p-4 dark:bg-transparent">{live.map(row)}</ul>
          )}
        </>
      )}

      {past.length > 0 && (
        <div className={live.length > 0 ? 'border-border-muted border-t' : ''}>
          <button
            type="button"
            onClick={() => setShowPast((value) => !value)}
            aria-expanded={showPast}
            className="text-text-muted hover:text-text-primary flex w-full items-center justify-between px-4 py-3 text-sm font-semibold sm:px-6"
          >
            <span>
              Past deliveries <span className="tabular-nums">({past.length})</span>
            </span>
            <IconChevronDown size={14} className={`transition-transform ${showPast ? 'rotate-180' : ''}`} />
          </button>
          {showPast && (
            <>
              <ul className="divide-border-muted border-border-muted divide-y border-t">
                {(showAllPast ? past : past.slice(0, PAST_SHOWN)).map(row)}
              </ul>
              {past.length > PAST_SHOWN && !showAllPast && (
                <button
                  type="button"
                  onClick={() => setShowAllPast(true)}
                  className="text-text-muted hover:text-text-primary border-border-muted w-full border-t px-4 py-2.5 text-sm font-semibold"
                >
                  Show all {past.length}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default DeliveriesPanel;
