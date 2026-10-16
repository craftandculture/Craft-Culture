'use client';

import {
  IconBottle,
  IconBuildingCastle,
  IconFilter,
  IconMail,
  IconMinus,
  IconPackages,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import bottleName from '@/app/_cellar/utils/bottleName';
import useActivationGate from '@/app/_onboarding/hooks/useActivationGate';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import displayWineName from '@/app/_wms/utils/displayWineName';
import useTRPC from '@/lib/trpc/browser';

/*
  Always two decimals. Without a minimum the column rendered $65, $80.9 and
  $67.01 in the same run of figures, so the decimal points did not line up and
  the eye could not compare them.
*/
const money = (value: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/*
  The catalogue name repeats the vintage and format that both have their own
  columns here, exactly as it does in the cellar.
*/
const displayName = displayWineName;

type SortKey = 'name' | 'priceAsc' | 'priceDesc' | 'vintageDesc' | 'available';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'name', label: 'Wine A–Z' },
  { id: 'priceAsc', label: 'Price, low first' },
  { id: 'priceDesc', label: 'Price, high first' },
  { id: 'vintageDesc', label: 'Vintage, newest' },
  { id: 'available', label: 'Most available' },
];

const PAGE = 50;

/**
 * What a member can add to their cellar
 *
 * The same catalogue the trade and private-client lists render, shown to a
 * member inside the platform. Wine another member has consigned appears here
 * without being marked as such, because a buyer is buying from C&C — which is
 * legally what is happening — and whose wine it was is nobody else's business.
 *
 * Four hundred wines is a catalogue, not a list, and a search box over a flat
 * table is not how anyone finds wine in one. Country, producer and vintage
 * narrow it; the rest is sorting and a page at a time.
 *
 * Filtering happens here rather than on the server because the whole catalogue
 * is fetched already — the trade and PC lists need it whole — so a round trip
 * per keystroke would buy nothing and cost the responsiveness.
 */
