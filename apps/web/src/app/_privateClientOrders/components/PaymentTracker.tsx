'use client';

import {
  IconCheck,
  IconCircleDashed,
  IconClock,
  IconLoader2,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientOrder } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

type PaymentStage = 'client' | 'distributor' | 'partner';

interface PaymentInfo {
  stage: PaymentStage;
  title: string;
  description: string;
  paidAt: Date | null;
  confirmedBy: string | null;
  reference: string | null;
  status: 'pending' | 'awaiting' | 'awaiting_verification' | 'paid' | 'confirmed';
}

interface PaymentTrackerProps {
  order: Pick<
    PrivateClientOrder,
    | 'id'
    | 'status'
    | 'clientPaidAt'
    | 'clientPaymentReference'
    | 'distributorPaidAt'
    | 'distributorPaymentReference'
    | 'partnerPaidAt'
    | 'partnerPaymentReference'
  >;
  canVerifyPayments?: boolean;
  onPaymentConfirmed?: () => void;
}

/**
 * Determine the status of a payment based on order status and timestamps
 */
const getPaymentStatus = (
  order: PaymentTrackerProps['order'],
  stage: PaymentStage,
): PaymentInfo['status'] => {
  const { status } = order;

  switch (stage) {
    case 'client':
      // If payment is confirmed by partner but awaiting distributor verification
      if (status === 'awaiting_payment_verification') {
        return 'awaiting_verification';
      }
      // Only show as paid if we have the timestamp AND we're past the payment stages
      if (order.clientPaidAt && !['awaiting_client_payment', 'awaiting_payment_verification'].includes(status)) {
        return 'paid';
      }
      if (status === 'awaiting_client_payment') {
        return 'awaiting';
      }
      // All other statuses before payment = pending
      return 'pending';

    case 'distributor':
      if (order.distributorPaidAt) return 'paid';
      if (status === 'awaiting_distributor_payment') return 'awaiting';
      // All other statuses = pending (distributor payment comes late in workflow)
      return 'pending';

    case 'partner':
      if (order.partnerPaidAt) return 'paid';
      if (status === 'awaiting_partner_payment') return 'awaiting';
      // All other statuses = pending (partner payment is last in workflow)
      return 'pending';

    default:
      return 'pending';
  }
};

/**
 * Build payment info for all three stages
 */
const buildPaymentInfo = (order: PaymentTrackerProps['order']): PaymentInfo[] => {
  return [
    {
      stage: 'client',
      title: 'Client Payment',
      description: 'Client pays Partner for the order',
      paidAt: order.clientPaidAt,
      confirmedBy: null,
      reference: order.clientPaymentReference,
      status: getPaymentStatus(order, 'client'),
    },
    {
      stage: 'distributor',
      title: 'Distributor Payment',
      description: 'C&C pays Distributor for delivery services',
      paidAt: order.distributorPaidAt,
      confirmedBy: null,
      reference: order.distributorPaymentReference,
      status: getPaymentStatus(order, 'distributor'),
    },
    {
      stage: 'partner',
      title: 'Partner Payment',
      description: 'C&C pays Partner for the product',
      paidAt: order.partnerPaidAt,
      confirmedBy: null,
      reference: order.partnerPaymentReference,
      status: getPaymentStatus(order, 'partner'),
    },
  ];
};

const statusConfig: Record<
  PaymentInfo['status'],
  { icon: typeof IconCheck; colorRole: 'muted' | 'warning' | 'success' | 'brand'; label: string }
> = {
  pending: { icon: IconCircleDashed, colorRole: 'muted', label: 'Pending' },
  awaiting: { icon: IconClock, colorRole: 'warning', label: 'Awaiting' },
  awaiting_verification: { icon: IconClock, colorRole: 'brand', label: 'Awaiting Verification' },
  paid: { icon: IconCheck, colorRole: 'success', label: 'Paid' },
  confirmed: { icon: IconCheck, colorRole: 'success', label: 'Confirmed' },
};

