'use client';

import { IconCheck, IconCircle, IconCircleDot } from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { LogisticsShipment } from '@/database/schema';

type ShipmentStatus = LogisticsShipment['status'];

interface StatusStep {
  status: ShipmentStatus;
  label: string;
  shortLabel: string;
}

const statusSteps: StatusStep[] = [
  { status: 'draft', label: 'Draft', shortLabel: 'Draft' },
  { status: 'booked', label: 'Booked', shortLabel: 'Booked' },
  { status: 'picked_up', label: 'Picked Up', shortLabel: 'Pickup' },
  { status: 'in_transit', label: 'In Transit', shortLabel: 'Transit' },
  { status: 'arrived_port', label: 'Arrived Port', shortLabel: 'Port' },
  { status: 'customs_clearance', label: 'Customs', shortLabel: 'Customs' },
  { status: 'cleared', label: 'Cleared', shortLabel: 'Cleared' },
  { status: 'at_warehouse', label: 'At Warehouse', shortLabel: 'Warehouse' },
];

export interface ShipmentStatusStepperProps {
  currentStatus: ShipmentStatus;
  onStatusClick?: (status: ShipmentStatus) => void;
}

/**
 * Visual stepper showing shipment status progression
 */
const ShipmentStatusStepper = ({ currentStatus, onStatusClick }: ShipmentStatusStepperProps) => {
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

  const currentIndex = statusSteps.findIndex((s) => s.status === currentStatus);

  return (
    <div className="w-full">
      {/* Desktop view */}
      <div className="hidden md:block">
        <div className="relative flex justify-between">
          {/* Progress line background */}
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-border-muted" />
          {/* Progress line filled */}
          <div
            className="absolute top-4 left-0 h-0.5 bg-fill-brand transition-all duration-500"
            style={{ width: `${(currentIndex / (statusSteps.length - 1)) * 100}%` }}
          />

          {statusSteps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isPending = index > currentIndex;

            return (
              <button
                key={step.status}
                onClick={() => onStatusClick?.(step.status)}
                disabled={!onStatusClick}
                className={`relative flex flex-col items-center ${onStatusClick ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {/* Circle */}
                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'border-fill-brand bg-fill-brand text-white'
                      : isCurrent
                        ? 'border-fill-brand bg-white dark:bg-surface-primary'
                        : 'border-border-muted bg-white dark:bg-surface-primary'
                  }`}
                >
                  {isCompleted ? (
                    <Icon icon={IconCheck} size="sm" />
                  ) : isCurrent ? (
                    <Icon icon={IconCircleDot} size="sm" className="text-fill-brand" />
                  ) : (
                    <Icon icon={IconCircle} size="sm" className="text-text-muted" />
                  )}
                </div>
                {/* Label */}
                <Typography
                  variant="bodyXs"
                  className={`mt-2 text-center ${
                    isCurrent ? 'font-semibold text-text-brand' : isPending ? 'text-text-muted' : ''
                  }`}
                >
                  {step.shortLabel}
                </Typography>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile view - compact */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {statusSteps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <button
                key={step.status}
                onClick={() => onStatusClick?.(step.status)}
                disabled={!onStatusClick}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs whitespace-nowrap ${
                  isCompleted
                    ? 'bg-fill-brand/10 text-text-brand'
                    : isCurrent
                      ? 'bg-fill-brand text-white'
                      : 'bg-surface-secondary text-text-muted'
                }`}
              >
                {isCompleted && <Icon icon={IconCheck} size="xs" />}
                {step.shortLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ShipmentStatusStepper;
