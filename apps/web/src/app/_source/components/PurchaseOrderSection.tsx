'use client';

import { IconCheck, IconPackage, IconSend, IconTruck } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

import PurchaseOrderCard from './PurchaseOrderCard';

export interface PurchaseOrderSectionProps {
  rfqId: string;
  rfqStatus: string;
  onGeneratePOs: () => void;
  isGenerating?: boolean;
}

/**
 * Section for displaying and managing Purchase Orders for an RFQ
 */
const PurchaseOrderSection = ({
  rfqId,
  rfqStatus,
  onGeneratePOs,
  isGenerating,
}: PurchaseOrderSectionProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [sendingPoId, setSendingPoId] = useState<string | null>(null);

  // Fetch POs for this RFQ
  const { data, isLoading, refetch } = useQuery({
    ...api.source.admin.getPurchaseOrders.queryOptions({ rfqId }),
    enabled: rfqStatus === 'finalized' || rfqStatus === 'po_generated',
  });

  // Send PO mutation
  const { mutate: sendPo } = useMutation(
    api.source.admin.sendPurchaseOrder.mutationOptions({
      onSuccess: () => {
        setSendingPoId(null);
        void refetch();
        void queryClient.invalidateQueries({ queryKey: ['source', 'admin', 'getOne'] });
      },
      onError: () => {
        setSendingPoId(null);
      },
    })
  );

  const handleSendPo = (poId: string) => {
    setSendingPoId(poId);
    sendPo({ poId });
  };

  // Show generate button if RFQ is finalized but no POs generated yet
  if (rfqStatus === 'finalized' && (!data || data.purchaseOrders.length === 0)) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <Typography variant="headingSm" className="text-lg font-semibold">
              Purchase Orders
            </Typography>
            <Typography variant="bodySm" className="text-text-muted mt-1">
              Generate purchase orders for each partner with selected quotes
            </Typography>
          </div>
          <Button onClick={onGeneratePOs} disabled={isGenerating}>
            <ButtonContent isLoading={isGenerating}>
              <IconPackage size={16} />
              Generate POs
            </ButtonContent>
          </Button>
        </div>
      </Card>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <Card className="p-6">
        <Typography variant="bodySm" className="text-text-muted">
          Loading purchase orders...
        </Typography>
      </Card>
    );
  }

  // No POs to show
  if (!data || data.purchaseOrders.length === 0) {
    return null;
  }

  const { purchaseOrders, summary } = data;

  return (
    <div className="space-y-4">
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <div>
          <Typography variant="headingSm" className="text-lg font-semibold">
            Purchase Orders ({summary.totalPOs})
          </Typography>
          <Typography variant="bodySm" className="text-text-muted">
            Total: {formatPrice(summary.grandTotalUsd, 'USD')}
          </Typography>
        </div>
        <div className="flex items-center gap-4 text-sm text-text-muted">
          {summary.draftCount > 0 && (
            <span className="flex items-center gap-1">
              <IconPackage size={14} />
              {summary.draftCount} draft
            </span>
          )}
          {summary.sentCount > 0 && (
            <span className="flex items-center gap-1 text-text-info">
              <IconSend size={14} />
              {summary.sentCount} sent
            </span>
          )}
          {summary.confirmedCount > 0 && (
            <span className="flex items-center gap-1 text-text-success">
              <IconCheck size={14} />
              {summary.confirmedCount} confirmed
            </span>
          )}
          {summary.shippedCount > 0 && (
            <span className="flex items-center gap-1 text-text-brand">
              <IconTruck size={14} />
              {summary.shippedCount} shipped
            </span>
          )}
        </div>
      </div>

      {/* PO Cards */}
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
    </div>
  );
};

export default PurchaseOrderSection;
