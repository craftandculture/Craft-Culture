'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconPackage,
  IconSend,
  IconTruck,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import PurchaseOrderCard from '@/app/_source/components/PurchaseOrderCard';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

/**
 * Admin Purchase Orders page for an RFQ
 */
const AdminPurchaseOrdersPage = () => {
  const params = useParams();
  const rfqId = params.rfqId as string;
  const api = useTRPC();

  const [sendingPoId, setSendingPoId] = useState<string | null>(null);

  // Fetch RFQ details for header
  const { data: rfq } = useQuery({
    ...api.source.admin.getOne.queryOptions({ rfqId }),
  });

  // Fetch POs
  const { data, isLoading, refetch } = useQuery({
    ...api.source.admin.getPurchaseOrders.queryOptions({ rfqId }),
  });

  // Send PO mutation
  const { mutate: sendPo } = useMutation(
    api.source.admin.sendPurchaseOrder.mutationOptions({
      onSuccess: () => {
        setSendingPoId(null);
        void refetch();
      },
      onError: () => {
        setSendingPoId(null);
      },
    })
  );

  // Send all draft POs mutation
  const handleSendAll = async () => {
    if (!data) return;
    const draftPOs = data.purchaseOrders.filter((po) => po.status === 'draft');
    for (const po of draftPOs) {
      sendPo({ poId: po.id });
    }
  };

  const handleSendPo = (poId: string) => {
    setSendingPoId(poId);
    sendPo({ poId });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <Typography variant="bodyMd" colorRole="muted">
          Loading purchase orders...
        </Typography>
      </div>
    );
  }

  const purchaseOrders = data?.purchaseOrders ?? [];
  const summary = data?.summary;

  return (
    <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href={`/platform/admin/source/${rfqId}`}>
              <Button variant="ghost" size="sm" aria-label="Back to RFQ">
                <ButtonContent iconLeft={IconArrowLeft} />
              </Button>
            </Link>
            <div>
              {rfq && (
                <Typography variant="bodyXs" className="font-mono text-text-muted mb-1">
                  {rfq.rfqNumber}
                </Typography>
              )}
              <Typography variant="headingLg">Purchase Orders</Typography>
              {rfq && (
                <Typography variant="bodySm" colorRole="muted">
                  {rfq.name}
                </Typography>
              )}
            </div>
          </div>

          {/* Send All Button */}
          {summary && summary.draftCount > 0 && (
            <Button variant="default" colorRole="brand" onClick={handleSendAll}>
              <ButtonContent iconLeft={IconSend}>
                Send All ({summary.draftCount})
              </ButtonContent>
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg">{summary.totalPOs}</Typography>
                <Typography variant="bodySm" colorRole="muted">
                  Total POs
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <IconPackage size={16} className="text-text-muted" />
                  <Typography variant="headingLg">{summary.draftCount}</Typography>
                </div>
                <Typography variant="bodySm" colorRole="muted">
                  Draft
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <IconSend size={16} className="text-text-info" />
                  <Typography variant="headingLg">{summary.sentCount}</Typography>
                </div>
                <Typography variant="bodySm" colorRole="muted">
                  Sent
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <IconCheck size={16} className="text-text-success" />
                  <Typography variant="headingLg">{summary.confirmedCount}</Typography>
                </div>
                <Typography variant="bodySm" colorRole="muted">
                  Confirmed
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <IconTruck size={16} className="text-text-brand" />
                  <Typography variant="headingLg">
                    {summary.shippedCount + summary.deliveredCount}
                  </Typography>
                </div>
                <Typography variant="bodySm" colorRole="muted">
                  Shipped
                </Typography>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Grand Total */}
        {summary && summary.grandTotalUsd > 0 && (
          <Card className="bg-gradient-to-r from-fill-brand/5 to-fill-brand/10 border-border-brand">
            <CardContent className="p-4 flex items-center justify-between">
              <Typography variant="headingSm">Grand Total</Typography>
              <Typography variant="headingLg" className="text-text-brand">
                {formatPrice(summary.grandTotalUsd, 'USD')}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* PO List */}
        {purchaseOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-fill-muted flex items-center justify-center mx-auto mb-4">
                <IconPackage className="h-6 w-6 text-text-muted" />
              </div>
              <Typography variant="headingSm" className="mb-2">
                No Purchase Orders
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-4">
                Generate purchase orders from the RFQ detail page after selecting quotes.
              </Typography>
              <Link href={`/platform/admin/source/${rfqId}`}>
                <Button variant="outline">
                  <ButtonContent iconLeft={IconArrowLeft}>Back to RFQ</ButtonContent>
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {purchaseOrders.map((po) => (
              <PurchaseOrderCard
                key={po.id}
                po={po}
                onSend={() => handleSendPo(po.id)}
                isSending={sendingPoId === po.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPurchaseOrdersPage;
