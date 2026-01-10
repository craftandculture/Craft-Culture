'use client';

import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconPackage,
  IconSend,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import Typography from '@/app/_ui/components/Typography/Typography';
import formatPrice from '@/utils/formatPrice';

interface PurchaseOrderItem {
  id: string;
  productName: string;
  producer: string | null;
  vintage: string | null;
  quantity: number;
  unitType: string;
  unitPriceUsd: number;
  lineTotalUsd: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: 'draft' | 'sent' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  totalAmountUsd: number | null;
  partnerId: string;
  partnerName: string | null;
  partnerBusinessName: string | null;
  sentAt: Date | null;
  confirmedAt: Date | null;
  estimatedDeliveryDate: Date | null;
  shippedAt: Date | null;
  trackingNumber: string | null;
  deliveredAt: Date | null;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderCardProps {
  po: PurchaseOrder;
  onSend: () => void;
  isSending?: boolean;
}

const statusConfig = {
  draft: {
    icon: IconPackage,
    bg: 'bg-fill-muted',
    text: 'text-text-muted',
    label: 'Draft',
  },
  sent: {
    icon: IconSend,
    bg: 'bg-fill-info/10',
    text: 'text-text-info',
    label: 'Sent',
  },
  confirmed: {
    icon: IconCheck,
    bg: 'bg-fill-success/10',
    text: 'text-text-success',
    label: 'Confirmed',
  },
  shipped: {
    icon: IconTruck,
    bg: 'bg-fill-brand/10',
    text: 'text-text-brand',
    label: 'Shipped',
  },
  delivered: {
    icon: IconCheck,
    bg: 'bg-fill-success/10',
    text: 'text-text-success',
    label: 'Delivered',
  },
  cancelled: {
    icon: IconX,
    bg: 'bg-fill-danger/10',
    text: 'text-text-danger',
    label: 'Cancelled',
  },
};

/**
 * Card component for displaying a single Purchase Order
 */
const PurchaseOrderCard = ({ po, onSend, isSending }: PurchaseOrderCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = statusConfig[po.status];
  const StatusIcon = config.icon;

  const partnerDisplayName = po.partnerName || po.partnerBusinessName || 'Unknown Partner';

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between p-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}
          >
            <StatusIcon size={14} />
            {config.label}
          </span>

          {/* PO number and partner */}
          <div>
            <Typography variant="body1" className="font-medium">
              {po.poNumber}
            </Typography>
            <Typography variant="body2" className="text-text-muted">
              {partnerDisplayName}
            </Typography>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Total */}
          <div className="text-right">
            <Typography variant="body1" className="font-semibold">
              {formatPrice(po.totalAmountUsd ?? 0, 'USD')}
            </Typography>
            <Typography variant="body2" className="text-text-muted">
              {po.items.length} item{po.items.length !== 1 ? 's' : ''}
            </Typography>
          </div>

          {/* Actions */}
          {po.status === 'draft' && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSend();
              }}
              disabled={isSending}
            >
              <ButtonContent isLoading={isSending}>
                <IconSend size={14} />
                Send
              </ButtonContent>
            </Button>
          )}

          {/* Expand/collapse */}
          <button type="button" className="text-text-muted hover:text-text-primary">
            {isExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border-primary bg-surface-muted p-4">
          {/* Timeline info */}
          <div className="mb-4 flex flex-wrap gap-4 text-sm">
            {po.sentAt && (
              <div>
                <span className="text-text-muted">Sent:</span>{' '}
                <span className="font-medium">{formatDate(po.sentAt)}</span>
              </div>
            )}
            {po.confirmedAt && (
              <div>
                <span className="text-text-muted">Confirmed:</span>{' '}
                <span className="font-medium">{formatDate(po.confirmedAt)}</span>
              </div>
            )}
            {po.estimatedDeliveryDate && (
              <div>
                <span className="text-text-muted">Est. Delivery:</span>{' '}
                <span className="font-medium">{formatDate(po.estimatedDeliveryDate)}</span>
              </div>
            )}
            {po.shippedAt && (
              <div>
                <span className="text-text-muted">Shipped:</span>{' '}
                <span className="font-medium">{formatDate(po.shippedAt)}</span>
              </div>
            )}
            {po.trackingNumber && (
              <div>
                <span className="text-text-muted">Tracking:</span>{' '}
                <span className="font-medium">{po.trackingNumber}</span>
              </div>
            )}
            {po.deliveredAt && (
              <div>
                <span className="text-text-muted">Delivered:</span>{' '}
                <span className="font-medium">{formatDate(po.deliveredAt)}</span>
              </div>
            )}
          </div>

          {/* Items table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-muted text-left text-text-muted">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Unit Price</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item) => (
                <tr key={item.id} className="border-b border-border-muted last:border-0">
                  <td className="py-2">
                    <div className="font-medium">{item.productName}</div>
                    {(item.producer || item.vintage) && (
                      <div className="text-text-muted">
                        {[item.producer, item.vintage].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {item.quantity} {item.unitType}
                    {item.quantity !== 1 ? 's' : ''}
                  </td>
                  <td className="py-2 text-right">
                    {formatPrice(item.unitPriceUsd, 'USD')}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {formatPrice(item.lineTotalUsd, 'USD')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={3} className="pt-3 text-right">
                  Total:
                </td>
                <td className="pt-3 text-right">
                  {formatPrice(po.totalAmountUsd ?? 0, 'USD')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
};

export default PurchaseOrderCard;
