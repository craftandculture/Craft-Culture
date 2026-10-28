'use client';

import { IconX } from '@tabler/icons-react';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import CurrencyToggle from '@/app/_cellar/components/CurrencyToggle';
import QuantityStepper from '@/app/_cellar/components/QuantityStepper';
import type { CellarCurrency } from '@/app/_cellar/constants/cellarCurrencies';
import bottleName from '@/app/_cellar/utils/bottleName';
import collectorWineName from '@/app/_cellar/utils/collectorWineName';
import { COMMISSION_RATES } from '@/app/_consignment/constants/commissionRates';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import { useTRPCClient } from '@/lib/trpc/browser';

/** One wine a member can offer, with the bottles free on each parcel */
export interface SellableWine {
  lwin18: string;
  productName: string;
  vintage: number | null;
  bottleSize: string | null;
  parcels: { stockId: string; availableBottles: number }[];
}

export interface SellWinesDialogProps {
  wines: SellableWine[];
  onClose: () => void;
  /** Called after at least one offer went through */
  onOffered: () => void;
  /** The member has not finished activating their cellar; the page explains what is left */
  onNotActivated: () => void;
  currency: CellarCurrency;
  currencies: readonly CellarCurrency[];
  onCurrencyChange: (currency: CellarCurrency) => void;
  /** USD per one unit of the chosen currency, today */
  rate: number;
  /** The rate for each currency, to say what one unit is worth */
  rates: Partial<Record<CellarCurrency, number>>;
}

/* The highest commission a buyer could pay, so the price shown is never understated */
const COMMISSION_PCT = Math.max(COMMISSION_RATES.trade, COMMISSION_RATES.collector);

const DARK_ACTION =
  'border-transparent bg-text-primary text-surface-primary fill-surface-primary hover:border-transparent hover:bg-text-primary hover:opacity-90 active:bg-text-primary';

const SYMBOL: Record<CellarCurrency, string> = { USD: '$', EUR: '€', GBP: '£', AED: 'AED ' };

const format2 = (value: number, code: CellarCurrency) =>
  value.toLocaleString('en-US', { style: 'currency', currency: code, maximumFractionDigits: 2 });

/**
 * Offer one or several wines to C&C to sell, each at the member's own price
 *
 * Every wine gets its own quantity and price, and becomes its own offer,
 * because each is reviewed, listed and sold on its own timetable. The price
 * can be typed in USD, EUR, GBP or AED. USD is the base: anything else is
 * converted at today's rate when the offer is sent, and that dollar figure is
 * what the member is owed, whatever the rate does before the wine sells.
 */
