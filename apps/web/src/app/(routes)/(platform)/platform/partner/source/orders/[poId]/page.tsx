'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconMapPin,
  IconPackage,
  IconReceipt,
  IconSend,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

interface ItemConfirmation {
  itemId: string;
  confirmed: boolean;
  rejectionReason?: string;
}

/**
 * Partner Purchase Order detail page with per-item confirmation
 */
const PartnerOrderDetailPage = () => {
  const params = useParams();
  const poId = params.poId as string;
  const api = useTRPC();

  // Per-item confirmation state
  const [itemConfirmations, setItemConfirmations] = useState<Map<string, ItemConfirmation>>(
    new Map()
  );
  const [generalNotes, setGeneralNotes] = useState('');

  // Fetch PO
  const { data: po, isLoading, refetch } = useQuery({
    ...api.source.partner.getOnePurchaseOrder.queryOptions({ poId }),
  });

  // Initialize item confirmations when PO loads
  const initializeConfirmations = () => {
    if (po && po.status === 'sent' && itemConfirmations.size === 0) {
      const newConfirmations = new Map<string, ItemConfirmation>();
      po.items.forEach((item) => {
        newConfirmations.set(item.id, {
          itemId: item.id,
          confirmed: true, // Default to confirmed
          rejectionReason: undefined,
        });
      });
      setItemConfirmations(newConfirmations);
    }
  };

  // Call initialization
  if (po && po.status === 'sent' && itemConfirmations.size === 0) {
    initializeConfirmations();
  }

  // Confirm PO mutation
  const { mutate: confirmPo, isPending: isConfirming } = useMutation(
    api.source.partner.confirmPurchaseOrder.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    })
  );

  const toggleItemConfirmation = (itemId: string) => {
    setItemConfirmations((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(itemId);
      if (current) {
        newMap.set(itemId, {
          ...current,
          confirmed: !current.confirmed,
          rejectionReason: current.confirmed ? '' : undefined,
        });
      }
      return newMap;
    });
  };

  const setItemRejectionReason = (itemId: string, reason: string) => {
    setItemConfirmations((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(itemId);
      if (current) {
        newMap.set(itemId, {
          ...current,
          rejectionReason: reason,
        });
      }
      return newMap;
    });
  };

  const handleSubmitConfirmation = () => {
    const items = Array.from(itemConfirmations.values());
    confirmPo({
      poId,
      items,
      notes: generalNotes || undefined,
    });
  };

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
      case 'partially_confirmed':
        return {
          icon: IconCheck,
          bg: 'bg-yellow-100',
          text: 'text-yellow-700',
          label: 'Partially Confirmed',
        };
      case 'cancelled':
        return {
          icon: IconX,
          bg: 'bg-red-100',
          text: 'text-red-700',
          label: 'Cancelled',
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

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
            <IconCheck className="h-3 w-3" />
            Confirmed
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
            <IconX className="h-3 w-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
            <IconClock className="h-3 w-3" />
            Pending
          </span>
        );
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
  const confirmedCount = Array.from(itemConfirmations.values()).filter((i) => i.confirmed).length;
  const rejectedCount = po.items.length - confirmedCount;

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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    po.status === 'partially_confirmed' ? 'bg-yellow-100' : 'bg-green-100'
                  }`}>
                    <IconCheck className={`h-4 w-4 ${
                      po.status === 'partially_confirmed' ? 'text-yellow-600' : 'text-green-600'
                    }`} />
                  </div>
                  <div>
                    <Typography variant="bodyMd" className="font-medium">
                      {po.status === 'partially_confirmed' ? 'Partially Confirmed' : 'Confirmed'}
                    </Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      {formatDate(po.confirmedAt)}
                      {po.confirmationNotes && ` - ${po.confirmationNotes}`}
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
                Order Details
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

        {/* Order Items - With Confirmation Controls */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-border-muted">
              <Typography variant="headingSm">
                {po.status === 'sent' ? 'Confirm Order Items' : 'Order Items'}
              </Typography>
              {po.status === 'sent' && (
                <Typography variant="bodySm" colorRole="muted" className="mt-1">
                  Review each item and confirm or reject. You must respond to all items.
                </Typography>
              )}
            </div>

            <div className="divide-y divide-border-muted">
              {po.items.map((item) => {
                const confirmation = itemConfirmations.get(item.id);
                const isConfirmed = confirmation?.confirmed ?? true;

                return (
                  <div key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Typography variant="bodyMd" className="font-semibold">
                            {item.productName}
                          </Typography>
                          {po.status !== 'sent' && getItemStatusBadge(item.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                          {item.producer && <span>{item.producer}</span>}
                          {item.vintage && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">
                              {item.vintage}
                            </span>
                          )}
                          {item.lwin && (
                            <span className="font-mono bg-fill-muted px-1.5 py-0.5 rounded">
                              {item.lwin}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span>
                            <span className="text-text-muted">Qty:</span>{' '}
                            <span className="font-medium">{item.quantity} {item.unitType}{item.quantity !== 1 ? 's' : ''}</span>
                          </span>
                          <span>
                            <span className="text-text-muted">Price:</span>{' '}
                            <span className="font-medium">{formatPrice(item.unitPriceUsd ?? 0, 'USD')}</span>
                          </span>
                          <span>
                            <span className="text-text-muted">Total:</span>{' '}
                            <span className="font-semibold text-text-brand">{formatPrice(item.lineTotalUsd ?? 0, 'USD')}</span>
                          </span>
                        </div>

                        {/* Show rejection reason for already processed items */}
                        {item.status === 'rejected' && item.rejectionReason && (
                          <div className="mt-2 p-2 bg-red-50 rounded-lg text-sm text-red-700">
                            <span className="font-medium">Reason:</span> {item.rejectionReason}
                          </div>
                        )}
                      </div>

                      {/* Confirmation Toggle (only for sent status) */}
                      {po.status === 'sent' && (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleItemConfirmation(item.id)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                isConfirmed ? 'bg-green-500' : 'bg-red-500'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  isConfirmed ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className={`text-sm font-medium ${isConfirmed ? 'text-green-600' : 'text-red-600'}`}>
                              {isConfirmed ? 'Confirm' : 'Reject'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Rejection reason input (only for sent status and rejected items) */}
                    {po.status === 'sent' && !isConfirmed && (
                      <div className="mt-3 pl-0 sm:pl-4">
                        <input
                          type="text"
                          placeholder="Reason for rejection (optional)"
                          value={confirmation?.rejectionReason || ''}
                          onChange={(e) => setItemRejectionReason(item.id, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg bg-red-50 placeholder:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total Row */}
            <div className="p-4 bg-fill-muted/50 flex items-center justify-between">
              <Typography variant="bodyMd" className="font-semibold">
                Total:
              </Typography>
              <Typography variant="headingSm" className="text-text-brand">
                {formatPrice(po.totalAmountUsd ?? 0, 'USD')}
              </Typography>
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Actions (only for sent status) */}
        {po.status === 'sent' && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <Typography variant="headingSm">Ready to Submit?</Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {confirmedCount === po.items.length
                      ? `All ${confirmedCount} items will be confirmed`
                      : `${confirmedCount} confirmed, ${rejectedCount} rejected`}
                  </Typography>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand w-full sm:w-48"
                  />
                  <Button
                    variant="default"
                    colorRole="brand"
                    onClick={handleSubmitConfirmation}
                    isDisabled={isConfirming}
                  >
                    <ButtonContent iconLeft={IconCheck}>
                      {isConfirming ? 'Submitting...' : 'Submit Response'}
                    </ButtonContent>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
    </div>
  );
};

export default PartnerOrderDetailPage;
