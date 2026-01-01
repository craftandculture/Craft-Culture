'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconLoader2,
  IconPackage,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getNextAction = () => {
    if (!order) return null;

    switch (order.status) {
      case 'cc_approved':
      case 'awaiting_client_payment':
        return { label: 'Confirm Client Payment', status: 'client_paid', icon: IconCheck };
      case 'client_paid':
        return { label: 'Confirm Payment to C&C', status: 'distributor_paid', icon: IconCheck };
      case 'distributor_paid':
        return { label: 'Stock In Transit', status: 'stock_in_transit', icon: IconTruck };
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
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
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
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/distributor/orders">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <Typography variant="headingLg">{order.orderNumber}</Typography>
                <PrivateOrderStatusBadge status={order.status} />
              </div>
              <Typography variant="bodySm" colorRole="muted">
                Partner: {order.partner?.businessName ?? 'Unknown'}
              </Typography>
            </div>
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

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Line Items */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Line Items ({order.items?.length ?? 0})
                </Typography>

                {order.items && order.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border-muted">
                        <tr>
                          <th className="pb-2 text-left font-medium text-text-muted">Product</th>
                          <th className="pb-2 text-center font-medium text-text-muted">Vintage</th>
                          <th className="pb-2 text-center font-medium text-text-muted">Cases</th>
                          <th className="pb-2 text-right font-medium text-text-muted">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-muted">
                        {order.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-3">
                              <Typography variant="bodySm" className="font-medium">
                                {item.productName}
                              </Typography>
                              <Typography variant="bodyXs" colorRole="muted">
                                {item.producer || '-'}
                              </Typography>
                            </td>
                            <td className="py-3 text-center">
                              <Typography variant="bodySm">{item.vintage || '-'}</Typography>
                            </td>
                            <td className="py-3 text-center">
                              <Typography variant="bodySm">{item.quantity}</Typography>
                            </td>
                            <td className="py-3 text-right">
                              <Typography variant="bodySm" className="font-medium">
                                {formatPrice(Number(item.totalUsd) || 0, 'USD')}
                              </Typography>
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

            {/* Client Information */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Client Information
                </Typography>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Name
                    </Typography>
                    <Typography variant="bodySm" className="font-medium">
                      {order.clientName || '-'}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Phone
                    </Typography>
                    <Typography variant="bodySm">{order.clientPhone || '-'}</Typography>
                  </div>
                  <div className="sm:col-span-2">
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Address
                    </Typography>
                    <Typography variant="bodySm">{order.clientAddress || '-'}</Typography>
                  </div>
                  {order.deliveryNotes && (
                    <div className="sm:col-span-2">
                      <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                        Delivery Notes
                      </Typography>
                      <Typography variant="bodySm">{order.deliveryNotes}</Typography>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Activity Timeline
                </Typography>
                <ActivityTimeline activities={order.activityLogs ?? []} />
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Documents
                </Typography>
                <DocumentUpload orderId={orderId} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Payment Tracker */}
            <Card>
              <CardContent className="p-6">
                <PaymentTracker
                  order={order}
                  canConfirmPayments={false}
                />
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Order Summary
                </Typography>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Typography variant="bodySm" colorRole="muted">
                      Cases
                    </Typography>
                    <Typography variant="bodySm">{order.caseCount ?? 0}</Typography>
                  </div>

                  <Divider />

                  <div className="flex justify-between">
                    <Typography variant="bodySm" colorRole="muted">
                      Subtotal
                    </Typography>
                    <Typography variant="bodySm">
                      {formatPrice(Number(order.subtotalUsd) || 0, 'USD')}
                    </Typography>
                  </div>
                  <div className="flex justify-between">
                    <Typography variant="bodySm" colorRole="muted">
                      Duty
                    </Typography>
                    <Typography variant="bodySm">
                      {formatPrice(Number(order.dutyUsd) || 0, 'USD')}
                    </Typography>
                  </div>
                  <div className="flex justify-between">
                    <Typography variant="bodySm" colorRole="muted">
                      VAT
                    </Typography>
                    <Typography variant="bodySm">
                      {formatPrice(Number(order.vatUsd) || 0, 'USD')}
                    </Typography>
                  </div>
                  <div className="flex justify-between">
                    <Typography variant="bodySm" colorRole="muted">
                      Logistics
                    </Typography>
                    <Typography variant="bodySm">
                      {formatPrice(Number(order.logisticsUsd) || 0, 'USD')}
                    </Typography>
                  </div>

                  <Divider />

                  <div className="flex justify-between">
                    <Typography variant="bodySm" className="font-semibold">
                      Total (USD)
                    </Typography>
                    <Typography variant="bodyMd" className="font-semibold">
                      {formatPrice(Number(order.totalUsd) || 0, 'USD')}
                    </Typography>
                  </div>
                  {order.totalAed && (
                    <div className="flex justify-between">
                      <Typography variant="bodySm" className="font-semibold">
                        Total (AED)
                      </Typography>
                      <Typography variant="bodyMd" className="font-semibold">
                        {formatPrice(Number(order.totalAed), 'AED')}
                      </Typography>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Key Dates */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Key Dates
                </Typography>
                <div className="space-y-3">
                  <div>
                    <Typography variant="bodyXs" colorRole="muted">
                      Assigned to You
                    </Typography>
                    <Typography variant="bodySm">
                      {formatDate(order.distributorAssignedAt)}
                    </Typography>
                  </div>
                  {order.clientPaidAt && (
                    <div>
                      <Typography variant="bodyXs" colorRole="muted">
                        Client Paid
                      </Typography>
                      <Typography variant="bodySm">{formatDate(order.clientPaidAt)}</Typography>
                    </div>
                  )}
                  {order.distributorPaidAt && (
                    <div>
                      <Typography variant="bodyXs" colorRole="muted">
                        Payment to C&C
                      </Typography>
                      <Typography variant="bodySm">
                        {formatDate(order.distributorPaidAt)}
                      </Typography>
                    </div>
                  )}
                  {order.stockReceivedAt && (
                    <div>
                      <Typography variant="bodyXs" colorRole="muted">
                        Stock Received
                      </Typography>
                      <Typography variant="bodySm">{formatDate(order.stockReceivedAt)}</Typography>
                    </div>
                  )}
                  {order.deliveredAt && (
                    <div>
                      <Typography variant="bodyXs" colorRole="muted">
                        Delivered
                      </Typography>
                      <Typography variant="bodySm">{formatDate(order.deliveredAt)}</Typography>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Distributor Notes */}
            {order.distributorNotes && (
              <Card>
                <CardContent className="p-6">
                  <Typography variant="headingSm" className="mb-4">
                    Your Notes
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {order.distributorNotes}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistributorOrderDetailPage;
