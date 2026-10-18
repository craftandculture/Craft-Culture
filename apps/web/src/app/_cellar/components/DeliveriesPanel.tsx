'use client';

import { IconChevronDown, IconTruckDelivery } from '@tabler/icons-react';
import type { inferRouterOutputs } from '@trpc/server';
import { format } from 'date-fns';
import { useState } from 'react';

import describePreferredDelivery from '@/app/_cellar/utils/describePreferredDelivery';
import type { AppRouter } from '@/trpc-router';

type Request =
  inferRouterOutputs<AppRouter>['cellar']['member']['getReleases']['requests'][number];

export interface DeliveriesPanelProps {
  requests: Request[];
  /** Deliveries under way sit above the wine; ones already made sit below it */
  section: 'live' | 'past';
}

/** Where an accepted delivery has got to, in the member's words */
const stageOf = (request: Request) => {
  switch (request.orderStatus) {
    case 'delivered':
      return {
        label: 'Delivered',
        tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900',
      };
    case 'stock_in_transit':
    case 'with_distributor':
    case 'out_for_delivery':
      return {
        label: 'On its way to you',
        tone: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-900',
      };
    case 'delivery_scheduled':
      return {
        label: 'Delivery arranged',
        tone: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-900',
      };
    default:
      return {
        label: 'Being prepared',
        tone: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900',
      };
  }
};

/*
  The four steps a member recognises, in order. The order's own statuses are
  finer than this — approvals, invoicing, stock moving to the distributor — and
  none of that is the member's concern.
*/
const STEPS = ['Being prepared', 'Delivery arranged', 'On its way', 'Delivered'];

const stepOf = (request: Request) => {
  switch (request.orderStatus) {
    case 'delivered':
      return 3;
    case 'stock_in_transit':
    case 'with_distributor':
    case 'out_for_delivery':
      return 2;
    case 'delivery_scheduled':
      return 1;
    default:
      return 0;
  }
};

/** Four segments, filled to where the delivery has got */
const ProgressStrip = ({ step }: { step: number }) => (
  <ol className="mt-2.5 grid grid-cols-4 gap-1" aria-label="Delivery progress">
    {STEPS.map((label, index) => (
      <li key={label} className="min-w-0">
        <span
          className={`block h-1 rounded-full ${
            index <= step
              ? 'bg-emerald-600 dark:bg-emerald-400'
              : 'bg-fill-muted'
          }`}
        />
        <span
          className={`mt-1 block truncate text-[10px] ${
            index === step
              ? 'text-text-primary font-semibold'
              : 'text-text-muted'
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

/** The wines on a delivery, the first two by name */
const winesOf = (request: Request) => {
  const names = request.items.map((item) =>
    item.vintage ? `${item.productName} ${item.vintage}` : item.productName,
  );
  const shown = names.slice(0, 2).join(', ');

  return names.length > 2 ? `${shown} and ${names.length - 2} more` : shown;
};

const bottlesOf = (request: Request) => {
  const bottles = request.items.reduce((sum, item) => sum + item.bottles, 0);

  return `${bottles} ${bottles === 1 ? 'bottle' : 'bottles'}`;
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

    return (
      <li key={request.id} className="px-4 py-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{winesOf(request)}</p>
            <p className="text-text-muted mt-0.5 text-xs">
              {bottlesOf(request)}
              {recipient ? ` · ${recipient}` : ''}
              {when ? ` · ${when}` : ''}
              {preferred ? ` · You asked for ${preferred}` : ''}
              <span className="text-text-muted/70"> · {request.requestNumber}</span>
            </p>
          </div>
          <span className={`w-fit flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${stage.tone}`}>
            {stage.label}
          </span>
        </div>
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
