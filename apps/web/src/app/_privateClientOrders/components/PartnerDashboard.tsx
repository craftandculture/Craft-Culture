'use client';

import {
  IconAlertCircle,
  IconArrowRight,
  IconBook,
  IconCalendar,
  IconChevronRight,
  IconCurrencyDollar,
  IconPackage,
  IconPlus,
  IconShieldCheck,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import USD_TO_AED from '@/lib/currency/usdToAed';
import { useTRPCClient } from '@/lib/trpc/browser';

import PrivateOrderStatusBadge from './PrivateOrderStatusBadge';

type Currency = 'USD' | 'AED';

/** Statuses that wait on the partner: send a draft, accept changes, confirm or re-verify the client */
const NEEDS_PARTNER_ACTION = [
  'draft',
  'revision_requested',
  'awaiting_partner_verification',
  'verification_suspended',
];

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
} as const;

/**
 * PartnerDashboard displays an overview of orders for wine partners
 * with KPIs, status pipeline, recent orders, and top clients
 */
const PartnerDashboard = () => {
  const trpcClient = useTRPCClient();
  const [currency, setCurrency] = useState<Currency>('USD');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['privateClientOrders.partnerDashboard'],
    queryFn: () => trpcClient.privateClientOrders.partnerDashboard.query(),
    refetchInterval: 30000,
    retry: 5,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
    staleTime: 0,
  });

  /**
   * Format currency value, calculating AED from USD if AED is not available
   */
  const formatCurrency = (amountUsd: number, _amountAed?: number) => {
    let amount: number;
    if (currency === 'USD') {
      amount = amountUsd;
    } else {
      amount = amountUsd * USD_TO_AED;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Format order currency value
   */
  const formatOrderCurrency = (order: {
    totalUsd?: number | null;
    totalAed?: number | null;
  }) => {
    const usdAmount = order.totalUsd ?? 0;
    let amount: number;
    if (currency === 'USD') {
      amount = usdAmount;
    } else {
      amount = usdAmount * USD_TO_AED;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-text-muted">Loading your orders...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Icon icon={IconPackage} size="xl" className="text-text-muted" />
        <Typography variant="bodySm" colorRole="muted">
          Unable to load dashboard data
        </Typography>
        <Button
          size="sm"
          colorRole="muted"
          onClick={() => refetch()}
          isDisabled={isRefetching}
        >
          {isRefetching ? 'Loading...' : 'Try again'}
        </Button>
      </div>
    );
  }

  const { kpis, statusBreakdown, statusCounts, recentOrders, topClients } = data;

  // Orders waiting on the partner, whichever pipeline stage they sit in
  const needsAction = statusCounts
    .filter((s) => NEEDS_PARTNER_ACTION.includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);

  const ORDERS = '/platform/private-orders/orders';

  /*
    The live pipeline, laid out as the distributor and admin dashboards are.
    `yours` marks the stages waiting on the partner, which turn amber when
    something is in them. Delivered is shown apart: it is the finish line.
  */
  const stages = [
    { key: 'drafts', label: 'Drafts', owner: 'You', count: statusBreakdown.drafts, dot: 'bg-slate-400', href: `${ORDERS}?status=draft`, yours: true },
    { key: 'pending', label: 'C&C review', owner: 'C&C', count: statusBreakdown.pendingApproval, dot: 'bg-amber-400', href: `${ORDERS}?status=pending`, yours: false },
    { key: 'verification', label: 'Verification', owner: 'You · distributor', count: statusBreakdown.awaitingVerification, dot: 'bg-orange-400', href: `${ORDERS}?status=verification`, yours: true },
    { key: 'payment', label: 'Payment', owner: 'Client', count: statusBreakdown.awaitingPayment, dot: 'bg-blue-500', href: `${ORDERS}?status=payment`, yours: false },
    { key: 'fulfilment', label: 'Fulfilment', owner: 'C&C · distributor', count: statusBreakdown.inFulfillment, dot: 'bg-violet-500', href: `${ORDERS}?status=fulfillment`, yours: false },
  ];
  const inFlight = stages.reduce((sum, stage) => sum + stage.count, 0);
  const totalClientValue = topClients.reduce((sum, client) => sum + client.totalValueUsd, 0);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography variant="headingLg" className="font-bold">
            Private Client Orders
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Orders you raise for your clients
          </Typography>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/platform/private-orders/new">
            <Button size="sm" colorRole="brand" className="gap-1.5">
              <Icon icon={IconPlus} size="sm" />
              New order
            </Button>
          </Link>
          <Link href={ORDERS}>
            <Button size="sm" variant="outline" className="gap-1.5">
              All orders
            </Button>
          </Link>
          <Link href="/docs/pco-flows">
            <Button size="sm" variant="ghost" className="gap-1.5">
              <Icon icon={IconBook} size="sm" />
              Process guide
            </Button>
          </Link>
          <div
            role="group"
            aria-label="Display currency"
            className="inline-flex items-center rounded-lg border border-border-muted bg-surface-secondary/50 p-0.5"
          >
            {(['USD', 'AED'] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={currency === c}
                onClick={() => setCurrency(c)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  currency === c
                    ? 'bg-background-primary text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/*
        The book at a glance, waiting-on-you first. The stored case count adds
        single bottles to cases, so it is shown as units, not "cases".
      */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            label: 'Needs your action',
            value: String(needsAction),
            sub: needsAction > 0 ? 'Open the list' : 'Nothing waiting on you',
            tone: needsAction > 0 ? TONES.amber : TONES.slate,
            icon: IconAlertCircle,
            href: needsAction > 0 ? `${ORDERS}?status=action` : undefined,
          },
          {
            label: 'Active orders',
            value: String(kpis.totalOrders),
            sub: `${inFlight} in progress`,
            tone: TONES.slate,
            icon: IconPackage,
            href: ORDERS,
          },
          {
            label: 'Value in progress',
            value: formatCurrency(kpis.totalValueUsd, kpis.totalValueAed),
            sub: 'Client price, active orders',
            tone: TONES.blue,
            icon: IconCurrencyDollar,
          },
          {
            label: 'Last 30 days',
            value: formatCurrency(kpis.monthlyValueUsd, kpis.monthlyValueAed),
            sub: `${kpis.monthlyOrders} ${kpis.monthlyOrders === 1 ? 'order' : 'orders'} · ${kpis.monthlyCases} ${kpis.monthlyCases === 1 ? 'unit' : 'units'}`,
            tone: TONES.emerald,
            icon: IconCalendar,
          },
          {
            label: 'Clients',
            value: String(kpis.totalClients),
            sub: `${kpis.verifiedClients} verified`,
            tone: TONES.slate,
            icon: IconUsers,
            href: '/platform/clients',
          },
        ].map((tile) => {
          const body = (
            <>
              <span className={`mx-auto mb-1.5 flex size-7 items-center justify-center rounded-md ${tile.tone.icon}`}>
                <Icon icon={tile.icon} size="sm" />
              </span>
              <span className="block text-[11px] font-medium uppercase tracking-wide text-text-muted">
                {tile.label}
              </span>
              <span
                className={`mt-1 block truncate text-[22px] font-bold leading-tight tracking-tight tabular-nums sm:text-[26px] ${tile.tone.value}`}
              >
                {tile.value}
              </span>
              <span className="mt-1.5 block truncate text-[11px] font-semibold text-text-muted/80">{tile.sub}</span>
            </>
          );
          const className = `block min-w-0 rounded-xl border bg-gradient-to-b to-transparent px-3 py-3.5 text-center shadow-sm transition ${tile.tone.tile}`;
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className={`${className} hover:-translate-y-px hover:shadow-md`}>
              {body}
            </Link>
          ) : (
            <div key={tile.label} className={className}>
              {body}
            </div>
          );
        })}
      </div>

      {/* Pipeline: where live orders are, and which are waiting on you */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <Typography variant="headingSm" className="font-semibold">
                Pipeline
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                {inFlight} in progress
              </Typography>
            </div>
            <Link
              href={`${ORDERS}?status=delivered`}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {statusBreakdown.completed} delivered
              <Icon icon={IconChevronRight} size="xs" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {stages.map((stage, index) => {
              const share = inFlight > 0 ? (stage.count / inFlight) * 100 : 0;
              const needsYou = stage.yours && stage.count > 0;
              return (
                <div key={stage.key} className="relative">
                  <Link
                    href={stage.href}
                    className={`flex h-full flex-col gap-2 rounded-lg border p-3 transition-colors ${
                      needsYou
                        ? 'border-fill-warning/50 bg-fill-warning/5 hover:bg-fill-warning/10'
                        : 'border-border-muted hover:border-border-primary hover:bg-fill-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${stage.dot}`} />
                        <Typography variant="bodySm" className="font-medium">
                          {stage.label}
                        </Typography>
                      </span>
                      <Typography variant="bodyXs" colorRole="muted" className="hidden truncate sm:block">
                        {stage.owner}
                      </Typography>
                    </div>
                    <Typography
                      variant="headingMd"
                      className={`font-semibold tabular-nums ${stage.count === 0 ? 'text-text-muted' : ''}`}
                    >
                      {stage.count}
                    </Typography>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-fill-muted">
                      <div className={`h-full ${stage.dot}`} style={{ width: `${share}%` }} />
                    </div>
                    <Typography variant="bodyXs" colorRole="muted">
                      {stage.count === 0 ? 'Empty' : needsYou ? 'Waiting on you' : `With ${stage.owner}`}
                    </Typography>
                  </Link>
                  {index < stages.length - 1 && (
                    <Icon
                      icon={IconChevronRight}
                      size="xs"
                      className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-fill-primary text-text-muted lg:block"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent orders and clients */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between">
              <Typography variant="headingSm" className="font-semibold">
                Recent orders
              </Typography>
              <Link href={ORDERS}>
                <Button variant="ghost" size="sm" className="gap-1">
                  View all <Icon icon={IconArrowRight} size="sm" />
                </Button>
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <Icon icon={IconPackage} size="lg" className="text-text-muted" />
                <Typography variant="bodySm" colorRole="muted">
                  No orders yet
                </Typography>
                <Link href="/platform/private-orders/new">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Icon icon={IconPlus} size="sm" />
                    Create your first order
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-muted">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/platform/private-orders/${order.id}`}
                    className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-secondary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Typography variant="bodySm" className="font-mono font-medium">
                          {order.orderNumber}
                        </Typography>
                        <PrivateOrderStatusBadge status={order.status} size="sm" />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-text-muted">
                        <Typography variant="bodyXs">{order.clientName}</Typography>
                        {order.client?.cityDrinksVerifiedAt && (
                          <span
                            title="Client verified with the distributor"
                            aria-label="Client verified"
                            className="inline-flex text-emerald-600 dark:text-emerald-400"
                          >
                            <Icon icon={IconShieldCheck} size="xs" />
                          </span>
                        )}
                        <span className="hidden sm:inline">·</span>
                        <Typography variant="bodyXs" className="hidden sm:inline">
                          {order.caseCount} {order.caseCount === 1 ? 'unit' : 'units'}
                        </Typography>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Typography variant="bodySm" className="whitespace-nowrap font-medium tabular-nums">
                        {formatOrderCurrency(order)}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {format(new Date(order.createdAt), 'd MMM')}
                      </Typography>
                    </div>
                    <Icon
                      icon={IconChevronRight}
                      size="sm"
                      className="flex-shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <Typography variant="headingSm" className="font-semibold">
                  Top clients
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  Share of client value, excluding drafts and cancelled orders
                </Typography>
              </div>
              <Link href="/platform/clients">
                <Button variant="ghost" size="sm" className="gap-1">
                  Clients <Icon icon={IconArrowRight} size="sm" />
                </Button>
              </Link>
            </div>

            {topClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <Icon icon={IconUsers} size="lg" className="text-text-muted" />
                <Typography variant="bodySm" colorRole="muted">
                  No client orders yet
                </Typography>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-muted">
                {topClients.map((client) => {
                  // Share of the book by value, so the bar and the figure agree
                  const percentage =
                    totalClientValue > 0
                      ? Math.round((client.totalValueUsd / totalClientValue) * 100)
                      : 0;
                  return (
                    <div key={client.clientId ?? client.clientName} className="py-2.5">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Typography variant="bodySm" className="truncate font-medium">
                              {client.clientName}
                            </Typography>
                            {client.isVerified && (
                              <span title="Client verified with the distributor" aria-label="Client verified" className="inline-flex text-emerald-600 dark:text-emerald-400">
                                <Icon icon={IconShieldCheck} size="xs" />
                              </span>
                            )}
                          </div>
                          <Typography variant="bodyXs" colorRole="muted">
                            {client.orderCount} {client.orderCount === 1 ? 'order' : 'orders'} · {client.totalCases}{' '}
                            {client.totalCases === 1 ? 'unit' : 'units'}
                          </Typography>
                        </div>
                        <Typography variant="bodySm" className="whitespace-nowrap font-medium tabular-nums">
                          {formatCurrency(client.totalValueUsd, client.totalValueAed)}
                        </Typography>
                      </div>
                      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-text-primary/70 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PartnerDashboard;
