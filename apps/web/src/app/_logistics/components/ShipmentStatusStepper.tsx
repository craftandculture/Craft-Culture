'use client';

import { IconCheck, IconCircle, IconCircleDot } from '@tabler/icons-react';
import { useState } from 'react';

import InlineConfirm from '@/app/_logistics/components/shipment/InlineConfirm';
import type { ShipmentStatus, ShipmentType } from '@/app/_logistics/utils/shipmentStatuses';
import { SHIPMENT_STEPS, shipmentStatusLabel } from '@/app/_logistics/utils/shipmentStatuses';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface ShipmentStatusStepperProps {
  currentStatus: ShipmentStatus;
  shipmentType: ShipmentType;
  onStatusClick?: (status: ShipmentStatus) => void;
  isUpdating?: boolean;
}

/**
 * Visual stepper showing shipment status progression
 *
 * The steps depend on the kind of shipment (SHIPMENT_STEPS), and a step is
 * current when the shipment's status is one it covers — so "Receiving" sits on
 * the warehouse step and "Delivered" completes an import. Clicking a step asks
 * first, because a status change notifies the partner.
 */
const ShipmentStatusStepper = ({
  currentStatus,
  shipmentType,
  onStatusClick,
  isUpdating = false,
}: ShipmentStatusStepperProps) => {
  const [pendingStatus, setPendingStatus] = useState<ShipmentStatus | null>(null);

  // Handle cancelled status separately
  if (currentStatus === 'cancelled') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">
        <Typography variant="bodySm" className="text-red-600 dark:text-red-400 text-center">
          This shipment has been cancelled
        </Typography>
      </div>
    );
  }

  const steps = SHIPMENT_STEPS[shipmentType];
  const currentIndex = steps.findIndex((s) => s.covers.includes(currentStatus));
  // The last step is the end of the journey, so reaching it counts as done
  const isFinished = currentIndex === steps.length - 1;

  const handleClick = (status: ShipmentStatus, isCurrent: boolean) => {
    if (!onStatusClick || isCurrent) return;
    setPendingStatus(status);
  };

  const pendingLabel = pendingStatus
    ? (steps.find((s) => s.status === pendingStatus)?.label ?? shipmentStatusLabel(pendingStatus))
    : null;

  const stateOf = (index: number) => ({
    isCompleted: index < currentIndex || (isFinished && index === currentIndex),
    isCurrent: index === currentIndex && !isFinished,
    isPending: index > currentIndex,
  });

  return (
    <div className="w-full">
      {/* Desktop view */}
      <div className="hidden md:block">
        <div className="relative flex justify-between">
          {/* Progress line background */}
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-border-muted" />
          {/* Progress line filled */}
          <div
            className="absolute top-4 left-0 h-0.5 bg-text-primary transition-all duration-500"
            style={{ width: `${(Math.max(currentIndex, 0) / (steps.length - 1)) * 100}%` }}
          />

          {steps.map((step, index) => {
            const { isCompleted, isCurrent, isPending } = stateOf(index);
            const isAtStep = index === currentIndex;

            return (
              <button
                key={step.status}
                type="button"
                onClick={() => handleClick(step.status, isAtStep)}
                disabled={!onStatusClick || isUpdating}
                className={`relative flex flex-col items-center ${onStatusClick && !isAtStep ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {/* Circle */}
                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'border-text-primary bg-text-primary text-surface-primary'
                      : isCurrent
                        ? 'border-text-primary bg-white dark:bg-surface-primary'
                        : 'border-border-muted bg-white dark:bg-surface-primary'
                  }`}
                >
                  {isCompleted ? (
                    <Icon icon={IconCheck} size="sm" />
                  ) : isCurrent ? (
                    <Icon icon={IconCircleDot} size="sm" className="text-text-primary" />
                  ) : (
                    <Icon icon={IconCircle} size="sm" className="text-text-muted" />
                  )}
                </div>
                {/* Label */}
                <Typography
                  variant="bodyXs"
                  className={`mt-2 text-center ${
                    isAtStep ? 'font-semibold text-text-primary' : isPending ? 'text-text-muted' : ''
                  }`}
                >
                  {step.label}
                </Typography>
                {/* The exact status, where the step stands for several */}
                {isAtStep && step.status !== currentStatus && (
                  <Typography variant="bodyXs" colorRole="muted" className="text-center">
                    {shipmentStatusLabel(currentStatus)}
                  </Typography>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile view - compact */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {steps.map((step, index) => {
            const { isCompleted, isCurrent } = stateOf(index);

            return (
              <button
                key={step.status}
                type="button"
                onClick={() => handleClick(step.status, index === currentIndex)}
                disabled={!onStatusClick || isUpdating}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs whitespace-nowrap ${
                  isCompleted
                    ? 'bg-fill-muted text-text-primary'
                    : isCurrent
                      ? 'bg-text-primary text-surface-primary'
                      : 'bg-surface-secondary text-text-muted'
                }`}
              >
                {isCompleted && <Icon icon={IconCheck} size="xs" />}
                {step.label}
              </button>
            );
          })}
        </div>
      </div>

      {pendingStatus && (
        <div className="mt-4 flex justify-center border-t border-border-muted pt-3">
          <InlineConfirm
            message={`Move this shipment to ${pendingLabel}? The partner is notified of the change.`}
            confirmLabel={`Move to ${pendingLabel}`}
            isPending={isUpdating}
            onConfirm={() => {
              onStatusClick?.(pendingStatus);
              setPendingStatus(null);
            }}
            onCancel={() => setPendingStatus(null)}
          />
        </div>
      )}
    </div>
  );
};

export default ShipmentStatusStepper;
