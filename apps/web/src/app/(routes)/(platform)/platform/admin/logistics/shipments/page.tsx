'use client';

import {
  IconAnchor,
  IconBox,
  IconChevronLeft,
  IconChevronRight,
  IconCloudDownload,
  IconLoader2,
  IconPlane,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShip,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { toast } from 'sonner';

import LogUpdateSheet, { type LogUpdateSheetShipment } from '@/app/_logistics/components/LogUpdateSheet';
import ShipmentMetrics from '@/app/_logistics/components/ShipmentMetrics';
import ShipmentPartyMark from '@/app/_logistics/components/ShipmentPartyMark';
import ShipmentStatusBadge from '@/app/_logistics/components/ShipmentStatusBadge';
import ShipmentTypeBadge, { type ShipmentType, shipmentTypeConfig } from '@/app/_logistics/components/ShipmentTypeBadge';
import type { ShipmentStageGroup } from '@/app/_logistics/schemas/getShipmentsSchema';
import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import type { logisticsTransportMode } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type TransportMode = (typeof logisticsTransportMode.enumValues)[number];

const PAGE_SIZE = 50;

const transportModeIcons: Record<TransportMode, typeof IconShip> = {
  sea_fcl: IconShip,
  sea_lcl: IconAnchor,
  air: IconPlane,
  road: IconTruck,
};

/** The tiles across the top; each is a filter and shows how many it would list */
const STAGE_TILES: { key: ShipmentStageGroup; label: string; tone: string }[] = [
  { key: 'active', label: 'Active', tone: 'bg-surface-secondary text-text-primary' },
  { key: 'on_the_way', label: 'On the way', tone: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
  { key: 'port_customs', label: 'Port or customs', tone: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' },
  { key: 'warehouse', label: 'At warehouse', tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  { key: 'done', label: 'Delivered', tone: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
];

// Re-export is no longer offered: mainland transfers took its place. Old ones still show under All types.
const TYPES: ShipmentType[] = ['inbound', 'outbound', 'mainland_transfer'];

const formatDate = (date: Date | null | undefined) =>
  date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : null;

const HOUR = 60 * 60 * 1000;

/** How long since news was logged, and how worried to be about it */
const freshness = (at: Date | string) => {
  const hours = (Date.now() - new Date(at).getTime()) / HOUR;
  const label = hours < 1 ? 'just now' : hours < 24 ? `${Math.floor(hours)}h ago` : `${Math.floor(hours / 24)}d ago`;
  const tone = hours < 24 ? 'bg-emerald-500' : hours < 48 ? 'bg-amber-500' : 'bg-red-600';
  return { label, tone, stale: hours >= 48 };
};

/** Statuses where news is still expected; once at the warehouse, receiving takes over */
const AWAITING = new Set(['draft', 'booked', 'picked_up', 'in_transit', 'arrived_port', 'customs_clearance', 'cleared']);

/**
 * Shipments list
 *
 * Tiles filter by where shipments are, pills by type, and the search covers
 * numbers, references, partner, supplier and wine. Filters live in the URL so
 * Back and shared links keep them. Export jobs and mainland transfers open on
 * their export job, where the team works them.
 */
const ShipmentsList = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const params = useSearchParams();

  const stage = (params.get('stage') as ShipmentStageGroup | null) ?? undefined;
  const type = (params.get('type') as ShipmentType | null) ?? undefined;
  const sort = params.get('sort') === 'eta' ? 'eta' : 'newest';
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  const search = params.get('q') ?? '';
  const owner = params.get('owner') ?? undefined;
  const mine = owner === 'me';
  const noNews = params.get('news') === 'none';

  const [typed, setTyped] = useState(search);
  const [updating, setUpdating] = useState<LogUpdateSheetShipment | null>(null);

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in changes)) next.delete('page');
    const qs = next.toString();
    /*
      The browser's own history, not router.replace: Next keeps useSearchParams
      in step with it, and it skips the server round trip that made each chip
      take a moment to light up.
    */
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
  };

  // Search runs once typing pauses, not on every key
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onType = (value: string) => {
    setTyped(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam({ q: value.trim() || null }), 300);
  };

  const { data, isLoading, refetch, isFetching } = useQuery({
    ...api.logistics.admin.getMany.queryOptions({
      limit: PAGE_SIZE,
      cursor: page * PAGE_SIZE,
      search: search || undefined,
      stage,
      type,
      sort,
      owner,
      noNews: noNews || undefined,
    }),
    placeholderData: (prev) => prev,
  });

  const { mutate: syncHillebrand, isPending: isSyncing } = useMutation({
    ...api.logistics.admin.syncHillebrand.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Synced ${result.created} new, ${result.updated} updated shipments`);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getMany']] });
    },
    onError: (error) => toast.error(error.message || 'Failed to sync with Hillebrand'),
  });

  const shipments = data?.data ?? [];
  const totalCount = data?.meta.totalCount ?? 0;
  const counts = data?.meta.stageCounts;
  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
              <Link href="/platform/admin/logistics" className="transition-colors hover:text-text-primary">
                Logistics
              </Link>
              <IconChevronRight className="size-4" />
              <span className="text-text-primary">Shipments</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Shipments</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => syncHillebrand()} disabled={isSyncing} title="Sync shipments from Hillebrand">
              <Icon icon={IconCloudDownload} size="sm" className={isSyncing ? 'animate-pulse' : ''} />
              <span className="ml-1 hidden sm:inline">Hillebrand</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching} title="Refresh">
              <Icon icon={IconRefresh} size="sm" className={isFetching ? 'animate-spin' : ''} />
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/admin/logistics/groups">
                <IconBox size={16} /> <span className="ml-1">Groups</span>
              </Link>
            </Button>
            <Link
              href="/platform/admin/logistics/shipments/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-text-primary px-3.5 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90"
            >
              <IconPlus size={16} /> New shipment
            </Link>
          </div>
        </div>

        {/* Stage tiles: counted across all shipments matching the search and type */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STAGE_TILES.map((t) => {
            const active = stage === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setParam({ stage: active ? null : t.key })}
                className={`rounded-xl px-4 py-3 text-left transition ${t.tone} ${
                  active ? 'ring-2 ring-text-primary ring-offset-2 ring-offset-surface-primary' : 'hover:opacity-80'
                }`}
              >
                <p className="text-2xl font-semibold tabular-nums">{counts ? counts[t.key] : '–'}</p>
                <p className="mt-0.5 text-xs font-medium opacity-80">{t.label}</p>
              </button>
            );
          })}
        </div>

        <div className="-mt-2 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          {/* An owner's own list, and what has gone quiet: the board the team keeps each day */}
          <button
            type="button"
            onClick={() => setParam({ owner: owner ? null : 'me' })}
            className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${
              owner ? 'bg-text-primary text-surface-primary' : 'bg-surface-secondary hover:text-text-primary'
            }`}
          >
            {owner && !mine ? 'One person’s actions ×' : 'My actions'}
          </button>
          <button
            type="button"
            onClick={() => setParam({ news: noNews ? null : 'none' })}
            className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${
              noNews ? 'bg-text-primary text-surface-primary' : 'bg-surface-secondary hover:text-text-primary'
            }`}
          >
            No news 48h
          </button>
          <span className="mx-1 h-3 w-px bg-border-muted" aria-hidden />
          <span>Also:</span>
          {(
            [
              ['draft', 'Drafts'],
              ['cancelled', 'Cancelled'],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => setParam({ stage: stage === key ? null : key })}
              className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${
                stage === key ? 'bg-text-primary text-surface-primary' : 'bg-surface-secondary hover:text-text-primary'
              }`}
            >
              {text} <span className="tabular-nums opacity-70">{counts ? counts[key] : '–'}</span>
            </button>
          ))}
        </div>

        {/* Search, type and sort */}
        <div className="space-y-3">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input
              value={typed}
              onChange={(e) => onType(e.target.value)}
              placeholder="Search number, reference, partner, supplier or wine"
              className="h-11 w-full rounded-xl border border-border-muted bg-surface-primary pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:border-text-primary focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5 overflow-x-auto">
              {([undefined, ...TYPES] as (ShipmentType | undefined)[]).map((t) => {
                const active = type === t;
                return (
                  <button
                    key={t ?? 'all'}
                    type="button"
                    onClick={() => setParam({ type: t ?? null })}
                    className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      active ? 'bg-text-primary text-surface-primary' : 'bg-surface-secondary text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {t ? shipmentTypeConfig[t].label : 'All types'}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>{isLoading ? 'Loading…' : `${totalCount} shipment${totalCount === 1 ? '' : 's'}`}</span>
              <span>·</span>
              <label htmlFor="sort">Sort</label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => setParam({ sort: e.target.value === 'eta' ? 'eta' : null })}
                className="h-8 rounded-lg border border-border-muted bg-surface-primary px-2 text-xs text-text-primary"
              >
                <option value="newest">Newest first</option>
                <option value="eta">Arriving soonest</option>
              </select>
            </div>
          </div>
        </div>

        {/* List */}
        <section className="overflow-hidden rounded-xl border border-border-muted bg-surface-primary">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <IconLoader2 className="size-6 animate-spin text-text-muted" />
            </div>
          ) : shipments.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-text-muted">
              {owner
                ? `Nothing is waiting on ${mine ? 'you' : 'them'}.`
                : search || stage || type || noNews ? 'No shipments match. Clear a filter or change the search.' : 'No shipments yet.'}
            </p>
          ) : (
            <ul className={`divide-y divide-border-muted transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              {shipments.map((shipment) => {
                const ModeIcon = transportModeIcons[shipment.transportMode] ?? IconShip;
                const origin = shipment.originCity ?? shipment.originCountry ?? 'Origin';
                const destination = shipment.destinationCity ?? shipment.destinationWarehouse ?? 'Destination';
                // Only export jobs have the exports screen; an import job opens as a shipment
                const href = shipment.jobKind === 'export'
                  ? `/platform/admin/logistics/exports/${shipment.id}`
                  : `/platform/admin/logistics/shipments/${shipment.id}`;
                const news = AWAITING.has(shipment.status)
                  ? freshness(shipment.lastUpdateAt ?? shipment.createdAt)
                  : null;
                // An ETA matters only while it is still awaited; once in, it is history
                const eta = AWAITING.has(shipment.status) ? formatDate(shipment.eta) : null;
                return (
                  <li key={shipment.id} className="flex items-center">
                    <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 transition-colors hover:bg-surface-secondary">
                      <ShipmentPartyMark type={shipment.type} logoUrl={shipment.partyLogoUrl} name={shipment.partyName} icon={ModeIcon} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-text-primary">
                            {shipment.name ?? shipment.partyName ?? `${origin} → ${destination}`}
                          </span>
                          <ShipmentTypeBadge type={shipment.type} />
                          <ShipmentStatusBadge status={shipment.status} />
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-text-muted">
                          <span className="font-mono">{shipment.jobNumber ?? shipment.shipmentNumber}</span>
                          <span>·</span>
                          <span className="truncate">
                            {origin} → {destination}
                          </span>
                          {shipment.name && shipment.partyName ? (
                            <>
                              <span>·</span>
                              <span className="truncate">{shipment.partyName}</span>
                            </>
                          ) : null}
                          {shipment.carrierName ? (
                            <>
                              <span>·</span>
                              <span>
                                {shipment.carrierName}
                                {shipment.containerNumber ? ` ${shipment.containerNumber}` : ''}
                              </span>
                            </>
                          ) : null}
                        </span>
                        {(shipment.nextAction || news) && (
                          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs">
                            {news && (
                              <span className={`inline-flex items-center gap-1 ${news.stale ? 'font-semibold text-red-700 dark:text-red-400' : 'text-text-muted'}`}>
                                <span className={`size-1.5 rounded-full ${news.tone}`} aria-hidden />
                                {news.stale ? `No news ${news.label.replace(' ago', '')}` : news.label}
                              </span>
                            )}
                            {shipment.nextAction && (
                              <>
                                {news && <span className="text-text-muted">·</span>}
                                <span className="min-w-0 truncate text-text-primary">Next: {shipment.nextAction}</span>
                                {shipment.actionOwnerName && (
                                  <span className="text-text-muted">({shipment.actionOwnerName.split(' ')[0]})</span>
                                )}
                              </>
                            )}
                          </span>
                        )}
                      </span>
                      <ShipmentMetrics
                        cases={shipment.totalCases}
                        bottles={shipment.totalBottles}
                        etaLabel={eta ? `${eta}${shipment.etaConfirmed ? '' : ' est.'}` : null}
                      />
                      <IconChevronRight className="size-4 shrink-0 text-text-muted" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setUpdating(shipment)}
                      className="mr-3 h-9 shrink-0 rounded-lg border border-border-muted px-3 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-secondary"
                    >
                      Update
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {pages > 1 ? (
          <div className="flex items-center justify-end gap-2 text-sm text-text-muted">
            <span>
              Page {page + 1} of {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setParam({ page: page - 1 ? String(page - 1) : null })}>
              <IconChevronLeft size={16} />
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setParam({ page: String(page + 1) })}>
              <IconChevronRight size={16} />
            </Button>
          </div>
        ) : null}
      </div>

      <LogUpdateSheet shipment={updating} onClose={() => setUpdating(null)} />
    </div>
  );
};

/** useSearchParams needs a Suspense boundary on a client page */
const ShipmentsListPage = () => (
  <Suspense fallback={null}>
    <ShipmentsList />
  </Suspense>
);

export default ShipmentsListPage;
