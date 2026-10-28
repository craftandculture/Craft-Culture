'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import CELLAR_CURRENCIES from '@/app/_cellar/constants/cellarCurrencies';
import type { CellarCurrency } from '@/app/_cellar/constants/cellarCurrencies';
import useTRPC from '@/lib/trpc/browser';

const STORAGE_KEY = 'cc-cellar-currency';

/* The dirham is pegged, so it reads correctly even before today's rates arrive */
const FALLBACK: Partial<Record<CellarCurrency, number>> = { USD: 1, AED: 1 / 3.6725 };

/**
 * The currency a member reads their cellar in, and today's rates
 *
 * Everything is held in USD, the base; the choice only changes how a figure
 * is shown, or what an asking price is typed in. USD unless the member picks
 * another, and the choice is remembered on this device. A currency whose rate
 * could not be fetched today is not offered.
 *
 * @example
 *   const { currency, money, toUsd } = useCellarCurrency();
 *   money(120); // '€107' when EUR is chosen
 */
const useCellarCurrency = () => {
  const api = useTRPC();
  const [currency, setCurrencyState] = useState<CellarCurrency>('USD');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (CELLAR_CURRENCIES as readonly string[]).includes(saved)) {
        setCurrencyState(saved as CellarCurrency);
      }
    } catch {
      // Storage can be blocked; USD it is
    }
  }, []);

  const { data } = useQuery({
    ...api.consignment.member.getFxRates.queryOptions(),
    staleTime: 60 * 60 * 1000,
  });

  const rates = { ...FALLBACK, ...data?.rates };
  const available = CELLAR_CURRENCIES.filter((code) => rates[code] != null);
  const active: CellarCurrency = rates[currency] != null ? currency : 'USD';
  /** USD per one unit of the chosen currency */
  const rate = rates[active] ?? 1;

  const setCurrency = (next: CellarCurrency) => {
    setCurrencyState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Remembered for this visit only
    }
  };

  /** A USD figure, read in the chosen currency */
  const money = (usd: number, precise = false) =>
    (usd / rate).toLocaleString('en-US', {
      style: 'currency',
      currency: active,
      maximumFractionDigits: precise ? 2 : 0,
    });

  return {
    currency: active,
    setCurrency,
    available,
    rate,
    rates,
    asOf: data?.asOf ?? null,
    money,
    /** An amount in the chosen currency, in USD */
    toUsd: (amount: number) => Math.round(amount * rate * 100) / 100,
  };
};

export default useCellarCurrency;
