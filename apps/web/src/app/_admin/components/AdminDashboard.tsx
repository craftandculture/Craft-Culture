'use client';

import {
  IconAlertTriangle,
  IconArrowRight,
  IconBarcode,
  IconBuilding,
  IconChevronRight,
  IconClock,
  IconFileCheck,
  IconPackage,
  IconPlus,
  IconShieldCheck,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';

import PrivateOrderStatusBadge from '../../_privateClientOrders/components/PrivateOrderStatusBadge';

type Currency = 'USD' | 'AED';

/** Default UAE exchange rate for AED/USD conversion */
const DEFAULT_EXCHANGE_RATE = 3.67;

/**
 * AdminDashboard displays an overview of all private client orders
 * with KPIs, status pipeline, and recent activity
 */
const AdminDashboard = () => {
  const trpcClient = useTRPCClient();
  const [currency, setCurrency] = useState<Currency>('USD');

  const { data, isLoading } = useQuery({
    queryKey: ['privateClientOrders.adminDashboard'],
    queryFn: () => trpcClient.privateClientOrders.adminDashboard.query(),
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
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

  const {
    kpis,
    attention,
    statusBreakdown,
    recentOrders,
    ordersByPartner,
    ordersNeedingStockUpdate,
  } = data;

  // Status pipeline steps for admin
  // The pipeline, in order: each stage is a group of statuses (PCO_STAGES)
  const stages = [
    { key: 'review', label: 'Review', color: 'bg-amber-400', dot: 'bg-amber-400' },
    { key: 'verification', label: 'Verification', color: 'bg-orange-400', dot: 'bg-orange-400' },
    { key: 'payment', label: 'Payment', color: 'bg-blue-500', dot: 'bg-blue-500' },
    { key: 'fulfilment', label: 'Fulfilment', color: 'bg-violet-500', dot: 'bg-violet-500' },
    { key: 'delivered', label: 'Delivered', color: 'bg-emerald-500', dot: 'bg-emerald-500' },
  ] as const;
  const pipelineTotal = stages.reduce((sum, st) => sum + data.stages[st.key].count, 0);


  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Header with Currency Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography variant="headingLg" className="font-bold">
            Private Client Orders
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Overview of all partner orders
          </Typography>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Link href="/platform/admin/private-orders/new">
          <Button size="sm" colorRole="brand" className="gap-1.5">
            <Icon icon={IconPlus} size="sm" />
            New order
          </Button>
        </Link>
        <Link href="/platform/admin/private-orders">
          <Button size="sm" variant="outline" className="gap-1.5">
            All orders ({kpis.totalOrders})
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

      {/* Stock Update Reminder Alert */}
      {ordersNeedingStockUpdate && ordersNeedingStockUpdate.length > 0 && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-500 dark:bg-amber-900/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-400 dark:bg-amber-500">
                <Icon
                  icon={IconAlertTriangle}
                  size="md"
                  className="text-amber-900 dark:text-amber-100"
                />
              </div>
              <div>
                <Typography variant="headingSm" className="font-semibold text-amber-900 dark:text-amber-100">
                  Stock Update Required
                </Typography>
                <Typography variant="bodySm" className="mt-0.5 text-amber-800 dark:text-amber-200">
                  {ordersNeedingStockUpdate.length} order{ordersNeedingStockUpdate.length !== 1 ? 's' : ''} in
                  fulfillment have items with pending stock status
                </Typography>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ordersNeedingStockUpdate.slice(0, 3).map((order) => (
                    <Link
                      key={order.orderId}
                      href={`/platform/admin/private-orders/${order.orderId}`}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-800/50 dark:text-amber-100 dark:hover:bg-amber-800/70"
                    >
                      {order.orderNumber}
                      <span className="rounded bg-amber-200 px-1 dark:bg-amber-700">
                        {order.pendingItemCount} item{order.pendingItemCount !== 1 ? 's' : ''}
                      </span>
                    </Link>
                  ))}
                  {ordersNeedingStockUpdate.length > 3 && (
                    <span className="inline-flex items-center px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
                      +{ordersNeedingStockUpdate.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Link href="/platform/admin/private-orders?stage=fulfilment">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full bg-amber-600 text-white hover:bg-amber-700 sm:w-auto"
                >
                  Update Stock Status
                  <Icon icon={IconArrowRight} size="sm" className="ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* What needs someone now — each count opens the list behind it */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          {
            label: 'Pending review',
            hint: 'Submitted by partners',
            count: statusBreakdown.pendingReview,
            href: '/platform/admin/private-orders?stage=review',
            icon: IconFileCheck,
          },
          {
            label: 'No distributor',
            hint: 'Approved, not assigned',
            count: attention.unassigned,
            href: '/platform/admin/private-orders?distributor=unassigned',
            icon: IconTruck,
          },
          {
            label: 'CD SKU missing',
            hint: 'Blocks payment',
            count: attention.skuMissing,
            href: '/platform/admin/private-orders?skuMissing=1',
            icon: IconBarcode,
          },
          {
            label: 'Verification stuck',
            hint: 'Suspended by distributor',
            count: attention.suspended,
            href: '/platform/admin/private-orders?status=verification_suspended',
            icon: IconShieldCheck,
          },
          {
            label: 'Drafts',
            hint: 'Not yet submitted',
            count: statusBreakdown.drafts,
            href: '/platform/admin/private-orders?status=draft',
            icon: IconClock,
            quiet: true,
          },
        ].map((item) => {
          const needsAction = item.count > 0 && !item.quiet;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`group flex flex-col gap-0.5 rounded-xl border px-4 py-3 transition-colors ${
                needsAction
                  ? 'border-fill-warning/50 bg-fill-warning/5 hover:bg-fill-warning/10'
                  : 'border-border-muted bg-fill-primary hover:bg-fill-muted/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wider">
                  {item.label}
                </Typography>
                <Icon
                  icon={item.icon}
                  size="sm"
                  className={needsAction ? 'text-fill-warning' : 'text-text-muted'}
                />
              </div>
              <Typography
                variant="headingMd"
                className={needsAction ? 'text-text-primary' : 'text-text-muted'}
              >
                {item.count}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="flex items-center gap-1">
                {item.count > 0 ? item.hint : 'All clear'}
                {item.count > 0 && (
                  <Icon
                    icon={IconChevronRight}
                    size="xs"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  />
                )}
              </Typography>
            </Link>
          );
        })}
      </div>

      {/* The book at a glance */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-border-muted bg-fill-primary px-5 py-3">
        {[
          { label: 'Active orders', value: String(kpis.totalOrders) },
          {
            label: 'Last 30 days',
            value: `${kpis.monthlyOrders} orders · ${kpis.monthlyCases} cases`,
          },
          {
            label: 'Value, last 30 days',
            value: formatCurrency(kpis.monthlyValueUsd, kpis.monthlyValueAed),
          },
          { label: 'Total value', value: formatCurrency(kpis.totalValueUsd, kpis.totalValueAed) },
          { label: 'Verified clients', value: String(kpis.verifiedClients) },
        ].map((stat) => (
          <div key={stat.label} className="flex items-baseline gap-2">
            <Typography variant="bodyXs" colorRole="muted">
              {stat.label}
            </Typography>
            <Typography variant="bodySm" className="font-semibold">
              {stat.value}
            </Typography>
          </div>
        ))}
      </div>

      {/* Pipeline: one bar, each stage's share of orders, then the stages */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <Typography variant="headingSm" className="font-semibold">
              Pipeline
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              {pipelineTotal} orders from review to delivery
            </Typography>
          </div>

          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-fill-muted">
            {stages.map((st) => {
              const count = data.stages[st.key].count;
              if (count === 0 || pipelineTotal === 0) return null;
              return (
                <Link
                  key={st.key}
                  href={`/platform/admin/private-orders?stage=${st.key}`}
                  className={`${st.color} h-full transition-opacity hover:opacity-80`}
                  style={{ width: `${(count / pipelineTotal) * 100}%` }}
                  title={`${st.label}: ${count}`}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {stages.map((st) => {
              const stage = data.stages[st.key];
              return (
                <Link
                  key={st.key}
                  href={`/platform/admin/private-orders?stage=${st.key}`}
                  className="group flex flex-col rounded-lg px-2 py-1.5 transition-colors hover:bg-fill-muted/50"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                    <Typography variant="bodyXs" colorRole="muted">
                      {st.label}
                    </Typography>
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <Typography variant="headingSm" className="font-semibold">
                      {stage.count}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="truncate">
                      {stage.count > 0 ? formatCurrency(stage.valueUsd, stage.valueAed) : ''}
                    </Typography>
                  </span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout for Recent Orders and Partners */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Recent Orders */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between">
              <Typography variant="headingSm" className="font-semibold">
                Recent Orders
              </Typography>
              <Link href="/platform/admin/private-orders">
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
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-muted">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/platform/admin/private-orders/${order.id}`}
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

        {/* Orders by Partner */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="mb-2">
              <Typography variant="headingSm" className="font-semibold">
                Orders by Partner
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                Distribution across wine partners
              </Typography>
            </div>

            {ordersByPartner.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <Icon icon={IconBuilding} size="lg" className="text-text-muted" />
                <Typography variant="bodySm" colorRole="muted">
                  No partner orders yet
                </Typography>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-muted">
                {ordersByPartner.map((partner) => {
                  // Share of the book by value, so the bar and the figure agree
                  const totalPartnerValue = ordersByPartner.reduce(
                    (sum, p) => sum + p.totalValueUsd,
                    0,
                  );
                  const percentage =
                    totalPartnerValue > 0
                      ? Math.round((partner.totalValueUsd / totalPartnerValue) * 100)
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
                              <Icon icon={IconBuilding} size="sm" className="text-text-muted" />
                            </div>
                          )}
                          <div>
                            <Typography variant="bodySm" className="font-medium">
                              {partner.partnerName}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {partner.orderCount} orders · {partner.activeCount} active
                            </Typography>
                          </div>
                        </div>
                        <Typography variant="bodySm" className="whitespace-nowrap font-medium">
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

    </div>
  );
};

export default AdminDashboard;
