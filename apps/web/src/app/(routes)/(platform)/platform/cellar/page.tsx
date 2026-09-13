'use client';

import {
  IconChevronDown,
  IconDownload,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Fragment, useMemo, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface CellarProduct {
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  bottleSize: string | null;
  caseConfig: number | null;
  totalCases: number;
  availableCases: number;
  reservedCases: number;
  locations: { locationCode: string; receivedAt: Date | null }[];
}

/** Bottles, not cases. A collector counts what they can open. */
const bottlesOf = (product: {
  totalCases: number;
  caseConfig: number | null;
}) => product.totalCases * (product.caseConfig ?? 1);

/** "0.75L" and "750ml" both mean a bottle; say so the way a label does. */
const formatSize = (size: string | null) => {
  if (!size) return '';
  const ml = Number(size.replace(/[^\d.]/g, ''));
  if (!ml) return size;
  const millilitres = size.toLowerCase().includes('cl') ? ml * 10 : ml;
  if (millilitres === 750) return '';
  if (millilitres >= 1000) return `${millilitres / 1000}L`;
  return `${millilitres}ml`;
};

/**
 * A collector's cellar
 *
 * Deliberately not the warehouse screen. That view answers operational
 * questions — which bay, which pack, what LWIN, how many cases are reserved —
 * and a collector asks none of them. They want to know what they own, how many
 * bottles there are, and that it is safe.
 */
const CellarPage = () => {
  const api = useTRPC();
  const [search, setSearch] = useState('');
  const [openWine, setOpenWine] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...api.wms.partner.getStock.queryOptions(),
  });

  const products = useMemo(
    () => (data?.products ?? []) as unknown as CellarProduct[],
    [data],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return products;

    return products.filter((product) =>
      [product.productName, product.producer, String(product.vintage ?? '')]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [products, search]);

  /* Grouped by producer, which is how a cellar is actually held in mind. */
  const byProducer = useMemo(() => {
    const groups = new Map<string, CellarProduct[]>();

    for (const product of filtered) {
      const key = product.producer?.trim() || 'Other';
      groups.set(key, [...(groups.get(key) ?? []), product]);
    }

    return [...groups.entries()]
      .map(([producer, wines]) => ({
        producer,
        wines: [...wines].sort(
          (a, b) =>
            (b.vintage ?? 0) - (a.vintage ?? 0) ||
            a.productName.localeCompare(b.productName),
        ),
        bottles: wines.reduce((sum, wine) => sum + bottlesOf(wine), 0),
      }))
      .sort((a, b) => b.bottles - a.bottles || a.producer.localeCompare(b.producer));
  }, [filtered]);

  const totals = useMemo(
    () => ({
      bottles: products.reduce((sum, product) => sum + bottlesOf(product), 0),
      wines: products.length,
      producers: new Set(
        products.map((product) => product.producer?.trim() || 'Other'),
      ).size,
      reserved: products.reduce((sum, product) => sum + product.reservedCases, 0),
    }),
    [products],
  );

  const handleExport = () => {
    const rows = [
      ['Producer', 'Wine', 'Vintage', 'Size', 'Bottles'],
      ...products.map((product) => [
        product.producer ?? '',
        product.productName,
        product.vintage ?? '',
        product.bottleSize ?? '',
        bottlesOf(product),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','),
      )
      .join('\n');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `cellar-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Typography
            variant="bodyXs"
            className="text-text-brand mb-2 font-semibold uppercase tracking-[0.2em]"
          >
            {data?.partner?.name ?? 'Private Cellar'}
          </Typography>
          <Typography variant="headingLg">Your cellar</Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1">
            Held in bond at Craft &amp; Culture, Ras Al Khaimah &middot; duty
            suspended until release
          </Typography>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isDisabled={isRefetching}
          >
            <ButtonContent iconLeft={IconRefresh}>Refresh</ButtonContent>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            isDisabled={!products.length}
          >
            <ButtonContent iconLeft={IconDownload}>Export</ButtonContent>
          </Button>
        </div>
      </header>

      {/* What a collector actually counts */}
      <div className="border-border-muted mb-8 grid grid-cols-3 gap-px overflow-hidden rounded-xl border">
        {[
          { value: totals.bottles.toLocaleString(), label: 'Bottles' },
          { value: totals.wines.toLocaleString(), label: 'Wines' },
          { value: totals.producers.toLocaleString(), label: 'Producers' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-background-primary px-4 py-5 text-center"
          >
            <div className="text-2xl font-semibold leading-none sm:text-3xl">
              {stat.value}
            </div>
            <Typography variant="bodyXs" colorRole="muted" className="mt-2 block">
              {stat.label}
            </Typography>
          </div>
        ))}
      </div>

      <div className="relative mb-6">
        <Icon
          icon={IconSearch}
          size="sm"
          className="text-text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by wine, producer or vintage"
          className="pl-9"
        />
      </div>

      {isLoading && (
        <Typography variant="bodySm" colorRole="muted">
          Loading your cellar...
        </Typography>
      )}

      {!isLoading && !byProducer.length && (
        <div className="border-border-muted rounded-xl border px-6 py-12 text-center">
          <Typography variant="bodyMd" colorRole="muted">
            {search
              ? 'No wines match that search.'
              : 'Nothing is held in your cellar yet.'}
          </Typography>
        </div>
      )}

      <div className="flex flex-col gap-8">
        {byProducer.map((group) => (
          <section key={group.producer}>
            <div className="border-border-muted mb-2 flex items-baseline justify-between border-b pb-2">
              <Typography variant="labelMd" className="font-semibold">
                {group.producer}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                {group.bottles} {group.bottles === 1 ? 'bottle' : 'bottles'}
              </Typography>
            </div>

            <div className="flex flex-col">
              {group.wines.map((wine) => {
                const isOpen = openWine === wine.lwin18;
                const bottles = bottlesOf(wine);
                const size = formatSize(wine.bottleSize);
                const received = wine.locations?.[0]?.receivedAt;

                return (
                  <Fragment key={wine.lwin18}>
                    <button
                      type="button"
                      onClick={() => setOpenWine(isOpen ? null : wine.lwin18)}
                      className="border-border-muted/60 hover:bg-fill-muted/40 flex items-center gap-3 border-b px-1 py-3 text-left transition-colors"
                    >
                      <Icon
                        icon={IconChevronDown}
                        size="sm"
                        className={`text-text-muted flex-shrink-0 transition-transform ${
                          isOpen ? '' : '-rotate-90'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <Typography variant="bodySm" className="font-medium">
                          {wine.productName}
                        </Typography>
                      </span>
                      {size && (
                        <Typography
                          variant="bodyXs"
                          colorRole="muted"
                          className="flex-shrink-0"
                        >
                          {size}
                        </Typography>
                      )}
                      <span className="w-16 flex-shrink-0 text-right tabular-nums">
                        <Typography variant="bodySm" className="font-semibold">
                          {bottles}
                        </Typography>
                      </span>
                    </button>

                    {isOpen && (
                      <div className="bg-fill-muted/30 border-border-muted/60 grid gap-4 border-b px-8 py-4 sm:grid-cols-3">
                        <div>
                          <Typography variant="bodyXs" colorRole="muted">
                            Vintage
                          </Typography>
                          <Typography variant="bodySm">
                            {wine.vintage ?? 'Non-vintage'}
                          </Typography>
                        </div>
                        <div>
                          <Typography variant="bodyXs" colorRole="muted">
                            Format
                          </Typography>
                          <Typography variant="bodySm">
                            {wine.totalCases}{' '}
                            {wine.totalCases === 1 ? 'case' : 'cases'} of{' '}
                            {wine.caseConfig ?? 1}
                            {wine.bottleSize ? ` · ${wine.bottleSize}` : ''}
                          </Typography>
                        </div>
                        <div>
                          <Typography variant="bodyXs" colorRole="muted">
                            In bond since
                          </Typography>
                          <Typography variant="bodySm">
                            {received ? format(new Date(received), 'MMMM yyyy') : '—'}
                          </Typography>
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {totals.reserved > 0 && (
        <Typography variant="bodyXs" colorRole="muted" className="mt-8 block">
          {totals.reserved} {totals.reserved === 1 ? 'case is' : 'cases are'}{' '}
          allocated against an instruction and cannot be released again.
        </Typography>
      )}

      <Typography variant="bodyXs" colorRole="muted" className="mt-8 block">
        To call wines forward for delivery, contact your account manager at{' '}
        <a className="text-text-brand" href="mailto:enquiries@craftculture.xyz">
          enquiries@craftculture.xyz
        </a>
        . Duties and delivery are quoted before any release.
      </Typography>
    </div>
  );
};

export default CellarPage;
