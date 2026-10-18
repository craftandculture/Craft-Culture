'use client';

import { IconChevronDown } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const bottles = (count: number) => `${count} ${count === 1 ? 'bottle' : 'bottles'}`;

/** Payments shown before the history folds */
const PAYMENTS_SHOWN = 3;

/**
 * What a member's sold wine has earned, and where the money has got to
 *
 * Three questions, in the order a seller asks them: has anything sold that I
 * am still waiting on, what is coming in the next monthly payment, and what
 * have I been paid. Every figure is the member's own asking price; nothing
 * about the sale price or our commission is fetched, let alone shown.
 *
 * Renders nothing until something has sold.
 */
const SaleProceedsPanel = () => {
  const api = useTRPC();
  const [openPaymentId, setOpenPaymentId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data } = useQuery({
    ...api.consignment.member.getProceeds.queryOptions(),
  });

  if (!data) return null;

  const { awaitingBuyer, nextPayment, payments, totalPaidUsd } = data;

  if (
    awaitingBuyer.sales.length === 0 &&
    nextPayment.sales.length === 0 &&
    payments.length === 0
  ) {
    return null;
  }

  const tiles = [
    {
      label: 'Sold, awaiting payment',
      value: money(awaitingBuyer.amountUsd),
      detail:
        awaitingBuyer.bottles > 0
          ? `${bottles(awaitingBuyer.bottles)} · paid to you once the buyer pays us`
          : 'nothing outstanding',
    },
    {
      label: 'Your next payment',
      value: money(nextPayment.amountUsd),
      detail:
        nextPayment.bottles === 0
          ? 'nothing due yet'
          : nextPayment.isBeingPrepared
            ? `${bottles(nextPayment.bottles)} · being prepared now`
            : `${bottles(nextPayment.bottles)} · in the next monthly payment`,
    },
    {
      label: 'Paid to you',
      value: money(totalPaidUsd),
      detail:
        payments.length === 0
          ? 'no payments yet'
          : `${payments.length} ${payments.length === 1 ? 'payment' : 'payments'}`,
    },
  ];

  return (
    <section className="mb-6">
      <h2 className="text-text-muted mb-2.5 text-[11px] font-semibold uppercase tracking-wider">
        Sale proceeds
      </h2>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-transparent px-3 py-2.5 shadow-sm sm:px-4 sm:py-3 dark:border-emerald-900 dark:from-emerald-500/10"
          >
            <dt className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.08em]">
              {tile.label}
            </dt>
            <dd className="text-text-primary m-0 mt-1 text-lg font-semibold tabular-nums sm:text-xl">
              {tile.value}
            </dd>
            <dd className="text-text-muted m-0 text-[11px]">{tile.detail}</dd>
          </div>
        ))}
      </dl>

      <p className="text-text-muted mt-2 max-w-[72ch] text-xs leading-5">
        We pay you once a month, for sales the buyer has already paid for.
        Amounts are your asking price for the bottles sold.
      </p>

      {payments.length > 0 && (
        <div className="border-border-muted bg-surface-primary mt-4 overflow-hidden rounded-xl border shadow-sm">
          <ul className="divide-border-muted divide-y">
            {(showAll ? payments : payments.slice(0, PAYMENTS_SHOWN)).map(
              (payment) => {
                const isOpen = openPaymentId === payment.id;

                return (
                  <li key={payment.id}>
                    <button
                      type="button"
                      onClick={() => setOpenPaymentId(isOpen ? null : payment.id)}
                      aria-expanded={isOpen}
                      className="hover:bg-fill-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="text-text-primary block text-sm font-semibold">
                          {payment.paidAt
                            ? `Paid ${format(new Date(payment.paidAt), 'd MMMM yyyy')}`
                            : 'Paid'}
                        </span>
                        <span className="text-text-muted block text-xs">
                          {bottles(payment.bottles)} ·{' '}
                          {payment.sales.length}{' '}
                          {payment.sales.length === 1 ? 'wine' : 'wines'}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-text-primary text-sm font-bold tabular-nums">
                          {money(payment.amountUsd)}
                        </span>
                        <IconChevronDown
                          size={14}
                          className={`text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </span>
                    </button>
                    {isOpen && (
                      <ul className="border-border-muted bg-surface-secondary/40 divide-border-muted divide-y border-t">
                        {payment.sales.map((sale) => (
                          <li
                            key={sale.id}
                            className="flex items-start justify-between gap-3 px-4 py-2.5"
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-emerald-800 dark:text-emerald-300">
                                {sale.productName}
                              </span>
                              <span className="text-text-muted block text-xs">
                                {bottles(sale.bottles)} at{' '}
                                {money(sale.askPerBottleUsd)} · sold{' '}
                                {format(new Date(sale.soldAt), 'd MMM yyyy')}
                              </span>
                            </span>
                            <span className="text-text-primary text-sm tabular-nums">
                              {money(sale.amountUsd)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              },
            )}
          </ul>
          {payments.length > PAYMENTS_SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="text-text-muted hover:text-text-primary border-border-muted w-full border-t px-4 py-2 text-xs font-semibold"
            >
              {showAll ? 'Show fewer' : `Show all ${payments.length} payments`}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default SaleProceedsPanel;
