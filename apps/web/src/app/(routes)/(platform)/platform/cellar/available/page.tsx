'use client';

import { IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/*
  The catalogue name repeats the vintage and format that both have their own
  columns here, exactly as it does in the cellar.
*/
const displayName = (name: string) =>
  name
    .replace(/\s+\d+(\.\d+)?%\s*abv\s*$/i, '')
    .replace(/\s+\d+(\.\d+)?L\s*$/i, '')
    .replace(/\s+(19|20)\d{2}\s*$/, '')
    .trim();

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

  const { data, isLoading } = useQuery({
    ...api.consignment.member.browseCatalogue.queryOptions({
      search: search || undefined,
    }),
  });

  const wines = data?.wines ?? [];

  return (
    <div className="w-full pb-8">
      <div className="mb-4">
        <Typography variant="headingMd" className="block">
          Available now
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" className="mt-0.5 block">
          Held in bond with us and ready to add to your cellar. Prices are per
          bottle, duty suspended.
        </Typography>
      </div>

      <div className="relative mb-4 lg:max-w-sm">
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

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted">
          Loading...
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
          <Typography variant="bodyXs" colorRole="muted" className="mb-2 block">
            {wines.length} {wines.length === 1 ? 'wine' : 'wines'}
          </Typography>

          <div className="border-border-muted overflow-x-auto rounded-xl border sm:max-h-[68vh] sm:overflow-auto">
            <table className="w-full min-w-[720px] text-sm">
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
                  <th className="px-3 py-2 text-right">$ / btl</th>
                  <th className="px-3 py-2 text-right" />
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
                    <td className="text-text-muted px-3 py-2 text-right text-[13px] tabular-nums">
                      {wine.availableBottles}
                    </td>
                    <td className="text-text-primary px-3 py-2 text-right text-[13px] font-semibold tabular-nums">
                      {money(wine.pricePerBottleUsd)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {/*
                        An enquiry, not a basket. Buying out of the pool is not
                        built — a sale has to move beneficial ownership and
                        settle the member it came from, and neither of those
                        exists yet. A button that took an order we could not
                        fulfil would be worse than a line that says who to ask.
                      */}
                      <a
                        href={`mailto:enquiries@craftculture.xyz?subject=${encodeURIComponent(`Enquiry — ${wine.product}`)}`}
                        className="text-text-brand text-xs font-semibold opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                      >
                        Enquire
                      </a>
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
