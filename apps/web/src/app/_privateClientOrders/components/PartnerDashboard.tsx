'use client';

import {
  IconArrowRight,
  IconBox,
  IconCalendar,
  IconCash,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFileCheck,
  IconPackage,
  IconPlus,
  IconShieldCheck,
  IconTruck,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';

import PrivateOrderStatusBadge from './PrivateOrderStatusBadge';

type Currency = 'USD' | 'AED';

/** Default UAE exchange rate for AED/USD conversion */
const DEFAULT_EXCHANGE_RATE = 3.67;

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
  const formatCurrency = (amountUsd: number, amountAed: number) => {
    let amount: number;
    if (currency === 'USD') {
      amount = amountUsd;
    } else {
      amount = amountAed > 0 ? amountAed : amountUsd * DEFAULT_EXCHANGE_RATE;
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
    const aedAmount = order.totalAed ?? 0;
    let amount: number;
    if (currency === 'USD') {
      amount = usdAmount;
    } else {
      amount = aedAmount > 0 ? aedAmount : usdAmount * DEFAULT_EXCHANGE_RATE;
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
        <div className="animate-pulse text-text-muted">Loading dashboard...</div>
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
          {isRefetching ? 'Loading...' : 'Try Again'}
        </Button>
      </div>
    );
  }

  const { kpis, statusBreakdown, recentOrders, topClients } = data;

  // Status pipeline steps for partners
  const pipelineSteps = [
    {
      label: 'Drafts',
      count: statusBreakdown.drafts,
      icon: IconFileCheck,
      color: 'bg-slate-400',
      bgColor: 'bg-slate-50 dark:bg-slate-900/20',
      textColor: 'text-slate-700 dark:text-slate-300',
      href: '/platform/private-orders/orders?status=draft',
    },
    {
      label: 'Pending',
      count: statusBreakdown.pendingApproval,
      icon: IconClock,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      textColor: 'text-amber-700 dark:text-amber-300',
      href: '/platform/private-orders/orders?status=pending',
    },
    {
      label: 'Verification',
      count: statusBreakdown.awaitingVerification,
      icon: IconShieldCheck,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      textColor: 'text-orange-700 dark:text-orange-300',
      href: '/platform/private-orders/orders?status=verification',
    },
    {
      label: 'Payment',
      count: statusBreakdown.awaitingPayment,
      icon: IconCash,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-700 dark:text-blue-300',
      href: '/platform/private-orders/orders?status=payment',
    },
    {
      label: 'Fulfillment',
      count: statusBreakdown.inFulfillment,
      icon: IconTruck,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      textColor: 'text-purple-700 dark:text-purple-300',
      href: '/platform/private-orders/orders?status=fulfillment',
    },
    {
      label: 'Delivered',
      count: statusBreakdown.completed,
      icon: IconCheck,
      color: 'bg-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-700 dark:text-green-300',
      href: '/platform/private-orders/orders?status=delivered',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header with New Order Button and Currency Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography variant="headingLg" className="font-bold">
            Dashboard
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Overview of your private client orders
          </Typography>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/platform/private-orders/new">
            <Button className="gap-2">
              <Icon icon={IconPlus} size="sm" />
              New Order
            </Button>
          </Link>
          <div className="inline-flex items-center rounded-lg border border-border-muted bg-surface-secondary/50 p-0.5">
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                currency === 'USD'
                  ? 'bg-background-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              USD
            </button>
            <button
              type="button"
              onClick={() => setCurrency('AED')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                currency === 'AED'
                  ? 'bg-background-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              AED
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {/* Active Orders */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="uppercase tracking-wider"
                >
                  Active Orders
                </Typography>
                <Typography variant="headingLg" className="mt-1">
                  {kpis.totalOrders}
                </Typography>
              </div>
              <div className="rounded-lg bg-fill-brand/10 p-2">
                <Icon icon={IconPackage} size="sm" className="text-text-brand" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* This Month */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="uppercase tracking-wider"
                >
                  This Month
                </Typography>
                <Typography variant="headingLg" className="mt-1">
                  {kpis.monthlyOrders}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {kpis.monthlyCases} cases
                </Typography>
              </div>
              <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <Icon
                  icon={IconCalendar}
                  size="sm"
                  className="text-emerald-600 dark:text-emerald-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Cases */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="uppercase tracking-wider"
                >
                  Total Cases
                </Typography>
                <Typography variant="headingLg" className="mt-1">
                  {kpis.totalCases}
                </Typography>
              </div>
              <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900/30">
                <Icon icon={IconBox} size="sm" className="text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clients */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="uppercase tracking-wider"
                >
                  Clients
                </Typography>
                <Typography variant="headingLg" className="mt-1">
                  {kpis.totalClients}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {kpis.verifiedClients} verified
                </Typography>
              </div>
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <Icon icon={IconUsers} size="sm" className="text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Value */}
        <Card className="relative overflow-hidden col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="uppercase tracking-wider"
                >
                  Total Value
                </Typography>
                <Typography variant="headingMd" className="mt-1">
                  {formatCurrency(kpis.totalValueUsd, kpis.totalValueAed)}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Monthly: {formatCurrency(kpis.monthlyValueUsd, kpis.monthlyValueAed)}
                </Typography>
              </div>
              <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                <Icon icon={IconCash} size="sm" className="text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Pipeline */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <Typography variant="headingSm" className="font-semibold">
              Order Pipeline
            </Typography>
            <Link href="/platform/private-orders/orders">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <Icon icon={IconArrowRight} size="sm" />
              </Button>
            </Link>
          </div>

          {/* Mobile: Stacked cards */}
          <div className="flex flex-col gap-2 sm:hidden">
            {pipelineSteps.map((step) => (
              <Link key={step.label} href={step.href}>
                <div
                  className={`flex items-center justify-between rounded-lg p-3 ${step.bgColor} transition-opacity hover:opacity-80`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-1.5 ${step.color}`}>
                      <Icon icon={step.icon} size="sm" className="text-white" />
                    </div>
                    <Typography variant="bodySm" className={step.textColor}>
                      {step.label}
                    </Typography>
                  </div>
                  <Badge colorRole="muted" size="sm" className="font-semibold">
                    {step.count}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: Horizontal pipeline */}
          <div className="hidden sm:block">
            <div className="flex items-center justify-between">
              {pipelineSteps.map((step, index) => (
                <div key={step.label} className="flex flex-1 items-center">
                  <Link href={step.href} className="group flex flex-1 flex-col items-center">
                    <div
                      className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${step.color} transition-transform group-hover:scale-110`}
                    >
                      <Icon icon={step.icon} size="sm" className="text-white" />
                    </div>
                    <Typography variant="headingMd" className="mb-0.5 font-bold">
                      {step.count}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="text-center">
                      {step.label}
                    </Typography>
                  </Link>
                  {index < pipelineSteps.length - 1 && (
                    <Icon
                      icon={IconChevronRight}
                      size="md"
                      className="mx-1 flex-shrink-0 text-text-muted"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout for Recent Orders and Top Clients */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <Typography variant="headingSm" className="font-semibold">
                Recent Orders
              </Typography>
              <Link href="/platform/private-orders/orders">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <Icon icon={IconArrowRight} size="sm" />
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
                    Create First Order
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-muted">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/platform/private-orders/${order.id}`}
                    className="group flex items-center gap-3 py-3 transition-colors hover:bg-surface-secondary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Typography variant="bodySm" className="font-mono font-medium">
                          {order.orderNumber}
                        </Typography>
                        <PrivateOrderStatusBadge status={order.status} size="sm" />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-text-muted">
                        <Typography variant="bodyXs">{order.clientName}</Typography>
                        {order.client?.cityDrinksVerifiedAt && (
                          <span
                            className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400"
                            title="City Drinks Verified"
                          >
                            <Icon icon={IconShieldCheck} size="xs" />
                          </span>
                        )}
                        <span className="hidden sm:inline">·</span>
                        <Typography variant="bodyXs" className="hidden sm:inline">
                          {order.caseCount} cases
                        </Typography>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Typography variant="bodySm" className="whitespace-nowrap font-medium">
                        {formatOrderCurrency(order)}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {format(new Date(order.createdAt), 'MMM d')}
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

        {/* Top Clients */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4">
              <Typography variant="headingSm" className="font-semibold">
                Top Clients
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                Your most active customers
              </Typography>
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
                  const percentage =
                    kpis.totalOrders > 0
                      ? Math.round((client.orderCount / kpis.totalOrders) * 100)
                      : 0;

                  return (
                    <div key={client.clientId ?? client.clientName} className="py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary">
                            <Icon icon={IconUser} size="sm" className="text-text-muted" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Typography
                                variant="bodySm"
                                className="truncate font-medium"
                              >
                                {client.clientName}
                              </Typography>
                              {client.isVerified && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  title="City Drinks Verified"
                                >
                                  <Icon icon={IconShieldCheck} size="xs" />
                                  <span className="text-[10px] font-medium">Verified</span>
                                </span>
                              )}
                            </div>
                            <Typography variant="bodyXs" colorRole="muted">
                              {client.orderCount} orders · {client.totalCases} cases
                            </Typography>
                          </div>
                        </div>
                        <Typography variant="bodySm" className="whitespace-nowrap font-medium">
                          {formatCurrency(client.totalValueUsd, client.totalValueAed)}
                        </Typography>
                      </div>
                      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-fill-brand transition-all"
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

      {/* Quick Links - Compact inline actions */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <Link
          href="/platform/private-orders/orders?status=draft"
          className="flex items-center gap-1.5 rounded-full border border-border-muted bg-surface-secondary/50 px-3 py-1.5 text-text-muted transition-colors hover:bg-surface-secondary hover:text-text-primary"
        >
          <Icon icon={IconFileCheck} size="xs" />
          <span>{statusBreakdown.drafts} Drafts</span>
        </Link>
        <Link
          href="/platform/private-orders/orders"
          className="flex items-center gap-1.5 rounded-full border border-border-muted bg-surface-secondary/50 px-3 py-1.5 text-text-muted transition-colors hover:bg-surface-secondary hover:text-text-primary"
        >
          <Icon icon={IconPackage} size="xs" />
          <span>All Orders</span>
        </Link>
        <Link
          href="/platform/clients"
          className="flex items-center gap-1.5 rounded-full border border-border-muted bg-surface-secondary/50 px-3 py-1.5 text-text-muted transition-colors hover:bg-surface-secondary hover:text-text-primary"
        >
          <Icon icon={IconUsers} size="xs" />
          <span>Manage Clients</span>
        </Link>
      </div>
    </div>
  );
};

export default PartnerDashboard;
