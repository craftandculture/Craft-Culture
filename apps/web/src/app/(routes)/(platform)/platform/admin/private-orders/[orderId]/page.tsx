'use client';

import { IconArrowLeft, IconLoader2 } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import PrivateOrderStatusBadge from '@/app/_privateClientOrders/components/PrivateOrderStatusBadge';
import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
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

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_cc_review', label: 'Under Review' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'cc_approved', label: 'Approved' },
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

/**
 * Admin detail view for a single private client order
 *
 * Shows full order details including line items and allows status updates.
 */
const AdminPrivateOrderDetailPage = () => {
  const params = useParams();
  const orderId = params.orderId as string;
  const api = useTRPC();
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch order details
  const { data: order, isLoading, refetch } = useQuery({
    ...api.privateClientOrders.adminGetOne.queryOptions({ id: orderId }),
    enabled: !!orderId,
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

  const handleStatusChange = (newStatus: OrderStatus) => {
    setIsUpdating(true);
    updateStatus({ orderId, status: newStatus });
  };

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

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/admin/private-orders">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <Typography variant="headingLg">{order.orderNumber}</Typography>
                <PrivateOrderStatusBadge status={order.status} />
              </div>
              <Typography variant="bodySm" colorRole="muted">
                Created {formatDate(order.createdAt)}
              </Typography>
            </div>
          </div>
        </div>

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
                          <th className="pb-2 text-left font-medium text-text-muted">Producer</th>
                          <th className="pb-2 text-center font-medium text-text-muted">Vintage</th>
                          <th className="pb-2 text-center font-medium text-text-muted">Qty</th>
                          <th className="pb-2 text-right font-medium text-text-muted">Price/Case</th>
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
                              {item.lwin && (
                                <Typography variant="bodyXs" colorRole="muted">
                                  LWIN: {item.lwin}
                                </Typography>
                              )}
                            </td>
                            <td className="py-3">
                              <Typography variant="bodySm">{item.producer || '-'}</Typography>
                            </td>
                            <td className="py-3 text-center">
                              <Typography variant="bodySm">{item.vintage || '-'}</Typography>
                            </td>
                            <td className="py-3 text-center">
                              <Typography variant="bodySm">{item.quantity}</Typography>
                            </td>
                            <td className="py-3 text-right">
                              <Typography variant="bodySm">
                                {formatPrice(Number(item.pricePerCaseUsd) || 0, 'USD')}
                              </Typography>
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
                    <Typography variant="bodySm">{order.clientName || '-'}</Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Email
                    </Typography>
                    <Typography variant="bodySm">{order.clientEmail || '-'}</Typography>
                  </div>
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Phone
                    </Typography>
                    <Typography variant="bodySm">{order.clientPhone || '-'}</Typography>
                  </div>
                  <div>
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Update */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Update Status
                </Typography>
                <Select
                  value={order.status}
                  onValueChange={(v) => handleStatusChange(v as OrderStatus)}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="w-full">
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
                      Items
                    </Typography>
                    <Typography variant="bodySm">{order.itemCount ?? 0}</Typography>
                  </div>
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
                      Total
                    </Typography>
                    <Typography variant="bodyMd" className="font-semibold">
                      {formatPrice(Number(order.totalUsd) || 0, 'USD')}
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Partner Info */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Partner
                </Typography>
                <div className="space-y-2">
                  <Typography variant="bodySm" className="font-medium">
                    {order.partner?.businessName ?? 'Unknown Partner'}
                  </Typography>
                  {order.partner?.contactEmail && (
                    <Typography variant="bodyXs" colorRole="muted">
                      {order.partner.contactEmail}
                    </Typography>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Internal Notes */}
            {order.partnerNotes && (
              <Card>
                <CardContent className="p-6">
                  <Typography variant="headingSm" className="mb-4">
                    Partner Notes
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {order.partnerNotes}
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

export default AdminPrivateOrderDetailPage;
