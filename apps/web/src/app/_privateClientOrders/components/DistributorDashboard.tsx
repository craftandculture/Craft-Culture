'use client';

import {
  IconArrowRight,
  IconBarcode,
  IconBook,
  IconCash,
  IconChevronRight,
  IconPackage,
  IconReceipt,
  IconShieldCheck,
  IconTruck,
  IconTruckDelivery,
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
import USD_TO_AED from '@/lib/currency/usdToAed';
import { useTRPCClient } from '@/lib/trpc/browser';

import PrivateOrderStatusBadge from './PrivateOrderStatusBadge';
import { DISTRIBUTOR_QUEUES } from '../constants';

type Currency = 'USD' | 'AED';

/** Default UAE exchange rate for AED/USD conversion */

const ORDERS = '/platform/distributor/orders';

/**
 * The distributor's dashboard, action first
 *
 * What is waiting on the distributor comes first, one tile per task, amber
 * when there is work and "All clear" when there is none; each opens the list
 * of exactly those orders. Then the book in one line, and a pipeline showing
 * where orders are and whether they are moving. Same layout as the C&C admin
 * dashboard, so both sides read an order the same way.
 */
const DistributorDashboard = () => {
  const trpcClient = useTRPCClient();
  const [currency, setCurrency] = useState<Currency>('AED');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['privateClientOrders.distributorDashboard'],
    queryFn: () => trpcClient.privateClientOrders.distributorDashboard.query(),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const formatCurrency = (amountUsd: number, _amountAed?: number) => {
    const amount =
      currency === 'USD'
        ? amountUsd
        : amountUsd * USD_TO_AED;
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
    // A failed load used to read "No data available", as if there were no orders
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Icon icon={IconPackage} size="xl" className="text-text-muted" />
        <Typography variant="bodySm" colorRole="muted">
          {isError ? 'The dashboard could not be loaded.' : 'No data available'}
        </Typography>
        {isError && (
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  const { kpis, queues, stages: stageData, recentOrders } = data;

  const tasks = [
    { key: 'verify', icon: IconShieldCheck },
    { key: 'clientPayment', icon: IconReceipt },
    { key: 'payCc', icon: IconCash },
    { key: 'receive', icon: IconTruck },
    { key: 'deliver', icon: IconTruckDelivery },
  ] as const;

  const tiles = [
    ...tasks.map((t) => ({
      label: DISTRIBUTOR_QUEUES[t.key].label,
      hint: DISTRIBUTOR_QUEUES[t.key].hint,
      count: queues[t.key],
      href: `${ORDERS}?queue=${t.key}`,
      icon: t.icon,
    })),
    ...(data.requiresOrderSku
      ? [
          {
            label: 'SKU missing',
            hint: 'Needed before payment',
            count: queues.skuMissing,
            href: `${ORDERS}?skuMissing=1`,
            icon: IconBarcode,
          },
        ]
      : []),
  ];

  // The live pipeline. Delivered is shown apart: it is the finish line.
  const stages = [
    { key: 'verification', label: 'Verification', owner: 'Partner · you', dot: 'bg-orange-400' },
    { key: 'payment', label: 'Payment', owner: 'Client · you', dot: 'bg-blue-500' },
    { key: 'inbound', label: 'Inbound', owner: 'C&C', dot: 'bg-violet-500' },
    { key: 'delivery', label: 'Delivery', owner: 'You', dot: 'bg-amber-400' },
  ] as const;
  const inFlight = stages.reduce((sum, st) => sum + stageData[st.key].count, 0);


  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography variant="headingLg" className="font-bold">
            Private Client Orders
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Orders assigned to you
          </Typography>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 tabular-nums" asChild>
            <Link href={ORDERS}>All orders ({kpis.totalOrders})</Link>
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5" asChild>
            <Link href="/docs/pco-flows">
              <Icon icon={IconBook} size="sm" />
              Process guide
            </Link>
          </Button>
          <div
            className="inline-flex items-center rounded-lg border border-border-muted bg-surface-secondary/50 p-0.5"
            role="group"
            aria-label="Currency"
          >
            {(['AED', 'USD'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                aria-pressed={currency === c}
                className={`min-h-8 rounded-md px-3 py-1 text-xs font-medium transition-all ${
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

      {/* What is waiting on you — each count opens the list behind it */}
      <Typography variant="bodyXs" colorRole="muted" className="-mb-2 uppercase tracking-wider">
        Needs your action
      </Typography>
      <div
        className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${
          tiles.length > 5 ? 'xl:grid-cols-6' : 'xl:grid-cols-5'
        }`}
      >
        {tiles.map((item) => {
          const needsAction = item.count > 0;
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
                className={`tabular-nums ${needsAction ? 'text-text-primary' : 'text-text-muted'}`}
              >
                {item.count}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="flex items-center gap-1">
                {needsAction ? item.hint : 'All clear'}
                {needsAction && (
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
          { label: 'Active orders', value: String(kpis.activeOrders) },
          {
            label: 'Last 30 days',
            value: `${kpis.monthlyOrders} orders · ${kpis.monthlyBottles} bottles`,
          },
          {
            label: 'Value, last 30 days',
            value: formatCurrency(kpis.monthlyValueUsd, kpis.monthlyValueAed),
          },
          { label: 'Total value', value: formatCurrency(kpis.totalValueUsd, kpis.totalValueAed) },
        ].map((stat) => (
          <div key={stat.label} className="flex items-baseline gap-2">
            <Typography variant="bodyXs" colorRole="muted">
              {stat.label}
            </Typography>
            <Typography variant="bodySm" className="font-semibold tabular-nums">
              {stat.value}
            </Typography>
          </div>
        ))}
      </div>

      {/* Pipeline: where live orders are, and whether they are moving */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <Typography variant="headingSm" className="font-semibold">
                Pipeline
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                {inFlight} in flight
              </Typography>
            </div>
            <Link
              href={`${ORDERS}?stage=delivered`}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {stageData.delivered.count} delivered
              {stageData.delivered.lastWeek > 0 && ` · ${stageData.delivered.lastWeek} this week`}
              <Icon icon={IconChevronRight} size="xs" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {stages.map((st, index) => {
              const stage = stageData[st.key];
              const share = inFlight > 0 ? (stage.count / inFlight) * 100 : 0;
              return (
                <div key={st.key} className="relative">
                  <Link
                    href={`${ORDERS}?stage=${st.key}`}
                    className="flex h-full flex-col gap-2 rounded-lg border border-border-muted p-3 transition-colors hover:border-border-primary hover:bg-fill-muted/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                        <Typography variant="bodySm" className="font-medium">
                          {st.label}
                        </Typography>
                      </span>
                      <Typography variant="bodyXs" colorRole="muted" className="hidden truncate sm:block">
                        {st.owner}
                      </Typography>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <Typography variant="headingMd" className="font-semibold tabular-nums">
                        {stage.count}
                      </Typography>
                      {stage.count > 0 && (
                        <Typography variant="bodyXs" colorRole="muted" className="tabular-nums">
                          {formatCurrency(stage.valueUsd, stage.valueAed)}
                        </Typography>
                      )}
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-fill-muted">
                      <div className={`h-full ${st.dot}`} style={{ width: `${share}%` }} />
                    </div>
                    <Typography variant="bodyXs" colorRole="muted">
                      {stage.count === 0
                        ? 'Empty'
                        : stage.oldestDays !== null
                          ? `Oldest ${stage.oldestDays === 0 ? 'today' : `${stage.oldestDays}d`} without a change`
                          : ' '}
                    </Typography>
                  </Link>
                  {stage.idle > 0 && (
                    <Link
                      href={`${ORDERS}?stage=${st.key}&idle=1`}
                      className="absolute right-2 top-9 rounded-full bg-fill-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-text-warning hover:bg-fill-warning/25"
                      title="No change in 7 days"
                    >
                      {stage.idle} idle 7d+
                    </Link>
                  )}
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

      {/* Recent orders */}
      <div className="grid gap-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between">
              <Typography variant="headingSm" className="font-semibold">
                Recently assigned
              </Typography>
              <Button variant="ghost" size="sm" className="gap-1" asChild>
                <Link href={ORDERS}>
                  View all <Icon icon={IconArrowRight} size="sm" />
                </Link>
              </Button>
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
                    href={`${ORDERS}/${order.id}`}
                    className="group -mx-2 flex min-h-12 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-secondary/50"
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
                        {order.partner && (
                          <div className="flex items-center gap-1">
                            <span>·</span>
                            {order.partner.logoUrl && (
                              <Image
                                src={order.partner.logoUrl}
                                alt={order.partner.businessName}
                                width={16}
                                height={16}
                                className="h-4 w-4 rounded object-contain"
                              />
                            )}
                            <Typography variant="bodyXs">{order.partner.businessName}</Typography>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Typography variant="bodySm" className="whitespace-nowrap font-medium tabular-nums">
                        {formatCurrency(order.totalUsd ?? 0, order.totalAed ?? 0)}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {format(new Date(order.distributorAssignedAt ?? order.createdAt), 'MMM d')}
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
      </div>
    </div>
  );
};

export default DistributorDashboard;
