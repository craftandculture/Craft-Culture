'use client';

import {
  IconBottle,
  IconBuildingWarehouse,
  IconChevronDown,
  IconCoin,
  IconDownload,
  IconRefresh,
  IconSearch,
  IconShip,
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

interface CellarParcel {
  locationId: string;
  quantityCases: number;
  reservedCases: number;
  lotNumber: string | null;
  receivedAt: Date | null;
}

interface CellarWine {
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  bottleSize: string | null;
  caseConfig: number | null;
  totalCases: number;
  reservedCases: number;
  costPerBottle: number | null;
  locations: CellarParcel[];
}

type QuickFilter = 'all' | 'largeFormat' | 'magnumPlus' | 'reserved';

const bottlesOf = (wine: { totalCases: number; caseConfig: number | null }) =>
  wine.totalCases * (wine.caseConfig ?? 1);

const sizeMl = (size: string | null) => {
  if (!size) return 750;

  const value = Number(size.replace(/[^\d.]/g, ''));

  if (!value) return 750;

  return size.toLowerCase().includes('cl') ? value * 10 : value;
};

const money = (value: number, precise = false) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: precise ? 2 : 0,
  });

const MOVEMENT_LABELS: Record<string, string> = {
  receive: 'Received into bond',
  transfer: 'Moved within the warehouse',
  pick: 'Released',
  dispatch: 'Dispatched',
  adjustment: 'Adjusted',
  repack: 'Repacked',
};

/**
 * A collector's cellar
 *
 * Built in the Stock Explorer idiom — dense, tabular, expandable — because
 * that layout works and a collection is still inventory. What changes is what
 * it reports: bottles rather than cases, no LWINs, no bay codes, no owner
 * column, and cost stated as what was declared on import rather than dressed
 * up as a valuation.
 */
