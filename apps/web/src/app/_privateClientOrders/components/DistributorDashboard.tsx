'use client';

import {
  IconArrowRight,
  IconBook,
  IconBox,
  IconBuilding,
  IconBuildingStore,
  IconCalendar,
  IconCash,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconPackage,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Image from 'next/image';
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
 * DistributorDashboard displays an overview of assigned orders
 * with KPIs, status pipeline, and recent activity
 */
const DistributorDashboard = () => {
  const trpcClient = useTRPCClient();
  const [currency, setCurrency] = useState<Currency>('AED');

  const { data, isLoading } = useQuery({
    queryKey: ['privateClientOrders.distributorDashboard'],
    queryFn: () => trpcClient.privateClientOrders.distributorDashboard.query(),
  });

  /**
   * Format currency value, calculating AED from USD if AED is not available
   */
  const formatCurrency = (amountUsd: number, amountAed: number) => {
    let amount: number;
    if (currency === 'USD') {
      amount = amountUsd;
    } else {
      // Use AED if available, otherwise calculate from USD
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
   * Format order currency value, calculating AED from USD if needed
   */
  const formatOrderCurrency = (order: { totalUsd?: number | null; totalAed?: number | null }) => {
    const usdAmount = order.totalUsd ?? 0;
    const aedAmount = order.totalAed ?? 0;
    let amount: number;
    if (currency === 'USD') {
      amount = usdAmount;
    } else {
      // Use AED if available, otherwise calculate from USD
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

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Icon icon={IconPackage} size="xl" className="text-text-muted" />
        <Typography variant="bodySm" colorRole="muted">
          No data available
        </Typography>
      </div>
    );
  }

  const { kpis, statusBreakdown, recentOrders, ordersByPartner } = data;

  // Status pipeline steps
  const pipelineSteps = [
    {
      label: 'Pending Payment',
      count: statusBreakdown.pendingPayment,
      icon: IconClock,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      textColor: 'text-amber-700 dark:text-amber-300',
    },
    {
      label: 'In Transit',
      count: statusBreakdown.inTransit,
      icon: IconTruck,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-700 dark:text-blue-300',
    },
    {
      label: 'At Warehouse',
      count: statusBreakdown.atWarehouse,
      icon: IconBox,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      textColor: 'text-purple-700 dark:text-purple-300',
    },
    {
      label: 'Out for Delivery',
      count: statusBreakdown.inDelivery,
      icon: IconTruck,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      textColor: 'text-indigo-700 dark:text-indigo-300',
    },
    {
      label: 'Delivered',
      count: statusBreakdown.completed,
      icon: IconCheck,
      color: 'bg-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-700 dark:text-green-300',
    },
  ];

  const totalActive = pipelineSteps
    .slice(0, 4)
    .reduce((sum, step) => sum + step.count, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Currency Toggle */}
      <div className="flex items-center justify-end">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Active Orders */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="uppercase tracking-wider"
                >
                  Active Orders
                </Typography>
                <Typography
                  variant="headingLg"
                  className="mt-1"
                >
                  {totalActive}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  Awaiting delivery
                </Typography>
              </div>
              <div className="rounded-lg bg-fill-brand/10 p-2">
                <Icon icon={IconPackage} size="md" className="text-text-brand" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* This Month Orders */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="uppercase tracking-wider"
                >
                  This Month
                </Typography>
                <Typography
                  variant="headingLg"
                  className="mt-1 text-2xl font-bold sm:text-3xl"
                >
                  {kpis.monthlyOrders}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  {kpis.monthlyCases} cases
                </Typography>
              </div>
              <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <Icon
                  icon={IconCalendar}
                  size="md"
                  className="text-emerald-600 dark:text-emerald-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Cases */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="uppercase tracking-wider"
                >
                  Total Cases
                </Typography>
                <Typography
                  variant="headingLg"
                  className="mt-1 text-2xl font-bold sm:text-3xl"
                >
                  {kpis.totalCases}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  All time
                </Typography>
              </div>
              <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900/30">
                <Icon
                  icon={IconBox}
                  size="md"
                  className="text-violet-600 dark:text-violet-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Value */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="uppercase tracking-wider"
                >
                  Total Value
                </Typography>
                <Typography
                  variant="headingLg"
                  className="mt-1 text-xl font-bold sm:text-2xl"
                >
                  {formatCurrency(kpis.totalValueUsd, kpis.totalValueAed)}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  Monthly: {formatCurrency(kpis.monthlyValueUsd, kpis.monthlyValueAed)}
                </Typography>
              </div>
              <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                <Icon
                  icon={IconCash}
                  size="md"
                  className="text-amber-600 dark:text-amber-400"
                />
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
            <Link href="/platform/distributor/orders">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <Icon icon={IconArrowRight} size="sm" />
              </Button>
            </Link>
          </div>

          {/* Mobile: Stacked cards */}
          <div className="flex flex-col gap-2 sm:hidden">
            {pipelineSteps.map((step) => (
              <div
                key={step.label}
                className={`flex items-center justify-between rounded-lg p-3 ${step.bgColor}`}
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
            ))}
          </div>

          {/* Desktop: Horizontal pipeline */}
          <div className="hidden sm:block">
            <div className="flex items-center justify-between">
              {pipelineSteps.map((step, index) => (
                <div key={step.label} className="flex flex-1 items-center">
                  <div className="flex flex-1 flex-col items-center">
                    <div
                      className={`mb-2 flex h-12 w-12 items-center justify-center rounded-full ${step.color}`}
                    >
                      <Icon icon={step.icon} size="md" className="text-white" />
                    </div>
                    <Typography
                      variant="headingMd"
                      className="mb-0.5 text-xl font-bold"
                    >
                      {step.count}
                    </Typography>
                    <Typography
                      variant="bodyXs"
                      colorRole="muted"
                      className="text-center"
                    >
                      {step.label}
                    </Typography>
                  </div>
                  {index < pipelineSteps.length - 1 && (
                    <Icon
                      icon={IconChevronRight}
                      size="md"
                      className="mx-2 flex-shrink-0 text-text-muted"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout for Recent Orders and Partners */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <Typography variant="headingSm" className="font-semibold">
                Recent Orders
              </Typography>
              <Link href="/platform/distributor/orders">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <Icon icon={IconArrowRight} size="sm" />
                </Button>
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <Icon icon={IconPackage} size="lg" className="text-text-muted" />
                <Typography variant="bodySm" colorRole="muted">
                  No orders assigned yet
                </Typography>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-muted">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/platform/distributor/orders/${order.id}`}
                    className="group flex items-center gap-3 py-3 transition-colors hover:bg-surface-secondary/50 sm:gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Typography
                          variant="bodySm"
                          className="font-mono font-medium"
                        >
                          {order.orderNumber}
                        </Typography>
                        <PrivateOrderStatusBadge
                          status={order.status}
                          size="sm"
                        />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-text-muted">
                        <Typography variant="bodyXs">{order.clientName}</Typography>
                        <span className="hidden sm:inline">·</span>
                        <div className="hidden items-center gap-1 sm:flex">
                          {order.partner?.logoUrl ? (
                            <Image
                              src={order.partner.logoUrl}
                              alt={order.partner?.businessName ?? 'Partner'}
                              width={16}
                              height={16}
                              className="h-4 w-4 rounded object-contain"
                            />
                          ) : null}
                          <Typography variant="bodyXs">
                            {order.partner?.businessName ?? 'Unknown'}
                          </Typography>
                        </div>
                        <span className="hidden sm:inline">·</span>
                        <Typography variant="bodyXs">
                          {order.caseCount} cases
                        </Typography>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Typography
                        variant="bodySm"
                        className="font-medium whitespace-nowrap"
                      >
                        {formatOrderCurrency(order)}
                      </Typography>
                      {order.distributorAssignedAt && (
                        <Typography variant="bodyXs" colorRole="muted">
                          {format(
                            new Date(order.distributorAssignedAt),
                            'MMM d',
                          )}
                        </Typography>
                      )}
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

        {/* Orders by Partner */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4">
              <Typography variant="headingSm" className="font-semibold">
                Orders by Partner
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                Distribution across wine partners
              </Typography>
            </div>

            {ordersByPartner.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <Icon
                  icon={IconBuildingStore}
                  size="lg"
                  className="text-text-muted"
                />
                <Typography variant="bodySm" colorRole="muted">
                  No partner orders yet
                </Typography>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-muted">
                {ordersByPartner.map((partner) => {
                  const percentage =
                    kpis.totalOrders > 0
                      ? Math.round((partner.orderCount / kpis.totalOrders) * 100)
                      : 0;

                  return (
                    <div key={partner.partnerId} className="py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {partner.partnerLogoUrl ? (
                            <Image
                              src={partner.partnerLogoUrl}
                              alt={partner.partnerName}
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded-lg object-contain"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-secondary">
                              <Icon
                                icon={IconBuilding}
                                size="sm"
                                className="text-text-muted"
                              />
                            </div>
                          )}
                          <div>
                            <Typography variant="bodySm" className="font-medium">
                              {partner.partnerName}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {partner.orderCount} orders · {partner.totalCases}{' '}
                              cases
                            </Typography>
                          </div>
                        </div>
                        <Typography
                          variant="bodySm"
                          className="font-medium whitespace-nowrap"
                        >
                          {formatCurrency(partner.totalValueUsd, partner.totalValueAed)}
                        </Typography>
                      </div>
                      <div className="relative h-2 overflow-hidden rounded-full bg-surface-secondary">
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

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <Typography variant="headingSm" className="mb-4 font-semibold">
            Quick Actions
          </Typography>
          <div className="flex flex-wrap gap-3">
            <Link href="/platform/distributor/orders?status=with_distributor">
              <Button variant="outline" className="gap-2">
                <Icon icon={IconBox} size="sm" />
                Ready for Delivery ({statusBreakdown.atWarehouse})
              </Button>
            </Link>
            <Link href="/platform/distributor/orders?status=out_for_delivery">
              <Button variant="outline" className="gap-2">
                <Icon icon={IconTruck} size="sm" />
                Out for Delivery ({statusBreakdown.inDelivery})
              </Button>
            </Link>
            <Link href="/platform/distributor/orders">
              <Button variant="outline" className="gap-2">
                <Icon icon={IconPackage} size="sm" />
                All Orders ({kpis.totalOrders})
              </Button>
            </Link>
            <Link href="/docs/pco-flows">
              <Button variant="outline" className="gap-2 border-border-brand text-text-brand hover:bg-fill-brand/5">
                <Icon icon={IconBook} size="sm" />
                Process Guide
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DistributorDashboard;
