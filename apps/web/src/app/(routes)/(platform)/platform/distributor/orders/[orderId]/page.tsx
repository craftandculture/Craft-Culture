'use client';

import {
  IconArrowLeft,
  IconBuilding,
  IconCheck,
  IconLoader2,
  IconPackage,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import ActivityTimeline from '@/app/_privateClientOrders/components/ActivityTimeline';
import DocumentUpload from '@/app/_privateClientOrders/components/DocumentUpload';
import PaymentTracker from '@/app/_privateClientOrders/components/PaymentTracker';
import PrivateOrderStatusBadge from '@/app/_privateClientOrders/components/PrivateOrderStatusBadge';
import WorkflowStepper from '@/app/_privateClientOrders/components/WorkflowStepper';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

/**
 * Distributor order detail page
 *
 * Shows full order details with action buttons for status updates.
 * Matches admin UX patterns with compact layout.
 */
const DistributorOrderDetailPage = () => {
  const params = useParams();
  const orderId = params.orderId as string;
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    ...api.privateClientOrders.distributorGetOne.queryOptions({ id: orderId }),
    enabled: !!orderId,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      trpcClient.privateClientOrders.distributorUpdateStatus.mutate({
        orderId,
        status: status as
          | 'client_paid'
          | 'awaiting_distributor_payment'
          | 'distributor_paid'
          | 'stock_in_transit'
          | 'with_distributor'
          | 'out_for_delivery'
          | 'delivered',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders.distributorGetOne'] });
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders.distributorGetMany'] });
      toast.success('Order status updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  /**
   * Get next action matching backend distributorTransitions exactly
   */
  const getNextAction = () => {
    if (!order) return null;

    switch (order.status) {
      case 'cc_approved':
      case 'awaiting_client_payment':
        return { label: 'Confirm Client Payment', status: 'client_paid', icon: IconCheck };
      case 'client_paid':
        return { label: 'Awaiting Distributor Payment', status: 'awaiting_distributor_payment', icon: IconCheck };
      case 'awaiting_distributor_payment':
        return { label: 'Confirm Payment to C&C', status: 'distributor_paid', icon: IconCheck };
      // distributor_paid: Wait for C&C to mark stock_in_transit - no action button
      case 'stock_in_transit':
        return { label: 'Stock Received', status: 'with_distributor', icon: IconPackage };
      case 'with_distributor':
        return { label: 'Start Delivery', status: 'out_for_delivery', icon: IconTruck };
      case 'out_for_delivery':
        return { label: 'Mark Delivered', status: 'delivered', icon: IconCheck };
      default:
        return null;
    }
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
              The order you&apos;re looking for doesn&apos;t exist or is not assigned to you.
            </Typography>
            <Button variant="outline" asChild>
              <Link href="/platform/distributor/orders">Back to Orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nextAction = getNextAction();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-4">
        {/* Header - compact with action button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/distributor/orders">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <Typography variant="headingLg">{order.orderNumber}</Typography>
            <PrivateOrderStatusBadge status={order.status} />
          </div>

          {/* Next Action Button */}
          {nextAction && (
            <Button
              colorRole="brand"
              onClick={() => updateStatus.mutate(nextAction.status)}
              disabled={updateStatus.isPending}
            >
              <ButtonContent iconLeft={nextAction.icon} isLoading={updateStatus.isPending}>
                {nextAction.label}
              </ButtonContent>
            </Button>
          )}
        </div>

        {/* Workflow Stepper */}
        <WorkflowStepper order={order} />

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
                  {formatPrice(Number(order.totalUsd) || 0, 'USD')}
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
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide text-text-muted">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted/50">
                    {order.items.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-muted/20">
                        <td className="px-2 py-1.5">
                          <span className="text-xs font-medium">{item.productName}</span>
                        </td>
                        <td className="px-2 py-1.5 text-xs">{item.producer || '-'}</td>
                        <td className="px-2 py-1.5 text-center text-xs">{item.vintage || '-'}</td>
                        <td className="px-2 py-1.5 text-center text-xs font-medium">{item.quantity}</td>
                        <td className="px-2 py-1.5 text-right text-xs font-semibold">
                          {formatPrice(Number(item.totalUsd) || 0, 'USD')}
                        </td>
                      </tr>
                    ))}
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
                Summary
              </Typography>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Subtotal</span>
                  <span>{formatPrice(Number(order.subtotalUsd) || 0, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Duty (5%)</span>
                  <span>{formatPrice(Number(order.dutyUsd) || 0, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">VAT (5%)</span>
                  <span>{formatPrice(Number(order.vatUsd) || 0, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Logistics</span>
                  <span>{formatPrice(Number(order.logisticsUsd) || 0, 'USD')}</span>
                </div>
                <Divider />
                <div className="flex justify-between font-semibold">
                  <span>Total (USD)</span>
                  <span>{formatPrice(Number(order.totalUsd) || 0, 'USD')}</span>
                </div>
                {order.totalAed && (
                  <div className="flex justify-between font-semibold">
                    <span>Total (AED)</span>
                    <span>{formatPrice(Number(order.totalAed), 'AED')}</span>
                  </div>
                )}
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
                  {order.clientPhone || '-'}
                </Typography>
                {order.clientAddress && (
                  <Typography variant="bodyXs" colorRole="muted" className="line-clamp-2">
                    {order.clientAddress}
                  </Typography>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Partner Info - Compact with logo */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-2">
                Partner
              </Typography>
              {order.partner ? (
                <div className="flex items-center gap-2">
                  {order.partner.logoUrl ? (
                    <Image
                      src={order.partner.logoUrl}
                      alt={order.partner.businessName}
                      width={28}
                      height={28}
                      className="rounded object-contain"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-fill-muted">
                      <Icon icon={IconBuilding} size="xs" colorRole="muted" />
                    </div>
                  )}
                  <Typography variant="bodySm" className="font-medium">
                    {order.partner.businessName}
                  </Typography>
                </div>
              ) : (
                <Typography variant="bodyXs" colorRole="muted">
                  Unknown
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Key Dates - Compact */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-2">
                Key Dates
              </Typography>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Assigned</span>
                  <span>{formatDate(order.distributorAssignedAt)}</span>
                </div>
                {order.clientPaidAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Client Paid</span>
                    <span>{formatDate(order.clientPaidAt)}</span>
                  </div>
                )}
                {order.distributorPaidAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Paid to C&C</span>
                    <span>{formatDate(order.distributorPaidAt)}</span>
                  </div>
                )}
                {order.stockReceivedAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Stock Received</span>
                    <span>{formatDate(order.stockReceivedAt)}</span>
                  </div>
                )}
                {order.deliveredAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Delivered</span>
                    <span>{formatDate(order.deliveredAt)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment, Documents & Activity - Full Width Grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <PaymentTracker
                order={order}
                canConfirmPayments={false}
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

        {/* Activity Timeline */}
        <Card>
          <CardContent className="p-4">
            <Typography variant="headingSm" className="mb-3">
              Activity Timeline
            </Typography>
            <ActivityTimeline activities={order.activityLogs ?? []} />
          </CardContent>
        </Card>

        {/* Notes - if present */}
        {(order.distributorNotes || order.deliveryNotes) && (
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {order.deliveryNotes && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Delivery Notes
                    </Typography>
                    <Typography variant="bodySm">{order.deliveryNotes}</Typography>
                  </div>
                )}
                {order.distributorNotes && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Your Notes
                    </Typography>
                    <Typography variant="bodySm">{order.distributorNotes}</Typography>
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

export default DistributorOrderDetailPage;
