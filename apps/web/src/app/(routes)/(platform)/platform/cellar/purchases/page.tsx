'use client';

import { IconShoppingBag, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import HowToPayPanel from '@/app/_cellar/components/HowToPayPanel';
import bottleName from '@/app/_cellar/utils/bottleName';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import displayWineName from '@/app/_wms/utils/displayWineName';
import useTRPC from '@/lib/trpc/browser';

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
  { label: string; tone: 'waiting' | 'claimed' | 'done' | 'gone'; detail: string }
> = {
  reserved: {
    label: 'Reserved for you',
    tone: 'waiting',
    detail: 'Pay by bank transfer using the details above, then let us know you have paid.',
  },
  payment_claimed: {
    label: 'Checking your payment',
    tone: 'claimed',
    detail: 'We are confirming your transfer. The wine remains reserved for you meanwhile.',
  },
  completed: {
    label: 'In your cellar',
    tone: 'done',
    detail: 'Added to your cellar, stored in our warehouse.',
  },
  expired: {
    label: 'Reservation expired',
    tone: 'gone',
    detail: 'The reservation ended before payment arrived, and the wine is available again.',
  },
  cancelled: { label: 'Cancelled', tone: 'gone', detail: '' },
};

const TONES = {
  waiting: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900',
  claimed: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-900',
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  /*
    Cancelling gives wine back to the list and the member loses their hold on
    it, so it asks once rather than acting on a single click.
  */
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    ...api.consignment.member.getPurchases.queryOptions(),
  });

  const { mutate: cancelPurchase, isPending: isCancelling } = useMutation(
    api.consignment.member.cancelPurchase.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.purchaseNumber} cancelled. The wine is available again.`);
        setConfirmCancelId(null);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: markPaid, isPending } = useMutation(
    api.consignment.member.markPurchasePaid.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Thank you. We will confirm ${result.purchaseNumber} once your payment arrives.`);
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
      <div className="mb-5">
        <Typography variant="headingMd" className="block">
          Purchases
        </Typography>
        <Typography variant="bodySm" colorRole="muted" className="mt-1 block max-w-2xl">
          Wine you have bought from us. It is stored duty-free in our bonded
          warehouse and added to your cellar once your payment is confirmed.
        </Typography>
      </div>

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted" className="block py-6">
          Loading&hellip;
        </Typography>
      )}

      {!isLoading && purchases.length === 0 && (
        <div className="border-border-muted rounded-xl border bg-gradient-to-b from-slate-50/70 to-transparent px-6 py-12 text-center dark:from-slate-500/10">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-500/20">
            <Icon icon={IconShoppingBag} size="md" />
          </span>
          <p className="text-text-primary text-base font-semibold">No purchases yet</p>
          <p className="text-text-muted mx-auto mt-1 max-w-sm text-sm leading-6">
            Wines you reserve from Available now will appear here, with how to
            pay for them.
          </p>
          <Link
            href="/platform/cellar/available"
            className="bg-text-primary text-surface-primary mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold"
          >
            Browse Available now
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {purchases.map((purchase) => {
          const state = STATES[purchase.status] ?? {
            label: purchase.status,
            tone: 'gone' as const,
            detail: '',
          };

          const canPay = ['reserved', 'payment_claimed'].includes(
            purchase.status,
          );

          const isOpen = openId === purchase.id;

          return (
            <article
              key={purchase.id}
              className="border-border-muted bg-surface-primary overflow-hidden rounded-xl border shadow-sm"
            >
              <header className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-text-primary font-mono text-xs font-semibold">
                      {purchase.purchaseNumber}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONES[state.tone]}`}
                    >
                      {state.label}
                    </span>
                  </div>
                  <p className="text-text-primary mt-1 text-xl font-bold tabular-nums">
                    {money(purchase.totalUsd)}
                  </p>
                  <p className="text-text-muted text-xs">
                    {purchase.items.length}{' '}
                    {purchase.items.length === 1 ? 'wine' : 'wines'}
                    {purchase.status === 'reserved' && purchase.reservedUntil
                      ? ` · reserved for another ${formatDistanceToNowStrict(new Date(purchase.reservedUntil))}`
                      : ''}
                  </p>
                </div>
                {canPay && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(isOpen ? null : purchase.id);
                      setReference('');
                    }}
                    className={`h-11 w-full rounded-lg px-5 text-sm font-semibold transition-colors sm:h-10 sm:w-auto ${
                      purchase.status === 'reserved'
                        ? 'bg-text-primary text-surface-primary'
                        : 'border-border-muted text-text-primary hover:bg-fill-muted border'
                    }`}
                  >
                    {purchase.status === 'reserved'
                      ? 'I have paid'
                      : 'Update payment reference'}
                  </button>
                )}
              </header>

              <div className="border-border-muted space-y-4 border-t px-4 py-4 sm:px-5">
                {purchase.status === 'reserved' && (
                  <HowToPayPanel
                    details={data?.paymentDetails ?? null}
                    amountUsd={purchase.totalUsd}
                    reference={purchase.purchaseNumber}
                  />
                )}

                {isOpen && canPay && (
                  <div className="border-border-muted rounded-xl border p-4">
                    {/*
                      Saying you have paid is a claim, not a receipt, and the
                      screen has to say so — otherwise a member reasonably
                      expects the wine to appear the moment they press it.
                    */}
                    <p className="text-text-primary text-sm font-semibold">
                      Let us know your payment is on its way
                    </p>
                    <p className="text-text-muted mt-1 max-w-[64ch] text-xs leading-5">
                      We confirm receipt with our bank, usually the same working
                      day, and the wine is added to your cellar from that point.
                      Your reservation will not expire while we are checking.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        placeholder="Your bank's transfer reference (optional)"
                        className="sm:max-w-[320px]"
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
                        {isPending ? 'Sending…' : 'Confirm payment sent'}
                      </button>
                    </div>
                  </div>
                )}

                {/*
                  A list, not a sentence. The producer, bottle and price per
                  bottle are what anyone checks an order against — and a case
                  of six and a case of twelve at the same total are not the same
                  purchase.
                */}
                <ul className="divide-border-muted border-border-muted divide-y rounded-lg border sm:hidden">
                  {purchase.items.map((item) => (
                    <li key={item.id} className="px-3 py-2.5">
                      <p className="text-text-primary text-sm font-semibold leading-snug">
                        {displayWineName(item.productName)}
                      </p>
                      <p className="text-text-muted text-xs">
                        {[item.producer, item.vintage ?? 'NV', bottleName(item.bottleSize)]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <div className="mt-1.5 flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-text-muted">
                          {quantity(item)} · {money(item.pricePerBottleUsd)} / btl
                        </span>
                        <span className="text-text-primary text-sm font-semibold tabular-nums">
                          {money(item.lineTotalUsd)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="border-border-muted hidden overflow-x-auto rounded-lg border sm:block">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-secondary/70">
                      <tr className="text-text-muted border-border-muted border-b text-[10px] font-semibold uppercase tracking-[0.08em]">
                        <th className="w-full min-w-[280px] px-3 py-2 text-left">Wine</th>
                        <th className="w-px whitespace-nowrap px-3 py-2 text-center">Vintage</th>
                        <th className="w-px whitespace-nowrap px-3 py-2 text-center">Bottle</th>
                        <th className="w-px whitespace-nowrap px-3 py-2 text-right">Quantity</th>
                        <th className="w-px whitespace-nowrap px-3 py-2 text-right">Per bottle</th>
                        <th className="w-px whitespace-nowrap px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border-muted/60 divide-y">
                      {purchase.items.map((item) => (
                        <tr key={item.id}>
                          <td className="max-w-0 px-3 py-2.5">
                            <span
                              className="text-text-primary block truncate text-[13.5px] font-semibold"
                              title={item.productName}
                            >
                              {displayWineName(item.productName)}
                            </span>
                            <span className="text-text-muted block truncate text-xs">
                              {item.producer ?? '—'}
                            </span>
                          </td>
                          <td className="text-text-muted whitespace-nowrap px-3 py-2.5 text-center text-[13px] tabular-nums">
                            {item.vintage ?? 'NV'}
                          </td>
                          <td className="text-text-primary whitespace-nowrap px-3 py-2.5 text-center text-[13px]">
                            {bottleName(item.bottleSize)}
                          </td>
                          <td className="text-text-primary whitespace-nowrap px-3 py-2.5 text-right text-[13px] tabular-nums">
                            {quantity(item)}
                          </td>
                          <td className="text-text-muted whitespace-nowrap px-3 py-2.5 text-right text-[13px] tabular-nums">
                            {money(item.pricePerBottleUsd)}
                          </td>
                          <td className="text-text-primary whitespace-nowrap px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums">
                            {money(item.lineTotalUsd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-text-muted text-xs leading-5">{state.detail}</p>

                  {canPay &&
                    (confirmCancelId === purchase.id ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-text-muted text-xs">
                          Cancel this reservation and make the wine available again?
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          colorRole="danger"
                          isDisabled={isCancelling}
                          onClick={() =>
                            cancelPurchase({ purchaseId: purchase.id })
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
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmCancelId(purchase.id)}
                        className="text-text-muted inline-flex h-9 items-center gap-1 self-start rounded px-2 text-xs font-medium transition-colors hover:text-red-700 sm:self-auto"
                      >
                        <Icon icon={IconX} size="xs" />
                        Cancel reservation
                      </button>
                    ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default PurchasesPage;
