'use client';

import {
  IconCheck,
  IconCircleDashed,
  IconClock,
  IconLoader2,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
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
  status: 'pending' | 'awaiting' | 'paid' | 'confirmed';
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
  canConfirmPayments?: boolean;
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
      if (order.clientPaidAt) return 'paid';
      if (
        status === 'awaiting_client_payment' ||
        status === 'cc_approved'
      ) {
        return 'awaiting';
      }
      if (['submitted', 'under_cc_review', 'revision_requested'].includes(status)) {
        return 'pending';
      }
      return 'paid';

    case 'distributor':
      if (order.distributorPaidAt) return 'paid';
      if (status === 'awaiting_distributor_payment') return 'awaiting';
      if (
        [
          'draft',
          'submitted',
          'under_cc_review',
          'revision_requested',
          'cc_approved',
          'awaiting_client_payment',
          'client_paid',
        ].includes(status)
      ) {
        return 'pending';
      }
      return 'paid';

    case 'partner':
      if (order.partnerPaidAt) return 'paid';
      if (status === 'awaiting_partner_payment') return 'awaiting';
      if (
        [
          'draft',
          'submitted',
          'under_cc_review',
          'revision_requested',
          'cc_approved',
          'awaiting_client_payment',
          'client_paid',
          'awaiting_distributor_payment',
          'distributor_paid',
        ].includes(status)
      ) {
        return 'pending';
      }
      return 'paid';

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
  canConfirmPayments = false,
  onPaymentConfirmed,
}: PaymentTrackerProps) => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const payments = buildPaymentInfo(order);

  // Track payment reference inputs for each stage
  const [paymentReferences, setPaymentReferences] = useState<Record<PaymentStage, string>>({
    client: '',
    distributor: '',
    partner: '',
  });

  const handleReferenceChange = (stage: PaymentStage, value: string) => {
    setPaymentReferences((prev) => ({ ...prev, [stage]: value }));
  };

  const confirmPaymentMutation = useMutation({
    mutationFn: async ({ stage, reference }: { stage: PaymentStage; reference: string }) => {
      return trpcClient.privateClientOrders.confirmPayment.mutate({
        orderId: order.id,
        paymentStage: stage,
        reference,
      });
    },
    onSuccess: (_data, variables) => {
      toast.success('Payment confirmed');
      // Clear the reference input
      setPaymentReferences((prev) => ({ ...prev, [variables.stage]: '' }));
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrder', order.id] });
      onPaymentConfirmed?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to confirm payment');
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
                          Paid: {format(payment.paidAt, 'MMM d, yyyy HH:mm')}
                        </Typography>
                      )}
                      {payment.reference && (
                        <Typography variant="bodyXs" colorRole="muted">
                          Ref: {payment.reference}
                        </Typography>
                      )}
                    </div>
                  )}

                  {/* Confirm button for awaiting payments */}
                  {canConfirmPayments && payment.status === 'awaiting' && (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Payment reference (required)"
                          value={paymentReferences[payment.stage]}
                          onChange={(e) => handleReferenceChange(payment.stage, e.target.value)}
                          className="max-w-[200px] text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            confirmPaymentMutation.mutate({
                              stage: payment.stage,
                              reference: paymentReferences[payment.stage],
                            })
                          }
                          isDisabled={confirmPaymentMutation.isPending || !paymentReferences[payment.stage].trim()}
                        >
                          {confirmPaymentMutation.isPending ? (
                            <Icon icon={IconLoader2} size="sm" className="animate-spin" />
                          ) : (
                            <Icon icon={IconCheck} size="sm" />
                          )}
                          Confirm
                        </Button>
                      </div>
                      {!paymentReferences[payment.stage].trim() && (
                        <Typography variant="bodyXs" colorRole="muted">
                          Enter the payment reference number to confirm
                        </Typography>
                      )}
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
