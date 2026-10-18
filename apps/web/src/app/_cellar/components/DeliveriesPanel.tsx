'use client';

import { IconChevronDown, IconTruckDelivery } from '@tabler/icons-react';
import type { inferRouterOutputs } from '@trpc/server';
import { format } from 'date-fns';
import { useState } from 'react';

import type { AppRouter } from '@/trpc-router';

type Request =
  inferRouterOutputs<AppRouter>['cellar']['member']['getReleases']['requests'][number];

export interface DeliveriesPanelProps {
  requests: Request[];
}

/** Where an accepted delivery has got to, in the member's words */
const stageOf = (request: Request) => {
  if (request.status === 'cancelled') {
    return { label: 'Withdrawn', tone: 'bg-surface-muted text-text-muted ring-border-muted' };
  }

  switch (request.orderStatus) {
    case 'delivered':
      return {
        label: 'Delivered',
        tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900',
      };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'bg-surface-muted text-text-muted ring-border-muted' };
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

const isFinished = (request: Request) =>
  request.status === 'cancelled' ||
  request.orderStatus === 'delivered' ||
  request.orderStatus === 'cancelled';

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
 * after they say yes. In progress leads, and past deliveries fold away under
 * one line so a member with years of history still sees the live ones first.
 */
const DeliveriesPanel = ({ requests }: DeliveriesPanelProps) => {
  const [showPast, setShowPast] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);

  const accepted = requests.filter(
    (request) => request.status === 'confirmed' || request.status === 'cancelled',
  );
  const live = accepted.filter((request) => request.status === 'confirmed' && !isFinished(request));
  const past = accepted.filter(isFinished);

  if (live.length === 0 && past.length === 0) return null;

  const row = (request: Request) => {
    const stage = stageOf(request);
    const when =
      request.orderStatus === 'delivered' && request.deliveredAt
        ? `Delivered ${format(new Date(request.deliveredAt), 'd MMM yyyy')}`
        : request.scheduledDeliveryAt && !isFinished(request)
          ? `Arranged for ${format(new Date(request.scheduledDeliveryAt), 'EEE d MMM')}`
          : null;

    return (
      <li key={request.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{winesOf(request)}</p>
          <p className="text-text-muted mt-0.5 text-xs">
            {bottlesOf(request)}
            {when ? ` · ${when}` : ''}
            <span className="text-text-muted/70"> · {request.requestNumber}</span>
          </p>
        </div>
        <span className={`w-fit flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${stage.tone}`}>
          {stage.label}
        </span>
      </li>
    );
  };

  return (
    <section className="border-border-muted bg-surface-primary mb-5 overflow-hidden rounded-xl border shadow-sm">
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
