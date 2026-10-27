'use client';

import {
  IconAlertTriangle,
  IconAnchor,
  IconArrowRight,
  IconBook,
  IconChartBar,
  IconChevronRight,
  IconClipboardList,
  IconCloudDownload,
  IconFileInvoice,
  IconFileText,
  IconPlane,
  IconPlus,
  IconRefresh,
  IconShip,
  IconTruck,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import BondsOutstandingCard from '@/app/_logistics/components/exports/BondsOutstandingCard';
import NeedsAttentionCard from '@/app/_logistics/components/NeedsAttentionCard';
import ShipmentMetrics from '@/app/_logistics/components/ShipmentMetrics';
import ShipmentPartyMark from '@/app/_logistics/components/ShipmentPartyMark';
import ShipmentStatusBadge from '@/app/_logistics/components/ShipmentStatusBadge';
import ShipmentTypeBadge, { type ShipmentType, shipmentTypeConfig } from '@/app/_logistics/components/ShipmentTypeBadge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import type { logisticsTransportMode } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type TransportMode = (typeof logisticsTransportMode.enumValues)[number];

const transportModeIcons: Record<TransportMode, typeof IconShip> = {
  sea_fcl: IconShip,
  sea_lcl: IconAnchor,
  air: IconPlane,
  road: IconTruck,
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Logistics Dashboard - overview of shipments, compliance, costs, and quotes
 */
const LogisticsDashboardPage = () => {
  const [typeFilter, setTypeFilter] = useState<ShipmentType | 'all'>('all');
  const [stageTab, setStageTab] = useState<'shipments' | 'quotes'>('shipments');
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching, error } = useQuery({
    ...api.logistics.admin.getDashboardMetrics.queryOptions(),
  });

  const { mutate: syncHillebrand, isPending: isSyncing } = useMutation({
    ...api.logistics.admin.syncHillebrand.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Synced ${result.created} new, ${result.updated} updated shipments`);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getDashboardMetrics']] });
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'getAttention']] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync with Hillebrand');
    },
  });

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-5">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const metrics = data;
  const shipments = metrics?.shipments;
  const allRecent = metrics?.recentShipments ?? [];
  const quoteJobs = allRecent.filter((s) => s.isQuote);
  const shipmentJobs = allRecent.filter((s) => !s.isQuote);
  const recent = stageTab === 'quotes' ? quoteJobs : shipmentJobs;
  const visible = recent.filter((s) => typeFilter === 'all' || s.type === typeFilter);

  // Where shipments are on the way in, read left to right
  const tiles = [
    { label: 'Active', value: shipments?.active ?? 0, tone: 'bg-surface-secondary text-text-primary' },
    { label: 'On the way', value: shipments?.onTheWay ?? 0, tone: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
    {
      label: 'At port or customs',
      value: shipments?.portCustoms ?? 0,
      tone: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
    },
    { label: 'At warehouse', value: shipments?.warehouse ?? 0, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
    { label: 'Opened, last 30 days', value: shipments?.recentActivityCount ?? 0, tone: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
  ];

  const docsFlag = (metrics?.documents.expiredCount ?? 0) + (metrics?.documents.expiringCount ?? 0);
  const sideRows = [
    {
      label: 'Freight to price or accept',
      value: String(metrics?.quoteRequests?.toPriceCount ?? 0),
      href: '/platform/admin/logistics/quotes',
      flag: (metrics?.quotes.expiringCount ?? 0) > 0,
    },
    {
      label: 'Awaiting forwarder replies',
      value: String(metrics?.quoteRequests?.awaitingRepliesCount ?? 0),
      href: '/platform/admin/logistics/quotes',
      flag: (metrics?.quoteRequests?.chaseCount ?? 0) > 0,
    },
    {
      label: 'Documents expired or expiring',
      value: String(docsFlag),
      href: '/platform/admin/logistics/reports/compliance',
      flag: docsFlag > 0,
    },
    {
      label: 'Landed cost this month',
      value: formatCurrency(metrics?.costs.monthlyLanded ?? 0),
      href: '/platform/admin/logistics/reports',
      flag: false,
    },
  ];

  const links = [
    { label: 'All shipments', href: '/platform/admin/logistics/shipments', icon: IconShip },
    { label: 'Export jobs', href: '/platform/admin/logistics/exports', icon: IconTruckDelivery },
    { label: 'Freight Quotes', href: '/platform/admin/logistics/quotes', icon: IconFileInvoice },
    { label: 'Export Invoices', href: '/platform/admin/logistics/export-invoices', icon: IconClipboardList },
    { label: 'Reports', href: '/platform/admin/logistics/reports', icon: IconChartBar },
    { label: 'PDF tool', href: '/platform/admin/logistics/tools/pdf-extract', icon: IconFileText },
  ];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Logistics</h1>
            <p className="mt-0.5 text-sm text-text-muted">Imports, exports and mainland transfers</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncHillebrand()}
              disabled={isSyncing}
              title="Sync shipments from Hillebrand"
            >
              <Icon icon={IconCloudDownload} size="sm" className={isSyncing ? 'animate-pulse' : ''} />
              <span className="ml-1 hidden sm:inline">Hillebrand</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching} title="Refresh">
              <Icon icon={IconRefresh} size="sm" className={isFetching ? 'animate-spin' : ''} />
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/admin/logistics/exports/new">
                <ButtonContent iconLeft={IconTruckDelivery}>New export job</ButtonContent>
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

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-900">
            The dashboard figures could not be loaded, so the counts below are not real: {error.message}
          </p>
        ) : null}

        {/* Status strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <Link
              key={t.label}
              href="/platform/admin/logistics/shipments"
              className={`rounded-xl px-4 py-3 transition-opacity hover:opacity-80 ${t.tone}`}
            >
              <p className="text-2xl font-semibold tabular-nums">{t.value}</p>
              <p className="mt-0.5 text-xs font-medium opacity-80">{t.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Main column: what needs acting on, then live work */}
          <div className="min-w-0 space-y-5">
            <NeedsAttentionCard />

            <section className="overflow-hidden rounded-xl border border-border-muted bg-surface-primary">
              <div className="flex items-center justify-between gap-3 border-b border-border-muted px-4">
                <div className="flex gap-4">
                  {(
                    [
                      { key: 'shipments', label: 'Shipments', count: shipmentJobs.length },
                      { key: 'quotes', label: 'Quotes', count: quoteJobs.length },
                    ] as const
                  ).map((tab) => {
                    const active = stageTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setStageTab(tab.key);
                          setTypeFilter('all');
                        }}
                        className={`-mb-px inline-flex items-center gap-1.5 border-b-2 py-3 text-sm font-semibold transition-colors ${
                          active
                            ? 'border-text-primary text-text-primary'
                            : 'border-transparent text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {tab.label}
                        <span className="tabular-nums text-xs font-medium opacity-70">{tab.count}</span>
                      </button>
                    );
                  })}
                </div>
                <Link
                  href={
                    stageTab === 'quotes'
                      ? '/platform/admin/logistics/quotes'
                      : '/platform/admin/logistics/shipments'
                  }
                  className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary"
                >
                  View all <IconArrowRight size={14} />
                </Link>
              </div>
              <p className="px-4 pt-3 text-xs text-text-muted">
                {stageTab === 'quotes'
                  ? 'Jobs still waiting on a freight quote to be accepted'
                  : 'Live, and finished in the last 7 days'}
              </p>
              <div className="-mx-px flex gap-1.5 overflow-x-auto px-4 py-3">
                {(['all', 'inbound', 'outbound', 'mainland_transfer', 're_export'] as const).map((t) => {
                  const count = recent.filter((s) => t === 'all' || s.type === t).length;
                  if (t !== 'all' && t !== 'inbound' && count === 0) return null;
                  const active = typeFilter === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-text-primary text-surface-primary'
                          : 'bg-surface-secondary text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {t === 'all' ? 'All' : shipmentTypeConfig[t].label}
                      <span className="tabular-nums opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>

              {visible.length === 0 ? (
                <p className="border-t border-border-muted px-4 py-10 text-center text-sm text-text-muted">
                  {stageTab === 'quotes'
                    ? 'No jobs waiting on a quote.'
                    : typeFilter === 'inbound'
                      ? 'No imports in the last 7 days. Older ones are under View all.'
                      : 'No live shipments. Finished ones are under View all.'}
                </p>
              ) : (
                <ul className="divide-y divide-border-muted border-t border-border-muted">
                  {visible.map((shipment) => {
                    const ModeIcon = transportModeIcons[shipment.transportMode] ?? IconShip;
                    const origin = shipment.originCity ?? shipment.originCountry ?? 'Origin';
                    const destination = shipment.destinationCity ?? shipment.destinationWarehouse ?? 'Destination';
                    return (
                      <li key={shipment.id}>
                        <Link
                          href={`/platform/admin/logistics/shipments/${shipment.id}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-secondary"
                        >
                          <ShipmentPartyMark type={shipment.type} logoUrl={shipment.partyLogoUrl} name={shipment.partyName} icon={ModeIcon} />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-medium text-text-primary">
                                {shipment.name ?? shipment.partyName ?? `${origin} → ${destination}`}
                              </span>
                              <ShipmentTypeBadge type={shipment.type} />
                              <ShipmentStatusBadge status={shipment.status} />
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                              <span className="font-mono">{shipment.shipmentNumber}</span>
                              {shipment.name || shipment.partyName ? (
                                <>
                                  <span>·</span>
                                  <span className="truncate">
                                    {origin} → {destination}
                                  </span>
                                </>
                              ) : null}
                              {shipment.name && shipment.partyName ? (
                                <>
                                  <span>·</span>
                                  <span className="truncate">{shipment.partyName}</span>
                                </>
                              ) : null}
                            </span>
                          </span>
                          <ShipmentMetrics
                            cases={shipment.totalCases}
                            bottles={shipment.totalBottles}
                            etaLabel={shipment.eta ? formatDate(shipment.eta) : null}
                          />
                          <IconChevronRight className="size-4 shrink-0 text-text-muted" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Side column: money held, the smaller counts, and the way to everything else */}
          <aside className="space-y-5">
            <BondsOutstandingCard />

            <section className="overflow-hidden rounded-xl border border-border-muted bg-surface-primary">
              <p className="px-4 pb-2 pt-4 text-sm font-semibold text-text-primary">At a glance</p>
              <ul className="divide-y divide-border-muted border-t border-border-muted">
                {sideRows.map((r) => (
                  <li key={r.label}>
                    <Link
                      href={r.href}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface-secondary"
                    >
                      <span className="flex items-center gap-2 text-text-muted">
                        {r.flag ? <IconAlertTriangle size={14} className="text-amber-600" /> : null}
                        {r.label}
                      </span>
                      <span className="font-semibold tabular-nums text-text-primary">{r.value}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="overflow-hidden rounded-xl border border-border-muted bg-surface-primary">
              <p className="px-4 pb-2 pt-4 text-sm font-semibold text-text-primary">Go to</p>
              <ul className="grid grid-cols-2 gap-1 p-2 pt-0">
                {links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-text-primary transition-colors hover:bg-surface-secondary"
                    >
                      <l.icon size={16} className="shrink-0 text-text-muted" />
                      <span className="truncate">{l.label}</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <a
                    href="https://craftculture.xyz/logistics-manual"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-text-primary transition-colors hover:bg-surface-secondary"
                  >
                    <IconBook size={16} className="shrink-0 text-text-muted" />
                    <span className="truncate">Manual</span>
                  </a>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default LogisticsDashboardPage;
