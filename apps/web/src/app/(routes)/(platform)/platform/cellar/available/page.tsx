'use client';

import { IconFilter, IconSearch, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
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
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>();
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
      onError: (error) => toast.error(error.message),
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
    'border-border-muted text-text-primary bg-background-primary h-9 rounded-lg border px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/40';

  return (
    <div className="w-full pb-8">
      <div className="mb-4">
        <Typography variant="headingMd" className="block">
          Available now
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 block">
          Held in bond with us and ready to add to your cellar. Prices are in
          bond, duty suspended &mdash; wine bought here stays where it is.
        </Typography>
      </div>

      <div className="mb-4 lg:flex lg:items-center lg:gap-4">
        <div className="relative lg:w-80 lg:flex-shrink-0">
          <Icon
            icon={IconSearch}
            size="sm"
            className="text-text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search wine, producer or vintage"
            className="pl-9"
          />
        </div>

        <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0 lg:mt-0">
          {[
            { id: undefined, label: 'Everything' },
            { id: 'Wine', label: 'Wine' },
            { id: 'Spirits', label: 'Spirits' },
            { id: 'RTD', label: 'RTD' },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                setCategory(chip.id);
                setLimit(PAGE);
              }}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                category === chip.id
                  ? 'bg-fill-brand text-text-on-brand'
                  : 'border-border-muted text-text-muted hover:text-text-primary border'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/*
          Country, producer and vintage are how anyone actually narrows a wine
          list. Hidden behind a toggle on small screens, because three selects
          above the fold on a phone pushes the wine itself off it.
        */}
        <button
          type="button"
          onClick={() => setShowFilters((open) => !open)}
          className="border-border-muted text-text-muted hover:text-text-primary mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors lg:hidden"
        >
          <Icon icon={IconFilter} size="xs" />
          {showFilters ? 'Hide filters' : 'Filters'}
          {activeFilters.length > 0 && (
            <span className="bg-fill-brand text-text-on-brand rounded-full px-1.5 text-[10px]">
              {activeFilters.length}
            </span>
          )}
        </button>

        <div
          className={`${showFilters ? 'flex' : 'hidden'} mt-2 flex-wrap gap-2 lg:mt-0 lg:flex lg:flex-nowrap`}
        >
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
            className={`${selectClass} max-w-[180px]`}
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
            className={`${selectClass} lg:ml-auto`}
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
        What is currently being excluded, and a one-click way out of each. A
        filter that cannot be seen is a filter somebody forgets they set, and
        then the catalogue looks empty for no reason.
      */}
      {activeFilters.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {activeFilters.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={filter.clear}
              className="border-border-muted text-text-muted hover:text-text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors"
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
            className="text-text-brand px-1 text-xs font-medium"
          >
            Clear all
          </button>
        </div>
      )}

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted" className="block py-6">
          Loading&hellip;
        </Typography>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="border-border-muted rounded-xl border px-6 py-14 text-center">
          <Typography variant="bodyMd" colorRole="muted" className="block">
            {search || activeFilters.length > 0
              ? 'Nothing matches that.'
              : 'Nothing available just now.'}
          </Typography>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <>
          {/*
            One line, not a link on every row. The per-row "Enquire" was a
            mailto, which navigates the page away from the list somebody was
            halfway through reading — and buying out of the catalogue is not
            built, so a control on each line promised something no click could
            deliver.
          */}
          <dl className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Wines', value: filtered.length.toLocaleString('en-US') },
              { label: 'Bottles', value: totalBottles.toLocaleString('en-US') },
              { label: 'Producers', value: String(shownProducers.size) },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border-border-muted rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3"
              >
                <dt className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.08em]">
                  {stat.label}
                </dt>
                <dd className="text-text-primary m-0 mt-1 text-lg font-semibold tabular-nums sm:text-xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <Typography variant="bodyXs" colorRole="muted">
              Showing {shown.length.toLocaleString('en-US')} of{' '}
              {filtered.length.toLocaleString('en-US')}
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Something not here? Ask your account team at{' '}
              <a
                className="text-text-brand font-medium"
                href="mailto:enquiries@craftculture.xyz"
              >
                enquiries@craftculture.xyz
              </a>
            </Typography>
          </div>

          <div className="border-border-muted overflow-x-auto rounded-xl border sm:max-h-[68vh] sm:overflow-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="bg-fill-muted/60 border-border-muted sticky top-0 z-10 border-b backdrop-blur">
                <tr className="text-text-muted text-[10px] uppercase tracking-[0.08em]">
                  <th className="w-[38%] min-w-[220px] px-3 py-2 text-left">
                    Wine
                  </th>
                  <th className="hidden px-3 py-2 text-left md:table-cell">
                    Producer
                  </th>
                  <th className="hidden px-3 py-2 text-center sm:table-cell">
                    Vintage
                  </th>
                  <th className="px-3 py-2 text-center">Format</th>
                  <th className="px-3 py-2 text-right">Available</th>
                  <th className="hidden px-3 py-2 text-right lg:table-cell">
                    $ / case
                  </th>
                  <th className="px-3 py-2 text-right">$ / btl</th>
                  <th className="w-[132px] px-3 py-2 text-right">Cases</th>
                </tr>
              </thead>
              <tbody className="divide-border-muted divide-y">
                {shown.map((wine) => (
                  <tr
                    key={`${wine.lwin18}-${wine.vintage ?? ''}`}
                    className="hover:bg-fill-muted/40 group transition-colors"
                  >
                    <td className="text-text-primary max-w-0 px-3 py-2 text-[13px] font-medium">
                      {/*
                        Truncated rather than allowed to set the table's width.
                        Names run to seventy characters here, and one long one
                        pushed the price columns off the right of the page.
                      */}
                      <span className="block truncate" title={wine.product}>
                        {displayName(wine.product)}
                      </span>
                      <span className="text-text-muted block truncate text-xs md:hidden">
                        {wine.producer}
                      </span>
                    </td>
                    <td className="text-text-muted hidden max-w-0 px-3 py-2 text-[13px] md:table-cell">
                      <span className="block truncate" title={wine.producer ?? ''}>
                        {wine.producer ?? '—'}
                      </span>
                    </td>
                    <td className="text-text-muted hidden px-3 py-2 text-center text-[13px] tabular-nums sm:table-cell">
                      {wine.vintage ?? 'NV'}
                    </td>
                    <td className="text-text-primary px-3 py-2 text-center text-[13px]">
                      {wine.caseConfig > 1 ? `${wine.caseConfig}×` : ''}
                      {wine.bottleSize ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] tabular-nums">
                      <span className="text-text-primary">
                        {wine.availableBottles}
                      </span>
                      <span className="text-text-muted block text-[11px]">
                        {wine.caseConfig > 1
                          ? `${wine.availableCases} ${wine.availableCases === 1 ? 'case' : 'cases'}`
                          : 'bottles'}
                      </span>
                    </td>
                    <td className="text-text-muted hidden px-3 py-2 text-right text-[13px] tabular-nums lg:table-cell">
                      {wine.caseConfig > 1 ? money(wine.pricePerCaseUsd) : '—'}
                    </td>
                    <td className="text-text-primary px-3 py-2 text-right text-[13px] font-semibold tabular-nums">
                      {money(wine.pricePerBottleUsd)}
                    </td>
                    {/*
                      Whole cases. A part case in bond would be a fraction of a
                      stock row, and nothing is physically opened anyway until
                      the wine is called forward.
                    */}
                    <td className="px-3 py-2 text-right">
                      {wine.availableCases > 0 ? (
                        <span className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            aria-label={`One fewer case of ${wine.product}`}
                            disabled={!basket.get(wine.lwin18)}
                            onClick={() =>
                              addCases(wine.lwin18, -1, wine.availableCases)
                            }
                            className="text-text-muted hover:bg-fill-muted hover:text-text-primary h-6 w-6 rounded transition-colors disabled:opacity-25"
                          >
                            &minus;
                          </button>
                          <span
                            className={`min-w-[28px] text-center text-xs font-semibold tabular-nums ${
                              basket.get(wine.lwin18)
                                ? 'text-text-brand'
                                : 'text-text-muted'
                            }`}
                          >
                            {basket.get(wine.lwin18) ?? 0}
                          </span>
                          <button
                            type="button"
                            aria-label={`One more case of ${wine.product}`}
                            disabled={
                              (basket.get(wine.lwin18) ?? 0) >= wine.availableCases
                            }
                            onClick={() =>
                              addCases(wine.lwin18, 1, wine.availableCases)
                            }
                            className="text-text-muted hover:bg-fill-muted hover:text-text-primary h-6 w-6 rounded transition-colors disabled:opacity-25"
                          >
                            +
                          </button>
                        </span>
                      ) : (
                        /*
                          Loose bottles with no whole case behind them cannot be
                          bought in bond. A disabled stepper would invite a click
                          to find out why.
                        */
                        <Typography variant="bodyXs" colorRole="muted">
                          Ask us
                        </Typography>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            A page at a time, on request. A hard cut with no control reads as
            "that is all there is", which for a catalogue of four hundred is
            the one thing it must not say.
          */}
          {/*
            A bar rather than a separate basket page. Choosing wine and
            committing to it are one motion here, and sending someone to another
            screen to find the total is how a half-built order gets abandoned.
          */}
          {basketLines.length > 0 && (
            <div className="border-border-muted bg-background-primary sticky bottom-0 z-20 -mx-3 mt-3 flex flex-col gap-2 border-t px-3 py-3 sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:border sm:px-4">
              <div className="min-w-0">
                <Typography variant="bodySm" className="block font-semibold">
                  {basketLines.length}{' '}
                  {basketLines.length === 1 ? 'wine' : 'wines'} &middot;{' '}
                  {basketBottles} {basketBottles === 1 ? 'bottle' : 'bottles'}
                  <span className="text-text-brand ml-2 tabular-nums">
                    {money(basketTotal)}
                  </span>
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="block">
                  Held in bond, duty suspended. Reserved 48 hours for your bank
                  transfer &mdash; the wine moves once we confirm it has landed.
                </Typography>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBasket(new Map())}
                  className="text-text-muted hover:text-text-primary px-2 py-1 text-xs font-medium transition-colors"
                >
                  Clear
                </button>
                <Button
                  colorRole="brand"
                  size="sm"
                  isDisabled={isPlacing}
                  onClick={() =>
                    placeOrder({
                      lines: basketLines.map((line) => ({
                        lwin18: line.wine.lwin18,
                        cases: line.cases,
                      })),
                    })
                  }
                >
                  <ButtonContent>
                    {isPlacing ? 'Reserving…' : 'Reserve and pay'}
                  </ButtonContent>
                </Button>
              </div>
            </div>
          )}

          {filtered.length > shown.length && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setLimit((current) => current + PAGE)}
                className="border-border-muted text-text-primary hover:bg-fill-muted rounded-lg border px-4 py-2 text-xs font-medium transition-colors"
              >
                Show {Math.min(PAGE, filtered.length - shown.length)} more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AvailablePage;
