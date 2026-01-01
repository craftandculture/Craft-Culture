'use client';

import {
  IconCheck,
  IconCircleDashed,
  IconClock,
  IconCreditCard,
  IconFileCheck,
  IconPackage,
  IconSend,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { format } from 'date-fns';

import Icon from '@/app/_ui/components/Icon/Icon';
import type { PrivateClientOrder } from '@/database/schema';

interface WorkflowStepperProps {
  order: PrivateClientOrder;
  compact?: boolean;
}

interface Step {
  id: string;
  label: string;
  shortLabel: string;
  icon: typeof IconCheck;
  timestamp?: Date | null;
}

/**
 * Visual workflow stepper showing order progress through stages
 *
 * Supports compact mode for mobile/smaller displays
 */
const WorkflowStepper = ({ order, compact = false }: WorkflowStepperProps) => {
  const getSteps = (): Step[] => {
    return [
      {
        id: 'created',
        label: 'Created',
        shortLabel: 'New',
        icon: IconCircleDashed,
        timestamp: order.createdAt,
      },
      {
        id: 'submitted',
        label: 'Submitted',
        shortLabel: 'Sent',
        icon: IconSend,
        timestamp: order.submittedAt,
      },
      {
        id: 'approved',
        label: 'Approved',
        shortLabel: 'OK',
        icon: IconFileCheck,
        timestamp: order.ccApprovedAt,
      },
      {
        id: 'paid',
        label: 'Paid',
        shortLabel: 'Paid',
        icon: IconCreditCard,
        timestamp: order.clientPaidAt,
      },
      {
        id: 'in_transit',
        label: 'In Transit',
        shortLabel: 'Ship',
        icon: IconTruck,
        timestamp: order.stockReceivedAt,
      },
      {
        id: 'delivered',
        label: 'Delivered',
        shortLabel: 'Done',
        icon: IconPackage,
        timestamp: order.deliveredAt,
      },
    ];
  };

  const steps = getSteps();

  const getStepStatus = (step: Step, index: number): 'completed' | 'current' | 'pending' => {
    if (order.status === 'cancelled') {
      return step.timestamp ? 'completed' : 'pending';
    }

    if (step.timestamp) return 'completed';

    const statusToStep: Record<string, string> = {
      draft: 'created',
      submitted: 'submitted',
      under_cc_review: 'submitted',
      revision_requested: 'submitted',
      cc_approved: 'approved',
      awaiting_client_payment: 'approved',
      client_paid: 'paid',
      awaiting_distributor_payment: 'paid',
      distributor_paid: 'paid',
      awaiting_partner_payment: 'paid',
      partner_paid: 'paid',
      stock_in_transit: 'in_transit',
      with_distributor: 'in_transit',
      out_for_delivery: 'in_transit',
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

  // Find the current step index for progress calculation
  const currentStepIndex = steps.findIndex((step, index) => getStepStatus(step, index) === 'current');
  const progressPercent = currentStepIndex >= 0 ? (currentStepIndex / (steps.length - 1)) * 100 : 0;

  return (
    <div className="rounded-lg border border-border-muted bg-surface-secondary/30 p-3">
      {/* Progress bar for mobile */}
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-border-muted sm:hidden">
        <div
          className="h-full bg-fill-brand transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-start justify-between gap-1 overflow-x-auto sm:gap-2">
        {steps.map((step, index) => {
          const status = getStepStatus(step, index);
          const StepIcon = status === 'completed' ? IconCheck : status === 'current' ? IconClock : step.icon;

          return (
            <div key={step.id} className="flex min-w-0 flex-1 flex-col items-center">
              {/* Step indicator */}
              <div className="relative flex w-full items-center">
                {/* Connector line (left) */}
                {index > 0 && (
                  <div
                    className={`hidden h-0.5 flex-1 sm:block ${
                      status === 'pending' ? 'bg-border-muted' : 'bg-fill-brand'
                    }`}
                  />
                )}

                {/* Circle */}
                <div
                  className={`relative z-10 flex flex-shrink-0 items-center justify-center rounded-full transition-all ${
                    compact ? 'h-6 w-6' : 'h-6 w-6 sm:h-8 sm:w-8'
                  } ${
                    status === 'completed'
                      ? 'bg-fill-brand text-white'
                      : status === 'current'
                        ? 'border-2 border-fill-brand bg-background-primary'
                        : order.status === 'cancelled' && step.id !== 'delivered'
                          ? 'border-2 border-fill-danger bg-background-primary'
                          : 'border-2 border-border-muted bg-background-primary'
                  }`}
                >
                  {order.status === 'cancelled' && status === 'pending' ? (
                    <Icon icon={IconX} size="xs" colorRole="danger" />
                  ) : (
                    <Icon
                      icon={StepIcon}
                      size="xs"
                      colorRole={status === 'completed' ? undefined : status === 'current' ? 'brand' : 'muted'}
                      className={status === 'completed' ? 'text-white' : ''}
                    />
                  )}
                </div>

                {/* Connector line (right) */}
                {index < steps.length - 1 && (
                  <div
                    className={`hidden h-0.5 flex-1 sm:block ${
                      status === 'completed' ? 'bg-fill-brand' : 'bg-border-muted'
                    }`}
                  />
                )}
              </div>

              {/* Step label */}
              <div className="mt-1.5 text-center">
                <span
                  className={`block text-[10px] font-medium leading-tight sm:text-xs ${
                    status === 'pending' ? 'text-text-muted' : 'text-text-primary'
                  }`}
                >
                  <span className="sm:hidden">{step.shortLabel}</span>
                  <span className="hidden sm:inline">{step.label}</span>
                </span>
                {step.timestamp && (
                  <span className="block text-[9px] text-text-muted sm:text-[10px]">
                    {formatStepDate(step.timestamp)}
                  </span>
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