const SellWinesDialog = ({
  wines,
  onClose,
  onOffered,
  onNotActivated,
  currency,
  currencies,
  onCurrencyChange,
  rate,
  rates,
}: SellWinesDialogProps) => {
  const trpcClient = useTRPCClient();
  const [lines, setLines] = useState<Map<string, { bottles: number; price: string }>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [isSending, setIsSending] = useState(false);

  const freeOf = (wine: SellableWine) =>
    wine.parcels.reduce((sum, parcel) => sum + Math.max(0, parcel.availableBottles), 0);

  // Every bottle that is free, by default; a member selling a wine usually sells all of it
  useEffect(() => {
    setLines((current) => {
      const next = new Map<string, { bottles: number; price: string }>();
      for (const wine of wines) {
        next.set(wine.lwin18, current.get(wine.lwin18) ?? { bottles: freeOf(wine), price: '' });
      }
      return next;
    });
    setErrors(new Map());
  }, [wines]);

  const update = (lwin18: string, change: Partial<{ bottles: number; price: string }>) =>
    setLines((current) => {
      const next = new Map(current);
      const line = next.get(lwin18) ?? { bottles: 0, price: '' };
      next.set(lwin18, { ...line, ...change });
      return next;
    });

  const ready = wines
    .map((wine) => {
      const line = lines.get(wine.lwin18);
      const price = Math.max(0, Number(line?.price) || 0);
      return { wine, bottles: line?.bottles ?? 0, price };
    })
    .filter((line) => line.bottles > 0 && line.price > 0);

  const receiveLocal = ready.reduce((sum, line) => sum + line.bottles * line.price, 0);
  const bottlesTotal = ready.reduce((sum, line) => sum + line.bottles, 0);
  const incomplete = wines.length - ready.length;

  const send = async () => {
    setIsSending(true);
    const failed = new Map<string, string>();
    const sent: string[] = [];

    // One offer per wine, sent in turn so each succeeds or fails on its own
    for (const { wine, bottles, price } of ready) {
      let remaining = bottles;
      const offerLines = wine.parcels
        .map((parcel) => {
          const take = Math.min(Math.max(0, parcel.availableBottles), remaining);
          remaining -= take;
          return { stockId: parcel.stockId, bottles: take };
        })
        .filter((line) => line.bottles > 0);

      try {
        const result = await trpcClient.consignment.member.offerForSale.mutate({
          lines: offerLines,
          askPerBottle: price,
          askCurrency: currency,
        });
        sent.push(result.mandateNumber);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('NOT_ACTIVATED')) {
          setIsSending(false);
          onClose();
          onNotActivated();
          return;
        }
        failed.set(wine.lwin18, error instanceof Error ? error.message : 'Could not send this offer');
      }
    }

    setIsSending(false);
    setErrors(failed);

    if (sent.length > 0) {
      toast.success(
        sent.length === 1
          ? `${sent[0]} sent. We will come back to you once it is listed.`
          : `${sent.length} offers sent. We will come back to you as each is listed.`,
      );
      onOffered();
    }
    if (failed.size === 0) onClose();
  };

  const rateLine =
    currency === 'USD'
      ? 'Prices are held in US dollars, the base currency of your cellar.'
      : `Converted to US dollars, the base currency of your cellar, at today's rate: ${SYMBOL[currency].trim()}1 = $${rate.toFixed(4)}. The dollar price is fixed on the day you list; a later move in the rate does not change it.`;

  return (
    <Dialog open={wines.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {wines.length === 1 ? 'Sell this wine' : `Sell ${wines.length} wines`}
          </DialogTitle>
          <DialogDescription>
            Set how many bottles and the price you want to receive for each.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-text-muted text-xs">Your prices in</span>
            <CurrencyToggle value={currency} options={currencies} onChange={onCurrencyChange} />
          </div>

          <ul className="border-border-muted divide-border-muted divide-y rounded-xl border">
            {wines.map((wine) => {
              const line = lines.get(wine.lwin18) ?? { bottles: 0, price: '' };
              const free = freeOf(wine);
              const price = Math.max(0, Number(line.price) || 0);
              const error = errors.get(wine.lwin18);

              return (
                <li key={wine.lwin18} className="px-3 py-3 sm:px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-text-primary text-sm font-medium">
                        {collectorWineName(wine.productName)}
                      </p>
                      <p className="text-text-muted text-xs tabular-nums">
                        {wine.vintage ?? 'NV'} · {bottleName(wine.bottleSize)} · {free}{' '}
                        {free === 1 ? 'bottle' : 'bottles'} free to offer
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-text-muted mb-1 block text-[11px]">Bottles</span>
                      <QuantityStepper
                        value={line.bottles}
                        max={free}
                        onChange={(bottles) => update(wine.lwin18, { bottles })}
                        label={`bottle of ${collectorWineName(wine.productName)}`}
                      />
                    </div>
                    <label className="block">
                      <span className="text-text-muted mb-1 block text-[11px]">
                        You receive per bottle ({currency})
                      </span>
                      <div className="border-border-muted bg-background-primary focus-within:border-text-muted flex h-9 items-center rounded-lg border px-2.5">
                        <span className="text-text-muted mr-1 text-sm">{SYMBOL[currency].trim()}</span>
                        <input
                          inputMode="decimal"
                          value={line.price}
                          onChange={(event) =>
                            update(wine.lwin18, { price: event.target.value.replace(/[^0-9.]/g, '') })
                          }
                          placeholder="0.00"
                          className="w-full bg-transparent text-right text-sm tabular-nums outline-none"
                        />
                      </div>
                      {price > 0 && currency !== 'USD' && (
                        <span className="text-text-muted mt-1 block text-right text-[11px] tabular-nums">
                          {format2(price * rate, 'USD')} a bottle
                        </span>
                      )}
                    </label>
                  </div>
                  {price > 0 && (
                    <p className="text-text-muted mt-1.5 text-[11px]">
                      Listed at up to {format2(price / (1 - COMMISSION_PCT / 100), currency)} a bottle,
                      with our commission added.
                    </p>
                  )}
                  {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
                </li>
              );
            })}
          </ul>

          {ready.length > 0 && (
            <dl className="bg-surface-muted flex flex-col gap-1 rounded-xl px-4 py-3 text-sm">
              <div className="flex justify-between">
                <dt className="font-semibold">You receive if it all sells</dt>
                <dd className="font-semibold tabular-nums">{format2(receiveLocal, currency)}</dd>
              </div>
              {currency !== 'USD' && (
                <div className="flex justify-between">
                  <dt className="text-text-muted text-xs">Fixed in US dollars today</dt>
                  <dd className="text-text-muted text-xs tabular-nums">
                    {format2(receiveLocal * rate, 'USD')}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-text-muted text-xs">Bottles offered</dt>
                <dd className="text-text-muted text-xs tabular-nums">{bottlesTotal}</dd>
              </div>
            </dl>
          )}

          <p className="text-text-muted text-xs leading-relaxed">
            {rateLine}
            {rates.USD && currency === 'USD' && rates.EUR
              ? ` Today €1 = $${rates.EUR.toFixed(4)}${rates.GBP ? `, £1 = $${rates.GBP.toFixed(4)}` : ''}.`
              : ''}{' '}
            Rate as of {format(new Date(), 'd MMMM yyyy')}.
          </p>

          {/*
            The point of no return is placement, which the member neither sees
            coming nor controls, so it is said here, before they offer.
          */}
          <div className="border-border-muted rounded-xl border px-4 py-3">
            <p className="text-text-primary text-xs font-semibold">Before you offer</p>
            <p className="text-text-muted mt-1 text-xs leading-relaxed">
              You receive your asking price in full; our commission is added
              to it, never deducted. You can withdraw an offer at any time
              while the wine is in our warehouse. To sell it, we may place it with a licensed
              distributor; once it has left our warehouse, the offer can no
              longer be withdrawn.{' '}
              <a
                href="/legal/private-cellar-terms"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
              >
                Private Cellar terms
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              colorRole="primary"
              className={DARK_ACTION}
              isDisabled={isSending || ready.length === 0}
              onClick={() => void send()}
            >
              <ButtonContent>
                {isSending
                  ? 'Sending…'
                  : ready.length === 0
                    ? 'Set a price to offer'
                    : `Offer ${ready.length === 1 ? '1 wine' : `${ready.length} wines`} to C&C`}
              </ButtonContent>
            </Button>
            <Button variant="outline" onClick={onClose}>
              <ButtonContent iconLeft={IconX}>Cancel</ButtonContent>
            </Button>
            {incomplete > 0 && ready.length > 0 && (
              <span className="text-text-muted text-xs">
                {incomplete} {incomplete === 1 ? 'wine has' : 'wines have'} no price or bottles and will not be offered
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SellWinesDialog;
