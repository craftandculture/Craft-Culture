'use client';

import {
  IconCheck,
  IconChevronDown,
  IconCurrencyDollar,
  IconLoader2,
  IconPhoto,
} from '@tabler/icons-react';
import Image from 'next/image';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import fileHref from '@/utils/fileHref';

export interface OrderCompletionCardProps {
  order: {
    distributorPaidAt: Date | string | null;
    distributorPaymentReference: string | null;
    partnerPaidAt: Date | string | null;
    partnerPaymentReference: string | null;
    deliveryPhoto: string | null;
  };
  /**
   * Delivered orders show this open and at the top of the page; before then it
   * sits lower down, collapsed, since none of it is due yet
   */
  prominent: boolean;
  distributorPaymentRef: string;
  onDistributorPaymentRefChange: (value: string) => void;
  onConfirmDistributorPayment: () => void;
  isConfirmingDistributorPayment: boolean;
  partnerPaymentRef: string;
  onPartnerPaymentRefChange: (value: string) => void;
  onMarkPartnerPaid: () => void;
  isMarkingPartnerPaid: boolean;
  onViewDeliveryPhoto: () => void;
  formatDate: (date: Date | null | undefined) => string;
}

/**
 * One of the three closing steps: its state on the left, the action on the
 * right
 */
