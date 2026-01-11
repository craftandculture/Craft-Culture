'use client';

import {
  IconArrowLeft,
  IconCalendar,
  IconCheck,
  IconClock,
  IconMapPin,
  IconPackage,
  IconReceipt,
  IconSend,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

/**
 * Partner Purchase Order detail page
 */
const PartnerOrderDetailPage = () => {
  const params = useParams();
  const poId = params.poId as string;
  const api = useTRPC();

  // Dialog states
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isShipDialogOpen, setIsShipDialogOpen] = useState(false);
  const [isDeliverDialogOpen, setIsDeliverDialogOpen] = useState(false);

  // Form states
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  const [confirmationNotes, setConfirmationNotes] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Fetch PO
  const { data: po, isLoading, refetch } = useQuery({
    ...api.source.partner.getOnePurchaseOrder.queryOptions({ poId }),
  });

  // Confirm PO mutation
  const { mutate: confirmPo, isPending: isConfirming } = useMutation(
    api.source.partner.confirmPurchaseOrder.mutationOptions({
      onSuccess: () => {
        setIsConfirmDialogOpen(false);
        setEstimatedDeliveryDate('');
        setConfirmationNotes('');
        void refetch();
      },
    })
  );

  // Update delivery status mutation
  const { mutate: updateDeliveryStatus, isPending: isUpdating } = useMutation(
    api.source.partner.updateDeliveryStatus.mutationOptions({
      onSuccess: () => {
        setIsShipDialogOpen(false);
        setIsDeliverDialogOpen(false);
        setTrackingNumber('');
        setShippingNotes('');
        setDeliveryNotes('');
        void refetch();
      },
    })
  );

  const formatDate = (date: Date | string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'sent':
        return {
          icon: IconClock,
          bg: 'bg-amber-100',
          text: 'text-amber-700',
          label: 'Awaiting Confirmation',
        };
      case 'confirmed':
        return {
          icon: IconCheck,
          bg: 'bg-green-100',
          text: 'text-green-700',
          label: 'Confirmed',
        };
      case 'shipped':
        return {
          icon: IconTruck,
          bg: 'bg-blue-100',
          text: 'text-blue-700',
          label: 'Shipped',
        };
      case 'delivered':
        return {
          icon: IconCheck,
          bg: 'bg-emerald-100',
          text: 'text-emerald-700',
          label: 'Delivered',
        };
      default:
        return {
          icon: IconPackage,
          bg: 'bg-gray-100',
          text: 'text-gray-700',
          label: status,
        };
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <Typography variant="bodyMd" colorRole="muted">
          Loading order...
        </Typography>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <Typography variant="bodyMd" colorRole="muted">
          Order not found
        </Typography>
      </div>
    );
  }

  const statusConfig = getStatusConfig(po.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/platform/partner/source/orders">
              <Button variant="ghost" size="sm" aria-label="Back to orders">
                <ButtonContent iconLeft={IconArrowLeft} />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Typography variant="bodyXs" className="font-mono text-text-muted">
                  {po.poNumber}
                </Typography>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                  <StatusIcon size={14} />
                  {statusConfig.label}
                </span>
              </div>
              <Typography variant="headingLg">{po.rfqName || 'Purchase Order'}</Typography>
              {po.rfqNumber && (
                <Typography variant="bodySm" colorRole="muted">
                  RFQ: {po.rfqNumber}
                </Typography>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {po.status === 'sent' && (
              <Button
                variant="default"
                colorRole="brand"
                onClick={() => setIsConfirmDialogOpen(true)}
              >
                <ButtonContent iconLeft={IconCheck}>Confirm Order</ButtonContent>
              </Button>
            )}
            {po.status === 'confirmed' && (
              <Button
                variant="default"
                colorRole="brand"
                onClick={() => setIsShipDialogOpen(true)}
              >
                <ButtonContent iconLeft={IconTruck}>Mark as Shipped</ButtonContent>
              </Button>
            )}
            {po.status === 'shipped' && (
              <Button
                variant="default"
                colorRole="brand"
                onClick={() => setIsDeliverDialogOpen(true)}
              >
                <ButtonContent iconLeft={IconCheck}>Mark as Delivered</ButtonContent>
              </Button>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <Card className="bg-gradient-to-r from-fill-brand/5 to-fill-brand/10 border-border-brand">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Typography variant="bodySm" colorRole="muted">
                  Order Total
                </Typography>
                <Typography variant="headingLg" className="text-text-brand">
                  {formatPrice(po.totalAmountUsd ?? 0, 'USD')}
                </Typography>
              </div>
              <div className="text-right">
                <Typography variant="bodySm" colorRole="muted">
                  Items
                </Typography>
                <Typography variant="headingLg">
                  {po.items.length}
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline / Status Info */}
        <Card>
          <CardContent className="p-4">
            <Typography variant="headingSm" className="mb-4">
              Order Timeline
            </Typography>
            <div className="space-y-3">
              {po.sentAt && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <IconSend className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <Typography variant="bodyMd" className="font-medium">
                      Order Received
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      {formatDate(po.sentAt)}
                    </Typography>
                  </div>
                </div>
              )}
              {po.confirmedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <IconCheck className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <Typography variant="bodyMd" className="font-medium">
                      Confirmed
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      {formatDate(po.confirmedAt)}
                      {po.confirmationNotes && ` - ${po.confirmationNotes}`}
                    </Typography>
                  </div>
                </div>
              )}
              {po.estimatedDeliveryDate && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <IconCalendar className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <Typography variant="bodyMd" className="font-medium">
                      Estimated Delivery
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      {formatDate(po.estimatedDeliveryDate)}
                    </Typography>
                  </div>
                </div>
              )}
              {po.shippedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <IconTruck className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <Typography variant="bodyMd" className="font-medium">
                      Shipped
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      {formatDate(po.shippedAt)}
                      {po.trackingNumber && ` - Tracking: ${po.trackingNumber}`}
                    </Typography>
                  </div>
                </div>
              )}
              {po.deliveredAt && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <IconCheck className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <Typography variant="bodyMd" className="font-medium">
                      Delivered
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      {formatDate(po.deliveredAt)}
                    </Typography>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Details */}
        {(po.deliveryAddress || po.deliveryInstructions || po.paymentTerms) && (
          <Card>
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-4">
                Delivery Details
              </Typography>
              <div className="space-y-4">
                {po.deliveryAddress && (
                  <div className="flex items-start gap-3">
                    <IconMapPin className="h-5 w-5 text-text-muted flex-shrink-0 mt-0.5" />
                    <div>
                      <Typography variant="bodySm" colorRole="muted">
                        Delivery Address
                      </Typography>
                      <Typography variant="bodyMd" className="whitespace-pre-wrap">
                        {po.deliveryAddress}
                      </Typography>
                    </div>
                  </div>
                )}
                {po.deliveryInstructions && (
                  <div className="flex items-start gap-3">
                    <IconPackage className="h-5 w-5 text-text-muted flex-shrink-0 mt-0.5" />
                    <div>
                      <Typography variant="bodySm" colorRole="muted">
                        Instructions
                      </Typography>
                      <Typography variant="bodyMd">
                        {po.deliveryInstructions}
                      </Typography>
                    </div>
                  </div>
                )}
                {po.paymentTerms && (
                  <div className="flex items-start gap-3">
                    <IconReceipt className="h-5 w-5 text-text-muted flex-shrink-0 mt-0.5" />
                    <div>
                      <Typography variant="bodySm" colorRole="muted">
                        Payment Terms
                      </Typography>
                      <Typography variant="bodyMd">
                        {po.paymentTerms}
                      </Typography>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-border-muted">
              <Typography variant="headingSm">Order Items</Typography>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-fill-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">Product</th>
                    <th className="px-4 py-3 text-right font-medium text-text-muted">Qty</th>
                    <th className="px-4 py-3 text-right font-medium text-text-muted">Unit Price</th>
                    <th className="px-4 py-3 text-right font-medium text-text-muted">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item) => (
                    <tr key={item.id} className="border-b border-border-muted last:border-0">
                      <td className="px-4 py-3">
                        <div>
                          <Typography variant="bodyMd" className="font-medium">
                            {item.productName}
                          </Typography>
                          <div className="flex items-center gap-2 text-text-muted text-xs">
                            {item.producer && <span>{item.producer}</span>}
                            {item.vintage && <span>{item.vintage}</span>}
                            {item.lwin && (
                              <span className="font-mono bg-fill-muted px-1 rounded">
                                {item.lwin}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.quantity} {item.unitType}
                        {item.quantity !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatPrice(item.unitPriceUsd ?? 0, 'USD')}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatPrice(item.lineTotalUsd ?? 0, 'USD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-fill-muted/50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                      Total:
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text-brand">
                      {formatPrice(po.totalAmountUsd ?? 0, 'USD')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {po.notes && (
          <Card>
            <CardContent className="p-4">
              <Typography variant="headingSm" className="mb-2">
                Notes
              </Typography>
              <Typography variant="bodyMd" colorRole="muted">
                {po.notes}
              </Typography>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirm Order Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Order</DialogTitle>
            <DialogDescription>
              Confirm that you can fulfill this purchase order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Estimated Delivery Date (optional)</label>
              <input
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <textarea
                value={confirmationNotes}
                onChange={(e) => setConfirmationNotes(e.target.value)}
                placeholder="Any notes about the order..."
                className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsConfirmDialogOpen(false)}
              isDisabled={isConfirming}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              colorRole="brand"
              onClick={() => {
                confirmPo({
                  poId,
                  estimatedDeliveryDate: estimatedDeliveryDate
                    ? new Date(estimatedDeliveryDate)
                    : undefined,
                  confirmationNotes: confirmationNotes || undefined,
                });
              }}
              isDisabled={isConfirming}
            >
              <ButtonContent iconLeft={IconCheck}>
                {isConfirming ? 'Confirming...' : 'Confirm Order'}
              </ButtonContent>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ship Order Dialog */}
      <Dialog open={isShipDialogOpen} onOpenChange={setIsShipDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Shipped</DialogTitle>
            <DialogDescription>
              Record shipping details for this order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tracking Number (optional)</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g., DHL-123456789"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Shipping Notes (optional)</label>
              <textarea
                value={shippingNotes}
                onChange={(e) => setShippingNotes(e.target.value)}
                placeholder="e.g., 2 pallets, fragile handling required..."
                className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsShipDialogOpen(false)}
              isDisabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              colorRole="brand"
              onClick={() => {
                updateDeliveryStatus({
                  poId,
                  action: 'ship',
                  trackingNumber: trackingNumber || undefined,
                  shippingNotes: shippingNotes || undefined,
                });
              }}
              isDisabled={isUpdating}
            >
              <ButtonContent iconLeft={IconTruck}>
                {isUpdating ? 'Updating...' : 'Mark as Shipped'}
              </ButtonContent>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deliver Order Dialog */}
      <Dialog open={isDeliverDialogOpen} onOpenChange={setIsDeliverDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Delivered</DialogTitle>
            <DialogDescription>
              Confirm that this order has been delivered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Delivery Notes (optional)</label>
              <textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="e.g., Signed by warehouse manager, all items received..."
                className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeliverDialogOpen(false)}
              isDisabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              colorRole="brand"
              onClick={() => {
                updateDeliveryStatus({
                  poId,
                  action: 'deliver',
                  deliveryNotes: deliveryNotes || undefined,
                });
              }}
              isDisabled={isUpdating}
            >
              <ButtonContent iconLeft={IconCheck}>
                {isUpdating ? 'Updating...' : 'Mark as Delivered'}
              </ButtonContent>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerOrderDetailPage;
