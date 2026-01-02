'use client';

import {
  IconAlertCircle,
  IconArrowLeft,
  IconBuilding,
  IconCheck,
  IconEdit,
  IconLoader2,
  IconRefresh,
  IconTrash,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import DocumentUpload from '@/app/_privateClientOrders/components/DocumentUpload';
import PaymentTracker from '@/app/_privateClientOrders/components/PaymentTracker';
import PrivateOrderStatusBadge from '@/app/_privateClientOrders/components/PrivateOrderStatusBadge';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientOrder } from '@/database/schema';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

type Currency = 'USD' | 'AED';

/** Default UAE exchange rate for AED/USD conversion */
const DEFAULT_EXCHANGE_RATE = 3.67;

/**
 * Format a price value with currency
 */
const formatCurrencyValue = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

type OrderStatus = PrivateClientOrder['status'];

// Statuses that allow distributor assignment
const DISTRIBUTOR_ASSIGNABLE_STATUSES: OrderStatus[] = [
  'cc_approved',
  'awaiting_client_payment',
  'client_paid',
];

// Statuses where admin cannot edit items
const NON_EDITABLE_STATUSES: OrderStatus[] = ['delivered', 'cancelled'];

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_cc_review', label: 'Under Review' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'cc_approved', label: 'Approved' },
  { value: 'awaiting_partner_verification', label: 'Awaiting Partner Verification' },
  { value: 'awaiting_distributor_verification', label: 'Awaiting Distributor Verification' },
  { value: 'verification_suspended', label: 'Verification Suspended' },
  { value: 'awaiting_client_payment', label: 'Awaiting Client Payment' },
  { value: 'client_paid', label: 'Client Paid' },
  { value: 'awaiting_distributor_payment', label: 'Awaiting Distributor Payment' },
  { value: 'distributor_paid', label: 'Distributor Paid' },
  { value: 'awaiting_partner_payment', label: 'Awaiting Partner Payment' },
  { value: 'partner_paid', label: 'Partner Paid' },
  { value: 'stock_in_transit', label: 'Stock In Transit' },
  { value: 'with_distributor', label: 'With Distributor' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface EditingItem {
  id: string;
  productName: string;
  producer: string;
  vintage: string;
  quantity: number;
  pricePerCaseUsd: number;
}

/**
 * Admin detail view for a single private client order
 *
 * Shows full order details including line items with inline editing.
 */
type ResetTargetStatus = 'awaiting_partner_verification' | 'awaiting_distributor_verification' | 'awaiting_client_payment';

const resetTargetOptions: { value: ResetTargetStatus; label: string; description: string }[] = [
  { value: 'awaiting_partner_verification', label: 'Partner Verification', description: 'Restart from partner verification' },
  { value: 'awaiting_distributor_verification', label: 'Distributor Verification', description: 'Skip to distributor verification' },
  { value: 'awaiting_client_payment', label: 'Awaiting Payment', description: 'Skip verification, proceed to payment' },
];

const AdminPrivateOrderDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAssigningDistributor, setIsAssigningDistributor] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [resetTarget, setResetTarget] = useState<ResetTargetStatus>('awaiting_distributor_verification');

  // Fetch order details
  const {
    data: order,
    isLoading,
    refetch,
  } = useQuery({
    ...api.privateClientOrders.adminGetOne.queryOptions({ id: orderId }),
    enabled: !!orderId,
  });

  // Fetch available distributors
  const { data: distributors = [] } = useQuery({
    ...api.partners.getMany.queryOptions({ type: 'distributor', status: 'active' }),
  });

  // Update status mutation
  const { mutate: updateStatus } = useMutation(
    api.privateClientOrders.adminUpdateStatus.mutationOptions({
      onSuccess: () => {
        toast.success('Order status updated');
        setIsUpdating(false);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update status');
        setIsUpdating(false);
      },
    }),
  );

  // Assign distributor mutation
  const { mutate: assignDistributor } = useMutation(
    api.privateClientOrders.adminAssignDistributor.mutationOptions({
      onSuccess: () => {
        toast.success('Distributor assigned');
        setIsAssigningDistributor(false);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to assign distributor');
        setIsAssigningDistributor(false);
      },
    }),
  );

  // Update item mutation
  const { mutate: updateItem, isPending: isUpdatingItem } = useMutation(
    api.privateClientOrders.adminUpdateItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item updated');
        setEditingItem(null);
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update item');
      },
    }),
  );

  // Remove item mutation
  const { mutate: removeItem, isPending: isRemovingItem } = useMutation(
    api.privateClientOrders.adminRemoveItem.mutationOptions({
      onSuccess: () => {
        toast.success('Item removed');
        void refetch();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to remove item');
      },
    }),
  );

  // Reset verification mutation (for suspended orders)
  const { mutate: resetVerification, isPending: isResetting } = useMutation({
    mutationFn: ({ targetStatus, notes }: { targetStatus: ResetTargetStatus; notes?: string }) =>
      trpcClient.privateClientOrders.adminResetVerification.mutate({
        orderId,
        targetStatus,
        notes,
      }),
    onSuccess: () => {
      toast.success('Order reset successfully. Verification flow resumed.');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reset order');
    },
  });

  // Delete order mutation (admin only, for draft/cancelled orders)
  const { mutate: deleteOrder, isPending: isDeleting } = useMutation({
    mutationFn: () => trpcClient.privateClientOrders.adminDelete.mutate({ orderId }),
    onSuccess: (data) => {
      toast.success(`Order ${data.orderNumber} deleted`);
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
      // Redirect to orders list
      router.push('/platform/admin/private-orders');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete order');
    },
  });

  const handleStatusChange = (newStatus: OrderStatus) => {
    setIsUpdating(true);
    updateStatus({ orderId, status: newStatus });
  };

  const handleDistributorAssign = (distributorId: string) => {
    setIsAssigningDistributor(true);
    assignDistributor({ orderId, distributorId });
  };

  const handleEditItem = (item: {
    id: string;
    productName: string;
    producer: string | null;
    vintage: string | null;
    quantity: number;
    pricePerCaseUsd: string | number;
  }) => {
    setEditingItem({
      id: item.id,
      productName: item.productName,
      producer: item.producer ?? '',
      vintage: item.vintage ?? '',
      quantity: item.quantity,
      pricePerCaseUsd: Number(item.pricePerCaseUsd),
    });
  };

  const handleSaveItem = () => {
    if (!editingItem) return;
    updateItem({
      itemId: editingItem.id,
      productName: editingItem.productName,
      producer: editingItem.producer || undefined,
      vintage: editingItem.vintage || undefined,
      quantity: editingItem.quantity,
      pricePerCaseUsd: editingItem.pricePerCaseUsd,
    });
  };

  const handleRemoveItem = (itemId: string) => {
    if (confirm('Are you sure you want to remove this item?')) {
      removeItem({ itemId });
    }
  };

  const canAssignDistributor = order && DISTRIBUTOR_ASSIGNABLE_STATUSES.includes(order.status);
  const canEditItems = order && !NON_EDITABLE_STATUSES.includes(order.status);
  const canDelete = order && ['draft', 'cancelled'].includes(order.status);

  const handleDeleteOrder = () => {
    if (confirm(`Are you sure you want to permanently delete order ${order?.orderNumber}? This action cannot be undone.`)) {
      deleteOrder();
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Typography variant="headingSm" className="mb-2">
              Order Not Found
            </Typography>
            <Typography variant="bodyMd" colorRole="muted" className="mb-4">
              The order you&apos;re looking for doesn&apos;t exist or has been deleted.
            </Typography>
            <Button variant="outline" asChild>
              <Link href="/platform/admin/private-orders">Back to Orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const _assignedDistributor = distributors.find((d) => d.id === order.distributor?.id);

  // Calculate exchange rate for AED conversion (use actual rate if available, otherwise default)
  const totalAed = Number(order.totalAed) || 0;
  const totalUsd = Number(order.totalUsd) || 1;
  const usdToAedRate = totalAed > 0 ? totalAed / totalUsd : DEFAULT_EXCHANGE_RATE;

  /**
   * Convert amount to selected currency
   */
  const getAmount = (usdAmount: number | string | null | undefined) => {
    const amount = Number(usdAmount) || 0;
    return currency === 'USD' ? amount : amount * usdToAedRate;
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-4">
        {/* Header - compact */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/admin/private-orders">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <Typography variant="headingLg">{order.orderNumber}</Typography>
            <PrivateOrderStatusBadge status={order.status} />
          </div>

          {/* Quick actions bar */}
          <div className="flex items-center gap-2">
            {/* Currency Toggle */}
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

            <Select
              value={order.status}
              onValueChange={(v) => handleStatusChange(v as OrderStatus)}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Delete button - only for draft/cancelled orders */}
            {canDelete && (
              <Button
                variant="outline"
                colorRole="danger"
                size="sm"
                onClick={handleDeleteOrder}
                disabled={isDeleting}
              >
                <Icon icon={IconTrash} size="sm" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </div>
        </div>

        {/* Admin Reset for Suspended Orders */}
        {order.status === 'verification_suspended' && (
          <Card className="border-2 border-fill-warning/50 bg-fill-warning/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-fill-warning/20">
                  <Icon icon={IconAlertCircle} size="lg" className="text-fill-warning" />
                </div>
                <div className="flex-1">
                  <Typography variant="headingSm" className="mb-1">
                    Order Suspended - Admin Override Available
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    This order is suspended due to verification issues. As C&C admin, you can reset the order
                    to any point in the verification flow.
                  </Typography>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={resetTarget}
                    onValueChange={(v) => setResetTarget(v as ResetTargetStatus)}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {resetTargetOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex flex-col">
                            <span>{opt.label}</span>
                            <span className="text-xs text-text-muted">{opt.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => resetVerification({ targetStatus: resetTarget })}
                    disabled={isResetting}
                    colorRole="brand"
                  >
                    <Icon icon={isResetting ? IconLoader2 : IconRefresh} size="sm" className={isResetting ? 'animate-spin' : ''} />
                    <span className="ml-2">Reset Order</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Line Items - Full Width, Primary Focus */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <Typography variant="headingSm">
                Line Items ({order.items?.length ?? 0})
              </Typography>
              <div className="flex items-center gap-4 text-sm text-text-muted">
                <span>{order.caseCount ?? 0} cases</span>
                <span className="font-semibold text-text-primary">
                  {formatCurrencyValue(getAmount(order.totalUsd), currency)}
                </span>
              </div>
            </div>

            {order.items && order.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border-muted bg-surface-secondary/50">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">Product</th>
                      <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-text-muted">Producer</th>
                      <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">Yr</th>
                      <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">Qty</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide text-text-muted">{currency}/Case</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide text-text-muted">Total ({currency})</th>
                      {canEditItems && (
                        <th className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted"></th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted/50">
                    {order.items.map((item) => {
                      const isEditing = editingItem?.id === item.id;

                      if (isEditing && editingItem) {
                        return (
                          <tr key={item.id} className="bg-surface-muted/30">
                            <td className="px-2 py-1">
                              <Input
                                value={editingItem.productName}
                                onChange={(e) =>
                                  setEditingItem({ ...editingItem, productName: e.target.value })
                                }
                                className="h-6 text-xs"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                value={editingItem.producer}
                                onChange={(e) =>
                                  setEditingItem({ ...editingItem, producer: e.target.value })
                                }
                                className="h-6 text-xs"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                value={editingItem.vintage}
                                onChange={(e) =>
                                  setEditingItem({ ...editingItem, vintage: e.target.value })
                                }
                                className="h-6 w-14 text-center text-xs"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                type="number"
                                min={1}
                                value={editingItem.quantity}
                                onChange={(e) =>
                                  setEditingItem({
                                    ...editingItem,
                                    quantity: parseInt(e.target.value) || 1,
                                  })
                                }
                                className="h-6 w-12 text-center text-xs"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={editingItem.pricePerCaseUsd}
                                onChange={(e) =>
                                  setEditingItem({
                                    ...editingItem,
                                    pricePerCaseUsd: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="h-6 w-20 text-right text-xs"
                              />
                            </td>
                            <td className="px-2 py-1 text-right text-xs font-medium">
                              {formatCurrencyValue(editingItem.quantity * editingItem.pricePerCaseUsd, 'USD')}
                            </td>
                            <td className="px-2 py-1">
                              <div className="flex items-center justify-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={handleSaveItem}
                                  disabled={isUpdatingItem}
                                  className="h-5 w-5 p-0"
                                >
                                  <Icon icon={IconCheck} size="xs" colorRole="success" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setEditingItem(null)}
                                  className="h-5 w-5 p-0"
                                >
                                  <Icon icon={IconX} size="xs" colorRole="muted" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={item.id} className="hover:bg-surface-muted/20">
                          <td className="px-2 py-1.5">
                            <span className="text-xs font-medium">{item.productName}</span>
                            {item.lwin && (
                              <span className="ml-1 text-[10px] text-text-muted">
                                ({item.lwin})
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-xs">{item.producer || '-'}</td>
                          <td className="px-2 py-1.5 text-center text-xs">{item.vintage || '-'}</td>
                          <td className="px-2 py-1.5 text-center text-xs font-medium">{item.quantity}</td>
                          <td className="px-2 py-1.5 text-right text-xs">
                            {formatCurrencyValue(getAmount(item.pricePerCaseUsd), currency)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-xs font-semibold">
                            {formatCurrencyValue(getAmount(item.totalUsd), currency)}
                          </td>
                          {canEditItems && (
                            <td className="px-2 py-1.5">
                              <div className="flex items-center justify-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => handleEditItem(item)}
                                  className="h-5 w-5 p-0"
                                >
                                  <Icon icon={IconEdit} size="xs" colorRole="muted" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => handleRemoveItem(item.id)}
                                  disabled={isRemovingItem}
                                  className="h-5 w-5 p-0"
                                >
                                  <Icon icon={IconTrash} size="xs" colorRole="danger" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Typography variant="bodySm" colorRole="muted">
                No line items
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Secondary Info - Horizontal Grid Below */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Order Summary - Compact */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-2">
                Summary ({currency})
              </Typography>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Subtotal</span>
                  <span>{formatCurrencyValue(getAmount(order.subtotalUsd), currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Duty (5%)</span>
                  <span>{formatCurrencyValue(getAmount(order.dutyUsd), currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">VAT (5%)</span>
                  <span>{formatCurrencyValue(getAmount(order.vatUsd), currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Logistics</span>
                  <span>{formatCurrencyValue(getAmount(order.logisticsUsd), currency)}</span>
                </div>
                <Divider />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrencyValue(getAmount(order.totalUsd), currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Info - Compact */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-2">
                Client
              </Typography>
              <div className="space-y-1 text-sm">
                <Typography variant="bodySm" className="font-medium">
                  {order.clientName || '-'}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {order.clientEmail || '-'}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {order.clientPhone || '-'}
                </Typography>
              </div>
            </CardContent>
          </Card>

          {/* Distributor - With logo */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-1.5">
                <Icon icon={IconTruck} size="xs" colorRole="muted" />
                <Typography variant="labelSm" colorRole="muted">
                  Distributor
                </Typography>
              </div>
              {canAssignDistributor ? (
                <Select
                  value={order.distributor?.id}
                  onValueChange={handleDistributorAssign}
                  disabled={isAssigningDistributor}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select distributor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {distributors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          {d.logoUrl ? (
                            <Image
                              src={d.logoUrl}
                              alt={d.businessName}
                              width={20}
                              height={20}
                              className="rounded object-contain"
                            />
                          ) : (
                            <div className="flex h-5 w-5 items-center justify-center rounded bg-fill-muted">
                              <Icon icon={IconBuilding} size="xs" colorRole="muted" />
                            </div>
                          )}
                          <span>{d.businessName}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : order.distributor ? (
                <div className="flex items-center gap-3">
                  {order.distributor.logoUrl ? (
                    <Image
                      src={order.distributor.logoUrl}
                      alt={order.distributor.businessName}
                      width={48}
                      height={48}
                      className="rounded-lg border border-border-muted object-contain p-1"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-muted bg-fill-muted">
                      <Icon icon={IconTruck} size="md" colorRole="muted" />
                    </div>
                  )}
                  <Typography variant="bodySm" className="font-medium">
                    {order.distributor.businessName}
                  </Typography>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border-muted bg-surface-muted">
                    <Icon icon={IconTruck} size="md" colorRole="muted" />
                  </div>
                  <Typography variant="bodyXs" colorRole="muted">
                    Assign after approval
                  </Typography>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Partner Info - With logo */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-1.5">
                <Icon icon={IconBuilding} size="xs" colorRole="muted" />
                <Typography variant="labelSm" colorRole="muted">
                  Partner
                </Typography>
              </div>
              <div className="flex items-center gap-3">
                {order.partner?.logoUrl ? (
                  <Image
                    src={order.partner.logoUrl}
                    alt={order.partner.businessName}
                    width={48}
                    height={48}
                    className="rounded-lg border border-border-muted object-contain p-1"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-muted"
                    style={{
                      backgroundColor: order.partner?.brandColor
                        ? `${order.partner.brandColor}20`
                        : undefined,
                    }}
                  >
                    <Icon icon={IconBuilding} size="md" colorRole="muted" />
                  </div>
                )}
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    {order.partner?.businessName ?? 'Unknown'}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Created {formatDate(order.createdAt)}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment & Documents - Full Width */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <PaymentTracker
                order={order}
                canConfirmPayments={true}
                onPaymentConfirmed={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ['privateClientOrders.adminGetOne', orderId],
                  });
                  void refetch();
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-3">
                Documents
              </Typography>
              <DocumentUpload orderId={orderId} />
            </CardContent>
          </Card>
        </div>

        {/* Notes - if present */}
        {(order.partnerNotes || order.deliveryNotes) && (
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {order.partnerNotes && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Partner Notes
                    </Typography>
                    <Typography variant="bodySm">{order.partnerNotes}</Typography>
                  </div>
                )}
                {order.deliveryNotes && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Delivery Notes
                    </Typography>
                    <Typography variant="bodySm">{order.deliveryNotes}</Typography>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminPrivateOrderDetailPage;
