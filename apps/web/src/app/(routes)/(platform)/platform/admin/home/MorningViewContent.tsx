'use client';

import {
  IconBinoculars,
  IconBolt,
  IconBrain,
  IconBuildingWarehouse,
  IconChevronRight,
  IconClock,
  IconCurrencyDollar,
  IconFileText,
  IconPencil,
  IconPlus,
  IconShoppingCart,
  IconSparkles,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

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

/** Format currency for display */
const formatCurrency = (amount: number | null | undefined, currency: Currency) => {
  const prefix = currency === 'USD' ? 'USD' : 'AED';
  const val = amount ?? 0;
  if (val >= 1000) {
    return `${prefix} ${(val / 1000).toFixed(1)}k`;
  }
  return `${prefix} ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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
          <Card className="lg:col-span-3">
            <CardContent className="h-80 animate-pulse p-6" />
          </Card>
          <div className="space-y-5 lg:col-span-2">
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
          <h1 className="text-[28px] font-bold tracking-tight">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {formatDate()} &mdash; Here&apos;s what needs your attention today
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-border-muted bg-surface-primary p-0.5">
          <button
            type="button"
            onClick={() => setCurrency('USD')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              currency === 'USD'
                ? 'bg-fill-brand text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            USD
          </button>
          <button
            type="button"
            onClick={() => setCurrency('AED')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              currency === 'AED'
                ? 'bg-fill-brand text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            AED
          </button>
        </div>
      </div>

      {/* ── KPI Cards — centered text ──────────── */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* PCO Orders */}
          <Card>
            <CardContent className="flex flex-col items-center px-4 py-5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Open Orders
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {data.kpis.openOrders}
              </p>
              <p className="mt-1.5 text-[12px] font-semibold">
                {data.kpis.openOrdersThisWeek > 0
                  ? <span className="text-emerald-600">+{data.kpis.openOrdersThisWeek} this week</span>
                  : <span className="font-normal text-text-muted">Active orders</span>}
              </p>
            </CardContent>
          </Card>

          {/* Invoiced (Month) */}
          <Card>
            <CardContent className="flex flex-col items-center px-4 py-5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Invoiced (Month)
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-text-brand">
                {formatCurrency(
                  currency === 'USD' ? data.kpis.revenueMonthUsd : data.kpis.revenueMonthAed,
                  currency,
                )}
              </p>
              <p className="mt-1.5 text-[12px] font-semibold">
                {(() => {
                  const current = currency === 'USD' ? data.kpis.revenueMonthUsd : data.kpis.revenueMonthAed;
                  const previous = currency === 'USD' ? data.kpis.revenueLastMonthUsd : data.kpis.revenueLastMonthAed;
                  if (previous > 0) {
                    const pct = Math.round(((current - previous) / previous) * 100);
                    return <span className={pct >= 0 ? 'text-emerald-600' : 'text-red-600'}>{pct >= 0 ? '+' : ''}{pct}% vs last month</span>;
                  }
                  return <span className="font-normal text-text-muted">No data last month</span>;
                })()}
              </p>
            </CardContent>
          </Card>

          {/* Invoiced (Year) */}
          <Card>
            <CardContent className="flex flex-col items-center px-4 py-5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Invoiced (Year)
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-text-brand">
                {formatCurrency(
                  currency === 'USD' ? data.kpis.revenueYearUsd : data.kpis.revenueYearAed,
                  currency,
                )}
              </p>
              <p className="mt-1.5 text-[12px] font-semibold">
                {(() => {
                  const current = currency === 'USD' ? data.kpis.revenueYearUsd : data.kpis.revenueYearAed;
                  const previous = currency === 'USD' ? data.kpis.revenueLastYearUsd : data.kpis.revenueLastYearAed;
                  if (previous > 0) {
                    const pct = Math.round(((current - previous) / previous) * 100);
                    return <span className={pct >= 0 ? 'text-emerald-600' : 'text-red-600'}>{pct >= 0 ? '+' : ''}{pct}% vs last year</span>;
                  }
                  return <span className="font-normal text-text-muted">No data last year</span>;
                })()}
              </p>
            </CardContent>
          </Card>

          {/* Pending Dispatch */}
          <Card>
            <CardContent className="flex flex-col items-center px-4 py-5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Pending Dispatch
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {data.kpis.pendingDispatch}
              </p>
              <p className="mt-1.5 text-[12px] text-text-muted">
                {data.kpis.stagedBatches} batches staged
              </p>
            </CardContent>
          </Card>

          {/* Agent Alerts */}
          <Card>
            <CardContent className="flex flex-col items-center px-4 py-5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Agent Alerts
              </p>
              <p className={`mt-2 text-3xl font-bold tracking-tight ${data.kpis.agentAlerts > 0 ? 'text-amber-600' : ''}`}>
                {data.kpis.agentAlerts}
              </p>
              <p className="mt-1.5 text-[12px] text-text-muted">
                {data.kpis.agentAlerts > 0
                  ? `${data.kpis.agentAlerts} high priority`
                  : 'No alerts'}
              </p>
            </CardContent>
          </Card>

          {/* Overdue Invoice */}
          <Card>
            <CardContent className="flex flex-col items-center px-4 py-5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Overdue Invoice
              </p>
              <p className={`mt-2 text-3xl font-bold tracking-tight ${data.kpis.overdueInvoices > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {data.kpis.overdueInvoices}
              </p>
              <p className="mt-1.5 text-[12px] text-text-muted">
                {data.kpis.overdueInvoices > 0
                  ? formatCurrency(
                      currency === 'USD' ? data.kpis.overdueAmountUsd : data.kpis.overdueAmountAed,
                      currency,
                    )
                  : 'All clear'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Two-column layout ────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Agent Briefing — left 3 cols */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-6 py-4">
                <p className="text-[15px] font-bold">Intelligence Briefing</p>
                <Link
                  href="/platform/admin/agents"
                  className="text-[12px] font-medium text-text-brand transition-opacity hover:opacity-80"
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
        <div className="space-y-5 lg:col-span-2">
          {/* Recent Orders */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-6 py-4">
                <p className="text-[15px] font-bold">Recent Orders</p>
                <Link
                  href="/platform/admin/private-orders"
                  className="text-[12px] font-medium text-text-brand transition-opacity hover:opacity-80"
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
                        {formatCurrency(
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