const AvailablePage = () => {
  const api = useTRPC();
  const { catchActivation, activationSheet } = useActivationGate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>('Wine');
  const [country, setCountry] = useState('');
  const [producer, setProducer] = useState('');
  const [vintage, setVintage] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  /*
    Cases, keyed by wine. Whole cases only — the book transfer moves a stock
    row's cases and a part case would have to be a fraction of one.
  */
  const [basket, setBasket] = useState<Map<string, number>>(new Map());

  const { data, isLoading, refetch } = useQuery({
    ...api.consignment.member.browseCatalogue.queryOptions({
      search: search || undefined,
      category,
    }),
  });

  const wines = useMemo(() => data?.wines ?? [], [data]);

  /*
    Built from what is actually in the list, so a member is never offered a
    filter that returns nothing. Recomputed when the category or search changes,
    which is why the options shrink as the list does.
  */
  const countries = useMemo(
    () =>
      [...new Set(wines.map((wine) => wine.country).filter(Boolean))].sort() as string[],
    [wines],
  );

  const producers = useMemo(
    () =>
      [...new Set(wines.map((wine) => wine.producer).filter(Boolean))].sort() as string[],
    [wines],
  );

  const vintages = useMemo(
    () =>
      [...new Set(wines.map((wine) => wine.vintage).filter(Boolean))].sort(
        (a, b) => Number(b) - Number(a),
      ) as number[],
    [wines],
  );

  const filtered = useMemo(() => {
    const rows = wines.filter(
      (wine) =>
        (!country || wine.country === country) &&
        (!producer || wine.producer === producer) &&
        (!vintage || String(wine.vintage) === vintage),
    );

    const sorted = [...rows];

    sorted.sort((a, b) => {
      if (sort === 'priceAsc') return a.pricePerBottleUsd - b.pricePerBottleUsd;
      if (sort === 'priceDesc') return b.pricePerBottleUsd - a.pricePerBottleUsd;
      if (sort === 'vintageDesc') return (b.vintage ?? 0) - (a.vintage ?? 0);
      if (sort === 'available') return b.availableBottles - a.availableBottles;

      return displayName(a.product).localeCompare(displayName(b.product));
    });

    return sorted;
  }, [wines, country, producer, vintage, sort]);

  const shown = filtered.slice(0, limit);
  const totalBottles = filtered.reduce(
    (sum, wine) => sum + wine.availableBottles,
    0,
  );
  const shownProducers = new Set(
    filtered.map((wine) => wine.producer).filter(Boolean),
  );

  const activeFilters = [
    country && { label: country, clear: () => setCountry('') },
    producer && { label: producer, clear: () => setProducer('') },
    vintage && { label: vintage, clear: () => setVintage('') },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const { mutate: placeOrder, isPending: isPlacing } = useMutation(
    api.consignment.member.createPurchase.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.purchaseNumber} reserved — pay by bank transfer within 48 hours.`,
        );
        setBasket(new Map());
        void refetch();
      },
      onError: (error) => {
        if (!catchActivation(error, 'purchase')) toast.error(error.message);
      },
    }),
  );

  const addCases = (lwin18: string, delta: number, maxCases: number) =>
    setBasket((current) => {
      const next = new Map(current);
      const chosen = Math.min(maxCases, Math.max(0, (next.get(lwin18) ?? 0) + delta));

      if (chosen === 0) next.delete(lwin18);
      else next.set(lwin18, chosen);

      return next;
    });

  const basketLines = [...basket.entries()]
    .map(([lwin18, cases]) => {
      const wine = wines.find((row) => row.lwin18 === lwin18);

      return wine ? { wine, cases } : null;
    })
    .filter(Boolean) as { wine: (typeof wines)[number]; cases: number }[];

  const basketTotal = basketLines.reduce(
    (sum, line) =>
      sum + line.cases * line.wine.caseConfig * line.wine.pricePerBottleUsd,
    0,
  );

  const basketBottles = basketLines.reduce(
    (sum, line) => sum + line.cases * line.wine.caseConfig,
    0,
  );

  const selectClass =
    'border-border-muted text-text-primary bg-surface-primary h-10 w-full min-w-0 rounded-lg border px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-text-primary/20 sm:h-9';

  const categoryTone = (category: string | null | undefined) =>
    category === 'Spirits'
      ? 'bg-amber-500'
      : category === 'RTD'
        ? 'bg-sky-500'
        : category === 'Wine'
          ? 'bg-emerald-500'
          : 'bg-slate-400';

  const origin = (wine: (typeof wines)[number]) =>
    [wine.producer, wine.region ?? wine.country].filter(Boolean).join(' · ');

  /*
    A private client counts bottles, and cases only as "a case of six". A
    wine sold by the bottle has a pack of one, which the trade notation
    rendered as cases of one.
  */
  const unitCount = (wine: (typeof wines)[number], count: number) =>
    wine.caseConfig > 1
      ? `${count} ${count === 1 ? 'case' : 'cases'} of ${wine.caseConfig}`
      : `${count} ${count === 1 ? 'bottle' : 'bottles'}`;

  /* One stepper for the table and the phone cards, so the two cannot drift. */
  const caseControl = (wine: (typeof wines)[number]) => {
    const chosen = basket.get(wine.lwin18) ?? 0;

    /*
      Loose bottles with no whole case behind them cannot be bought in bond. A
      disabled stepper would invite a click to find out why.
    */
    if (wine.availableCases <= 0) {
      return (
        <a
          href="mailto:enquiries@craftculture.xyz"
          className="text-text-muted hover:text-text-primary text-xs font-medium underline underline-offset-2"
        >
          Ask us
        </a>
      );
    }

    if (!chosen) {
      return (
        <button
          type="button"
          onClick={() => addCases(wine.lwin18, 1, wine.availableCases)}
          className="border-border-muted text-text-primary hover:bg-text-primary hover:text-surface-primary inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold transition-colors sm:h-8"
          aria-label={`Add ${wine.caseConfig > 1 ? 'a case' : 'a bottle'} of ${wine.product}`}
        >
          <Icon icon={IconPlus} size="xs" /> Add
        </button>
      );
    }

    return (
      <span className="bg-text-primary text-surface-primary inline-flex h-9 items-center rounded-lg sm:h-8">
        <button
          type="button"
          aria-label={`One fewer ${wine.caseConfig > 1 ? 'case' : 'bottle'} of ${wine.product}`}
          onClick={() => addCases(wine.lwin18, -1, wine.availableCases)}
          className="flex h-full w-8 items-center justify-center rounded-l-lg hover:bg-white/10"
        >
          <Icon icon={IconMinus} size="xs" />
        </button>
        <span className="min-w-[64px] px-1 text-center text-xs font-semibold tabular-nums">
          {unitCount(wine, chosen)}
        </span>
        <button
          type="button"
          aria-label={`One more ${wine.caseConfig > 1 ? 'case' : 'bottle'} of ${wine.product}`}
          disabled={chosen >= wine.availableCases}
          onClick={() => addCases(wine.lwin18, 1, wine.availableCases)}
          className="flex h-full w-8 items-center justify-center rounded-r-lg hover:bg-white/10 disabled:opacity-30"
        >
          <Icon icon={IconPlus} size="xs" />
        </button>
      </span>
    );
  };

  const availability = (wine: (typeof wines)[number]) =>
    wine.caseConfig > 1 && wine.availableCases > 0
      ? unitCount(wine, wine.availableCases)
      : `${wine.availableBottles} ${wine.availableBottles === 1 ? 'bottle' : 'bottles'}`;

  const pill =
    'bg-surface-muted text-text-primary inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums';

  return (
    <div className="w-full pb-28">
      {activationSheet}

      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Typography variant="headingMd" className="block">
            Available now
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1 block max-w-2xl">
            Held in bond with us and ready to add to your cellar. Prices are in bond, duty suspended &mdash; wine you
            buy here stays where it is.
          </Typography>
        </div>
        {/*
          One line, not a link on every row. A per-row mailto navigated the page
          away from the list somebody was halfway through reading.
        */}
        <a
          href="mailto:enquiries@craftculture.xyz"
          className="border-border-muted text-text-primary hover:bg-fill-muted inline-flex h-9 flex-shrink-0 items-center gap-1.5 self-start rounded-lg border px-3 text-xs font-semibold transition-colors sm:self-auto"
        >
          <Icon icon={IconMail} size="xs" /> Looking for something else?
        </a>
      </header>

      {/*
        Search, kind and the narrowing filters live in one panel, so the page
        reads as controls, then figures, then wine — three bands rather than
        one run of grey.
      */}
      <div className="border-border-muted bg-surface-secondary/40 mb-4 rounded-xl border p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative md:w-80 md:flex-shrink-0">
            <Icon
              icon={IconSearch}
              size="sm"
              className="text-text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search wine, producer or vintage"
              className="bg-surface-primary pl-9"
            />
          </div>

          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {[
              { id: undefined, label: 'Everything', tone: '' },
              { id: 'Wine', label: 'Wine', tone: 'bg-emerald-500' },
              { id: 'Spirits', label: 'Spirits', tone: 'bg-amber-500' },
              { id: 'RTD', label: 'RTD', tone: 'bg-sky-500' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  setCategory(chip.id);
                  setLimit(PAGE);
                }}
                aria-pressed={category === chip.id}
                className={`inline-flex h-9 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors ${
                  category === chip.id
                    ? 'bg-text-primary text-surface-primary'
                    : 'border-border-muted bg-surface-primary text-text-muted hover:text-text-primary border'
                }`}
              >
                {chip.tone && <span className={`size-1.5 rounded-full ${chip.tone}`} />}
                {chip.label}
              </button>
            ))}
          </div>

          {/*
            Hidden behind a toggle on small screens: three selects above the
            fold on a phone push the wine itself off it.
          */}
          <button
            type="button"
            onClick={() => setShowFilters((open) => !open)}
            className="border-border-muted bg-surface-primary text-text-primary inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold md:hidden"
          >
            <Icon icon={IconFilter} size="xs" />
            {showFilters ? 'Hide filters' : 'Filter and sort'}
            {activeFilters.length > 0 && (
              <span className="bg-text-primary text-surface-primary rounded-full px-1.5 text-[10px]">
                {activeFilters.length}
              </span>
            )}
          </button>

          </div>

          <div className={`${showFilters ? 'grid' : 'hidden'} grid-cols-2 gap-2 md:grid md:grid-cols-4`}>
            <select
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setLimit(PAGE);
              }}
              className={selectClass}
              aria-label="Country"
            >
              <option value="">All countries</option>
              {countries.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={producer}
              onChange={(event) => {
                setProducer(event.target.value);
                setLimit(PAGE);
              }}
              className={selectClass}
              aria-label="Producer"
            >
              <option value="">All producers</option>
              {producers.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={vintage}
              onChange={(event) => {
                setVintage(event.target.value);
                setLimit(PAGE);
              }}
              className={selectClass}
              aria-label="Vintage"
            >
              <option value="">All vintages</option>
              {vintages.map((option) => (
                <option key={option} value={String(option)}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className={selectClass}
              aria-label="Sort"
            >
              {SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/*
          What is being excluded, and a one-click way out of each. A filter that
          cannot be seen is one somebody forgets they set.
        */}
        {activeFilters.length > 0 && (
          <div className="border-border-muted mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
            {activeFilters.map((filter) => (
              <button
                key={filter.label}
                type="button"
                onClick={filter.clear}
                className="bg-surface-primary border-border-muted text-text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
              >
                {filter.label}
                <Icon icon={IconX} size="xs" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setCountry('');
                setProducer('');
                setVintage('');
              }}
              className="text-text-muted hover:text-text-primary px-1 text-xs font-semibold underline underline-offset-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted" className="block py-6">
          Loading&hellip;
        </Typography>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="border-border-muted rounded-xl border px-6 py-14 text-center">
          <Typography variant="bodyMd" colorRole="muted" className="block">
            {search || activeFilters.length > 0 ? 'Nothing matches that.' : 'Nothing available just now.'}
          </Typography>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <>
          <dl className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              {
                label: 'Wines',
                value: filtered.length.toLocaleString('en-US'),
                icon: IconBottle,
                tone: 'border-emerald-100 from-emerald-50/50 dark:border-emerald-900/50 dark:from-emerald-500/10',
                iconTone: 'bg-emerald-100/70 text-emerald-600 dark:bg-emerald-500/20',
              },
              {
                label: 'Bottles',
                value: totalBottles.toLocaleString('en-US'),
                icon: IconPackages,
                tone: 'border-amber-100 from-amber-50/50 dark:border-amber-900/50 dark:from-amber-500/10',
                iconTone: 'bg-amber-100/70 text-amber-600 dark:bg-amber-500/20',
              },
              {
                label: 'Producers',
                value: String(shownProducers.size),
                icon: IconBuildingCastle,
                tone: 'border-violet-100 from-violet-50/50 dark:border-violet-900/50 dark:from-violet-500/10',
                iconTone: 'bg-violet-100/70 text-violet-600 dark:bg-violet-500/20',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`flex items-center gap-3 rounded-xl border bg-gradient-to-b to-transparent px-3 py-2.5 shadow-sm sm:px-4 sm:py-3 ${stat.tone}`}
              >
                <span
                  className={`hidden size-9 flex-shrink-0 items-center justify-center rounded-lg sm:flex ${stat.iconTone}`}
                >
                  <stat.icon size={18} />
                </span>
                <div className="min-w-0">
                  <dd className="text-text-primary m-0 text-lg font-bold leading-tight tabular-nums sm:text-xl">
                    {stat.value}
                  </dd>
                  <dt className="text-text-muted text-[11px] font-medium">{stat.label}</dt>
                </div>
              </div>
            ))}
          </dl>

          <Typography variant="bodyXs" colorRole="muted" className="mb-2 block">
            Showing {shown.length.toLocaleString('en-US')} of {filtered.length.toLocaleString('en-US')}
          </Typography>

          {/* A phone gets cards: a seven-column table cannot be read at that width */}
          <ul className="space-y-2 sm:hidden">
            {shown.map((wine) => {
              const isChosen = Boolean(basket.get(wine.lwin18));
              return (
                <li
                  key={`${wine.lwin18}-${wine.vintage ?? ''}`}
                  className={`bg-surface-primary rounded-xl border p-3 shadow-sm ${
                    isChosen ? 'border-text-primary' : 'border-border-muted'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 size-2 flex-shrink-0 rounded-full ${categoryTone(wine.category)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-text-primary text-sm font-semibold leading-snug">
                        {displayName(wine.product)}
                      </p>
                      <p className="text-text-muted mt-0.5 truncate text-xs">{origin(wine)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className={pill}>{wine.vintage ?? 'NV'}</span>
                        <span className={pill}>
                          {bottleName(wine.bottleSize)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="border-border-muted mt-3 flex items-end justify-between gap-3 border-t pt-3">
                    <div>
                      <p className="text-text-primary text-base font-bold tabular-nums">
                        {money(wine.pricePerBottleUsd)}
                        <span className="text-text-muted text-xs font-normal"> / btl</span>
                      </p>
                      <p className="text-text-muted text-[11px]">{availability(wine)}</p>
                    </div>
                    {caseControl(wine)}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="border-border-muted hidden overflow-x-auto rounded-xl border shadow-sm sm:block sm:max-h-[68vh] sm:overflow-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface-secondary/90 border-border-muted sticky top-0 z-10 border-b backdrop-blur">
                <tr className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.08em]">
                  <th className="w-full min-w-[280px] px-4 py-2.5 text-left">Wine</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5 text-center">Vintage</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5 text-center">Bottle</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5 text-right">Available</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5 text-right">Price</th>
                  <th className="w-px whitespace-nowrap px-4 py-2.5 text-right">Add to cellar</th>
                </tr>
              </thead>
              <tbody className="divide-border-muted divide-y">
                {shown.map((wine) => {
                  const isChosen = Boolean(basket.get(wine.lwin18));
                  return (
                    <tr
                      key={`${wine.lwin18}-${wine.vintage ?? ''}`}
                      className={`group transition-colors ${
                        isChosen
                          ? 'bg-emerald-50/50 shadow-[inset_3px_0_0] shadow-emerald-500 dark:bg-emerald-500/10'
                          : 'hover:bg-fill-muted/40'
                      }`}
                    >
                      <td className="max-w-0 px-4 py-3">
                        {/*
                          Truncated rather than allowed to set the table's
                          width. Names run to seventy characters here.
                        */}
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`mt-1.5 size-2 flex-shrink-0 rounded-full ${categoryTone(wine.category)}`}
                            title={wine.category ?? undefined}
                          />
                          <div className="min-w-0">
                            <span
                              className="text-text-primary block truncate text-[13.5px] font-semibold"
                              title={wine.product}
                            >
                              {displayName(wine.product)}
                            </span>
                            <span className="text-text-muted block truncate text-xs">{origin(wine) || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={pill}>{wine.vintage ?? 'NV'}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={pill}>
                          {bottleName(wine.bottleSize)}
                        </span>
                      </td>
                      <td className="text-text-muted whitespace-nowrap px-3 py-3 text-right text-xs tabular-nums">
                        {availability(wine)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                        <span className="text-text-primary block text-[14px] font-bold">
                          {money(wine.pricePerBottleUsd)}
                          <span className="text-text-muted text-[11px] font-normal"> / btl</span>
                        </span>
                        {wine.caseConfig > 1 && (
                          <span className="text-text-muted block text-[11px]">
                            {money(wine.pricePerCaseUsd)} per case of {wine.caseConfig}
                          </span>
                        )}
                      </td>
                      {/*
                        Whole cases. A part case in bond would be a fraction of
                        a stock row, and nothing is opened until called forward.
                      */}
                      <td className="px-4 py-3 text-right">{caseControl(wine)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/*
            A page at a time, on request. A hard cut with no control reads as
            "that is all there is", which for a catalogue of four hundred is the
            one thing it must not say.
          */}
          {filtered.length > shown.length && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setLimit((current) => current + PAGE)}
                className="border-border-muted bg-surface-primary text-text-primary hover:bg-fill-muted h-10 rounded-lg border px-5 text-xs font-semibold shadow-sm transition-colors"
              >
                Show {Math.min(PAGE, filtered.length - shown.length)} more
              </button>
            </div>
          )}

          {/*
            A bar rather than a separate basket page. Choosing wine and
            committing to it are one motion here, and sending someone to another
            screen to find the total is how a half-built order gets abandoned.
          */}
          {basketLines.length > 0 && (
            <div className="bg-text-primary text-surface-primary sticky bottom-3 z-20 mt-4 flex flex-col gap-3 rounded-xl px-4 py-3 shadow-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {basketLines.length} {basketLines.length === 1 ? 'wine' : 'wines'} &middot; {basketBottles}{' '}
                  {basketBottles === 1 ? 'bottle' : 'bottles'}
                  <span className="ml-2 tabular-nums">{money(basketTotal)}</span>
                </p>
                <p className="text-xs opacity-70">
                  Held in bond, duty suspended. Reserved for 48 hours for your bank transfer; the wine moves once we
                  confirm it has arrived.
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBasket(new Map())}
                  className="h-9 px-2 text-xs font-semibold opacity-70 transition-opacity hover:opacity-100"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={isPlacing}
                  onClick={() =>
                    placeOrder({
                      lines: basketLines.map((line) => ({
                        lwin18: line.wine.lwin18,
                        cases: line.cases,
                      })),
                    })
                  }
                  className="bg-surface-primary text-text-primary h-10 flex-1 rounded-lg px-4 text-sm font-semibold disabled:opacity-50 sm:flex-none"
                >
                  {isPlacing ? 'Reserving…' : 'Reserve and pay'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AvailablePage;
