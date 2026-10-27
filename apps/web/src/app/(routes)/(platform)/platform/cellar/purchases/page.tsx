'use client';

import {
  IconBuildingBank,
  IconChevronDown,
  IconShoppingBag,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import CellarPageHeader from '@/app/_cellar/components/CellarPageHeader';
import CellarState from '@/app/_cellar/components/CellarState';
import HowToPayPanel from '@/app/_cellar/components/HowToPayPanel';
import useIsCellarViewer from '@/app/_cellar/hooks/useIsCellarViewer';
import bottleName from '@/app/_cellar/utils/bottleName';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import displayWineName from '@/app/_wms/utils/displayWineName';
import useTRPC from '@/lib/trpc/browser';

/** Wines shown before a purchase's list folds */
const WINES_SHOWN = 3;

/** Past purchases shown before the history folds */
const PAST_SHOWN = 3;

const money = (value: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/*
  What each state means to the buyer, in the terms that matter to them: whether
  they still owe money, and whether the wine is theirs yet.
*/
const STATES: Record<
  string,
  {
    label: string;
    tone: 'waiting' | 'claimed' | 'done' | 'gone';
    detail: string;
  }
> = {
  reserved: {
    label: 'Reserved for you',
    tone: 'waiting',
    detail:
      'Pay by bank transfer using How to pay below, then let us know you have paid.',
  },
  payment_claimed: {
    label: 'Checking your payment',
    tone: 'claimed',
    detail:
      'We are confirming your transfer. The wine remains reserved for you meanwhile.',
  },
  completed: {
    label: 'In your cellar',
    tone: 'done',
    detail: 'Added to your cellar, stored in our warehouse.',
  },
  expired: {
    label: 'Reservation expired',
    tone: 'gone',
    detail:
      'The reservation ended before payment arrived, and the wine is available again.',
  },
  cancelled: { label: 'Cancelled', tone: 'gone', detail: '' },
};

/* Emerald once the wine is in the cellar; everything still waiting in slate */
const TONES = {
  waiting:
    'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-700',
  claimed:
    'bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-600',
  done: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900',
  gone: 'bg-surface-muted text-text-muted',
};

/**
 * What a member has bought, and what is still owed
 *
 * Kept apart from the cellar because the question is different: the cellar
 * answers "what do I own", this answers "what have I committed to and what do I
 * still have to do about it". A purchase only reaches the cellar once the money
 * has been confirmed.
 */
const PurchasesPage = () => {
  const api = useTRPC();
  const isViewer = useIsCellarViewer();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  /*
    Cancelling gives wine back to the list and the member loses their hold on
    it, so it asks once rather than acting on a single click.
  */
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [showAllIds, setShowAllIds] = useState<Set<string>>(new Set());
  const [showAllPast, setShowAllPast] = useState(false);
  const toggleShowAll = (id: string) =>
    setShowAllIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { data, isLoading, isError, refetch } = useQuery({
    ...api.consignment.member.getPurchases.queryOptions(),
  });

  const { mutate: cancelPurchase, isPending: isCancelling } = useMutation(
    api.consignment.member.cancelPurchase.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.purchaseNumber} cancelled. The wine is available again.`,
        );
        setConfirmCancelId(null);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: markPaid, isPending } = useMutation(
    api.consignment.member.markPurchasePaid.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `Thank you. We will confirm ${result.purchaseNumber} once your payment arrives.`,
        );
        setOpenId(null);
        setReference('');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const purchases = data?.purchases ?? [];

  /* Quantities as a collector says them: "1 case of 6", or "6 bottles" for wine sold by the bottle */
  const quantity = (item: (typeof purchases)[number]['items'][number]) =>
    (item.caseConfig ?? 1) > 1
      ? `${item.cases} ${item.cases === 1 ? 'case' : 'cases'} of ${item.caseConfig}`
      : `${item.bottles} ${item.bottles === 1 ? 'bottle' : 'bottles'}`;

  return (
    <div className="w-full pb-8">
      <CellarPageHeader
        title="Purchases"
        description="Wine you have bought through Craft & Culture. It is held in bond and added to your cellar once your payment is confirmed."
      />

      {isLoading && <CellarState kind="loading" />}

      {isError && <CellarState kind="error" />}

      {!isLoading && !isError && purchases.length === 0 && (
        <CellarState
          kind="empty"
          icon={IconShoppingBag}
          title="No purchases yet"
          message="Wines you reserve from the C&C Cellar List will appear here, with how to pay for them."
          action={
            <Link
              href="/platform/cellar/available"
              className="bg-text-primary text-surface-primary inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold"
            >
              Browse the C&C Cellar List
            </Link>
          }
        />
      )}

      {[
        {
          title: 'In progress',
          isPast: false,
          rows: purchases.filter((purchase) =>
            ['reserved', 'payment_claimed'].includes(purchase.status),
          ),
        },
        {
          title: 'Past purchases',
          isPast: true,
          rows: purchases.filter(
            (purchase) =>
              !['reserved', 'payment_claimed'].includes(purchase.status),
          ),
        },
      ]
        .filter((group) => group.rows.length > 0)
        .map((group) => (
          <section key={group.title} className="mb-8">
            <h2 className="text-text-muted mb-2.5 text-[11px] font-semibold uppercase tracking-wider">
              {group.title} · {group.rows.length}
            </h2>
            <div className="flex flex-col gap-4">
              {/*
                The history folds after a few. Every completed purchase is
                already in the cellar, so these are a record, and a long one
                should not bury the purchases still waiting on payment.
              */}
              {(group.isPast && !showAllPast
                ? group.rows.slice(0, PAST_SHOWN)
                : group.rows
              ).map((purchase) => {
                const state = STATES[purchase.status] ?? {
                  label: purchase.status,
                  tone: 'gone' as const,
                  detail: '',
                };

                const canPay =
                  !isViewer &&
                  ['reserved', 'payment_claimed'].includes(purchase.status);

                const isOpen = openId === purchase.id;

                return (
                  <article
                    key={purchase.id}
                    className="border-border-muted bg-surface-primary overflow-hidden rounded-xl border shadow-sm"
                  >
                    {/*
                The wine is the purchase; the order number, state and payment
                are about it. So the wines lead, large, and the rest follows in
                smaller type.
              */}
                    <ul className="divide-border-muted divide-y">
                      {(showAllIds.has(purchase.id)
                        ? purchase.items
                        : purchase.items.slice(0, WINES_SHOWN)
                      ).map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6 sm:px-5"
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-text-primary text-lg font-semibold leading-snug sm:text-xl"
                              title={item.productName}
                            >
                              {displayWineName(item.productName)}
                            </p>
                            <p className="text-text-muted mt-0.5 text-sm">
                              {[
                                item.producer,
                                item.vintage ?? 'NV',
                                bottleName(item.bottleSize),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            <p className="text-text-muted mt-0.5 text-xs tabular-nums">
                              {quantity(item)} at{' '}
                              {money(item.pricePerBottleUsd)} a bottle
                            </p>
                          </div>
                          <p className="text-text-primary text-base font-bold tabular-nums sm:text-right">
                            {money(item.lineTotalUsd)}
                          </p>
                        </li>
                      ))}
                    </ul>
                    {/* Twenty wines is a real purchase; the first few say what it is, the rest are a click away */}
                    {purchase.items.length > WINES_SHOWN && (
                      <button
                        type="button"
                        onClick={() => toggleShowAll(purchase.id)}
                        className="text-text-primary border-border-muted hover:bg-fill-muted/40 flex w-full items-center justify-center gap-1 border-t px-4 py-2.5 text-xs font-semibold"
                      >
                        {showAllIds.has(purchase.id)
                          ? 'Show fewer'
                          : `Show all ${purchase.items.length} wines`}
                        <Icon
                          icon={IconChevronDown}
                          size="xs"
                          className={
                            showAllIds.has(purchase.id) ? 'rotate-180' : ''
                          }
                        />
                      </button>
                    )}

                    <div className="border-border-muted bg-surface-secondary/40 flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-4 py-2.5 sm:px-5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONES[state.tone]}`}
                      >
                        {state.label}
                      </span>
                      <span className="text-text-muted font-mono text-xs">
                        {purchase.purchaseNumber}
                      </span>
                      {purchase.status === 'reserved' &&
                        purchase.reservedUntil &&
                        new Date(purchase.reservedUntil) > new Date() && (
                          <span className="text-text-muted text-xs">
                            held for another{' '}
                            {formatDistanceToNowStrict(
                              new Date(purchase.reservedUntil),
                            )}
                          </span>
                        )}
                      <span className="ml-auto flex items-center gap-3">
                        {/* The total only earns a place here when there is more than one line to add up */}
                        {purchase.items.length > 1 && (
                          <span className="text-text-primary text-sm font-bold tabular-nums">
                            {purchase.items.length} wines ·{' '}
                            {money(purchase.totalUsd)}
                          </span>
                        )}
                        {canPay && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenId(isOpen ? null : purchase.id);
                              setReference('');
                            }}
                            aria-expanded={isOpen}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-300"
                          >
                            <Icon icon={IconBuildingBank} size="xs" />
                            {purchase.status === 'reserved'
                              ? 'How to pay'
                              : 'Payment details'}
                            <Icon
                              icon={IconChevronDown}
                              size="xs"
                              className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            />
                          </button>
                        )}
                      </span>
                    </div>

                    {canPay && (
                      <div>
                        {isOpen && (
                          <div className="space-y-4 border-t border-emerald-100 bg-emerald-50/40 px-4 py-4 sm:px-5 dark:border-emerald-900/50 dark:bg-emerald-500/5">
                            {purchase.status === 'reserved' && (
                              <HowToPayPanel
                                details={data?.paymentDetails ?? null}
                                amountUsd={purchase.totalUsd}
                                reference={purchase.purchaseNumber}
                              />
                            )}
                            {/*
                        Saying you have paid is a claim, not a receipt, and the
                        screen has to say so — otherwise a member reasonably
                        expects the wine to appear the moment they press it.
                      */}
                            <div>
                              <p className="text-text-primary text-sm font-semibold">
                                {purchase.status === 'reserved'
                                  ? 'Once you have paid'
                                  : 'Your transfer reference'}
                              </p>
                              <p className="text-text-muted mt-0.5 max-w-[64ch] text-xs leading-5">
                                We confirm receipt with our bank, usually the
                                same working day, and the wine is added to your
                                cellar from that point. Your reservation will
                                not expire while we check.
                              </p>
                              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Input
                                  value={reference}
                                  onChange={(event) =>
                                    setReference(event.target.value)
                                  }
                                  placeholder="Your bank's transfer reference (optional)"
                                  className="bg-surface-primary sm:max-w-[320px]"
                                />
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() =>
                                    markPaid({
                                      purchaseId: purchase.id,
                                      paymentReference: reference || undefined,
                                    })
                                  }
                                  className="bg-text-primary text-surface-primary h-10 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
                                >
                                  {isPending
                                    ? 'Sending…'
                                    : purchase.status === 'reserved'
                                      ? 'I have paid'
                                      : 'Update reference'}
                                </button>
                              </div>
                            </div>

                            {/*
                              Once they have said they paid, money may be on its
                              way, so cancelling is ours to settle with them.
                            */}
                            {purchase.status === 'payment_claimed' ? (
                              <p className="text-text-muted text-right text-xs">
                                To change this order, please contact the cellar
                                team.
                              </p>
                            ) : (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {confirmCancelId === purchase.id ? (
                                <>
                                  <span className="text-text-muted text-xs">
                                    Cancel this reservation and make the wine
                                    available again?
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    colorRole="danger"
                                    isDisabled={isCancelling}
                                    onClick={() =>
                                      cancelPurchase({
                                        purchaseId: purchase.id,
                                      })
                                    }
                                  >
                                    <ButtonContent>Yes, cancel</ButtonContent>
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmCancelId(null)}
                                    className="text-text-muted hover:text-text-primary h-9 px-2 text-xs font-semibold"
                                  >
                                    Keep it
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmCancelId(purchase.id)
                                  }
                                  className="text-text-muted inline-flex h-9 items-center gap-1 rounded px-2 text-xs font-medium transition-colors hover:text-red-700"
                                >
                                  <Icon icon={IconX} size="xs" />
                                  Cancel reservation
                                </button>
                              )}
                            </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {!canPay && state.detail && (
                      <p className="text-text-muted border-border-muted border-t px-4 py-2.5 text-xs sm:px-5">
                        {state.detail}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
            {group.isPast && group.rows.length > PAST_SHOWN && (
              <button
                type="button"
                onClick={() => setShowAllPast((value) => !value)}
                className="text-text-muted hover:text-text-primary mt-3 flex items-center gap-1 text-xs font-semibold"
              >
                {showAllPast
                  ? 'Show fewer'
                  : `Show all ${group.rows.length} past purchases`}
                <Icon
                  icon={IconChevronDown}
                  size="xs"
                  className={showAllPast ? 'rotate-180' : ''}
                />
              </button>
            )}
          </section>
        ))}
    </div>
  );
};

export default PurchasesPage;
