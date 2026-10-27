'use client';

import { IconChevronDown, IconChevronRight, IconTag, IconX } from '@tabler/icons-react';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

import QuantityStepper from '@/app/_cellar/components/QuantityStepper';
import displayWineName from '@/app/_wms/utils/displayWineName';

/** The parts of a cellar wine this view reads; the page's own type satisfies it */
export interface PhoneWine {
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  bottleSize: string | null;
  caseConfig: number | null;
  totalCases: number;
  /** Loose bottles from an opened case */
  openBottles?: number | null;
  region?: string | null;
  country?: string | null;
  locations: { stockId: string; receivedAt: Date | string | null }[];
  uk?: { bottles: number; receivedAt: Date | string | null }[];
}

export interface CellarPhoneCollectionProps<W extends PhoneWine> {
  /** The wines the page's search, filters and location strip leave showing */
  wines: W[];
  /** A search is typed: open every group so matches are not hidden */
  isSearching: boolean;
  isViewer: boolean;
  /** The location strip is on the UK: nothing there can be delivered from here */
  isUkOnly: boolean;
  bottlesInBasket: (wine: W) => number;
  addToDelivery: (wine: W, bottles: number) => void;
  onSell: (wine: W) => void;
}

type GroupBy = 'region' | 'producer' | 'vintage';

const GROUPINGS: { key: GroupBy; label: string }[] = [
  { key: 'region', label: 'By region' },
  { key: 'producer', label: 'By producer' },
  { key: 'vintage', label: 'By vintage' },
];

const sizeMlOf = (size: string | null) => {
  const match = /([\d.]+)\s*(cl|ml|l)\b/i.exec(size ?? '');
  if (!match) return 750;
  const value = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  return Math.round(unit === 'l' ? value * 1000 : unit === 'cl' ? value * 10 : value);
};

/** "Magnum", "Bottle", "Half bottle" … as a collector would name the bottle */
const bottleName = (size: string | null) => {
  const ml = sizeMlOf(size);
  if (ml <= 400) return 'Half bottle';
  if (ml <= 800) return 'Bottle';
  if (ml <= 1600) return 'Magnum';
  if (ml <= 3200) return 'Double magnum';
  if (ml <= 4600) return 'Jeroboam';
  if (ml <= 6200) return 'Imperial';
  return `${(ml / 1000).toLocaleString('en-GB')}L`;
};

const ukBottles = (wine: PhoneWine) => (wine.uk ?? []).reduce((sum, line) => sum + line.bottles, 0);
const uaeBottles = (wine: PhoneWine) =>
  wine.totalCases * (wine.caseConfig ?? 1) + (wine.openBottles ?? 0);

const formatOf = (wine: PhoneWine) => {
  const pack = wine.caseConfig ?? 1;
  const name = bottleName(wine.bottleSize);
  return pack > 1 ? `${name} · case of ${pack}` : name;
};

const sinceOf = (wine: PhoneWine) => {
  const dates = [...wine.locations.map((p) => p.receivedAt), ...(wine.uk ?? []).map((l) => l.receivedAt)]
    .filter(Boolean)
    .map((d) => new Date(d as string));
  if (!dates.length) return null;
  return format(new Date(Math.min(...dates.map((d) => d.getTime()))), 'MMMM yyyy');
};

const groupKey = (wine: PhoneWine, by: GroupBy) =>
  by === 'producer'
    ? wine.producer?.trim() || 'Other producers'
    : by === 'vintage'
      ? wine.vintage && wine.vintage > 1000
        ? String(wine.vintage)
        : 'Non-vintage'
      : wine.region?.trim() || wine.country?.trim() || 'Other';

/**
 * A member's collection on a phone: grouped, one line per wine, details on tap
 *
 * The desktop table has ten columns; on a phone that is a sideways scroll
 * through numbers. Here the collection folds into groups (region, producer or
 * vintage), each wine is a single line a collector would read aloud, and
 * everything else, including adding bottles to a delivery or offering the
 * wine for sale, is on the wine's own sheet.
 *
 * It holds no data of its own: it is handed the page's filtered wines and the
 * page's delivery basket, so search, filters, the activation gate and the
 * review step all behave exactly as on the desktop.
 */