const CellarPage = () => {
  const api = useTRPC();
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [openWine, setOpenWine] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    ...api.wms.partner.getStock.queryOptions(),
  });

  const wines = useMemo(
    () => (data?.products ?? []) as unknown as CellarWine[],
    [data],
  );

  const inbound = useMemo(() => data?.inbound ?? [], [data]);

  const movementsByWine = useMemo(() => {
    type Movement = NonNullable<typeof data>['recentMovements'][number];

    const map = new Map<string, Movement[]>();

    for (const movement of data?.recentMovements ?? []) {
      if (!movement.lwin18) continue;
      map.set(movement.lwin18, [...(map.get(movement.lwin18) ?? []), movement]);
    }

    return map;
  }, [data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return wines
      .filter((wine) => {
        if (
          term &&
          ![wine.productName, wine.producer, String(wine.vintage ?? '')]
            .join(' ')
            .toLowerCase()
            .includes(term)
        ) {
          return false;
        }

        if (quickFilter === 'largeFormat') return sizeMl(wine.bottleSize) > 750;
        if (quickFilter === 'magnumPlus') return sizeMl(wine.bottleSize) >= 1500;
        if (quickFilter === 'reserved') return wine.reservedCases > 0;

        return true;
      })
      .sort(
        (a, b) =>
          (a.producer ?? '').localeCompare(b.producer ?? '') ||
          (b.vintage ?? 0) - (a.vintage ?? 0) ||
          a.productName.localeCompare(b.productName),
      );
  }, [wines, search, quickFilter]);

  const totals = useMemo(() => {
    const priced = wines.filter((wine) => (wine.costPerBottle ?? 0) > 0);

    return {
      bottles: wines.reduce((sum, wine) => sum + bottlesOf(wine), 0),
      cases: wines.reduce((sum, wine) => sum + wine.totalCases, 0),
      wines: wines.length,
      producers: new Set(wines.map((wine) => wine.producer?.trim() || 'Other'))
        .size,
      cost: priced.reduce(
        (sum, wine) => sum + bottlesOf(wine) * (wine.costPerBottle ?? 0),
        0,
      ),
      pricedCount: priced.length,
      inboundBottles: inbound.reduce(
        (sum, line) => sum + (line.totalBottles ?? 0),
        0,
      ),
    };
  }, [wines, inbound]);

  const handleExport = () => {
    const csvRows = [
      ['Producer', 'Wine', 'Vintage', 'Size', 'Pack', 'Cases', 'Bottles', 'Import $/btl'],
      ...wines.map((wine) => [
        wine.producer ?? '',
        wine.productName,
        wine.vintage ?? '',
        wine.bottleSize ?? '',
        wine.caseConfig ?? '',
        wine.totalCases,
        bottlesOf(wine),
        wine.costPerBottle ?? '',
      ]),
    ];

    const csv = csvRows
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

  const filters: { key: QuickFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'largeFormat', label: 'Large format' },
    { key: 'magnumPlus', label: 'Magnum and above' },
    { key: 'reserved', label: 'Awaiting collection' },
  ];

  const th =
    'text-[11px] font-medium uppercase tracking-wider text-text-muted px-3 py-2.5';
  const td = 'px-3 py-2.5 align-middle';

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-6 sm:px-6 sm:py-8">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Typography variant="headingLg">Your cellar</Typography>
          <Typography variant="bodySm" colorRole="muted" className="mt-1 block">
            {data?.partner?.name ? `${data.partner.name} — ` : ''}held in bond at
            Craft &amp; Culture, Ras Al Khaimah &middot; duty suspended until
            release
          </Typography>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
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
            isDisabled={!wines.length}
          >
            <ButtonContent iconLeft={IconDownload}>Export</ButtonContent>
          </Button>
        </div>
      </header>

      {/* Headline figures, in the Stock Explorer idiom */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="to-background-primary rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/40 px-3 py-2.5 text-center shadow-sm">
          <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100/70 text-indigo-500">
            <IconBottle size={13} />
          </div>
          <div className="text-lg font-bold leading-tight tabular-nums">
            {totals.bottles.toLocaleString()}
          </div>
          <div className="text-text-muted text-[11px]">Bottles</div>
          <div className="text-text-muted text-[10px]">
            {totals.cases.toLocaleString()} cases
          </div>
        </div>

        <div className="to-background-primary rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/40 px-3 py-2.5 text-center shadow-sm">
          <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-blue-100/70 text-blue-500">
            <IconBuildingWarehouse size={13} />
          </div>
          <div className="text-lg font-bold leading-tight tabular-nums">
            {totals.wines.toLocaleString()}
          </div>
          <div className="text-text-muted text-[11px]">Wines</div>
          <div className="text-text-muted text-[10px]">
            {totals.producers} producers
          </div>
        </div>

        <div className="to-background-primary rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 px-3 py-2.5 text-center shadow-sm">
          <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100/70 text-emerald-500">
            <IconCoin size={13} />
          </div>
          <div className="text-lg font-bold leading-tight tabular-nums">
            {totals.cost > 0 ? money(totals.cost) : '—'}
          </div>
          <div className="text-text-muted text-[11px]">Recorded on import</div>
          <div className="text-text-muted text-[10px]">
            {totals.pricedCount}/{totals.wines} wines
          </div>
        </div>

        <div className="to-background-primary rounded-xl border border-amber-100 bg-gradient-to-b from-amber-50/40 px-3 py-2.5 text-center shadow-sm">
          <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-amber-100/70 text-amber-500">
            <IconShip size={13} />
          </div>
          <div className="text-lg font-bold leading-tight tabular-nums">
            {totals.inboundBottles.toLocaleString()}
          </div>
          <div className="text-text-muted text-[11px]">In transit</div>
          <div className="text-text-muted text-[10px]">
            {inbound.length} {inbound.length === 1 ? 'line' : 'lines'}
          </div>
        </div>
      </div>

      {inbound.length > 0 && (
        <section className="border-border-muted mb-5 rounded-xl border">
          <div className="border-border-muted flex items-center gap-2 border-b px-3 py-2.5">
            <Icon icon={IconShip} size="sm" className="text-amber-500" />
            <Typography variant="labelSm" className="font-semibold">
              On its way
            </Typography>
          </div>
          <div className="divide-border-muted divide-y">
            {inbound.map((line, index) => (
              <div
                key={`${line.shipmentNumber}-${line.lwin18 ?? index}`}
                className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <Typography variant="bodySm" className="min-w-0 break-words">
                  {line.productName}
                </Typography>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="flex-shrink-0 tabular-nums"
                >
                  {line.totalBottles ?? 0} btl
                  {line.eta
                    ? ` · due ${format(new Date(line.eta), 'MMM yyyy')}`
                    : ''}
                </Typography>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="relative mb-3">
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

      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setQuickFilter(filter.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              quickFilter === filter.key
                ? 'bg-fill-brand text-text-on-brand'
                : 'border-border-muted text-text-muted hover:text-text-primary border'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <Typography variant="bodyXs" colorRole="muted" className="mb-2 block">
        {rows.length} {rows.length === 1 ? 'wine' : 'wines'}
      </Typography>

      <div className="border-border-muted overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-fill-muted/40">
            <tr>
              <th className="w-8 px-2 py-2.5" />
              <th className={`${th} text-left`}>Wine</th>
              <th className={`${th} hidden text-left sm:table-cell`}>Producer</th>
              <th className={`${th} text-center`}>Vintage</th>
              <th className={`${th} hidden text-center sm:table-cell`}>Size</th>
              <th className={`${th} hidden text-center md:table-cell`}>Pack</th>
              <th className={`${th} text-right`}>Cases</th>
              <th className={`${th} text-right`}>Bottles</th>
              <th className={`${th} hidden text-right lg:table-cell`}>
                Import $/btl
              </th>
            </tr>
          </thead>
          <tbody className="divide-border-muted divide-y">
            {isLoading && (
              <tr>
                <td colSpan={9} className="text-text-muted px-3 py-8 text-center">
                  Loading your cellar...
                </td>
              </tr>
            )}

            {!isLoading && !rows.length && (
              <tr>
                <td colSpan={9} className="text-text-muted px-3 py-10 text-center">
                  {search || quickFilter !== 'all'
                    ? 'No wines match that filter.'
                    : 'Nothing is held in your cellar yet.'}
                </td>
              </tr>
            )}

            {rows.map((wine) => {
              const isOpen = openWine === wine.lwin18;
              const history = movementsByWine.get(wine.lwin18) ?? [];

              return (
                <Fragment key={wine.lwin18}>
                  <tr
                    onClick={() => setOpenWine(isOpen ? null : wine.lwin18)}
                    className="hover:bg-fill-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="px-2 py-2.5">
                      <Icon
                        icon={IconChevronDown}
                        size="sm"
                        className={`text-text-muted transition-transform ${
                          isOpen ? '' : '-rotate-90'
                        }`}
                      />
                    </td>
                    <td className={`${td} font-medium`}>
                      {wine.productName}
                      <span className="text-text-muted block text-xs sm:hidden">
                        {wine.producer}
                      </span>
                    </td>
                    <td className={`${td} text-text-muted hidden sm:table-cell`}>
                      {wine.producer ?? '—'}
                    </td>
                    <td className={`${td} text-center tabular-nums`}>
                      {wine.vintage ?? 'NV'}
                    </td>
                    <td className={`${td} hidden text-center sm:table-cell`}>
                      {wine.bottleSize ?? '—'}
                    </td>
                    <td className={`${td} hidden text-center md:table-cell`}>
                      {wine.caseConfig ?? '—'}
                    </td>
                    <td className={`${td} text-right font-semibold tabular-nums`}>
                      {wine.totalCases}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {bottlesOf(wine)}
                    </td>
                    <td
                      className={`${td} hidden text-right tabular-nums lg:table-cell`}
                    >
                      {wine.costPerBottle
                        ? money(wine.costPerBottle, true)
                        : '—'}
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="bg-fill-muted/30">
                      <td colSpan={9} className="px-4 py-3 sm:px-10">
                        {/*
                          One line per parcel actually held. A wine received on
                          two occasions is two holdings with two histories, and
                          collapsing them to a single total is the warehouse's
                          convenience rather than the owner's record.
                        */}
                        <Typography
                          variant="bodyXs"
                          colorRole="muted"
                          className="mb-2 block font-semibold uppercase tracking-wider"
                        >
                          Cases held
                        </Typography>
                        <div className="mb-3 flex flex-col gap-1.5">
                          {wine.locations.map((parcel) => (
                            <div
                              key={`${parcel.locationId}-${parcel.lotNumber ?? ''}`}
                              className="border-border-muted/60 bg-background-primary flex flex-col gap-1 rounded-lg border px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                            >
                              <Typography variant="bodySm" className="tabular-nums">
                                <span className="font-semibold">
                                  {parcel.quantityCases}{' '}
                                  {parcel.quantityCases === 1 ? 'case' : 'cases'}
                                </span>{' '}
                                <span className="text-text-muted">
                                  &times; {wine.caseConfig ?? 1}{' '}
                                  {wine.bottleSize ?? '75cl'} ={' '}
                                  {parcel.quantityCases * (wine.caseConfig ?? 1)}{' '}
                                  bottles
                                </span>
                              </Typography>
                              <div className="flex flex-wrap gap-x-3">
                                {parcel.lotNumber && (
                                  <Typography
                                    variant="bodyXs"
                                    colorRole="muted"
                                    className="font-mono"
                                  >
                                    Lot {parcel.lotNumber}
                                  </Typography>
                                )}
                                {parcel.receivedAt && (
                                  <Typography variant="bodyXs" colorRole="muted">
                                    In bond since{' '}
                                    {format(
                                      new Date(parcel.receivedAt),
                                      'MMM yyyy',
                                    )}
                                  </Typography>
                                )}
                                {parcel.reservedCases > 0 && (
                                  <Typography
                                    variant="bodyXs"
                                    className="text-text-brand"
                                  >
                                    {parcel.reservedCases} awaiting collection
                                  </Typography>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {history.length > 0 && (
                          <>
                            <Typography
                              variant="bodyXs"
                              colorRole="muted"
                              className="mb-1.5 block font-semibold uppercase tracking-wider"
                            >
                              History
                            </Typography>
                            <div className="flex flex-col gap-1">
                              {history.slice(0, 5).map((movement) => (
                                <div
                                  key={movement.id}
                                  className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                                >
                                  <Typography variant="bodyXs">
                                    {MOVEMENT_LABELS[movement.movementType] ??
                                      movement.movementType}
                                    {movement.quantityCases
                                      ? ` · ${movement.quantityCases} ${
                                          movement.quantityCases === 1
                                            ? 'case'
                                            : 'cases'
                                        }`
                                      : ''}
                                  </Typography>
                                  <Typography
                                    variant="bodyXs"
                                    colorRole="muted"
                                    className="flex-shrink-0"
                                  >
                                    {movement.performedAt
                                      ? format(
                                          new Date(movement.performedAt),
                                          'd MMM yyyy',
                                        )
                                      : ''}
                                  </Typography>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <Typography variant="bodyXs" colorRole="muted" className="mt-6 block">
        Import cost is the value declared when the wine was brought into bond,
        not a market valuation. To call wines forward for delivery, contact{' '}
        <a className="text-text-brand" href="mailto:enquiries@craftculture.xyz">
          enquiries@craftculture.xyz
        </a>
        &nbsp;— duties and delivery are quoted before any release.
      </Typography>
    </div>
  );
};

export default CellarPage;
