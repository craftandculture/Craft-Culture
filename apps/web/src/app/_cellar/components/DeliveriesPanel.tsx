'use client';

import { IconChevronDown, IconTruckDelivery } from '@tabler/icons-react';
import type { inferRouterOutputs } from '@trpc/server';
import { format } from 'date-fns';
import { useState } from 'react';

import deliveryStage, { DELIVERY_STAGES } from '@/app/_cellar/utils/deliveryStage';
import describePreferredDelivery from '@/app/_cellar/utils/describePreferredDelivery';
import displayWineName from '@/app/_wms/utils/displayWineName';
import type { AppRouter } from '@/trpc-router';

type Request =
  inferRouterOutputs<AppRouter>['cellar']['member']['getReleases']['requests'][number];

export interface DeliveriesPanelProps {
  requests: Request[];
  /** Deliveries under way sit above the wine; ones already made sit below it */
  section: 'live' | 'past';
}

const AMBER =
  'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900';
const BLUE =
  'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-900';
const GREEN =
  'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900';

/** How far a delivery has got, from the warehouse's own stages */
const stepOf = (request: Request) => deliveryStage(request);

/** Where an accepted delivery has got to, in the member's words */
const stageOf = (request: Request) => {
  const step = stepOf(request);

  return {
    label: DELIVERY_STAGES[step]?.label ?? 'Confirmed',
    tone: step === 5 ? GREEN : step >= 3 ? BLUE : AMBER,
  };
};

/*
  One segment per stage of the team's own process: confirmed, picked, packed,
  collected, out for delivery, delivered. On a phone only the current stage is
  named, or six labels would not fit.
*/
const ProgressStrip = ({ step }: { step: number }) => (
  <ol className="mt-2.5 grid grid-cols-6 gap-1" aria-label="Delivery progress">
    {DELIVERY_STAGES.map(({ label }, index) => (
      <li key={label} className="min-w-0">
        <span
          className={`block h-1 rounded-full ${
            index <= step
              ? 'bg-emerald-600 dark:bg-emerald-400'
              : 'bg-fill-muted'
          }`}
        />
        <span
          className={`mt-1 truncate text-[10px] ${
            index === step
              ? 'text-text-primary block font-semibold'
              : 'text-text-muted hidden sm:block'
          }`}
          aria-current={index === step ? 'step' : undefined}
        >
          {label}
        </span>
      </li>
    ))}
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
    const stage = stageOf(request);
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

    return (
      <li key={request.id} className="px-4 py-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-text-primary text-sm font-semibold">
              {summaryOf(request)}
              <span className="text-text-muted/70 ml-2 font-mono text-[11px] font-normal">{request.requestNumber}</span>
            </p>
            {(recipient || when || preferred) && (
              <p className="text-text-muted mt-0.5 text-xs">
                {[recipient, when, preferred ? `You asked for ${preferred}` : null].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <span className={`w-fit flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${stage.tone}`}>
            {stage.label}
          </span>
        </div>

        <ul className="mt-2.5 flex flex-col gap-1">
          {wines.map((item, index) => (
            /* Vintage beside the name: pushed to the far edge it read as an unlabelled number. */
            <li key={`${item.productName}-${index}`} className="truncate text-sm">
              <span className="text-emerald-800 dark:text-emerald-300">{displayWineName(item.productName)}</span>
              <span className="text-text-muted tabular-nums"> {item.vintage ?? 'NV'}</span>
              {item.bottles > 1 && <span className="text-text-muted text-xs"> · {item.bottles} bottles</span>}
            </li>
          ))}
        </ul>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => toggleWines(request.id)}
            aria-expanded={isOpen}
            className="text-text-muted hover:text-text-primary mt-1 inline-flex items-center gap-1 text-xs font-semibold"
          >
            {isOpen ? 'Show fewer' : `Show all ${request.items.length} wines`}
            <IconChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
        {section === 'live' && <ProgressStrip step={stepOf(request)} />}
      </li>
    );
  };

  return (
    <section
      className={`border-border-muted bg-surface-primary overflow-hidden rounded-xl border shadow-sm ${section === 'live' ? 'mb-5' : 'mt-6'}`}
    >
      {live.length > 0 && (
        <>
          <header className="border-border-muted flex items-center gap-2 border-b px-4 py-2.5">
            <IconTruckDelivery size={15} className="text-text-muted" />
            <p className="text-text-primary text-[11px] font-semibold uppercase tracking-wider">Your deliveries</p>
            <span className="bg-surface-muted text-text-muted rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
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
            className="text-text-muted hover:text-text-primary flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold"
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
                  className="text-text-muted hover:text-text-primary border-border-muted w-full border-t px-4 py-2 text-xs font-semibold"
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