const CellarPhoneCollection = <W extends PhoneWine>({
  wines,
  isSearching,
  isViewer,
  isUkOnly,
  bottlesInBasket,
  addToDelivery,
  onSell,
}: CellarPhoneCollectionProps<W>) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('region');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [chosen, setChosen] = useState<W | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, W[]>();
    for (const wine of wines) {
      const key = groupKey(wine, groupBy);
      map.set(key, [...(map.get(key) ?? []), wine]);
    }
    const sorted = [...map.entries()].map(([name, list]) => ({
      name,
      wines: [...list].sort(
        (a, b) =>
          displayWineName(a.productName).localeCompare(displayWineName(b.productName), 'en', { sensitivity: 'base' }) ||
          (a.vintage ?? 0) - (b.vintage ?? 0),
      ),
      bottles: list.reduce((sum, wine) => sum + uaeBottles(wine) + ukBottles(wine), 0),
    }));
    return groupBy === 'vintage'
      ? sorted.sort((a, b) => (Number(b.name) || 0) - (Number(a.name) || 0))
      : sorted.sort((a, b) => (a.name.startsWith('Other') ? 1 : b.name.startsWith('Other') ? -1 : b.bottles - a.bottles));
  }, [wines, groupBy]);

  /* One group needs no folding; a search shows every match */
  const isOpen = (name: string) => isSearching || groups.length === 1 || open.has(name);

  const toggle = (name: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  useEffect(() => {
    if (!chosen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [chosen]);

  return (
    <div className="flex flex-col gap-3 md:hidden">
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3">
        {GROUPINGS.map((grouping) => (
          <button
            key={grouping.key}
            type="button"
            onClick={() => {
              setGroupBy(grouping.key);
              setOpen(new Set());
            }}
            className={`h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold ${
              groupBy === grouping.key ? 'bg-text-primary text-surface-primary' : 'bg-black/[0.05] text-text-primary dark:bg-white/[0.08]'
            }`}
          >
            {grouping.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="text-text-muted py-8 text-center text-sm">No wines match.</p>
      ) : (
        <div className="border-border-muted bg-surface-primary overflow-hidden rounded-2xl border">
          {groups.map((group) => {
            const expanded = isOpen(group.name);
            return (
              <div key={group.name} className="border-border-muted border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggle(group.name)}
                  aria-expanded={expanded}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="text-text-primary block text-[15px] font-semibold">{group.name}</span>
                    <span className="text-text-muted text-xs">
                      {group.wines.length} {group.wines.length === 1 ? 'wine' : 'wines'} · {group.bottles}{' '}
                      {group.bottles === 1 ? 'bottle' : 'bottles'}
                    </span>
                  </span>
                  {expanded ? (
                    <IconChevronDown size={18} className="text-text-muted shrink-0" />
                  ) : (
                    <IconChevronRight size={18} className="text-text-muted shrink-0" />
                  )}
                </button>

                {expanded && (
                  <ul className="border-border-muted border-t">
                    {group.wines.map((wine) => {
                      const bottles = uaeBottles(wine) + ukBottles(wine);
                      const picked = bottlesInBasket(wine);
                      return (
                        <li key={wine.lwin18} className="border-border-muted border-b last:border-b-0">
                          <button
                            type="button"
                            onClick={() => setChosen(wine)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-black/[0.04] dark:active:bg-white/[0.06]"
                          >
                            <span className="min-w-0">
                              <span className="text-text-primary block text-sm font-medium leading-snug">
                                {displayWineName(wine.productName)}
                              </span>
                              <span className="text-text-muted mt-0.5 block text-xs">
                                {wine.vintage && wine.vintage > 1000 ? `${wine.vintage} · ` : 'NV · '}
                                {formatOf(wine)}
                                {ukBottles(wine) > 0 && (uaeBottles(wine) > 0 ? ' · UAE and UK' : ' · UK bond')}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end">
                              <span className="text-text-primary text-sm font-semibold tabular-nums">{bottles}</span>
                              {picked > 0 && (
                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                  {picked} to deliver
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {chosen && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={displayWineName(chosen.productName)}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/35" onClick={() => setChosen(null)} />
          <div className="bg-background-primary absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/15 dark:bg-white/20" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  {[chosen.vintage && chosen.vintage > 1000 ? chosen.vintage : 'NV', chosen.region || chosen.country]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <h2 className="text-text-primary mt-1 text-xl font-semibold leading-tight tracking-tight">
                  {displayWineName(chosen.productName)}
                </h2>
                {chosen.producer && <p className="text-text-muted mt-0.5 text-sm">{chosen.producer}</p>}
              </div>
              <button
                type="button"
                onClick={() => setChosen(null)}
                aria-label="Close"
                className="text-text-muted grid size-9 shrink-0 place-items-center rounded-full bg-black/[0.05] dark:bg-white/[0.08]"
              >
                <IconX size={18} />
              </button>
            </div>

            <dl className="border-border-muted mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border">
              {[
                ['Bottles', String(uaeBottles(chosen) + ukBottles(chosen))],
                ['Format', formatOf(chosen)],
                [
                  'Held at',
                  uaeBottles(chosen) > 0 && ukBottles(chosen) > 0
                    ? 'C&C warehouse and UK bond'
                    : ukBottles(chosen) > 0
                      ? 'Our UK bond'
                      : 'C&C bonded warehouse',
                ],
                ['In your cellar since', sinceOf(chosen) ?? 'Recently'],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`border-border-muted px-4 py-3 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b' : ''}`}
                >
                  <dt className="text-text-muted text-[11px]">{label}</dt>
                  <dd className="text-text-primary text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            {!isViewer && !isUkOnly && uaeBottles(chosen) > 0 && (
              <div className="mt-5 flex flex-col gap-3">
                <p className="text-text-primary text-sm font-semibold">Request a delivery</p>
                <div className="border-border-muted flex items-center justify-between rounded-2xl border px-4 py-3">
                  <span className="text-text-muted text-sm">Bottles to deliver</span>
                  <QuantityStepper
                    value={bottlesInBasket(chosen)}
                    max={uaeBottles(chosen)}
                    label={`bottle of ${displayWineName(chosen.productName)}`}
                    onChange={(next) => addToDelivery(chosen, next - bottlesInBasket(chosen))}
                  />
                </div>
                {(chosen.caseConfig ?? 1) > 1 && bottlesInBasket(chosen) + (chosen.caseConfig ?? 1) <= uaeBottles(chosen) && (
                  <button
                    type="button"
                    onClick={() => addToDelivery(chosen, chosen.caseConfig ?? 1)}
                    className="border-border-muted text-text-primary h-11 rounded-xl border text-sm font-semibold"
                  >
                    Add a case of {chosen.caseConfig}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setChosen(null)}
                  disabled={bottlesInBasket(chosen) === 0}
                  className="bg-text-primary text-surface-primary h-12 rounded-xl text-[15px] font-semibold disabled:opacity-40"
                >
                  {bottlesInBasket(chosen) > 0 ? 'Done, review below' : 'Choose bottles above'}
                </button>
              </div>
            )}

            {!isViewer && uaeBottles(chosen) > 0 && (
              <button
                type="button"
                onClick={() => {
                  const wine = chosen;
                  setChosen(null);
                  onSell(wine);
                }}
                className="text-text-primary mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
              >
                <IconTag size={17} /> Offer this wine for sale
              </button>
            )}

            {ukBottles(chosen) > 0 && uaeBottles(chosen) === 0 && (
              <p className="text-text-muted mt-5 rounded-xl bg-black/[0.04] px-4 py-3 text-sm dark:bg-white/[0.06]">
                This wine is held at our UK bond. To bring it to the UAE, choose Move wine to the UAE above.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CellarPhoneCollection;
