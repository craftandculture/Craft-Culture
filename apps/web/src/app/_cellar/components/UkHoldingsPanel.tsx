'use client';

import { IconBuildingWarehouse } from '@tabler/icons-react';
import type { inferRouterOutputs } from '@trpc/server';
import { format } from 'date-fns';

import ContactLinks from '@/app/_onboarding/components/ContactLinks';
import type { AppRouter } from '@/trpc-router';

import bottleName from '../utils/bottleName';

type UkHoldings = inferRouterOutputs<AppRouter>['cellar']['member']['getUkHoldings'];

export interface UkHoldingsPanelProps {
  data: UkHoldings;
}

/** "4 cases of 6", "3 bottles", "1 magnum", as a collector would say it */
const quantityOf = (holding: UkHoldings['holdings'][number]) => {
  const size = holding.bottleSizeLitres ? bottleName(`${Math.round(holding.bottleSizeLitres * 100)}cl`) : null;
  const isNamed = size !== null && !/\d/.test(size);
  const unit = (count: number) =>
    isNamed && size ? `${count} ${size.toLowerCase()}${count === 1 ? '' : 's'}` : `${count} ${count === 1 ? 'bottle' : 'bottles'}`;

  const parts: string[] = [];

  if (holding.cases > 0 && holding.bottlesPerCase) {
    parts.push(`${holding.cases} ${holding.cases === 1 ? 'case' : 'cases'} of ${holding.bottlesPerCase}`);
  }

  if (holding.singles > 0 || parts.length === 0) {
    parts.push(unit(holding.cases > 0 ? holding.singles : holding.totalBottles));
  }

  return parts.join(' and ');
};

/**
 * The member's wine at C&C's UK bond, in the same collection as the rest
 *
 * Read from LCB's own stock report, so it is exactly what our account at
 * Burton holds for them. Nothing is priced here; moving wine to the UAE is a
 * conversation with a freight quote, so the panel says how to ask.
 */
const UkHoldingsPanel = ({ data }: UkHoldingsPanelProps) => {
  if (data.holdings.length === 0) return null;

  const bottles = data.holdings.reduce((sum, holding) => sum + holding.totalBottles, 0);

  return (
    <section className="border-border-muted bg-surface-primary mt-8 overflow-hidden rounded-xl border shadow-sm">
      <header className="border-border-muted flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-500/20">
            <IconBuildingWarehouse size={15} />
          </span>
          <div>
            <p className="text-text-primary text-sm font-semibold">United Kingdom · London City Bond, Burton</p>
            <p className="text-text-muted text-xs">
              Held in bond for you in C&amp;C&apos;s account · {data.holdings.length}{' '}
              {data.holdings.length === 1 ? 'wine' : 'wines'}, {bottles} {bottles === 1 ? 'bottle' : 'bottles'}
            </p>
          </div>
        </div>
        {data.reportedAt && (
          <p className="text-text-muted text-[11px]">Updated {format(new Date(data.reportedAt), 'd MMM yyyy')}</p>
        )}
      </header>

      <ul className="divide-border-muted divide-y">
        {data.holdings.map((holding) => (
          <li key={holding.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <p className="min-w-0 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              {holding.name}
              <span className="text-text-muted font-normal"> · {holding.vintage ?? 'NV'}</span>
            </p>
            <p className="text-text-muted flex-shrink-0 text-xs tabular-nums">
              {quantityOf(holding)}
              {holding.receivedAt ? ` · since ${format(new Date(holding.receivedAt), 'MMM yyyy')}` : ''}
            </p>
          </li>
        ))}
      </ul>

      <footer className="border-border-muted bg-surface-muted/40 space-y-2 border-t px-4 py-3">
        <p className="text-text-muted text-xs leading-5">
          Your UK wine stays under bond, duty and VAT suspended. When you would like any of it brought to your cellar
          in the UAE, let us know and we will arrange the shipment and send you the costs first.
        </p>
        <ContactLinks />
      </footer>
    </section>
  );
};

export default UkHoldingsPanel;
