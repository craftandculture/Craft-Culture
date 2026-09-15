'use client';

import { IconShoppingBag, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

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
    detail: 'Send the transfer, then tell us you have.',
  },
  payment_claimed: {
    label: 'Checking your transfer',
    tone: 'claimed',
    detail: 'We are looking for it. The wine stays held for you meanwhile.',
  },
  completed: {
    label: 'In your cellar',
    tone: 'done',
    detail: 'Ownership has moved. It never left the warehouse.',
  },
  expired: {
    label: 'Reservation lapsed',
    tone: 'gone',
    detail: 'The hold ran out and the wine went back on the list.',
  },
  cancelled: { label: 'Cancelled', tone: 'gone', detail: '' },
};

const TONES = {
  waiting: 'bg-amber-50 text-amber-800',
  claimed: 'bg-violet-50 text-violet-700',
  done: 'bg-teal-50 text-teal-700',
  gone: 'bg-fill-secondary text-text-muted',
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
        toast.success(`${result.purchaseNumber} cancelled — the wine is back on the list.`);
        setConfirmCancelId(null);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const { mutate: markPaid, isPending } = useMutation(
    api.consignment.member.markPurchasePaid.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Thank you — we will confirm ${result.purchaseNumber}.`);
        setOpenId(null);
        setReference('');
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const purchases = data?.purchases ?? [];

  return (
    <div className="w-full pb-8">
      <div className="mb-4">
        <Typography variant="headingMd" className="block">
          Purchases
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 block">
          Wine you have bought in bond. It stays in the warehouse throughout
          &mdash; only who owns it changes.
        </Typography>
      </div>

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted" className="block py-6">
          Loading&hellip;
        </Typography>
      )}

      {!isLoading && purchases.length === 0 && (
        <div className="border-border-muted rounded-xl border px-6 py-14 text-center">
          <Icon
            icon={IconShoppingBag}
            size="lg"
            className="text-text-muted mx-auto mb-3"
          />
          <Typography variant="bodyMd" colorRole="muted" className="block">
            Nothing bought yet.
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" className="mt-1 block">
            Available now lists everything held in bond with us.
          </Typography>
        </div>
      )}

      <div className="flex flex-col gap-3">
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
            <div
              key={purchase.id}
              className="border-border-muted overflow-hidden rounded-xl border"
            >
              <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Typography variant="bodySm" className="font-semibold">
                    <span className="font-mono text-xs">
                      {purchase.purchaseNumber}
                    </span>
                    <span className="text-text-brand ml-2 tabular-nums">
                      {money(purchase.totalUsd)}
                    </span>
                  </Typography>
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="mt-0.5 block"
                  >
                    {purchase.items.length}{' '}
                    {purchase.items.length === 1 ? 'wine' : 'wines'}
                    {purchase.status === 'reserved' && purchase.reservedUntil
                      ? ` · reserved for another ${formatDistanceToNowStrict(new Date(purchase.reservedUntil))}`
                      : ''}
                  </Typography>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONES[state.tone]}`}
                  >
                    {state.label}
                  </span>
                  {canPay && (
                    <Button
                      size="sm"
                      variant={
                        purchase.status === 'reserved' ? undefined : 'outline'
                      }
                      colorRole="brand"
                      onClick={() => {
                        setOpenId(isOpen ? null : purchase.id);
                        setReference('');
                      }}
                    >
                      <ButtonContent>
                        {purchase.status === 'reserved'
                          ? 'I have paid'
                          : 'Update reference'}
                      </ButtonContent>
                    </Button>
                  )}
                </div>
              </div>

              <div className="border-border-muted bg-fill-muted/30 border-t px-4 py-3">
                {/*
                  A table, not a sentence. "Charmes · 2020 · 1 case" left the
                  producer, the format and the per-bottle price out, which are
                  the three things anyone checks an order against — and a case
                  of six and a case of twelve at the same total are not the
                  same purchase.
                */}
                <div className="border-border-muted bg-background-primary mb-3 overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-text-muted border-border-muted border-b text-[10px] uppercase tracking-[0.08em]">
                        <th className="px-3 py-1.5 text-left">Wine</th>
                        <th className="hidden px-3 py-1.5 text-left sm:table-cell">
                          Producer
                        </th>
                        <th className="px-3 py-1.5 text-center">Vintage</th>
                        <th className="px-3 py-1.5 text-center">Format</th>
                        <th className="px-3 py-1.5 text-right">Qty</th>
                        <th className="px-3 py-1.5 text-right">$ / btl</th>
                        <th className="px-3 py-1.5 text-right">Line</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border-muted/60 divide-y">
                      {purchase.items.map((item) => (
                        <tr key={item.id}>
                          <td className="text-text-primary max-w-0 px-3 py-2 text-[13px] font-medium">
                            <span
                              className="block truncate"
                              title={item.productName}
                            >
                              {displayWineName(item.productName)}
                            </span>
                            <span className="text-text-muted block truncate text-[11px] sm:hidden">
                              {item.producer}
                            </span>
                          </td>
                          <td className="text-text-muted hidden max-w-0 px-3 py-2 text-[13px] sm:table-cell">
                            <span
                              className="block truncate"
                              title={item.producer ?? ''}
                            >
                              {item.producer ?? '—'}
                            </span>
                          </td>
                          <td className="text-text-muted px-3 py-2 text-center text-[13px] tabular-nums">
                            {item.vintage ?? 'NV'}
                          </td>
                          <td className="text-text-primary px-3 py-2 text-center text-[13px]">
                            {(item.caseConfig ?? 1) > 1
                              ? `${item.caseConfig}×`
                              : ''}
                            {item.bottleSize ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-[13px] tabular-nums">
                            <span className="text-text-primary">
                              {item.cases}{' '}
                              {item.cases === 1 ? 'case' : 'cases'}
                            </span>
                            <span className="text-text-muted block text-[11px]">
                              {item.bottles}{' '}
                              {item.bottles === 1 ? 'bottle' : 'bottles'}
                            </span>
                          </td>
                          <td className="text-text-muted px-3 py-2 text-right text-[13px] tabular-nums">
                            {money(item.pricePerBottleUsd)}
                          </td>
                          <td className="text-text-primary px-3 py-2 text-right text-[13px] font-semibold tabular-nums">
                            {money(item.lineTotalUsd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Typography variant="bodyXs" colorRole="muted">
                    {state.detail}
                  </Typography>

                  {canPay &&
                    (confirmCancelId === purchase.id ? (
                      <span className="inline-flex items-center gap-2">
                        <Typography variant="bodyXs" colorRole="muted">
                          Release this wine back to the list?
                        </Typography>
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
                          className="text-text-muted hover:text-text-primary px-1 text-xs font-medium"
                        >
                          Keep it
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmCancelId(purchase.id)}
                        className="text-text-muted inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors hover:text-red-700"
                      >
                        <Icon icon={IconX} size="xs" />
                        Cancel order
                      </button>
                    ))}
                </div>

                {isOpen && canPay && (
                  <div className="mt-3">
                    {/*
                      Saying you have paid is a claim, not a receipt, and the
                      screen has to say so — otherwise a member reasonably
                      expects the wine to appear the moment they press it.
                    */}
                    <Typography
                      variant="bodyXs"
                      colorRole="muted"
                      className="mb-2 block max-w-[64ch]"
                    >
                      Telling us does not move the wine on its own. We check the
                      bank and confirm, usually the same working day, and the
                      wine is yours from that point. Your reservation will not
                      lapse while we are checking.
                    </Typography>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        placeholder="Transfer reference, if you have one"
                        className="max-w-[280px]"
                      />
                      <Button
                        size="sm"
                        colorRole="brand"
                        isDisabled={isPending}
                        onClick={() =>
                          markPaid({
                            purchaseId: purchase.id,
                            paymentReference: reference || undefined,
                          })
                        }
                      >
                        <ButtonContent>Tell us it is sent</ButtonContent>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PurchasesPage;
