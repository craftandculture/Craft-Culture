'use client';

import {
  IconBottle,
  IconChevronDown,
  IconClock,
  IconCoin,
  IconTag,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import CellarPageHeader from '@/app/_cellar/components/CellarPageHeader';
import CellarState from '@/app/_cellar/components/CellarState';
import CellarStatTile from '@/app/_cellar/components/CellarStatTile';
import ConfirmAction from '@/app/_cellar/components/ConfirmAction';
import FirstStepsCard from '@/app/_cellar/components/FirstStepsCard';
import SaleProceedsPanel from '@/app/_cellar/components/SaleProceedsPanel';
import useIsCellarViewer from '@/app/_cellar/hooks/useIsCellarViewer';
import { COMMISSION_RATES } from '@/app/_consignment/constants/commissionRates';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import displayWineName from '@/app/_wms/utils/displayWineName';
import useTRPC from '@/lib/trpc/browser';

/*
  One figure, not a range. Wine lists at one number, and what varies behind
  it is our commission, 2.5% or 5% depending on who buys, which never changes
  what the member receives.
*/
const listedPrice = (askPerBottleUsd: number) =>
  askPerBottleUsd /
  (1 - Math.max(COMMISSION_RATES.trade, COMMISSION_RATES.collector) / 100);

/**
 * "Set as €180 · €1 = $1.1203 on 26 Oct", for a price typed in another currency
 *
 * USD is what the member is owed; this says where the figure came from, at
 * the rate fixed on the day they listed.
 */
const setInLine = (mandate: {
  askCurrency: string;
  askPerBottleLocal: number | null;
  askFxRate: number | null;
  askFxAt: Date | string | null;
}) => {
  if (mandate.askCurrency === 'USD' || !mandate.askPerBottleLocal || !mandate.askFxRate) return null;
  const local = mandate.askPerBottleLocal.toLocaleString('en-US', {
    style: 'currency',
    currency: mandate.askCurrency,
    maximumFractionDigits: 2,
  });
  const on = mandate.askFxAt ? ` on ${format(new Date(mandate.askFxAt), 'd MMM yyyy')}` : '';
  return `Set as ${local} · 1 ${mandate.askCurrency} = $${mandate.askFxRate.toFixed(4)}${on}`;
};

const money = (value: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/*
  What each state means to the member, in their words rather than ours. The
  status column is the only place most of them will ever read about the
  difference between listed and placed, so it has to carry the consequence and
  not just the name.
*/
const STATES: Record<
  string,
  { label: string; tone: 'held' | 'live' | 'sold'; detail: string }
> = {
  offered: {
    label: 'With us for review',
    tone: 'held',
    detail: 'We are looking at it. You can still withdraw.',
  },
  listed: {
    label: 'Listed for sale',
    tone: 'live',
    detail: 'Offered to our trade and private clients. You can still withdraw.',
  },
  placed: {
    label: 'With a distributor',
    tone: 'held',
    detail: 'Delivered to a licensed distributor and on sale. It can no longer be withdrawn.',
  },
  partially_sold: {
    label: 'Part sold',
    tone: 'held',
    detail: 'Some has sold. The rest is still on offer.',
  },
  sold: { label: 'Sold', tone: 'sold', detail: 'Paid to you in the next monthly payment.' },
  withdrawn: { label: 'Withdrawn', tone: 'held', detail: 'Back in your cellar.' },
  expired: { label: 'Expired', tone: 'held', detail: 'Back in your cellar.' },
  draft: {
    label: 'Sent back',
    tone: 'held',
    detail: 'We have asked for a change before we can list it.',
  },
};

/*
  Emerald only once the wine has sold: that is the moment that means money
  for the member. Everything still in progress reads in slate, never amber,
  which in the cellar is kept for something due.
*/
const TONES = {
  held: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:ring-slate-700',
  live: 'bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-600',
  sold: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900',
};

/**
 * What a member has offered for sale, and where it has got to
 *
 * Kept apart from the cellar itself because the questions are different: the
 * cellar answers "what do I own", this answers "what did I ask you to sell and
 * what happened". Wine under offer still appears in the cellar — it has not
 * gone anywhere — but it is not what a member comes here to check.
 */
const SellingPage = () => {
  const api = useTRPC();
  const isViewer = useIsCellarViewer();
  const [showPast, setShowPast] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    ...api.consignment.member.getMandates.queryOptions(),
  });

  const { mutate: withdraw, isPending } = useMutation(
    api.consignment.member.withdrawMandate.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.mandateNumber} withdrawn. It is back in your cellar.`);
        void refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const mandates = data?.mandates ?? [];

  const isPast = (status: string) =>
    ['sold', 'withdrawn', 'expired'].includes(status);
  const current = mandates.filter((mandate) => !isPast(mandate.status));
  const past = mandates.filter((mandate) => isPast(mandate.status));

  /*
    The questions a member actually arrives with: how much have I got out
    there, what is it worth to me if it sells, and has any of it gone live yet.
    Without these the page was a single row in a lot of white space, and the
    totals had to be worked out by reading down a column.
  */
  const live = mandates.filter((mandate) =>
    ['listed', 'placed', 'partially_sold'].includes(mandate.status),
  );

  const openBottles = current.reduce((sum, mandate) => sum + mandate.bottlesRemaining, 0);

  const openValue = current.reduce(
      (sum, mandate) => sum + mandate.askPerBottleUsd * mandate.bottlesRemaining,
      0,
    );

  /** One offer per card on a phone, one per row on a wider screen */
  const renderOffers = (rows: typeof mandates) => (
    <>
      {/* A phone gets one card per offer: a seven-column table cannot be read at that width */}
        <ul className="space-y-2 md:hidden">
          {rows.map((mandate) => {
            const state = STATES[mandate.status] ?? {
              label: mandate.status,
              tone: 'held' as const,
              detail: '',
            };
            const canWithdraw =
              !isViewer && ['offered', 'listed'].includes(mandate.status);

            return (
              <li
                key={mandate.id}
                className="border-border-muted bg-surface-primary rounded-xl border p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-text-primary min-w-0 text-lg font-semibold leading-snug">
                    {displayWineName(mandate.productName, { keepVintage: true })}
                  </p>
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[state.tone]}`}
                  >
                    {state.label}
                  </span>
                </div>
                <p className="text-text-muted mt-0.5 text-xs">
                  <span className="font-mono">{mandate.mandateNumber}</span>
                  {mandate.offeredAt
                    ? ` · offered ${formatDistanceToNowStrict(new Date(mandate.offeredAt), { addSuffix: true })}`
                    : ''}
                </p>
                <dl className="border-border-muted mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-text-muted">Bottles</dt>
                    <dd className="text-text-primary m-0 font-semibold tabular-nums">
                      {mandate.bottlesRemaining}
                      {mandate.bottlesRemaining !== mandate.bottlesOffered &&
                        ` of ${mandate.bottlesOffered}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Your price</dt>
                    <dd className="text-text-primary m-0 font-semibold tabular-nums">
                      {money(mandate.askPerBottleUsd)}
                      <span className="text-text-muted block text-[11px] font-normal">
                        per bottle
                      </span>
                      {setInLine(mandate) && (
                        <span className="text-text-muted block text-[11px] font-normal">
                          {setInLine(mandate)}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="hidden sm:block">
                    <dt className="text-text-muted">Buyer pays</dt>
                    <dd className="text-text-primary m-0 font-semibold tabular-nums">
                      {money(listedPrice(mandate.askPerBottleUsd))}
                      <span className="text-text-muted block text-[11px] font-normal">
                        listed price
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">You receive</dt>
                    <dd className="text-text-primary m-0 font-semibold tabular-nums">
                      {money(mandate.askPerBottleUsd * mandate.bottlesRemaining)}
                    </dd>
                  </div>
                </dl>
                <p className="text-text-muted mt-2 text-xs leading-5">
                  {mandate.status === 'draft' && mandate.adminNotes
                    ? mandate.adminNotes
                    : state.detail}
                </p>
                {canWithdraw && (
                  <ConfirmAction
                    title="Withdraw this offer?"
                    description={
                    <p>
                      This wine comes off our lists and stays in your private
                      cellar. You can offer it again at any time.
                    </p>
                  }
                    confirmLabel="Withdraw offer"
                    tone="danger"
                    onConfirm={() => withdraw({ mandateId: mandate.id })}
                  >
                    <button
                      type="button"
                      disabled={isPending}
                      className="border-border-muted text-text-primary mt-3 h-10 w-full rounded-lg border text-sm font-semibold disabled:opacity-50 sm:w-auto sm:px-5"
                    >
                      Withdraw
                    </button>
                  </ConfirmAction>
                )}
              </li>
            );
          })}
        </ul>

        <div className="border-border-muted bg-surface-primary hidden overflow-x-auto rounded-xl border shadow-sm md:block md:max-h-[68vh] md:overflow-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-fill-muted/60 border-border-muted sticky top-0 z-10 border-b backdrop-blur">
              <tr className="text-text-muted text-[10px] uppercase tracking-[0.08em]">
                <th className="px-4 py-2 text-left">Wine</th>
                <th className="px-3 py-2 text-right">Bottles</th>
                <th className="px-3 py-2 text-right">Your price</th>
                <th className="px-3 py-2 text-right">Buyer pays</th>
                <th className="px-3 py-2 text-right">You receive</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right" />
              </tr>
            </thead>
            <tbody className="divide-border-muted divide-y">
              {rows.map((mandate) => {
                const state = STATES[mandate.status] ?? {
                  label: mandate.status,
                  tone: 'held' as const,
                  detail: '',
                };

                const canWithdraw = !isViewer && ['offered', 'listed'].includes(
                  mandate.status,
                );

                return (
                  <tr
                    key={mandate.id}
                    className="hover:bg-fill-muted/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-text-primary text-base font-semibold leading-snug">
                        {displayWineName(mandate.productName, { keepVintage: true })}
                      </p>
                      <Typography
                        variant="bodyXs"
                        colorRole="muted"
                        className="block"
                      >
                        <span className="font-mono">{mandate.mandateNumber}</span>
                        {mandate.offeredAt
                          ? ` · offered ${formatDistanceToNowStrict(new Date(mandate.offeredAt), { addSuffix: true })}`
                          : ''}
                      </Typography>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {mandate.bottlesRemaining}
                      {mandate.bottlesRemaining !== mandate.bottlesOffered && (
                        <span className="text-text-muted text-xs">
                          {' '}
                          of {mandate.bottlesOffered}
                        </span>
                      )}
                    </td>
                    <td className="text-text-muted px-3 py-3 text-right tabular-nums">
                      {money(mandate.askPerBottleUsd)}
                      <span className="text-text-muted block text-[11px]">
                        per bottle
                      </span>
                      {setInLine(mandate) && (
                        <span className="text-text-muted block text-[11px]">
                          {setInLine(mandate)}
                        </span>
                      )}
                    </td>
                    {/*
                      The margin, disclosed rather than discovered. A member who
                      finds their $210 on our list at $221 having never been
                      told is right to ask why; the rate depends on who buys, so
                      it is a range until one does.
                    */}
                    {/*
                      One figure, not a range. The range implied the price moved
                      with the buyer; it does not. Wine lists at one number, and
                      what varies behind it is our commission — 2.5% or 5%
                      depending on who buys — which never changes what the
                      member receives.
                    */}
                    <td className="text-text-muted px-3 py-3 text-right tabular-nums">
                      {money(listedPrice(mandate.askPerBottleUsd))}
                      <span className="text-text-muted block text-[11px]">
                        listed price
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {money(
                        mandate.askPerBottleUsd * mandate.bottlesRemaining,
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[state.tone]}`}
                      >
                        {state.label}
                      </span>
                      <Typography
                        variant="bodyXs"
                        colorRole="muted"
                        className="mt-1 block max-w-[34ch]"
                      >
                        {mandate.status === 'draft' && mandate.adminNotes
                          ? mandate.adminNotes
                          : state.detail}
                      </Typography>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canWithdraw ? (
                        <ConfirmAction
                          title="Withdraw this offer?"
                          description={
                    <p>
                      This wine comes off our lists and stays in your private
                      cellar. You can offer it again at any time.
                    </p>
                  }
                          confirmLabel="Withdraw offer"
                          tone="danger"
                          onConfirm={() => withdraw({ mandateId: mandate.id })}
                        >
                          <Button size="sm" variant="outline" isDisabled={isPending}>
                            <ButtonContent>Withdraw</ButtonContent>
                          </Button>
                        </ConfirmAction>
                      ) : (
                        /*
                          A sentence, not a disabled button. A greyed control
                          invites a click to find out why it is greyed.
                        */
                        <Typography variant="bodyXs" colorRole="muted">
                          {mandate.status === 'placed' ||
                          mandate.status === 'partially_sold'
                            ? 'Cannot be withdrawn'
                            : ''}
                        </Typography>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
    </>
  );

  const awaitingReview = mandates.filter((mandate) => mandate.status === 'offered').length;

  return (
    <div className="w-full pb-8">
      <CellarPageHeader
        title="Selling"
        description="Wine you have offered for sale through Craft & Culture."
      />

      {!isLoading && !isError && current.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {[
            {
              label: 'Bottles offered',
              amount: openBottles,
              value: String(openBottles),
              detail: `across ${current.length} ${current.length === 1 ? 'offer' : 'offers'}`,
              icon: IconBottle,
              tone: 'plain' as const,
            },
            {
              label: 'You receive if it sells',
              amount: openValue,
              value: money(openValue),
              detail: 'at your asking price',
              icon: IconCoin,
              tone: 'emerald' as const,
            },
            {
              label: 'Listed for sale',
              amount: live.length,
              value: String(live.length),
              detail: live.length === 1 ? 'offer live' : 'offers live',
              icon: IconTag,
              tone: 'plain' as const,
            },
            {
              label: 'Awaiting review',
              amount: awaitingReview,
              value: String(awaitingReview),
              detail: 'with us now',
              icon: IconClock,
              tone: 'plain' as const,
            },
          ]
            // A tile that reads 0 says nothing a member needs to know
            .filter((stat) => stat.amount > 0)
            .map((stat) => (
            <CellarStatTile
              key={stat.label}
              label={stat.label}
              value={stat.value}
              detail={stat.detail}
              icon={stat.icon}
              tone={stat.tone}
            />
          ))}
        </div>
      )}

      <SaleProceedsPanel />

      {isLoading && <CellarState kind="loading" className="mt-6" />}

      {isError && <CellarState kind="error" className="mt-6" />}

      {!isLoading && !isError && mandates.length === 0 && (
        <div className="mt-6">
          <FirstStepsCard
            eyebrow="Selling from your cellar"
            title="Offer wine from your collection"
            message="Your wine stays in our bonded warehouse until it sells, and you decide the price."
            steps={[
              {
                icon: IconBottle,
                title: 'Choose your wines',
                text: 'In your cellar, select the wines and press Sell.',
              },
              {
                icon: IconTag,
                title: 'Set your price',
                text: 'Name your asking price in USD, EUR, GBP or AED. We review the offer with you.',
              },
              {
                icon: IconCoin,
                title: 'Paid when it sells',
                text: 'Nothing leaves your cellar until it is sold, and the proceeds are paid to you.',
              },
            ]}
            action={{ href: '/platform/cellar', label: 'Choose wines in your cellar' }}
          />
        </div>
      )}

      {!isLoading && current.length > 0 && renderOffers(current)}

      {/*
        Sold, withdrawn and expired offers are a record, not something to act
        on. They fold away so a long selling history does not push the offers
        still in play out of sight.
      */}
      {!isLoading && past.length > 0 && (
        <section className={current.length > 0 ? 'mt-8' : ''}>
          <button
            type="button"
            onClick={() => setShowPast((value) => !value)}
            aria-expanded={showPast || current.length === 0}
            className="text-text-muted hover:text-text-primary mb-2.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider"
          >
            Past offers · {past.length}
            <Icon
              icon={IconChevronDown}
              size="xs"
              className={`transition-transform ${showPast || current.length === 0 ? 'rotate-180' : ''}`}
            />
          </button>
          {/* With nothing current, the history is all there is, so it shows */}
          {(showPast || current.length === 0) && renderOffers(past)}
        </section>
      )}
    </div>
  );
};

export default SellingPage;
