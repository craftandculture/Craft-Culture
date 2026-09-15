'use client';

import { IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

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

/**
 * What a member can add to their cellar
 *
 * The same catalogue the trade and private-client lists render, shown to a
 * member inside the platform. Wine another member has consigned appears here
 * without being marked as such, because a buyer is buying from C&C — which is
 * legally what is happening — and whose wine it was is nobody else's business.
 */
const AvailablePage = () => {
  const api = useTRPC();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    ...api.consignment.member.browseCatalogue.queryOptions({
      search: search || undefined,
      category,
    }),
  });

  const wines = data?.wines ?? [];

  /*
    What is actually here, before a member starts reading rows. The page opened
    on a bare search box and a flat table, which gave no sense of whether the
    list was worth scrolling.
  */
  const totalBottles = wines.reduce((sum, wine) => sum + wine.availableBottles, 0);
  const producers = new Set(wines.map((wine) => wine.producer).filter(Boolean));

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
              onClick={() => setCategory(chip.id)}
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
      </div>

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted" className="block py-6">
          Loading&hellip;
        </Typography>
      )}

      {!isLoading && wines.length === 0 && (
        <div className="border-border-muted rounded-xl border px-6 py-14 text-center">
          <Typography variant="bodyMd" colorRole="muted" className="block">
            {search ? 'Nothing matches that.' : 'Nothing available just now.'}
          </Typography>
        </div>
      )}

      {!isLoading && wines.length > 0 && (
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
              { label: 'Wines', value: String(wines.length) },
              { label: 'Bottles', value: totalBottles.toLocaleString('en-US') },
              { label: 'Producers', value: String(producers.size) },
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

          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <Typography variant="bodyXs" colorRole="muted">
              Held in bond &middot; duty suspended
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              To buy anything here, speak to your account team at{' '}
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
                  <th className="min-w-[240px] px-3 py-2 text-left">Wine</th>
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
                </tr>
              </thead>
              <tbody className="divide-border-muted divide-y">
                {wines.map((wine) => (
                  <tr
                    key={`${wine.lwin18}-${wine.vintage ?? ''}`}
                    className="hover:bg-fill-muted/40 group transition-colors"
                  >
                    <td className="text-text-primary px-3 py-2 text-[13px] font-medium">
                      {displayName(wine.product)}
                      <span className="text-text-muted block text-xs md:hidden">
                        {wine.producer}
                      </span>
                    </td>
                    <td className="text-text-muted hidden px-3 py-2 text-[13px] md:table-cell">
                      {wine.producer ?? '—'}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default AvailablePage;
