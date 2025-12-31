'use client';

import { IconCheck, IconClock, IconX } from '@tabler/icons-react';
import { format } from 'date-fns';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientOrder } from '@/database/schema';

interface WorkflowStepperProps {
  order: PrivateClientOrder;
}

interface Step {
  id: string;
  label: string;
  description?: string;
  timestamp?: Date | null;
}

/**
 * Visual workflow stepper showing order progress through stages
 */
const WorkflowStepper = ({ order }: WorkflowStepperProps) => {
  const getSteps = (): Step[] => {
    const steps: Step[] = [
      {
        id: 'created',
        label: 'Created',
        description: 'Order created',
        timestamp: order.createdAt,
      },
      {
        id: 'submitted',
        label: 'Submitted',
        description: 'Sent for review',
        timestamp: order.submittedAt,
      },
      {
        id: 'approved',
        label: 'Approved',
        description: 'C&C approved',
        timestamp: order.ccApprovedAt,
      },
      {
        id: 'client_paid',
        label: 'Client Paid',
        description: 'Payment received',
        timestamp: order.clientPaidAt,
      },
      {
        id: 'distributor_paid',
        label: 'Distributor Paid',
        description: 'Payment to C&C',
        timestamp: order.distributorPaidAt,
      },
      {
        id: 'stock_received',
        label: 'Stock Received',
        description: 'At distributor',
        timestamp: order.stockReceivedAt,
      },
      {
        id: 'delivered',
        label: 'Delivered',
        description: 'Complete',
        timestamp: order.deliveredAt,
      },
    ];

    return steps;
  };

  const steps = getSteps();

  const getStepStatus = (step: Step, index: number): 'completed' | 'current' | 'pending' => {
    if (order.status === 'cancelled') {
      return step.timestamp ? 'completed' : 'pending';
    }

    if (step.timestamp) return 'completed';

    // Find the current step based on status
    const statusToStep: Record<string, string> = {
      draft: 'created',
      submitted: 'submitted',
      under_cc_review: 'submitted',
      revision_requested: 'submitted',
      cc_approved: 'approved',
      awaiting_client_payment: 'approved',
      client_paid: 'client_paid',
      awaiting_distributor_payment: 'client_paid',
      distributor_paid: 'distributor_paid',
      awaiting_partner_payment: 'distributor_paid',
      partner_paid: 'distributor_paid',
      stock_in_transit: 'distributor_paid',
      with_distributor: 'stock_received',
      out_for_delivery: 'stock_received',
      delivered: 'delivered',
    };

    const currentStepId = statusToStep[order.status] ?? 'created';
    const currentStepIndex = steps.findIndex((s) => s.id === currentStepId);

    if (index === currentStepIndex) return 'current';
    if (index < currentStepIndex) return 'completed';
    return 'pending';
  };

  const formatStepDate = (date: Date | null | undefined) => {
    if (!date) return null;
    return format(new Date(date), 'MMM d');
  };

  return (
    <div className="rounded-lg border border-border-muted bg-surface-secondary/30 p-4">
      <div className="flex items-start justify-between gap-2 overflow-x-auto">
        {steps.map((step, index) => {
          const status = getStepStatus(step, index);

          return (
            <div key={step.id} className="flex flex-1 flex-col items-center">
              {/* Step indicator */}
              <div className="relative flex w-full items-center">
                {/* Connector line (left) */}
                {index > 0 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      status === 'pending' ? 'bg-border-muted' : 'bg-fill-brand'
                    }`}
                  />
                )}

                {/* Circle */}
                <div
                  className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                    status === 'completed'
                      ? 'bg-fill-brand text-white'
                      : status === 'current'
                        ? 'border-2 border-fill-brand bg-background-primary'
                        : order.status === 'cancelled' && step.id !== 'delivered'
                          ? 'border-2 border-fill-danger bg-background-primary'
                          : 'border-2 border-border-muted bg-background-primary'
                  }`}
                >
                  {status === 'completed' ? (
                    <Icon icon={IconCheck} size="sm" />
                  ) : status === 'current' ? (
                    <Icon icon={IconClock} size="sm" colorRole="brand" />
                  ) : order.status === 'cancelled' ? (
                    <Icon icon={IconX} size="sm" colorRole="danger" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-border-muted" />
                  )}
                </div>

                {/* Connector line (right) */}
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      status === 'completed' ? 'bg-fill-brand' : 'bg-border-muted'
                    }`}
                  />
                )}
              </div>

              {/* Step label */}
              <div className="mt-2 text-center">
                <Typography
                  variant="bodyXs"
                  className={`font-medium ${
                    status === 'pending' ? 'text-text-muted' : 'text-text-primary'
                  }`}
                >
                  {step.label}
                </Typography>
                {step.timestamp && (
                  <Typography variant="bodyXs" colorRole="muted">
                    {formatStepDate(step.timestamp)}
                  </Typography>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowStepper;
