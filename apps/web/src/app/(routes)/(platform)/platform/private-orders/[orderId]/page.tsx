'use client';

import { IconArrowLeft, IconBuilding, IconLoader2 } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import ActivityTimeline from '@/app/_privateClientOrders/components/ActivityTimeline';
import DocumentUpload from '@/app/_privateClientOrders/components/DocumentUpload';
import PaymentTracker from '@/app/_privateClientOrders/components/PaymentTracker';
import PrivateOrderStatusBadge from '@/app/_privateClientOrders/components/PrivateOrderStatusBadge';
import WorkflowStepper from '@/app/_privateClientOrders/components/WorkflowStepper';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

/**
 * Partner detail view for a single private client order
 *
 * Shows full order details including line items in read-only mode.
 * Matches admin UX patterns with compact layout.
 */
const PrivateOrderDetailPage = () => {
  const params = useParams();
  const orderId = params.orderId as string;
  const api = useTRPC();
  const queryClient = useQueryClient();

  // Fetch order details
  const { data: order, isLoading, refetch } = useQuery({
    ...api.privateClientOrders.getOne.queryOptions({ id: orderId }),
    enabled: !!orderId,
  });

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
              <Link href="/platform/private-orders">Back to Orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-4">
        {/* Header - compact */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/private-orders">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <Typography variant="headingLg">{order.orderNumber}</Typography>
            <PrivateOrderStatusBadge status={order.status} />
          </div>
          <Typography variant="bodySm" colorRole="muted">
            Created {formatDate(order.createdAt)}
          </Typography>
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
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide text-text-muted">$/Case</th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-medium uppercase tracking-wide text-text-muted">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted/50">
                    {order.items.map((item) => (
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
                          {formatPrice(Number(item.pricePerCaseUsd) || 0, 'USD')}
                        </td>
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
                  <span>Total</span>
                  <span>{formatPrice(Number(order.totalUsd) || 0, 'USD')}</span>
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

          {/* Distributor Info - Compact */}
          <Card>
            <CardContent className="p-4">
              <Typography variant="labelSm" colorRole="muted" className="mb-2">
                Distributor
              </Typography>
              {order.distributor ? (
                <div className="flex items-center gap-2">
                  {order.distributor.logoUrl ? (
                    <Image
                      src={order.distributor.logoUrl}
                      alt={order.distributor.businessName}
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
                    {order.distributor.businessName}
                  </Typography>
                </div>
              ) : (
                <Typography variant="bodyXs" colorRole="muted">
                  Not yet assigned
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
                  <span className="text-text-muted">Created</span>
                  <span>{formatDate(order.createdAt)}</span>
                </div>
                {order.submittedAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Submitted</span>
                    <span>{formatDate(order.submittedAt)}</span>
                  </div>
                )}
                {order.ccApprovedAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Approved</span>
                    <span>{formatDate(order.ccApprovedAt)}</span>
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
                canConfirmPayments={true}
                onPaymentConfirmed={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ['privateClientOrders.getOne', orderId],
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
        {(order.partnerNotes || order.deliveryNotes || order.clientAddress) && (
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {order.clientAddress && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Delivery Address
                    </Typography>
                    <Typography variant="bodySm">{order.clientAddress}</Typography>
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
                {order.partnerNotes && (
                  <div>
                    <Typography variant="labelSm" colorRole="muted" className="mb-1">
                      Internal Notes
                    </Typography>
                    <Typography variant="bodySm">{order.partnerNotes}</Typography>
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

export default PrivateOrderDetailPage;
