'use client';

import {
  IconBinoculars,
  IconBolt,
  IconBuildingWarehouse,
  IconChartBar,
  IconClipboardCheck,
  IconFileText,
  IconPencil,
  IconPlus,
  IconSparkles,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

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
const formatAed = (amount: number) =>
  `AED ${amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount.toLocaleString()}`;

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

/** Skeleton pulse block */
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-fill-primary-hover ${className ?? ''}`} />
);

/** Agent icon + color config */
const agentConfig: Record<string, { icon: typeof IconBinoculars; bgColor: string; iconColor: string }> = {
  scout: { icon: IconBinoculars, bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600' },
  concierge: { icon: IconSparkles, bgColor: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600' },
  storyteller: { icon: IconPencil, bgColor: 'bg-violet-100 dark:bg-violet-900/30', iconColor: 'text-violet-600' },
};

/** Quick action definitions */
const quickActions = [
  { label: '+ New Order', href: '/platform/admin/private-orders/new', icon: IconPlus },
  { label: 'Create Quote', href: '/platform/quotes', icon: IconFileText },
  { label: 'Open WMS', href: '/platform/admin/wms', icon: IconBuildingWarehouse },
  { label: 'Logistics', href: '/platform/admin/logistics', icon: IconTruck },
  { label: 'Stock Check', href: '/platform/admin/wms/stock/check', icon: IconClipboardCheck },
  { label: 'Stock Explorer', href: '/platform/admin/stock-explorer', icon: IconChartBar },
  { label: 'Run Scout', href: '/platform/admin/agents', icon: IconBolt },
];

/**
 * Morning View dashboard content — KPIs, agent briefs, recent orders, quick actions
 */
const MorningViewContent = () => {
  const api = useTRPC();

  const { data: user } = useQuery({
    ...api.users.getMe.queryOptions(),
  });

  const { data, isLoading } = useQuery({
    ...api.morningView.get.queryOptions(),
    refetchInterval: 60_000,
  });

  const firstName = user?.firstName ?? user?.name?.split(' ')[0] ?? '';

  return (
    <div className="container space-y-6 py-6">
      {/* Greeting */}
      <div>
        <Typography variant="headingLg" className="font-bold">
          {getGreeting()}{firstName ? `, ${firstName}` : ''}
        </Typography>
        <Typography variant="bodySm" colorRole="muted">
          {formatDate()} — Here&apos;s what needs your attention today
        </Typography>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Open Orders */}
          <div className="rounded-xl border border-border-muted bg-white p-4 dark:bg-background-secondary">
            <Typography variant="bodyXs" className="font-semibold uppercase tracking-wider text-text-muted">
              Open Orders
            </Typography>
            <Typography variant="headingLg" className="mt-1">
              {data.kpis.openOrders}
            </Typography>
            {data.kpis.openOrdersThisWeek > 0 && (
              <Typography variant="bodyXs" className="mt-0.5 text-emerald-600">
                +{data.kpis.openOrdersThisWeek} this week
              </Typography>
            )}
          </div>

          {/* Revenue (Week) */}
          <div className="rounded-xl border border-border-muted bg-white p-4 dark:bg-background-secondary">
            <Typography variant="bodyXs" className="font-semibold uppercase tracking-wider text-text-muted">
              Revenue (Week)
            </Typography>
            <Typography variant="headingLg" className="mt-1 text-text-brand">
              {formatAed(data.kpis.revenueWeekAed)}
            </Typography>
            {data.kpis.revenueLastWeekAed > 0 ? (
              <Typography
                variant="bodyXs"
                className={`mt-0.5 ${
                  data.kpis.revenueWeekAed >= data.kpis.revenueLastWeekAed
                    ? 'text-emerald-600'
                    : 'text-red-600'
                }`}
              >
                {data.kpis.revenueWeekAed >= data.kpis.revenueLastWeekAed ? '+' : ''}
                {Math.round(
                  ((data.kpis.revenueWeekAed - data.kpis.revenueLastWeekAed) /
                    data.kpis.revenueLastWeekAed) *
                    100,
                )}
                % vs last week
              </Typography>
            ) : (
              <Typography variant="bodyXs" className="mt-0.5 text-text-muted">
                No data last week
              </Typography>
            )}
          </div>

          {/* Pending Dispatch */}
          <div className="rounded-xl border border-border-muted bg-white p-4 dark:bg-background-secondary">
            <Typography variant="bodyXs" className="font-semibold uppercase tracking-wider text-text-muted">
              Pending Dispatch
            </Typography>
            <Typography variant="headingLg" className="mt-1">
              {data.kpis.pendingDispatch}
            </Typography>
            <Typography variant="bodyXs" className="mt-0.5 text-text-muted">
              {data.kpis.stagedBatches} batches staged
            </Typography>
          </div>

          {/* Agent Alerts */}
          <div className="rounded-xl border border-border-muted bg-white p-4 dark:bg-background-secondary">
            <Typography variant="bodyXs" className="font-semibold uppercase tracking-wider text-text-muted">
              Agent Alerts
            </Typography>
            <Typography
              variant="headingLg"
              className={`mt-1 ${data.kpis.agentAlerts > 0 ? 'text-amber-600' : ''}`}
            >
              {data.kpis.agentAlerts}
            </Typography>
            <Typography variant="bodyXs" className="mt-0.5 text-text-muted">
              {data.kpis.agentAlerts > 0
                ? `${data.kpis.agentAlerts} high priority`
                : 'No alerts'}
            </Typography>
          </div>

          {/* Overdue Invoice */}
          <div className="rounded-xl border border-border-muted bg-white p-4 dark:bg-background-secondary">
            <Typography variant="bodyXs" className="font-semibold uppercase tracking-wider text-text-muted">
              Overdue Invoice
            </Typography>
            <Typography
              variant="headingLg"
              className={`mt-1 ${data.kpis.overdueInvoices > 0 ? 'text-red-600' : 'text-emerald-600'}`}
            >
              {data.kpis.overdueInvoices}
            </Typography>
            <Typography variant="bodyXs" className="mt-0.5 text-text-muted">
              {data.kpis.overdueInvoices > 0
                ? `USD ${data.kpis.overdueAmountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : 'All clear'}
            </Typography>
          </div>
        </div>
      ) : null}

      {/* Two-column layout: Agent Briefing + Recent Orders / Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Agent Briefing — left 3 cols */}
        <div className="space-y-3 lg:col-span-3">
          <div className="flex items-center justify-between">
            <Typography variant="bodyMd" className="font-semibold">
              Agent Briefing
            </Typography>
            <Link
              href="/platform/admin/agents"
              className="text-sm font-medium text-text-brand hover:underline"
            >
              View all agents →
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : data?.agentBriefs && data.agentBriefs.length > 0 ? (
            <div className="space-y-3">
              {data.agentBriefs.map((brief) => {
                const config = agentConfig[brief.agentId] ?? agentConfig.scout;
                return (
                  <div
                    key={brief.agentId}
                    className="flex items-start gap-4 rounded-xl border border-border-muted bg-white p-4 dark:bg-background-secondary"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}
                    >
                      <Icon icon={config.icon} size="md" className={config.iconColor} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Typography variant="bodySm" className="font-semibold">
                            The {brief.agentId.charAt(0).toUpperCase() + brief.agentId.slice(1)} — {brief.highlight}
                          </Typography>
                          <Typography variant="bodyXs" className="mt-1 line-clamp-2 text-text-muted">
                            {brief.summary.length > 150
                              ? `${brief.summary.slice(0, 150)}...`
                              : brief.summary}
                          </Typography>
                        </div>
                        <Link
                          href="/platform/admin/agents"
                          className="shrink-0 text-sm font-medium text-text-brand hover:underline"
                        >
                          View →
                        </Link>
                      </div>
                      {brief.createdAt && (
                        <Typography variant="bodyXs" className="mt-1.5 text-text-muted">
                          {formatRelativeTime(brief.createdAt)}
                        </Typography>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-border-muted bg-white p-6 text-center dark:bg-background-secondary">
              <Typography variant="bodySm" colorRole="muted">
                No briefs yet. Agents run daily — check back soon.
              </Typography>
            </div>
          )}
        </div>

        {/* Right column — Recent Orders + Quick Actions */}
        <div className="space-y-6 lg:col-span-2">
          {/* Recent Orders */}
          <div className="rounded-xl border border-border-muted bg-white dark:bg-background-secondary">
            <div className="flex items-center justify-between border-b border-border-muted px-4 py-3">
              <Typography variant="bodyMd" className="font-semibold">
                Recent Orders
              </Typography>
              <Link
                href="/platform/admin/private-orders"
                className="text-sm font-medium text-text-brand hover:underline"
              >
                All orders →
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : data?.recentOrders && data.recentOrders.length > 0 ? (
              <div className="divide-y divide-border-muted">
                {data.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={
                      order.source === 'pco'
                        ? `/platform/admin/private-orders/${order.id}`
                        : `/platform/admin/zoho-sales-orders`
                    }
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-fill-primary-hover"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${getStatusColor(order.status)}`} />
                    <div className="min-w-0 flex-1">
                      <Typography variant="bodyXs" className="truncate font-medium">
                        {order.orderNumber} — {order.customerName}
                      </Typography>
                    </div>
                    <Typography variant="bodyXs" className="shrink-0 font-semibold">
                      {order.totalAed
                        ? `AED ${order.totalAed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : 'Pending'}
                    </Typography>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <Typography variant="bodySm" colorRole="muted">
                  No recent orders
                </Typography>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-border-muted bg-white p-4 dark:bg-background-secondary">
            <Typography variant="bodyMd" className="mb-3 font-semibold">
              Quick Actions
            </Typography>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-1.5 rounded-lg border border-border-muted px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-fill-brand/30 hover:text-text-brand"
                >
                  <Icon icon={action.icon} size="sm" />
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MorningViewContent;
