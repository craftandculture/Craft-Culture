'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import SupplierOrderStatusBadge from '@/app/_source/components/SupplierOrderStatusBadge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

type ItemConfirmation = {
  itemId: string;
  confirmationStatus: 'confirmed' | 'updated' | 'rejected';
  updatedPriceUsd?: number;
  rejectionReason?: string;
};

/**
 * Partner Supplier Order detail page - confirm items
 */
const PartnerSupplierOrderDetailPage = () => {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const api = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [itemConfirmations, setItemConfirmations] = useState<Map<string, ItemConfirmation>>(
    new Map(),
  );
  const [partnerNotes, setPartnerNotes] = useState('');

  const { data: order, isLoading } = useQuery({
    ...api.source.partner.supplierOrders.getOne.queryOptions({ id: params.orderId }),
  });

  const { mutate: confirmOrder, isPending: isConfirming } = useMutation(
    api.source.partner.supplierOrders.confirm.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries({
          queryKey: api.source.partner.supplierOrders.getOne.queryKey({ id: params.orderId }),
        });
        toast.success(`Order ${result.orderStatus}: ${result.confirmedCount} confirmed, ${result.updatedCount} updated, ${result.rejectedCount} rejected`);
        router.push('/platform/partner/source/orders');
      },
      onError: (error) => {
        toast.error(`Failed to confirm order: ${error.message}`);
      },
    }),
  );

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleConfirmItem = (itemId: string) => {
    const newConfirmations = new Map(itemConfirmations);
    newConfirmations.set(itemId, { itemId, confirmationStatus: 'confirmed' });
    setItemConfirmations(newConfirmations);
  };

  const handleRejectItem = (itemId: string, reason: string) => {
    const newConfirmations = new Map(itemConfirmations);
    newConfirmations.set(itemId, {
      itemId,
      confirmationStatus: 'rejected',
      rejectionReason: reason,
    });
    setItemConfirmations(newConfirmations);
  };

  const handleSubmitConfirmation = () => {
    if (itemConfirmations.size === 0) {
      toast.error('Please confirm at least one item');
      return;
    }

    confirmOrder({
      supplierOrderId: params.orderId,
      items: Array.from(itemConfirmations.values()),
      partnerNotes: partnerNotes || undefined,
    });
  };

  const handleDownloadExcel = async () => {
    if (!order) return;
    try {
      const result = await trpcClient.source.partner.supplierOrders.downloadExcel.query({
        id: params.orderId,
      });
      // Download the file
      const link = document.createElement('a');
      link.href = `data:${result.mimeType};base64,${result.base64}`;
      link.download = result.filename;
      link.click();
    } catch {
      toast.error('Failed to download Excel file');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-8">
        <Typography variant="bodyMd" colorRole="muted">
          Loading order...
        </Typography>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-8">
        <Typography variant="bodyMd" colorRole="muted">
          Order not found
        </Typography>
      </div>
    );
  }

  const canConfirm = order.status === 'sent' || order.status === 'pending_confirmation';

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/platform/partner/source/orders"
            className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary mb-4"
          >
            <IconArrowLeft className="h-4 w-4" />
            <Typography variant="bodySm">Back to Orders</Typography>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Typography variant="headingLg">{order.orderNumber}</Typography>
                <SupplierOrderStatusBadge status={order.status} />
              </div>
              <Typography variant="bodyMd" colorRole="muted">
                {order.customerPo?.customerCompany || order.customerPo?.customerName}
                {' • '}
                {order.items.length} items • {formatCurrency(order.totalAmountUsd)}
              </Typography>
            </div>
            <Button
              variant="outline"
              colorRole="primary"
              size="sm"
              onClick={handleDownloadExcel}
            >
              <ButtonContent iconLeft={IconDownload}>Download Excel</ButtonContent>
            </Button>
          </div>
        </div>

        {/* Items */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-border-primary">
              <Typography variant="headingSm">Order Items</Typography>
              {canConfirm && (
                <Typography variant="bodySm" colorRole="muted">
                  Confirm each item or update pricing if needed
                </Typography>
              )}
            </div>
            <div className="divide-y divide-border-primary">
              {order.items.map((item) => {
                const confirmation = itemConfirmations.get(item.id);
                const isConfirmed = confirmation?.confirmationStatus === 'confirmed';
                const isRejected = confirmation?.confirmationStatus === 'rejected';
                const isUpdated = confirmation?.confirmationStatus === 'updated';

                return (
                  <div
                    key={item.id}
                    className={`p-4 ${
                      isConfirmed
                        ? 'bg-fill-success/5'
                        : isRejected
                          ? 'bg-fill-danger/5'
                          : isUpdated
                            ? 'bg-fill-warning/5'
                            : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <Typography variant="bodyMd" className="font-medium">
                          {item.productName}
                        </Typography>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted mt-1">
                          <span>Vintage: {item.vintage || '-'}</span>
                          <span>Qty: {item.quantityCases} cases ({item.caseConfig})</span>
                          <span>Price: {formatCurrency(item.costPerCaseUsd)}/case</span>
                          <span className="font-medium">
                            Total: {formatCurrency(item.lineTotalUsd)}
                          </span>
                        </div>
                        {item.lwin18 && (
                          <Typography variant="bodySm" colorRole="muted" className="font-mono mt-1">
                            LWIN: {item.lwin18}
                          </Typography>
                        )}
                      </div>

                      {canConfirm && !confirmation && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            colorRole="primary"
                            size="sm"
                            onClick={() => handleConfirmItem(item.id)}
                          >
                            <ButtonContent iconLeft={IconCheck}>Confirm</ButtonContent>
                          </Button>
                          <Button
                            variant="outline"
                            colorRole="danger"
                            size="sm"
                            onClick={() => {
                              const reason = prompt('Reason for rejection:');
                              if (reason) {
                                handleRejectItem(item.id, reason);
                              }
                            }}
                          >
                            <ButtonContent iconLeft={IconX}>Reject</ButtonContent>
                          </Button>
                        </div>
                      )}

                      {confirmation && (
                        <div className="flex items-center gap-2">
                          {isConfirmed && (
                            <span className="text-text-success flex items-center gap-1">
                              <IconCheck className="h-4 w-4" />
                              Confirmed
                            </span>
                          )}
                          {isRejected && (
                            <span className="text-text-danger flex items-center gap-1">
                              <IconX className="h-4 w-4" />
                              Rejected
                            </span>
                          )}
                          {isUpdated && (
                            <span className="text-text-warning">
                              Updated: {formatCurrency(confirmation.updatedPriceUsd || 0)}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newConfirmations = new Map(itemConfirmations);
                              newConfirmations.delete(item.id);
                              setItemConfirmations(newConfirmations);
                            }}
                          >
                            Reset
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Notes & Submit */}
        {canConfirm && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <Typography variant="bodySm" className="mb-2 font-medium">
                  Notes (optional)
                </Typography>
                <textarea
                  value={partnerNotes}
                  onChange={(e) => setPartnerNotes(e.target.value)}
                  placeholder="Add any notes about this order..."
                  className="bg-background-primary border-border-primary text-text-primary placeholder:text-text-muted w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                />
              </div>
              <div className="flex items-center justify-between">
                <Typography variant="bodySm" colorRole="muted">
                  {itemConfirmations.size} of {order.items.length} items confirmed
                </Typography>
                <Button
                  variant="default"
                  colorRole="brand"
                  onClick={handleSubmitConfirmation}
                  disabled={isConfirming || itemConfirmations.size === 0}
                >
                  <ButtonContent>
                    {isConfirming ? 'Submitting...' : 'Submit Confirmation'}
                  </ButtonContent>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Already confirmed message */}
        {!canConfirm && order.status !== 'draft' && (
          <Card className="bg-fill-success/10 border-border-success">
            <CardContent className="p-4">
              <Typography variant="bodyMd" className="text-text-success">
                This order has been {order.status}.
                {order.confirmedAt && (
                  <span className="text-text-muted ml-2">
                    Confirmed on {new Date(order.confirmedAt).toLocaleDateString()}
                  </span>
                )}
              </Typography>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PartnerSupplierOrderDetailPage;
