'use client';

import {
  IconBottle,
  IconBuildingWarehouse,
  IconFilter,
  IconGlassFull,
  IconMinus,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import CellarPageHeader from '@/app/_cellar/components/CellarPageHeader';
import CellarState from '@/app/_cellar/components/CellarState';
import CellarStatTile from '@/app/_cellar/components/CellarStatTile';
import RecentlyAddedTag from '@/app/_cellar/components/RecentlyAddedTag';
import ViewOnlyNotice from '@/app/_cellar/components/ViewOnlyNotice';
import useIsCellarViewer from '@/app/_cellar/hooks/useIsCellarViewer';
import bottleName from '@/app/_cellar/utils/bottleName';
import isRecentlyAdded from '@/app/_cellar/utils/isRecentlyAdded';
import regionTone from '@/app/_cellar/utils/regionTone';
import FindWineDialog from '@/app/_cellarSourcing/components/FindWineDialog';
import MemberSourcingPanel from '@/app/_cellarSourcing/components/MemberSourcingPanel';
import useActivationGate from '@/app/_onboarding/hooks/useActivationGate';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
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
  const isViewer = useIsCellarViewer();
  // Finding a wine is a Private Cellar service; a trade partner is not offered it
  const { data: profile } = useQuery(api.cellar.member.getProfile.queryOptions());
  const isPrivateCollector = profile?.isPrivateCollector ?? false;
  const router = useRouter();
  const { catchActivation, activationSheet } = useActivationGate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>('Wine');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [producer, setProducer] = useState('');
  const [vintage, setVintage] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [onlyRecent, setOnlyRecent] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  /*
    Cases, keyed by wine. Whole cases only — the book transfer moves a stock
    row's cases and a part case would have to be a fraction of one.
  */
  const [basket, setBasket] = useState<Map<string, number>>(new Map());
  /* Reserving commits the member to a bank transfer, so it is reviewed first */
  const [isReviewing, setIsReviewing] = useState(false);

  const { data, isLoading, isError } = useQuery({
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
        (!onlyRecent || isRecentlyAdded(wine.addedAt)) &&
        (!region || (wine.region ?? wine.country)?.trim() === region) &&
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
  }, [wines, region, country, producer, vintage, sort, onlyRecent]);

  /* The regions most of the list comes from, as coloured pills to scan by */
  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const wine of wines) {
      const name = (wine.region ?? wine.country)?.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name]) => name);
  }, [wines]);

  const recentCount = useMemo(() => wines.filter((wine) => isRecentlyAdded(wine.addedAt)).length, [wines]);

  const shown = filtered.slice(0, limit);

  const moreRef = useRef<HTMLDivElement>(null);
  const hasMore = filtered.length > limit;

  useEffect(() => {
    const marker = moreRef.current;
    if (!marker || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLimit((current) => current + PAGE);
        }
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(marker);

    return () => observer.disconnect();
  }, [hasMore, limit]);
  const totalBottles = filtered.reduce(
    (sum, wine) => sum + wine.availableBottles,
    0,
  );
  const shownProducers = new Set(
    filtered.map((wine) => wine.producer).filter(Boolean),
  );

  const activeFilters = [
    region && { label: region, clear: () => setRegion('') },
    country && { label: country, clear: () => setCountry('') },
    producer && { label: producer, clear: () => setProducer('') },
    vintage && { label: vintage, clear: () => setVintage('') },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const { mutate: placeOrder, isPending: isPlacing } = useMutation(
    api.consignment.member.createPurchase.mutationOptions({
      onSuccess: (result) => {
        toast.success(`${result.purchaseNumber} is reserved for you. Here is how to pay.`);
        setBasket(new Map());
        setIsReviewing(false);
        // Straight to where the bank details and reference are
        router.push('/platform/cellar/purchases');
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

  /* The cellar's own palette: C&C greens and near-black, never a rainbow */
  const categoryTone = (category: string | null | undefined) =>
    category === 'Spirits'
      ? 'bg-neutral-700 dark:bg-neutral-300'
      : category === 'RTD'
        ? 'bg-emerald-300'
        : category === 'Wine'
          ? 'bg-emerald-600'
          : 'bg-neutral-400';

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
    if (isViewer) return null;

    const chosen = basket.get(wine.lwin18) ?? 0;

    /*
      Loose bottles with no whole case behind them cannot be bought in bond. A
      disabled stepper would invite a click to find out why.
    */
    if (wine.availableCases <= 0) {
      return (
        <a
          href="mailto:enquiries@craftculture.xyz"
          className="border-border-muted text-text-primary hover:bg-surface-secondary inline-flex h-10 items-center rounded-lg border px-3 text-xs font-semibold sm:h-9"
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
          className="border-border-muted text-text-primary hover:bg-text-primary hover:text-surface-primary inline-flex h-10 items-center gap-1 rounded-lg border px-3.5 text-xs font-semibold transition-colors sm:h-9"
          aria-label={`Add ${wine.caseConfig > 1 ? 'a case' : 'a bottle'} of ${wine.product}`}
        >
          <Icon icon={IconPlus} size="xs" /> Add
        </button>
      );
    }

    return (
      <span className="bg-text-primary text-surface-primary inline-flex h-10 items-center rounded-lg sm:h-9">
        <button
          type="button"
          aria-label={`One fewer ${wine.caseConfig > 1 ? 'case' : 'bottle'} of ${wine.product}`}
          onClick={() => addCases(wine.lwin18, -1, wine.availableCases)}
          className="flex h-full w-10 items-center justify-center rounded-l-lg hover:bg-white/10 sm:w-9"
        >
          <Icon icon={IconMinus} size="xs" />
        </button>
        <span className="min-w-[64px] whitespace-nowrap px-1 text-center text-xs font-semibold tabular-nums">
          {unitCount(wine, chosen)}
        </span>
        <button
          type="button"
          aria-label={`One more ${wine.caseConfig > 1 ? 'case' : 'bottle'} of ${wine.product}`}
          disabled={chosen >= wine.availableCases}
          onClick={() => addCases(wine.lwin18, 1, wine.availableCases)}
          className="flex h-full w-10 items-center justify-center rounded-r-lg hover:bg-white/10 disabled:opacity-30 sm:w-9"
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

      {/*
        One action, not a link on every row. It used to be a mailto, which
        left the request in somebody's inbox; now it is a request the team
        works and the member can follow.
      */}
      <CellarPageHeader
        title="C&C Cellar List"
        description="Wines held in our bonded warehouse, available to add to your cellar. Prices are in bond; duty and VAT apply only to wine delivered to you in the UAE."
        actions={!isViewer && isPrivateCollector ? <FindWineDialog /> : undefined}
      />

      {isViewer && <ViewOnlyNotice />}

      {/* A guest sees the requests and offers; every control in them is off */}
      <fieldset disabled={isViewer} className="m-0 min-w-0 border-0 p-0">
        <MemberSourcingPanel
          onActivationError={(error) => catchActivation(error, 'purchase')}
        />
      </fieldset>

      {/*
        Search, kind and the narrowing filters live in one panel, so the page
        reads as controls, then figures, then wine — three bands rather than
        one run of grey.
      */}
      <div className="border-border-muted bg-surface-primary mb-4 rounded-xl border p-3 shadow-sm sm:p-4">
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
              { id: 'Wine', label: 'Wine', tone: categoryTone('Wine') },
              { id: 'Spirits', label: 'Spirits', tone: categoryTone('Spirits') },
              { id: 'RTD', label: 'Ready to drink', tone: categoryTone('RTD') },
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
                setRegion('');
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

      {isLoading && <CellarState kind="loading" rows={5} />}

      {isError && <CellarState kind="error" />}

      {!isLoading && !isError && filtered.length === 0 && (
        search || activeFilters.length > 0 ? (
          <CellarState
            kind="empty"
            title="No wines match these filters."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setRegion('');
                  setCountry('');
                  setProducer('');
                  setVintage('');
                  setLimit(PAGE);
                }}
                className="h-10 px-2 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <CellarState
            kind="empty"
            message="The C&C Cellar List is being updated. Please check back shortly."
          />
        )
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <>
          {regions.length > 1 && (
            <div className="-mx-3 mb-4 flex items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              <span className="text-text-muted shrink-0 text-xs font-semibold">Regions</span>
              {regions.map((name) => {
                const active = region === name;
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setRegion(active ? '' : name)}
                    className={`flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                        : 'border-border-muted text-text-secondary hover:text-text-primary hover:border-border-primary bg-transparent'
                    }`}
                  >
                    <span className={`size-2 rounded-full ${regionTone(name)}`} aria-hidden />
                    {name}
                  </button>
                );
              })}
            </div>
          )}

          <div
            className={`mb-4 grid gap-2 sm:gap-3 ${recentCount > 0 || onlyRecent ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}
          >
            {/* What has arrived this week leads, and filters the list to it; nothing to show, no tile */}
            {(recentCount > 0 || onlyRecent) && (
            <CellarStatTile
              label={onlyRecent ? 'Showing recently added' : 'Added this week'}
              icon={IconSparkles}
              tone="emerald"
              value={String(recentCount)}
              onClick={() => setOnlyRecent((on) => !on)}
              isActive={onlyRecent}
            />
            )}
            <CellarStatTile
              label="Wines"
              icon={IconGlassFull}
              tone="plain"
              value={filtered.length.toLocaleString('en-US')}
            />
            <CellarStatTile
              label="Bottles"
              icon={IconBottle}
              tone="plain"
              value={totalBottles.toLocaleString('en-US')}
            />
            <CellarStatTile
              label="Producers"
              icon={IconBuildingWarehouse}
              tone="plain"
              value={String(shownProducers.size)}
            />
          </div>


          {/* A phone gets cards: a seven-column table cannot be read at that width */}
          <ul className="space-y-2 sm:hidden">
            {shown.map((wine) => {
              const isChosen = Boolean(basket.get(wine.lwin18));
              return (
                <li
                  key={`${wine.lwin18}-${wine.vintage ?? ''}`}
                  className={`rounded-xl border p-3 shadow-sm ${
                    isChosen
                      ? 'bg-surface-primary border-text-primary'
                      : isRecentlyAdded(wine.addedAt)
                        ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-500/[0.07]'
                        : 'bg-surface-primary border-border-muted'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 size-2 flex-shrink-0 rounded-full ${categoryTone(wine.category)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-text-primary text-lg font-semibold leading-snug">
                        {displayName(wine.product)}
                      </p>
                      <p className="text-text-muted mt-0.5 truncate text-xs">{origin(wine)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {isRecentlyAdded(wine.addedAt) && <RecentlyAddedTag />}
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
                        <span className="text-text-muted text-xs font-normal"> per bottle</span>
                      </p>
                      <p className="text-text-muted text-[11px]">{availability(wine)}</p>
                    </div>
                    {caseControl(wine)}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="border-border-muted bg-surface-primary hidden overflow-x-auto rounded-xl border shadow-sm sm:block sm:max-h-[68vh] sm:overflow-auto">
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
                          : isRecentlyAdded(wine.addedAt)
                            ? 'bg-emerald-50/40 hover:bg-emerald-50/70 dark:bg-emerald-500/[0.06]'
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
                              className="text-text-primary block truncate text-base font-semibold"
                              title={wine.product}
                            >
                              {displayName(wine.product)}
                            </span>
                            <span className="text-text-muted flex items-center gap-2 truncate text-xs">
                              {isRecentlyAdded(wine.addedAt) && <RecentlyAddedTag />}
                              <span className="truncate">{origin(wine)}</span>
                            </span>
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
                          <span className="text-text-muted text-[11px] font-normal"> per bottle</span>
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
            The next wines load as the collector nears the end of the list, so
            browsing never stops at a button, while the first paint stays at
            fifty rows. The marker stays in the page while more remain, so the
            list never reads as finished when it is not.
          */}
          {filtered.length > shown.length && (
            <div ref={moreRef} className="text-text-muted mt-4 py-4 text-center text-xs">
              Loading more wines&hellip;
            </div>
          )}

          {/*
            A bar rather than a separate basket page. Choosing wine and
            committing to it are one motion here, and sending someone to another
            screen to find the total is how a half-built order gets abandoned.
            A white card, so its one near-black button is the emphasis.
          */}
          {basketLines.length > 0 && (
            <div className="border-border-muted bg-surface-primary sticky bottom-[calc(env(safe-area-inset-bottom,0px)+60px)] z-20 mt-4 md:bottom-3 flex flex-col gap-3 rounded-xl border px-4 py-3 shadow-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-text-primary text-sm font-semibold">
                  {basketLines.length} {basketLines.length === 1 ? 'wine' : 'wines'} &middot; {basketBottles}{' '}
                  {basketBottles === 1 ? 'bottle' : 'bottles'}
                  <span className="ml-2 tabular-nums">{money(basketTotal)}</span>
                </p>
                <p className="text-text-muted text-xs">
                  Duty-free. Reserved for you for 48 hours while you pay by bank transfer, and added to your cellar
                  once your payment arrives.
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBasket(new Map())}
                  className="h-9 px-2 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={isPlacing}
                  onClick={() => setIsReviewing(true)}
                  className="bg-text-primary text-surface-primary h-10 flex-1 rounded-lg px-4 text-sm font-semibold disabled:opacity-50 sm:flex-none"
                >
                  Review and reserve
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={isReviewing} onOpenChange={(open) => !isPlacing && setIsReviewing(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm your reservation</DialogTitle>
            <DialogDescription>
              Please check your selection. Nothing is reserved until you confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="w-full overflow-y-auto px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          <ul className="divide-border-muted border-border-muted max-h-[40vh] divide-y overflow-y-auto rounded-xl border">
            {basketLines.map((line) => (
              <li key={line.wine.lwin18} className="flex items-start justify-between gap-4 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-text-primary text-sm font-semibold leading-snug">
                    {displayName(line.wine.product)}
                  </p>
                  <p className="text-text-muted text-xs">
                    {[line.wine.vintage ?? 'NV', bottleName(line.wine.bottleSize), unitCount(line.wine, line.cases)].join(' · ')}
                  </p>
                </div>
                <p className="text-text-primary flex-shrink-0 text-sm font-semibold tabular-nums">
                  {money(line.cases * line.wine.caseConfig * line.wine.pricePerBottleUsd)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-baseline justify-between px-1">
            <span className="text-text-muted text-sm">
              Total · {basketBottles} {basketBottles === 1 ? 'bottle' : 'bottles'}
            </span>
            <span className="text-text-primary text-xl font-bold tabular-nums">{money(basketTotal)}</span>
          </div>

          <div className="bg-surface-secondary/60 text-text-muted mt-3 space-y-1.5 rounded-xl p-3.5 text-xs leading-5">
            <p>
              Prices are duty-free. Your wine stays in your cellar at our warehouse until you ask us to deliver it.
              Duty and VAT are only paid then.
            </p>
            <p>
              We hold it for you for 48 hours. Pay by bank transfer using the details on your Purchases page, quoting
              your reservation number. It is added to your cellar once your payment arrives.</p>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsReviewing(false)}
              disabled={isPlacing}
              className="border-border-muted text-text-primary h-11 rounded-lg border px-4 text-sm font-semibold"
            >
              Back
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
              className="bg-text-primary text-surface-primary h-11 rounded-lg px-5 text-sm font-semibold disabled:opacity-50"
            >
              {isPlacing ? 'Reserving…' : `Confirm reservation · ${money(basketTotal)}`}
            </button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvailablePage;
