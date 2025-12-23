'use client';

import {
  IconCheck,
  IconClock,
  IconCreditCard,
  IconFileText,
  IconSend,
  IconTruck,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { Quote } from '@/database/schema';

interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  icon: typeof IconFileText;
  status: 'completed' | 'current' | 'upcoming';
}

interface QuoteWorkflowStepperProps {
  quote: Quote & { createdBy?: { customerType?: 'b2b' | 'b2c' } | null };
  variant?: 'default' | 'compact';
}

/**
 * Clean, minimal workflow stepper for quote approval process
 * Supports both B2B (PO) and B2C (payment) workflows
 */
const QuoteWorkflowStepper = ({ quote, variant = 'default' }: QuoteWorkflowStepperProps) => {
  // Determine if this is a B2C flow based on customer type or status indicators
  const isB2C = useMemo(() => {
    // If createdBy has customerType, use that
    if (quote.createdBy?.customerType) {
      return quote.createdBy.customerType === 'b2c';
    }
    // Otherwise infer from status - if it has payment-related status, it's B2C
    return (
      quote.status === 'awaiting_payment' ||
      quote.status === 'paid' ||
      quote.paymentMethod !== null
    );
  }, [quote.createdBy?.customerType, quote.status, quote.paymentMethod]);

  const steps: WorkflowStep[] = useMemo(() => {
    const quoteStatus = quote.status;

    // Define workflow steps based on flow type (B2C vs B2B)
    const b2cSteps = [
      {
        id: 'submitted',
        label: 'Submitted',
        description: 'Order request received',
        icon: IconSend,
      },
      {
        id: 'review',
        label: 'Under Review',
        description: 'C&C team reviewing',
        icon: IconClock,
      },
      {
        id: 'confirmed',
        label: 'Confirmed',
        description: 'Quote approved',
        icon: IconCheck,
      },
      {
        id: 'awaiting_payment',
        label: 'Awaiting Payment',
        description: 'Payment pending',
        icon: IconCreditCard,
      },
      {
        id: 'paid',
        label: 'Paid',
        description: 'Payment received',
        icon: IconCheck,
      },
      {
        id: 'delivered',
        label: 'Delivered',
        description: 'Order complete',
        icon: IconTruck,
      },
    ];

    const b2bSteps = [
      {
        id: 'submitted',
        label: 'Submitted',
        description: 'Order request received',
        icon: IconSend,
      },
      {
        id: 'review',
        label: 'Under Review',
        description: 'C&C team reviewing',
        icon: IconClock,
      },
      {
        id: 'confirmed',
        label: 'Confirmed',
        description: 'Quote approved',
        icon: IconCheck,
      },
      {
        id: 'po_submitted',
        label: 'PO Submitted',
        description: 'Purchase order received',
        icon: IconFileText,
      },
      {
        id: 'po_confirmed',
        label: 'PO Confirmed',
        description: 'Order confirmed',
        icon: IconCheck,
      },
      {
        id: 'delivered',
        label: 'Delivered',
        description: 'Order complete',
        icon: IconTruck,
      },
    ];

    const allSteps = isB2C ? b2cSteps : b2bSteps;

    // Determine current step index based on status
    let currentStepIndex = 0;
    if (quoteStatus === 'buy_request_submitted') {
      currentStepIndex = 0;
    } else if (quoteStatus === 'under_cc_review' || quoteStatus === 'revision_requested') {
      currentStepIndex = 1;
    } else if (quoteStatus === 'cc_confirmed') {
      currentStepIndex = 2;
    } else if (isB2C) {
      // B2C flow
      if (quoteStatus === 'awaiting_payment') currentStepIndex = 3;
      else if (quoteStatus === 'paid') currentStepIndex = 4;
      else if (quoteStatus === 'delivered') currentStepIndex = 5;
    } else {
      // B2B flow
      if (quoteStatus === 'po_submitted') currentStepIndex = 3;
      else if (quoteStatus === 'po_confirmed') currentStepIndex = 4;
      else if (quoteStatus === 'delivered') currentStepIndex = 5;
    }

    return allSteps.map((step, index) => ({
      ...step,
      status:
        index < currentStepIndex
          ? ('completed' as const)
          : index === currentStepIndex
            ? ('current' as const)
            : ('upcoming' as const),
    }));
  }, [quote.status, isB2C]);

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                step.status === 'completed'
                  ? 'bg-fill-brand text-text-brand-contrast'
                  : step.status === 'current'
                    ? 'bg-fill-brand/20 text-text-brand ring-2 ring-border-brand'
                    : 'bg-fill-muted text-text-muted'
              }`}
            >
              {step.status === 'completed' ? (
                <Icon icon={IconCheck} size="sm" />
              ) : (
                <Icon icon={step.icon} size="sm" />
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-8 transition-all ${
                  step.status === 'completed' ? 'bg-fill-brand' : 'bg-border-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-6 top-6 h-full w-0.5 bg-border-muted" />
        <div
          className="absolute left-6 top-6 w-0.5 bg-fill-brand transition-all duration-500"
          style={{
            height: `${(steps.findIndex((s) => s.status === 'current') / (steps.length - 1)) * 100}%`,
          }}
        />

        {/* Steps */}
        <div className="relative space-y-6">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-4">
              {/* Step Icon */}
              <div
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-4 border-white dark:border-background-primary transition-all ${
                  step.status === 'completed'
                    ? 'bg-fill-brand text-text-brand-contrast shadow-md'
                    : step.status === 'current'
                      ? 'bg-fill-brand/10 text-text-brand ring-2 ring-border-brand shadow-md'
                      : 'bg-fill-muted text-text-muted'
                }`}
              >
                {step.status === 'completed' ? (
                  <Icon icon={IconCheck} size="md" />
                ) : (
                  <Icon icon={step.icon} size="md" />
                )}
              </div>

              {/* Step Content */}
              <div className={`flex-1 pt-1.5 ${index < steps.length - 1 ? 'pb-6' : ''}`}>
                <Typography
                  variant="bodySm"
                  className={`font-semibold ${
                    step.status === 'current'
                      ? 'text-text-brand'
                      : step.status === 'completed'
                        ? 'text-text-primary'
                        : 'text-text-muted'
                  }`}
                >
                  {step.label}
                </Typography>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="mt-0.5"
                >
                  {step.description}
                </Typography>

                {/* Show timestamp for completed/current steps */}
                {step.status !== 'upcoming' && (
                  <div className="mt-2">
                    {step.id === 'submitted' && quote.buyRequestSubmittedAt && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {new Date(quote.buyRequestSubmittedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    )}
                    {step.id === 'review' && quote.ccReviewStartedAt && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {new Date(quote.ccReviewStartedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    )}
                    {step.id === 'confirmed' && quote.ccConfirmedAt && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {new Date(quote.ccConfirmedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    )}
                    {step.id === 'awaiting_payment' && quote.ccConfirmedAt && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {new Date(quote.ccConfirmedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    )}
                    {step.id === 'paid' && quote.paidAt && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {new Date(quote.paidAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    )}
                    {step.id === 'po_submitted' && quote.poSubmittedAt && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {new Date(quote.poSubmittedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    )}
                    {step.id === 'po_confirmed' && quote.poConfirmedAt && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {new Date(quote.poConfirmedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    )}
                    {step.id === 'delivered' && quote.deliveredAt && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {new Date(quote.deliveredAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    )}
                  </div>
                )}

                {/* Show revision notice if applicable */}
                {step.id === 'review' && quote.status === 'revision_requested' && (
                  <div className="mt-2 rounded-lg bg-fill-warning/10 px-3 py-2 border border-border-warning">
                    <Typography variant="bodyXs" className="text-text-warning font-medium">
                      Revision Requested
                    </Typography>
                    {quote.revisionReason && (
                      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                        {quote.revisionReason}
                      </Typography>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuoteWorkflowStepper;
