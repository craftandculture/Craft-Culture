'use client';

import { IconBuildingWarehouse, IconWorld } from '@tabler/icons-react';
import { format } from 'date-fns';

export type CellarLocation = 'all' | 'uae' | 'uk';

export interface CellarLocationSummary {
  key: Exclude<CellarLocation, 'all'>;
  /** The country, as the card's heading */
  country: string;
  /** Who holds it there, as a collector would put it */
  place: string;
  bottles: number;
  wines: number;
  /** Indicative value in USD, where any of it is priced */
  valueUsd: number;
  /** When the warehouse last told us what it holds; absent for our own */
  updatedAt?: Date | string | null;
}

export interface CellarLocationStripProps {
  locations: CellarLocationSummary[];
  value: CellarLocation;
  onChange: (location: CellarLocation) => void;
  formatValue: (usd: number) => string;
}

const plural = (count: number, word: string) =>
  `${count.toLocaleString('en-US')} ${count === 1 ? word : `${word}s`}`;

/**
 * Where a member's wine is, and a way to look at one place at a time
 *
 * One collection, with the location as something to filter by, rather than a
 * UAE cellar with other warehouses hung beneath it. All comes first, because
 * the collection is what a member owns; each place then has its own card with
 * what is held there. A warehouse we are told about by report says when it
 * last reported, so a member can see how fresh the figure is.
 *
 * Only shown when wine is held in more than one place.
 */
const CellarLocationStrip = ({ locations, value, onChange, formatValue }: CellarLocationStripProps) => {
  const all = locations.reduce(
    (sum, location) => ({
      bottles: sum.bottles + location.bottles,
      wines: sum.wines + location.wines,
      valueUsd: sum.valueUsd + location.valueUsd,
    }),
    { bottles: 0, wines: 0, valueUsd: 0 },
  );

  const cards = [
    {
      key: 'all' as const,
      country: 'All locations',
      place: plural(locations.length, 'warehouse'),
      ...all,
      updatedAt: null,
    },
    ...locations,
  ];

  return (
    <div className="-mx-3 mb-5 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
      {cards.map((card) => {
        const isActive = value === card.key;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onChange(card.key)}
            aria-pressed={isActive}
            className={`min-w-[220px] flex-shrink-0 rounded-xl border px-4 py-3 text-left transition-colors sm:min-w-0 ${
              isActive
                ? 'border-text-primary bg-surface-primary shadow-sm ring-1 ring-text-primary'
                : 'border-border-muted bg-surface-primary hover:border-text-muted'
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-md ${
                  isActive ? 'bg-text-primary text-surface-primary' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10'
                }`}
              >
                {card.key === 'all' ? <IconWorld size={13} /> : <IconBuildingWarehouse size={13} />}
              </span>
              <span className="text-text-primary text-sm font-semibold">{card.country}</span>
            </span>
            <span className="text-text-muted mt-0.5 block truncate text-xs">{card.place}</span>
            <span className="text-text-primary mt-2 block text-lg font-bold tabular-nums leading-tight">
              {plural(card.bottles, 'bottle')}
            </span>
            <span className="text-text-muted block text-[11px]">
              {plural(card.wines, 'wine')}
              {card.valueUsd > 0 ? ` · about ${formatValue(card.valueUsd)}` : ''}
              {card.updatedAt ? ` · updated ${format(new Date(card.updatedAt), 'd MMM')}` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CellarLocationStrip;