const Step = ({
  done,
  pendingTone,
  icon,
  title,
  detail,
  children,
}: React.PropsWithChildren<{
  done: boolean;
  pendingTone: 'warning' | 'muted';
  icon: typeof IconCheck;
  title: string;
  detail: string;
}>) => (
  <div className="bg-background-primary/50 flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex items-start gap-3">
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          done
            ? 'bg-fill-success/20'
            : pendingTone === 'warning'
              ? 'bg-fill-warning/20'
              : 'bg-fill-muted'
        }`}
      >
        <Icon
          icon={done ? IconCheck : icon}
          size="sm"
          className={
            done
              ? 'text-fill-success'
              : pendingTone === 'warning'
                ? 'text-fill-warning'
                : 'text-text-muted'
          }
        />
      </div>
      <div>
        <Typography variant="labelMd" className="mb-0.5">
          {title}
        </Typography>
        <Typography variant="bodyXs" colorRole="muted">
          {detail}
        </Typography>
      </div>
    </div>
    {children}
  </div>
);

/**
 * Closing an order: the distributor's payment to C&C, C&C's payment to the wine
 * partner, and the distributor's proof of delivery
 *
 * One card in two places. It was written out twice on the order page — once for
 * delivered orders and once for the rest — and the copies had drifted.
 */
const OrderCompletionCard = ({
  order,
  prominent,
  distributorPaymentRef,
  onDistributorPaymentRefChange,
  onConfirmDistributorPayment,
  isConfirmingDistributorPayment,
  partnerPaymentRef,
  onPartnerPaymentRefChange,
  onMarkPartnerPaid,
  isMarkingPartnerPaid,
  onViewDeliveryPhoto,
  formatDate,
}: OrderCompletionCardProps) => {
  const [isExpanded, setIsExpanded] = useState(prominent);
  const pendingTone = prominent ? 'warning' : 'muted';

  const outstanding = [
    order.distributorPaidAt,
    order.partnerPaidAt,
    order.deliveryPhoto,
  ].filter((value) => !value).length;

  const toDate = (value: Date | string | null) =>
    value ? new Date(value) : null;

  return (
    <Card
      className={
        prominent
          ? 'border-fill-success/50 bg-fill-success/5 border-2'
          : undefined
      }
    >
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="hover:bg-fill-muted/30 flex w-full items-center justify-between gap-3 p-4 text-left"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                prominent ? 'bg-fill-success/20' : 'bg-fill-muted'
              }`}
            >
              <Icon
                icon={IconCheck}
                size="md"
                className={prominent ? 'text-fill-success' : 'text-text-muted'}
              />
            </div>
            <div className="min-w-0">
              <Typography variant="headingSm" className="mb-0.5">
                Order completion
              </Typography>
              <div className="text-text-muted flex flex-wrap items-center gap-1.5 text-xs">
                {order.distributorPaidAt && (
                  <span className="bg-fill-success/20 text-fill-success inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                    <IconCheck size={12} /> Distributor paid
                  </span>
                )}
                {order.partnerPaidAt && (
                  <span className="bg-fill-success/20 text-fill-success inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                    <IconCheck size={12} /> Partner paid
                  </span>
                )}
                {order.deliveryPhoto && (
                  <span className="bg-fill-success/20 text-fill-success inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                    <IconCheck size={12} /> Proof of delivery
                  </span>
                )}
                <span>
                  {outstanding === 0
                    ? 'All done'
                    : `${outstanding} of 3 outstanding`}
                </span>
              </div>
            </div>
          </div>
          <Icon
            icon={IconChevronDown}
            size="md"
            className={`text-text-muted shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {isExpanded && (
          <div className="border-border-muted space-y-3 border-t p-4">
            <Step
              done={!!order.distributorPaidAt}
              pendingTone={pendingTone}
              icon={IconCurrencyDollar}
              title="Distributor payment to C&C"
              detail={
                order.distributorPaidAt
                  ? `Received on ${formatDate(toDate(order.distributorPaidAt))}${order.distributorPaymentReference ? ` · Ref: ${order.distributorPaymentReference}` : ''}`
                  : 'Confirm when the distributor has paid C&C for the order'
              }
            >
              {!order.distributorPaidAt && (
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <Input
                    placeholder="Reference (optional)"
                    aria-label="Distributor payment reference"
                    value={distributorPaymentRef}
                    onChange={(e) =>
                      onDistributorPaymentRefChange(e.target.value)
                    }
                    className="w-full text-xs sm:w-[160px]"
                  />
                  <Button
                    type="button"
                    onClick={onConfirmDistributorPayment}
                    disabled={isConfirmingDistributorPayment}
                    colorRole="brand"
                    size="sm"
                  >
                    <Icon
                      icon={
                        isConfirmingDistributorPayment
                          ? IconLoader2
                          : IconCurrencyDollar
                      }
                      size="xs"
                      className={
                        isConfirmingDistributorPayment ? 'animate-spin' : ''
                      }
                    />
                    <span className="ml-1.5">
                      {isConfirmingDistributorPayment
                        ? 'Confirming...'
                        : 'Confirm received'}
                    </span>
                  </Button>
                </div>
              )}
            </Step>

            <Step
              done={!!order.partnerPaidAt}
              pendingTone={pendingTone}
              icon={IconCurrencyDollar}
              title="C&C payment to partner"
              detail={
                order.partnerPaidAt
                  ? `Paid on ${formatDate(toDate(order.partnerPaidAt))}${order.partnerPaymentReference ? ` · Ref: ${order.partnerPaymentReference}` : ''}`
                  : 'Record when C&C has paid the wine partner for the stock'
              }
            >
              {!order.partnerPaidAt && (
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <Input
                    placeholder="Reference (optional)"
                    aria-label="Partner payment reference"
                    value={partnerPaymentRef}
                    onChange={(e) => onPartnerPaymentRefChange(e.target.value)}
                    className="w-full text-xs sm:w-[160px]"
                  />
                  <Button
                    type="button"
                    onClick={onMarkPartnerPaid}
                    disabled={isMarkingPartnerPaid}
                    colorRole="brand"
                    size="sm"
                  >
                    <Icon
                      icon={
                        isMarkingPartnerPaid ? IconLoader2 : IconCurrencyDollar
                      }
                      size="xs"
                      className={isMarkingPartnerPaid ? 'animate-spin' : ''}
                    />
                    <span className="ml-1.5">
                      {isMarkingPartnerPaid ? 'Recording...' : 'Mark paid'}
                    </span>
                  </Button>
                </div>
              )}
            </Step>

            <Step
              done={!!order.deliveryPhoto}
              pendingTone={pendingTone}
              icon={IconPhoto}
              title="Proof of delivery"
              detail={
                order.deliveryPhoto
                  ? 'Photo uploaded by the distributor'
                  : 'Awaiting delivery confirmation from the distributor'
              }
            >
              {order.deliveryPhoto && (
                <button
                  type="button"
                  onClick={onViewDeliveryPhoto}
                  aria-label="View proof of delivery photo"
                  className="border-border-muted group relative self-start overflow-hidden rounded-lg border"
                >
                  <Image
                    src={fileHref(order.deliveryPhoto)}
                    alt="Proof of delivery"
                    width={120}
                    height={80}
                    className="h-[80px] w-[120px] object-cover transition-transform group-hover:scale-105"
                    unoptimized
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                    <IconPhoto className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>
              )}
            </Step>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderCompletionCard;
