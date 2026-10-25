'use client';

import { IconCheck, IconChevronDown, IconTruckDelivery } from '@tabler/icons-react';
import type { inferRouterOutputs } from '@trpc/server';
import { format } from 'date-fns';
import { useState } from 'react';

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
  <ol className="mt-5 grid grid-cols-6" aria-label="Delivery progress">
    {DELIVERY_STAGES.map(({ label }, index) => {
      const done = index < step || (index === step && step === DELIVERY_STAGES.length - 1);
      const current = index === step && !done;
      const time = index <= step ? times[index] : null;

      return (
        <li key={label} className="min-w-0" aria-current={current ? 'step' : undefined}>
          <div className="flex items-center">
            <span
              className={`flex size-5 flex-shrink-0 items-center justify-center rounded-full ${
                done
                  ? 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-black'
                  : current
                    ? 'bg-surface-primary ring-2 ring-emerald-600 dark:ring-emerald-400'
                    : 'bg-fill-muted'
              }`}
            >
              {done && <IconCheck size={12} stroke={3} />}
              {current && <span className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
            </span>
            {index < DELIVERY_STAGES.length - 1 && (
              <span
                className={`mx-1 h-0.5 flex-1 rounded-full ${
                  index < step ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-fill-muted'
                }`}
              />
            )}
          </div>
          <p
            className={`mt-2 truncate pr-2 text-sm ${
              index === step
                ? 'text-text-primary block font-semibold'
                : index < step
                  ? 'text-text-secondary hidden sm:block'
                  : 'text-text-muted hidden sm:block'
            }`}
          >
            {label}
          </p>
          {time && (
            <p
              className={`text-text-muted truncate pr-2 text-xs tabular-nums ${
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
const WINES_SHOWN = 3;

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
const DeliveriesPanel = ({ requests, section }: DeliveriesPanelProps) => {
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
      summaryOf(request),
      recipient,
      when,
      preferred ? `You asked for ${preferred}` : null,
    ].filter(Boolean);

    return (
      <li key={request.id} className="px-4 py-5 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-text-primary text-lg font-semibold">
            {step === 5 && request.deliveredAt
              ? `Delivered ${format(new Date(request.deliveredAt), 'd MMMM')}`
              : stage?.headline}
          </p>
          <span className="text-text-muted flex-shrink-0 font-mono text-xs">
            {request.requestNumber}
            {request.orderNumber ? ` · ${request.orderNumber}` : ''}
          </span>
        </div>
        <p className="text-text-muted mt-1 text-sm">{details.join(' · ')}</p>

        {section === 'live' && <ProgressSteps step={step} times={reachedAt(request)} />}

        {/*
          The wine, one line each: the name as a collector reads it, its
          vintage and bottle underneath, and how many on the right.
        */}
        <div className="border-border-muted mt-4 border-t pt-2">
          <ul className="divide-border-muted/60 divide-y">
            {wines.map((item, index) => (
              <li
                key={`${item.productName}-${index}`}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-text-primary truncate text-base font-medium">
                    {collectorWineName(item.productName)}
                  </p>
                  <p className="text-text-muted text-sm tabular-nums">
                    {item.vintage ?? 'NV'} · {bottleName(item.bottleSize)}
                  </p>
                </div>
                <span className="bg-surface-muted text-text-secondary flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium tabular-nums">
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
              className="text-text-muted hover:text-text-primary mt-2 inline-flex items-center gap-1 text-sm font-semibold"
            >
              {isOpen ? 'Show fewer' : `Show all ${request.items.length} wines`}
              <IconChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <section
      className={`border-border-muted bg-surface-primary overflow-hidden rounded-xl border shadow-sm ${section === 'live' ? 'mb-5' : 'mt-6'}`}
    >
      {live.length > 0 && (
        <>
          <header className="border-border-muted flex items-center gap-2 border-b px-4 py-3 sm:px-6">
            <IconTruckDelivery size={18} className="text-text-muted" />
            <p className="text-text-primary text-base font-semibold">In progress</p>
            <span className="bg-surface-muted text-text-muted rounded-full px-2 text-xs font-semibold tabular-nums">
              {live.length}
            </span>
          </header>
          <ul className="divide-border-muted divide-y">{live.map(row)}</ul>
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
