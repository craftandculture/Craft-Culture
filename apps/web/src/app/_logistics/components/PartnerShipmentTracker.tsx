'use client';

import { IconCheck } from '@tabler/icons-react';
import { format } from 'date-fns';

import partnerShipmentSteps from '../utils/partnerShipmentSteps';

export interface PartnerShipmentTrackerProps {
  status: string;
  reachedAt: Record<string, string>;
  atd: Date | string | null;
  eta: Date | string | null;
}

/**
 * Where a wine partner's inbound shipment is, step by step, with the date
 * each step was reached
 *
 * Across the card on a wide screen, down it on a phone.
 */
const PartnerShipmentTracker = ({ status, reachedAt, atd, eta }: PartnerShipmentTrackerProps) => {
  const { steps, current } = partnerShipmentSteps(status, reachedAt, atd, eta);
  const when = (step: (typeof steps)[number]) =>
    step.date ? format(new Date(step.date), 'd MMM') : step.expected ? `Expected ${format(new Date(step.expected), 'd MMM')}` : '';

  return (
    <section className="border-border-muted bg-surface-primary rounded-xl border p-4 shadow-sm sm:p-5">
      <ol className="hidden sm:grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => (
          <li key={step.label} className="relative flex flex-col items-center text-center">
            {index > 0 && (
              <span
                className={`absolute right-1/2 top-2 h-0.5 w-full -translate-y-1/2 ${step.done ? 'bg-emerald-500' : 'bg-border-muted'}`}
              />
            )}
            <span
              className={`relative z-10 flex size-4 items-center justify-center rounded-full ${
                step.done ? 'bg-emerald-500 text-white' : 'border-border-muted bg-surface-primary border-2'
              }`}
            >
              {step.done && <IconCheck size={10} stroke={3} />}
            </span>
            <span
              className={`mt-2 px-1 text-[11px] leading-tight ${index === current ? 'text-text-primary font-semibold' : 'text-text-muted'}`}
            >
              {step.label}
            </span>
            {when(step) && (
              <span className={`text-text-muted mt-0.5 text-[10px] tabular-nums ${step.date ? '' : 'italic'}`}>{when(step)}</span>
            )}
          </li>
        ))}
      </ol>

      <ol className="space-y-2 sm:hidden">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-center gap-2.5 text-sm">
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                step.done ? 'bg-emerald-500 text-white' : 'border-border-muted border-2'
              }`}
            >
              {step.done && <IconCheck size={11} stroke={3} />}
            </span>
            <span className={index === current ? 'text-text-primary font-semibold' : 'text-text-muted'}>{step.label}</span>
            {when(step) && (
              <span className={`text-text-muted ml-auto text-xs tabular-nums ${step.date ? '' : 'italic'}`}>{when(step)}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
};

export default PartnerShipmentTracker;
