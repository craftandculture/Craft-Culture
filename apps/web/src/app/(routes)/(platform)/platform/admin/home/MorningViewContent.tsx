'use client';

import {
  IconAlertTriangle,
  IconBinoculars,
  IconBolt,
  IconBrain,
  IconBuildingWarehouse,
  IconChevronRight,
  IconClock,
  IconCurrencyDollar,
  IconEye,
  IconEyeOff,
  IconFileText,
  IconPencil,
  IconPlus,
  IconShoppingCart,
  IconSparkles,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import HomeTasksCard from '@/app/_teamTasks/components/HomeTasksCard';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import useTRPC from '@/lib/trpc/browser';

type Currency = 'USD' | 'AED';

/** Time-based greeting */
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/** Format date string: "Thursday 20 Feb 2026" */
const formatDate = () =>
  new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/**
 * Format currency for display
 *
 * Millions from a million up, so a year's revenue reads "USD 1.01M" rather
 * than "USD 1013.4k"; thousands below that.
 */
const formatCurrency = (amount: number | null | undefined, currency: Currency) => {
  const prefix = currency === 'USD' ? 'USD' : 'AED';
  const val = amount ?? 0;
  const size = Math.abs(val);
  if (size >= 1_000_000) {
    return `${prefix} ${(val / 1_000_000).toFixed(2)}M`;
  }
  if (size >= 1000) {
    return `${prefix} ${(val / 1000).toFixed(1)}k`;
  }
  return `${prefix} ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

/** Tile tints, from the Stock Explorer / Team Tasks house style */
const TONES = {
  slate: {
    tile: 'border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10',
    icon: 'bg-slate-100 text-slate-500 dark:bg-slate-500/20',
    value: 'text-text-primary',
  },
  emerald: {
    tile: 'border-emerald-100 from-emerald-50/50 dark:border-emerald-900/50 dark:from-emerald-500/10',
    icon: 'bg-emerald-100/70 text-emerald-600 dark:bg-emerald-500/20',
    value: 'text-text-primary',
  },
  blue: {
    tile: 'border-blue-100 from-blue-50/50 dark:border-blue-900/50 dark:from-blue-500/10',
    icon: 'bg-blue-100/70 text-blue-600 dark:bg-blue-500/20',
    value: 'text-text-primary',
  },
  amber: {
    tile: 'border-amber-100 from-amber-50/50 dark:border-amber-900/50 dark:from-amber-500/10',
    icon: 'bg-amber-100/70 text-amber-600 dark:bg-amber-500/20',
    value: 'text-amber-600',
  },
  red: {
    tile: 'border-red-100 from-red-50/50 dark:border-red-900/50 dark:from-red-500/10',
    icon: 'bg-red-100/70 text-red-500 dark:bg-red-500/20',
    value: 'text-red-600',
  },
} as const;

/** A change against the previous period, as a coloured percentage */
const changeLine = (current: number, previous: number, period: string) => {
  if (!(previous > 0)) {
    return <span className="text-text-muted">No data last {period}</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  return (
    <span className={pct >= 0 ? 'text-emerald-600' : 'text-red-600'}>
      {pct >= 0 ? '+' : ''}
      {pct}% vs last {period}
    </span>
  );
};

/** Format relative time */
const formatRelativeTime = (date: Date | string) => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/** Status dot color mapping */
const getStatusColor = (status: string) => {
  const green = ['delivered', 'cc_approved', 'client_paid', 'distributor_paid', 'partner_paid', 'approved', 'picked'];
  const amber = ['submitted', 'under_cc_review', 'awaiting_client_payment', 'awaiting_distributor_payment', 'awaiting_partner_payment', 'awaiting_partner_verification', 'awaiting_distributor_verification', 'synced', 'picking', 'draft'];
  const red = ['cancelled', 'verification_suspended', 'revision_requested'];

  if (green.includes(status)) return 'bg-emerald-500';
  if (red.includes(status)) return 'bg-red-500';
  if (amber.includes(status)) return 'bg-amber-500';
  return 'bg-emerald-500';
};

/** Agent icon + color config */
const agentConfig: Record<string, { icon: typeof IconBinoculars; bgColor: string; iconColor: string; label: string }> = {
  scout: { icon: IconBinoculars, bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600', label: 'Market Scout' },
  concierge: { icon: IconSparkles, bgColor: 'bg-blue-100', iconColor: 'text-blue-600', label: 'PCO Concierge' },
  storyteller: { icon: IconPencil, bgColor: 'bg-violet-100', iconColor: 'text-violet-600', label: 'Socials' },
  buyer: { icon: IconShoppingCart, bgColor: 'bg-amber-100', iconColor: 'text-amber-600', label: 'Purchasing' },
  pricer: { icon: IconCurrencyDollar, bgColor: 'bg-cyan-100', iconColor: 'text-cyan-600', label: 'Pricing' },
  advisor: { icon: IconBrain, bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600', label: 'Business' },
};

/** Quick action definitions */
const quickActions = [
  { label: '+ New Order', href: '/platform/admin/private-orders/new', icon: IconPlus },
  { label: '+ Create Quote', href: '/platform/quotes', icon: IconFileText },
  { label: 'Open WMS', href: '/platform/admin/wms', icon: IconBuildingWarehouse },
  { label: 'Run Scout', href: '/platform/admin/agents', icon: IconBolt },
];

/**
 * Morning View dashboard content — KPIs, agent briefs, recent orders, quick actions
 */
const MorningViewContent = () => {
  const api = useTRPC();
  const [currency, setCurrency] = useState<Currency>('USD');
  const [redacted, setRedacted] = useState(false);

  const { data: user } = useQuery({
    ...api.users.getMe.queryOptions(),
  });

  const { data, isLoading } = useQuery({
    ...api.morningView.get.queryOptions(),
    refetchInterval: 60_000,
  });

  const firstName = user?.firstName ?? user?.name?.split(' ')[0] ?? '';

  // Loading skeleton matching layout
  if (isLoading) {
    return (
      <div className="container space-y-6 py-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-secondary" />
            <div className="mt-2 h-4 w-80 animate-pulse rounded bg-surface-secondary" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded-lg bg-surface-secondary" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Card key={n}>
              <CardContent className="p-5">
                <div className="mx-auto h-3 w-20 animate-pulse rounded bg-surface-secondary" />
                <div className="mx-auto mt-4 h-8 w-16 animate-pulse rounded bg-surface-secondary" />
                <div className="mx-auto mt-3 h-3 w-24 animate-pulse rounded bg-surface-secondary" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-5">
          <Card className="min-w-0 lg:col-span-3">
            <CardContent className="h-80 animate-pulse p-6" />
          </Card>
          <div className="min-w-0 space-y-5 lg:col-span-2">
            <Card><CardContent className="h-56 animate-pulse p-6" /></Card>
            <Card><CardContent className="h-24 animate-pulse p-6" /></Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-8">
      {/* ── Greeting + Currency Toggle ──────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {formatDate()} &mdash; Here&apos;s what needs your attention today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRedacted((r) => !r)}
            className="rounded-full border border-border-muted bg-surface-primary p-1.5 text-text-muted shadow-sm transition-colors hover:text-text-primary"
            title={redacted ? 'Show values' : 'Hide values'}
          >
            {redacted ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
          </button>
          <div className="flex items-center rounded-full border border-border-muted bg-surface-muted p-0.5">
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                currency === 'USD'
                  ? 'bg-text-primary text-surface-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              USD
            </button>
            <button
              type="button"
              onClick={() => setCurrency('AED')}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                currency === 'AED'
                  ? 'bg-text-primary text-surface-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              AED
            </button>
          </div>
        </div>
      </div>

      {/* ── Sync health warning — invoice sync canary ──────────── */}
      {data?.invoiceSync?.isStale && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <IconAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            <span className="font-semibold">Invoice sync looks stale.</span>{' '}
            Last update from Zoho was{' '}
            {data.invoiceSync.lastSyncedAt
              ? new Date(data.invoiceSync.lastSyncedAt).toLocaleString('en-GB')
              : 'never'}
            {' '}— the Invoiced &amp; Overdue figures below may be out of date until it catches up.
          </p>
        </div>
      )}

      {/* ── KPI tiles — house style, tinted by meaning ──────────── */}
      {data && (() => {
        const pick = (usd: number, aed: number) => (currency === 'USD' ? usd : aed);
        const money = (usd: number, aed: number) =>
          redacted ? '•••' : formatCurrency(pick(usd, aed), currency);
        const k = data.kpis;

        const tiles: {
          label: string;
          value: React.ReactNode;
          sub: React.ReactNode;
          icon: typeof IconShoppingCart;
          tone: keyof typeof TONES;
          href?: string;
        }[] = [
          {
            label: 'Open orders',
            value: k.openOrders,
            sub:
              k.openOrdersThisWeek > 0 ? (
                <span className="text-emerald-600">+{k.openOrdersThisWeek} this week</span>
              ) : (
                'Active orders'
              ),
            icon: IconShoppingCart,
            tone: 'slate',
            href: '/platform/admin/private-orders',
          },
          {
            label: 'Invoiced this month',
            value: money(k.revenueMonthUsd, k.revenueMonthAed),
            sub: redacted
              ? '\u00a0'
              : changeLine(
                  pick(k.revenueMonthUsd, k.revenueMonthAed),
                  pick(k.revenueLastMonthUsd, k.revenueLastMonthAed),
                  'month',
                ),
            icon: IconFileText,
            tone: 'emerald',
          },
          {
            label: 'Invoiced this year',
            value: money(k.revenueYearUsd, k.revenueYearAed),
            sub: redacted
              ? '\u00a0'
              : changeLine(
                  pick(k.revenueYearUsd, k.revenueYearAed),
                  pick(k.revenueLastYearUsd, k.revenueLastYearAed),
                  'year',
                ),
            icon: IconCurrencyDollar,
            tone: 'emerald',
          },
          {
            label: 'Pending dispatch',
            value: k.pendingDispatch,
            sub: `${k.stagedBatches} ${k.stagedBatches === 1 ? 'batch' : 'batches'} staged`,
            icon: IconBuildingWarehouse,
            tone: 'blue',
            href: '/platform/admin/wms/dispatch',
          },
          {
            label: 'Agent alerts',
            value: k.agentAlerts,
            sub: k.agentAlerts > 0 ? `${k.agentAlerts} high priority` : 'No alerts',
            icon: IconBolt,
            tone: k.agentAlerts > 0 ? 'amber' : 'slate',
            href: '/platform/admin/agents',
          },
          {
            label: 'Overdue invoices',
            value: k.overdueInvoices,
            sub:
              k.overdueInvoices > 0
                ? money(k.overdueAmountUsd, k.overdueAmountAed)
                : 'All clear',
            icon: IconAlertTriangle,
            tone: k.overdueInvoices > 0 ? 'red' : 'emerald',
          },
        ];

        return (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map((tile) => {
              const tone = TONES[tile.tone];
              const TileIcon = tile.icon;
              const body = (
                <>
                  <span className={`mx-auto mb-1.5 flex size-7 items-center justify-center rounded-md ${tone.icon}`}>
                    <TileIcon size={15} />
                  </span>
                  <span className={`block text-2xl font-bold leading-tight tracking-tight tabular-nums ${tone.value}`}>
                    {tile.value}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-medium text-text-muted">{tile.label}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-text-muted/80">{tile.sub}</span>
                </>
              );
              const className = `block rounded-xl border bg-gradient-to-b to-transparent px-3 py-3.5 text-center shadow-sm transition ${tone.tile}`;

              return tile.href ? (
                <Link
                  key={tile.label}
                  href={tile.href}
                  className={`${className} hover:-translate-y-px hover:shadow-md`}
                >
                  {body}
                </Link>
              ) : (
                <div key={tile.label} className={className}>
                  {body}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Two-column layout ────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Agent Briefing — left 3 cols */}
        <div className="min-w-0 lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-6 py-4">
                <p className="text-[15px] font-bold">Intelligence Briefing</p>
                <Link
                  href="/platform/admin/agents"
                  className="text-[12px] font-medium text-text-muted transition-colors hover:text-text-primary"
                >
                  View all &rarr;
                </Link>
              </div>

              {data?.agentBriefs && data.agentBriefs.length > 0 ? (
                <div className="flex flex-col">
                  {data.agentBriefs.map((brief) => {
                    const config = agentConfig[brief.agentId] ?? agentConfig.scout;
                    return (
                      <Link
                        key={brief.agentId}
                        href="/platform/admin/agents"
                        className="group flex items-start gap-3.5 border-t border-border-muted px-6 py-4 transition-colors hover:bg-surface-secondary/50"
                      >
                        <div
                          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.bgColor}`}
                        >
                          <Icon icon={config.icon} size="sm" className={config.iconColor} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px]">
                            <span className="font-bold">{config.label}</span>
                            <span className="ml-1.5 font-semibold">&mdash; {brief.highlight}</span>
                          </p>
                          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-text-muted">
                            {brief.summary.length > 150
                              ? `${brief.summary.slice(0, 150)}...`
                              : brief.summary}
                          </p>
                          {brief.createdAt && (
                            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-text-muted/70">
                              <IconClock size={11} />
                              {formatRelativeTime(brief.createdAt)}
                            </p>
                          )}
                        </div>
                        <IconChevronRight
                          size={16}
                          className="mt-1 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="border-t border-border-muted px-6 py-10 text-center">
                  <p className="text-sm text-text-muted">
                    No briefs yet. Intelligence runs daily &mdash; check back soon.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — Recent Orders + Quick Actions */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <HomeTasksCard />

          {/* Recent Orders */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-6 py-4">
                <p className="text-[15px] font-bold">Recent Orders</p>
                <Link
                  href="/platform/admin/private-orders"
                  className="text-[12px] font-medium text-text-muted transition-colors hover:text-text-primary"
                >
                  All orders &rarr;
                </Link>
              </div>

              {data?.recentOrders && data.recentOrders.length > 0 ? (
                <div className="flex flex-col">
                  {data.recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={
                        order.source === 'pco'
                          ? `/platform/admin/private-orders/${order.id}`
                          : `/platform/admin/zoho-sales-orders`
                      }
                      className="group flex items-center gap-3 border-t border-border-muted px-6 py-3.5 transition-colors hover:bg-surface-secondary/50"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${getStatusColor(order.status)}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px]">
                          <span className="font-semibold">{order.orderNumber}</span>
                          <span className="ml-1.5 text-text-muted">&mdash; {order.customerName}</span>
                        </p>
                      </div>
                      <p className="shrink-0 tabular-nums text-[13px] font-bold">
                        {redacted ? '***' : formatCurrency(
                          currency === 'USD' ? order.totalUsd : order.totalAed,
                          currency,
                        )}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="border-t border-border-muted px-6 py-10 text-center">
                  <p className="text-sm text-text-muted">No recent orders</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4">
                <p className="text-[15px] font-bold">Quick Actions</p>
              </div>
              <div className="flex flex-wrap gap-2.5 border-t border-border-muted px-6 py-5">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary bg-surface-primary px-4 py-2.5 text-[13px] font-semibold transition-colors hover:border-text-muted hover:bg-surface-secondary/50"
                  >
                    <Icon icon={action.icon} size="sm" className="text-text-muted" />
                    {action.label}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MorningViewContent;
