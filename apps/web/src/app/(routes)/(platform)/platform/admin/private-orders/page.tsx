'use client';

import {
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconLoader2,
  IconPackage,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import PrivateOrderStatusBadge from '@/app/_privateClientOrders/components/PrivateOrderStatusBadge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
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
const AdminPrivateOrdersPage = () => {
  const api = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fetch orders
  const { data, isLoading, refetch } = useQuery({
    ...api.privateClientOrders.adminGetMany.queryOptions({
      limit: 50,
      search: searchQuery || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    staleTime: 30000,
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
          <Button asChild>
            <Link href="/platform/admin/private-orders/new">
              <ButtonContent iconLeft={IconPlus}>New Order</ButtonContent>
            </Link>
          </Button>
        </div>

        {/* Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Icon icon={IconPackage} size="md" className="text-purple-600" />
                </div>
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="uppercase tracking-wide">
                    Total Orders
                  </Typography>
                  <Typography variant="headingMd" className="text-purple-600">
                    {totalCount}
                  </Typography>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                {searchQuery || statusFilter !== 'all'
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
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Order
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Partner
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Client
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Items
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Actions
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
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Icon
                                  icon={isExpanded ? IconChevronUp : IconChevronDown}
                                  size="sm"
                                  colorRole="muted"
                                />
                                <Typography variant="bodySm" className="font-medium">
                                  {order.orderNumber}
                                </Typography>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <Typography variant="bodySm">
                                {order.partner?.businessName ?? 'Unknown'}
                              </Typography>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <Typography variant="bodySm" className="font-medium">
                                  {order.clientName || 'No name'}
                                </Typography>
                                <Typography variant="bodyXs" colorRole="muted">
                                  {order.clientEmail || '-'}
                                </Typography>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Typography variant="bodySm">
                                {order.itemCount ?? 0} ({order.caseCount ?? 0} cases)
                              </Typography>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Typography variant="bodySm" className="font-semibold">
                                {formatPrice(Number(order.totalUsd) || 0, 'USD')}
                              </Typography>
                            </td>
                            <td className="px-6 py-4">
                              <PrivateOrderStatusBadge status={order.status} />
                            </td>
                            <td className="px-6 py-4">
                              <Typography variant="bodySm" colorRole="muted">
                                {formatDate(order.createdAt)}
                              </Typography>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Link href={`/platform/admin/private-orders/${order.id}`}>
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
                          <div className="flex items-center gap-2">
                            <Icon
                              icon={isExpanded ? IconChevronUp : IconChevronDown}
                              size="sm"
                              colorRole="muted"
                            />
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
                            <Typography variant="bodyXs" className="font-medium">
                              {order.clientName || 'No client name'}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {order.itemCount ?? 0} items · {order.caseCount ?? 0} cases
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
    </div>
  );
};

export default AdminPrivateOrdersPage;