/**
 * Payment Tracker component for private client orders
 *
 * Displays a cascade view of all payment stages:
 * 1. Client Payment - Client pays Partner
 * 2. Distributor Payment - C&C pays Distributor
 * 3. Partner Payment - C&C pays Partner
 */
const PaymentTracker = ({
  order,
  canVerifyPayments = false,
  onPaymentConfirmed,
}: PaymentTrackerProps) => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const payments = buildPaymentInfo(order);

  const verifyPaymentMutation = useMutation({
    mutationFn: async () => {
      return trpcClient.privateClientOrders.distributorPaymentVerification.mutate({
        orderId: order.id,
      });
    },
    onSuccess: () => {
      toast.success('Payment verified - delivery scheduling can begin');
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrder', order.id] });
      onPaymentConfirmed?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to verify payment');
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <Typography variant="labelMd">Payment Status</Typography>

      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-border-muted" />

        <div className="flex flex-col gap-4">
          {payments.map((payment, index) => {
            const config = statusConfig[payment.status];
            const isLast = index === payments.length - 1;

            return (
              <div key={payment.stage} className="relative flex items-start gap-4">
                {/* Status indicator */}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    payment.status === 'paid' || payment.status === 'confirmed'
                      ? 'bg-fill-success'
                      : payment.status === 'awaiting'
                        ? 'bg-fill-warning'
                        : payment.status === 'awaiting_verification'
                          ? 'bg-fill-brand'
                          : 'bg-fill-muted'
                  }`}
                >
                  <Icon
                    icon={config.icon}
                    size="sm"
                    colorRole={payment.status === 'pending' ? 'muted' : undefined}
                    className={
                      payment.status === 'paid' || payment.status === 'confirmed'
                        ? 'text-text-on-fill'
                        : payment.status === 'awaiting'
                          ? 'text-text-warning'
                          : payment.status === 'awaiting_verification'
                            ? 'text-text-on-fill'
                            : ''
                    }
                  />
                </div>

                {/* Content */}
                <div className={`flex-1 ${!isLast ? 'pb-4' : ''}`}>
                  <div className="flex items-center gap-2">
                    <Typography variant="labelSm">{payment.title}</Typography>
                    <Badge size="sm" colorRole={config.colorRole}>
                      {config.label}
                    </Badge>
                  </div>

                  <Typography variant="bodyXs" colorRole="muted" className="mt-0.5">
                    {payment.description}
                  </Typography>

                  {/* Payment details */}
                  {(payment.paidAt || payment.reference) && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {payment.paidAt && (
                        <Typography variant="bodyXs" colorRole="muted">
                          Confirmed: {format(payment.paidAt, 'MMM d, yyyy HH:mm')}
                        </Typography>
                      )}
                      {payment.reference && (
                        <Typography variant="bodyXs" colorRole="muted">
                          Ref: {payment.reference}
                        </Typography>
                      )}
                    </div>
                  )}

                  {/* Message for awaiting verification status */}
                  {payment.status === 'awaiting_verification' && (
                    <Typography variant="bodyXs" className="mt-2 text-text-brand">
                      Partner confirmed payment received. Awaiting distributor verification.
                    </Typography>
                  )}

                  {/* Verify button for distributor */}
                  {canVerifyPayments && payment.status === 'awaiting_verification' && (
                    <div className="mt-2">
                      <Button
                        variant="default"
                        colorRole="brand"
                        size="sm"
                        onClick={() => verifyPaymentMutation.mutate()}
                        isDisabled={verifyPaymentMutation.isPending}
                      >
                        {verifyPaymentMutation.isPending ? (
                          <Icon icon={IconLoader2} size="sm" className="animate-spin" />
                        ) : (
                          <Icon icon={IconCheck} size="sm" />
                        )}
                        Verify Payment & Schedule Delivery
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PaymentTracker;
