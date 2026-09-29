'use client';

import {
  IconBuilding,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconLoader2,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import PrivateOrderStatusBadge from '@/app/_privateClientOrders/components/PrivateOrderStatusBadge';
import type { PcoStage } from '@/app/_privateClientOrders/constants';
import formatSubscriptionBox from '@/app/_privateClientOrders/utils/formatSubscriptionBox';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Checkbox from '@/app/_ui/components/Checkbox/Checkbox';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientOrder } from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

type OrderStatus = PrivateClientOrder['status'];

const statusOptions: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_cc_review', label: 'Under Review' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'cc_approved', label: 'Approved' },
  { value: 'awaiting_client_payment', label: 'Awaiting Client Payment' },
  { value: 'client_paid', label: 'Client Paid' },
  { value: 'awaiting_distributor_payment', label: 'Awaiting Distributor' },
  { value: 'distributor_paid', label: 'Distributor Paid' },
  { value: 'awaiting_partner_payment', label: 'Awaiting Partner' },
  { value: 'partner_paid', label: 'Partner Paid' },
  { value: 'stock_in_transit', label: 'In Transit' },
  { value: 'with_distributor', label: 'With Distributor' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * Admin page for managing private client orders
 *
 * Features:
 * - View all private client orders across all partners
 * - Filter by status and search
 * - Update order status
 * - View order details
 */
const STAGE_LABELS: Record<PcoStage, string> = {
  review: 'Pending review',
  verification: 'Verification',
  payment: 'Payment',
  fulfilment: 'Fulfilment',
  delivered: 'Delivered',
};

const AdminPrivateOrdersPage = () => {
  const api = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  // One subscription box, stored as its index in `boxes` ('all' for none)
  const [boxFilter, setBoxFilter] = useState('all');
  // 'all', 'unassigned', or a distributor's id
  const [distributorFilter, setDistributorFilter] = useState('all');
  // Orders ticked for a bulk action
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDistributorId, setBulkDistributorId] = useState('');
  const [bulkStockStatus, setBulkStockStatus] = useState('');
  // Set from dashboard links: a pipeline stage, or orders missing a CD SKU
  const [stageFilter, setStageFilter] = useState<PcoStage | null>(null);
  const [skuMissingFilter, setSkuMissingFilter] = useState(false);
  const [idleFilter, setIdleFilter] = useState(false);

  // Dashboard links arrive as ?stage=, ?status=, ?distributor=, ?skuMissing=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stage = params.get('stage');
    if (stage && ['review', 'verification', 'payment', 'fulfilment', 'delivered'].includes(stage)) {
      setStageFilter(stage as PcoStage);
    }
    const status = params.get('status');
    if (status) setStatusFilter(status as OrderStatus);
    const distributor = params.get('distributor');
    if (distributor) setDistributorFilter(distributor);
    if (params.get('skuMissing') === '1') setSkuMissingFilter(true);
    if (params.get('idle') === '1') setIdleFilter(true);
  }, []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: boxes = [] } = useQuery(
    api.privateClientOrders.adminGetSubscriptionBoxes.queryOptions(),
  );
  const selectedBox = boxFilter === 'all' ? undefined : boxes[Number(boxFilter)];

  const { data: distributors = [] } = useQuery(
    api.partners.getMany.queryOptions({ type: 'distributor', status: 'active' }),
  );

  // Fetch orders
  const { data, isLoading, refetch, isFetching } = useQuery({
    ...api.privateClientOrders.adminGetMany.queryOptions({
      limit: 50,
      search: searchQuery || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      distributor: distributorFilter === 'all' ? undefined : distributorFilter,
      stage: stageFilter ?? undefined,
      skuMissing: skuMissingFilter || undefined,
      idle: idleFilter || undefined,
      box: selectedBox
        ? {
            tier: selectedBox.tier,
            caseSize: selectedBox.caseSize,
            variant: selectedBox.variant,
          }
        : undefined,
    }),
    staleTime: 0, // Always fetch fresh data
    refetchInterval: 5000, // Refresh every 10 seconds
  });

  const handleRefresh = () => {
    void refetch();
  };

  // Bulk actions: each order is handled exactly as it would be on its own page
  const onBulkDone = (label: string) => ({
    onSuccess: (result: {
      succeeded: number;
      failed: { orderNumber: string; message?: string }[];
    }) => {
      if (result.succeeded > 0) {
        toast.success(`${label}: ${result.succeeded} order${result.succeeded === 1 ? '' : 's'}`);
      }
      for (const failure of result.failed) {
        toast.error(`${failure.orderNumber}: ${failure.message ?? 'failed'}`);
      }
      setSelected(new Set());
      void refetch();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  });
  const bulkAssign = useMutation(
    api.privateClientOrders.adminBulkAssignDistributor.mutationOptions(
      onBulkDone('Distributor assigned'),
    ),
  );
  const bulkStock = useMutation(
    api.privateClientOrders.adminBulkUpdateStockStatus.mutationOptions(
      onBulkDone('Stock status updated'),
    ),
  );

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Update status mutation
  const { mutate: updateStatus, isPending: isUpdating } = useMutation(
    api.privateClientOrders.adminUpdateStatus.mutationOptions({
      onSuccess: () => {
        toast.success('Order status updated');
        setUpdatingId(null);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update status');
        setUpdatingId(null);
      },
    }),
  );

  const orders = data?.data ?? [];
  const totalCount = data?.meta.totalCount ?? 0;

  // Counts for the quick filters: one row fetched each, the total is what matters
  const countOf = (filters: { status?: OrderStatus; distributor?: string }) =>
    api.privateClientOrders.adminGetMany.queryOptions({ limit: 1, ...filters });
  const { data: awaitingPayment } = useQuery(countOf({ status: 'awaiting_client_payment' }));
  const { data: unassigned } = useQuery(countOf({ distributor: 'unassigned' }));
  const { data: drafts } = useQuery(countOf({ status: 'draft' }));
  const awaitingPaymentCount = awaitingPayment?.meta.totalCount ?? 0;
  const unassignedCount = unassigned?.meta.totalCount ?? 0;
  const draftCount = drafts?.meta.totalCount ?? 0;

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    updateStatus({ orderId, status: newStatus });
  };

  const toggleExpanded = (orderId: string) => {
    setExpandedId(expandedId === orderId ? null : orderId);
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Typography variant="headingLg" className="mb-2">
              Private Client Orders
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Manage orders from wine partners for their private clients
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
            >
              <Icon
                icon={IconRefresh}
                size="sm"
                className={isFetching ? 'animate-spin' : ''}
              />
            </Button>
            <Button asChild>
              <Link href="/platform/admin/private-orders/new">
                <ButtonContent iconLeft={IconPlus}>New Order</ButtonContent>
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick filters with counts */}
        <div className="flex flex-wrap gap-2">
          {[
            {
              key: 'all',
              label: 'All orders',
              count: totalCount,
              active:
                statusFilter === 'all' &&
                distributorFilter === 'all' &&
                !stageFilter &&
                !skuMissingFilter &&
                !idleFilter,
              apply: () => {
                setStatusFilter('all');
                setDistributorFilter('all');
                setStageFilter(null);
                setSkuMissingFilter(false);
                setIdleFilter(false);
              },
            },
            {
              key: 'payment',
              label: 'Awaiting payment',
              count: awaitingPaymentCount,
              active: statusFilter === 'awaiting_client_payment',
              apply: () => setStatusFilter('awaiting_client_payment'),
            },
            {
              key: 'unassigned',
              label: 'No distributor',
              count: unassignedCount,
              warn: true,
              active: distributorFilter === 'unassigned',
              apply: () => setDistributorFilter('unassigned'),
            },
            {
              key: 'draft',
              label: 'Drafts',
              count: draftCount,
              active: statusFilter === 'draft',
              apply: () => setStatusFilter('draft'),
            },
          ].map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.apply}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                chip.active
                  ? 'border-border-brand bg-fill-brand/10 text-text-primary'
                  : 'border-border-muted bg-fill-primary text-text-muted hover:text-text-primary'
              }`}
            >
              {chip.label}
              <span
                className={`rounded-full px-1.5 text-xs font-semibold ${
                  chip.warn && chip.count > 0
                    ? 'bg-fill-warning/20 text-text-warning'
                    : 'bg-fill-muted text-text-primary'
                }`}
              >
                {chip.count}
              </span>
            </button>
          ))}
          {stageFilter && (
            <button
              type="button"
              onClick={() => setStageFilter(null)}
              className="flex items-center gap-1.5 rounded-full border border-border-brand bg-fill-brand/10 px-3 py-1.5 text-sm text-text-primary"
            >
              Stage: {STAGE_LABELS[stageFilter]} <span className="text-text-muted">×</span>
            </button>
          )}
          {idleFilter && (
            <button
              type="button"
              onClick={() => setIdleFilter(false)}
              className="flex items-center gap-1.5 rounded-full border border-border-brand bg-fill-brand/10 px-3 py-1.5 text-sm text-text-primary"
            >
              No change in 7 days <span className="text-text-muted">×</span>
            </button>
          )}
          {skuMissingFilter && (
            <button
              type="button"
              onClick={() => setSkuMissingFilter(false)}
              className="flex items-center gap-1.5 rounded-full border border-border-brand bg-fill-brand/10 px-3 py-1.5 text-sm text-text-primary"
            >
              CD SKU missing <span className="text-text-muted">×</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Icon
                  icon={IconSearch}
                  size="sm"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <Input
                  placeholder="Search by order number, client name, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full sm:w-48">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as OrderStatus | 'all')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-52">
                <Select value={distributorFilter} onValueChange={setDistributorFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Distributor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All distributors</SelectItem>
                    <SelectItem value="unassigned">No distributor yet</SelectItem>
                    {distributors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.businessName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {boxes.length > 0 && (
                <div className="w-full sm:w-56">
                  <Select value={boxFilter} onValueChange={setBoxFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filter by box" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All boxes</SelectItem>
                      {boxes.map((box, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {formatSubscriptionBox({
                            subscriptionTier: box.tier,
                            subscriptionCaseSize: box.caseSize,
                            subscriptionVariant: box.variant,
                          })}{' '}
                          ({box.orders})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon icon={IconPackage} size="xl" className="mx-auto mb-4 text-text-muted" />
              <Typography variant="headingSm" className="mb-2">
                No Orders Found
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                {searchQuery || statusFilter !== 'all' || boxFilter !== 'all' || distributorFilter !== 'all' || stageFilter || skuMissingFilter || idleFilter
                  ? 'No orders match your filters. Try adjusting your search.'
                  : 'No private client orders have been created yet.'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead className="border-b border-border-muted">
                    <tr>
                      <th className="w-10 py-3 pl-4">
                        <Checkbox
                          aria-label="Select all shown"
                          checked={
                            orders.length > 0 && orders.every((o) => selected.has(o.id))
                          }
                          onCheckedChange={(checked) =>
                            setSelected(
                              checked === true ? new Set(orders.map((o) => o.id)) : new Set(),
                            )
                          }
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Order
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Partner → Distributor
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Items
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                        
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted">
                    {orders.map((order) => {
                      const isExpanded = expandedId === order.id;
                      const isThisUpdating = updatingId === order.id && isUpdating;

                      return (
                        <>
                          <tr
                            key={order.id}
                            className="cursor-pointer hover:bg-surface-muted"
                            onClick={() => toggleExpanded(order.id)}
                          >
                            <td className="w-10 py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                aria-label={`Select ${order.orderNumber}`}
                                checked={selected.has(order.id)}
                                onCheckedChange={() => toggleSelected(order.id)}
                              />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Icon
                                  icon={isExpanded ? IconChevronUp : IconChevronDown}
                                  size="sm"
                                  colorRole="muted"
                                />
                                <div>
                                  <Typography variant="bodySm" className="font-mono font-medium">
                                    {order.orderNumber}
                                  </Typography>
                                  <Typography variant="bodyXs" colorRole="muted">
                                    {formatDate(order.createdAt)}
                                  </Typography>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Typography variant="bodySm" className="font-medium">
                                {order.clientName || 'No name'}
                              </Typography>
                              <Typography variant="bodyXs" colorRole="muted" className="truncate">
                                {order.clientEmail || '—'}
                              </Typography>
                              {(order.client?.cityDrinksVerifiedAt || formatSubscriptionBox(order)) && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {order.client?.cityDrinksVerifiedAt && (
                                    <span
                                      className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                      title="City Drinks Verified"
                                    >
                                      <Icon icon={IconShieldCheck} size="xs" />
                                      Verified
                                    </span>
                                  )}
                                  {formatSubscriptionBox(order) && (
                                    <span className="whitespace-nowrap rounded-full bg-fill-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-text-brand">
                                      {formatSubscriptionBox(order)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {order.partner?.logoUrl ? (
                                  <Image
                                    src={order.partner.logoUrl}
                                    alt={order.partner?.businessName ?? 'Partner'}
                                    width={24}
                                    height={24}
                                    className="h-6 w-6 shrink-0 rounded object-contain"
                                  />
                                ) : (
                                  <Icon icon={IconBuilding} size="sm" className="shrink-0 text-text-muted" />
                                )}
                                <div className="min-w-0">
                                  <Typography variant="bodySm" className="truncate">
                                    {order.partner?.businessName ?? 'Unknown'}
                                  </Typography>
                                  {order.distributor ? (
                                    <Typography
                                      variant="bodyXs"
                                      colorRole="muted"
                                      className="whitespace-nowrap"
                                      title={order.distributor.businessName}
                                    >
                                      → {order.distributor.distributorCode || order.distributor.businessName}
                                      {order.distributorSku && (
                                        <span className="ml-1 font-mono">· {order.distributorSku}</span>
                                      )}
                                    </Typography>
                                  ) : (
                                    <span className="whitespace-nowrap rounded-full bg-fill-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-text-warning">
                                      No distributor
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <Typography variant="bodySm">
                                {order.caseCount ?? 0} {(order.caseCount ?? 0) === 1 ? 'case' : 'cases'}
                              </Typography>
                              <Typography variant="bodyXs" colorRole="muted">
                                {order.itemCount ?? 0} {(order.itemCount ?? 0) === 1 ? 'line' : 'lines'}
                              </Typography>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <Typography variant="bodySm" className="font-semibold">
                                {formatPrice(Number(order.totalUsd) || 0, 'USD')}
                              </Typography>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <PrivateOrderStatusBadge status={order.status} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Link href={`/platform/admin/private-orders/${order.id}`} aria-label={`Open ${order.orderNumber}`}>
                                  <Icon icon={IconEye} size="sm" />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${order.id}-details`} className="bg-surface-muted">
                              <td colSpan={8} className="px-6 py-4">
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                  {/* Update Status */}
                                  <div>
                                    <Typography
                                      variant="bodySm"
                                      className="mb-3 font-semibold uppercase tracking-wide text-text-secondary"
                                    >
                                      Update Status
                                    </Typography>
                                    <Select
                                      value={order.status}
                                      onValueChange={(v) =>
                                        handleStatusChange(order.id, v as OrderStatus)
                                      }
                                      disabled={isThisUpdating}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {statusOptions
                                          .filter((opt) => opt.value !== 'all')
                                          .map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                              {opt.label}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Client Details */}
                                  <div>
                                    <Typography
                                      variant="bodySm"
                                      className="mb-3 font-semibold uppercase tracking-wide text-text-secondary"
                                    >
                                      Client Details
                                    </Typography>
                                    <div className="space-y-1 text-xs">
                                      <div>
                                        <span className="text-text-muted">Phone: </span>
                                        {order.clientPhone || '-'}
                                      </div>
                                      <div>
                                        <span className="text-text-muted">Address: </span>
                                        {order.clientAddress || '-'}
                                      </div>
                                      {order.deliveryNotes && (
                                        <div>
                                          <span className="text-text-muted">Notes: </span>
                                          {order.deliveryNotes}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Order Details */}
                                  <div>
                                    <Typography
                                      variant="bodySm"
                                      className="mb-3 font-semibold uppercase tracking-wide text-text-secondary"
                                    >
                                      Order Breakdown
                                    </Typography>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-text-muted">Subtotal:</span>
                                        <span>{formatPrice(Number(order.subtotalUsd) || 0, 'USD')}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-text-muted">Duty:</span>
                                        <span>{formatPrice(Number(order.dutyUsd) || 0, 'USD')}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-text-muted">VAT:</span>
                                        <span>{formatPrice(Number(order.vatUsd) || 0, 'USD')}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-text-muted">Logistics:</span>
                                        <span>{formatPrice(Number(order.logisticsUsd) || 0, 'USD')}</span>
                                      </div>
                                      <div className="flex justify-between border-t border-border-muted pt-1 font-semibold">
                                        <span>Total:</span>
                                        <span>{formatPrice(Number(order.totalUsd) || 0, 'USD')}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="divide-y divide-border-muted md:hidden">
                {orders.map((order) => {
                  const isExpanded = expandedId === order.id;
                  const isThisUpdating = updatingId === order.id && isUpdating;

                  return (
                    <div key={order.id} className="p-4">
                      <div
                        className="cursor-pointer space-y-3"
                        onClick={() => toggleExpanded(order.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                aria-label={`Select ${order.orderNumber}`}
                                checked={selected.has(order.id)}
                                onCheckedChange={() => toggleSelected(order.id)}
                              />
                            </span>
                            <Icon
                              icon={isExpanded ? IconChevronUp : IconChevronDown}
                              size="sm"
                              colorRole="muted"
                            />
                            {order.partner?.logoUrl ? (
                              <Image
                                src={order.partner.logoUrl}
                                alt={order.partner?.businessName ?? 'Partner'}
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
                                {order.orderNumber}
                              </Typography>
                              <Typography variant="bodyXs" colorRole="muted">
                                {order.partner?.businessName ?? 'Unknown Partner'}
                              </Typography>
                            </div>
                          </div>
                          <PrivateOrderStatusBadge status={order.status} />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Typography variant="bodyXs" className="font-medium">
                                {order.clientName || 'No client name'}
                              </Typography>
                              {order.client?.cityDrinksVerifiedAt && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  title="City Drinks Verified"
                                >
                                  <Icon icon={IconShieldCheck} size="xs" />
                                </span>
                              )}
                              {formatSubscriptionBox(order) && (
                                <span className="rounded-full bg-fill-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-text-brand">
                                  {formatSubscriptionBox(order)}
                                </span>
                              )}
                            </div>
                            <Typography variant="bodyXs" colorRole="muted">
                              {order.itemCount ?? 0} items · {order.caseCount ?? 0} cases ·{' '}
                              {order.distributor ? (
                                `→ ${order.distributor.businessName}`
                              ) : (
                                <span className="text-text-warning">No distributor</span>
                              )}
                            </Typography>
                          </div>
                          <Typography variant="bodySm" className="font-semibold">
                            {formatPrice(Number(order.totalUsd) || 0, 'USD')}
                          </Typography>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 space-y-4 rounded-lg bg-surface-muted p-3">
                          {/* Update Status */}
                          <div>
                            <Typography
                              variant="bodyXs"
                              className="mb-2 font-semibold uppercase tracking-wide text-text-secondary"
                            >
                              Update Status
                            </Typography>
                            <Select
                              value={order.status}
                              onValueChange={(v) => handleStatusChange(order.id, v as OrderStatus)}
                              disabled={isThisUpdating}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions
                                  .filter((opt) => opt.value !== 'all')
                                  .map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Client */}
                          <div>
                            <Typography
                              variant="bodyXs"
                              className="mb-2 font-semibold uppercase tracking-wide text-text-secondary"
                            >
                              Client
                            </Typography>
                            <div className="space-y-1 text-xs">
                              <div>
                                <span className="text-text-muted">Email: </span>
                                {order.clientEmail || '-'}
                              </div>
                              <div>
                                <span className="text-text-muted">Phone: </span>
                                {order.clientPhone || '-'}
                              </div>
                              <div>
                                <span className="text-text-muted">Address: </span>
                                {order.clientAddress || '-'}
                              </div>
                            </div>
                          </div>

                          <Button size="sm" variant="outline" asChild className="w-full">
                            <Link href={`/platform/admin/private-orders/${order.id}`}>
                              <ButtonContent iconLeft={IconEye}>View Details</ButtonContent>
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    
      {/* Bulk actions for the ticked orders */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="flex w-full max-w-4xl flex-wrap items-center gap-3 rounded-xl border border-border-primary bg-fill-primary px-4 py-3 shadow-lg">
            <Typography variant="bodySm" className="font-medium">
              {selected.size} selected
            </Typography>

            <div className="flex items-center gap-2">
              <Select value={bulkDistributorId} onValueChange={setBulkDistributorId}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Assign distributor" />
                </SelectTrigger>
                <SelectContent>
                  {distributors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.businessName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                colorRole="brand"
                disabled={!bulkDistributorId || bulkAssign.isPending}
                onClick={() =>
                  bulkAssign.mutate({
                    orderIds: [...selected],
                    distributorId: bulkDistributorId,
                  })
                }
              >
                {bulkAssign.isPending ? 'Assigning…' : 'Assign'}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Select value={bulkStockStatus} onValueChange={setBulkStockStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Set stock status" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    ['confirmed', 'Confirmed'],
                    ['in_transit_to_cc', 'In transit to C&C'],
                    ['at_cc_bonded', 'At C&C bonded'],
                    ['at_cc_ready_for_dispatch', 'Packed'],
                    ['in_transit_to_distributor', 'In transit to distributor'],
                    ['at_distributor', 'At distributor'],
                    ['delivered', 'Delivered'],
                  ].map(([value, label]) => (
                    <SelectItem key={value} value={value!}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                colorRole="brand"
                disabled={!bulkStockStatus || bulkStock.isPending}
                onClick={() =>
                  bulkStock.mutate({
                    orderIds: [...selected],
                    stockStatus: bulkStockStatus as
                      | 'confirmed'
                      | 'in_transit_to_cc'
                      | 'at_cc_bonded'
                      | 'at_cc_ready_for_dispatch'
                      | 'in_transit_to_distributor'
                      | 'at_distributor'
                      | 'delivered',
                  })
                }
              >
                {bulkStock.isPending ? 'Updating…' : 'Apply'}
              </Button>
            </div>

            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPrivateOrdersPage;
