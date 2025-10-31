'use client';

import type { Quote } from '@/database/schema';

export interface QuoteWorkflowTimelineProps {
  quote: Quote;
}

interface TimelineStep {
  label: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: Date | null;
  notes?: string | null;
}

/**
 * Get timeline steps for a quote based on its status and data
 *
 * @param quote - The quote object
 * @returns Array of timeline steps
 */
const getTimelineSteps = (quote: Quote): TimelineStep[] => {
  const steps: TimelineStep[] = [];

  // Step 1: Created
  steps.push({
    label: 'Quote Created',
    status: 'completed',
    timestamp: quote.createdAt,
  });

  // Step 2: Sent
  if (quote.status === 'draft') {
    steps.push({
      label: 'Send Quote',
      status: 'upcoming',
    });
    return steps;
  }

  steps.push({
    label: 'Quote Sent',
    status: 'completed',
  });

  // Step 3: Buy Request Submitted
  if (
    quote.status === 'sent' ||
    (quote.status === 'revision_requested' && !quote.buyRequestSubmittedAt)
  ) {
    steps.push({
      label: 'Submit Buy Request',
      status: 'current',
    });
    return steps;
  }

  steps.push({
    label: 'Buy Request Submitted',
    status: 'completed',
    timestamp: quote.buyRequestSubmittedAt,
  });

  // Handle revision loop
  if (quote.status === 'revision_requested') {
    steps.push({
      label: 'Revision Requested',
      status: 'current',
      timestamp: quote.revisionRequestedAt,
      notes: quote.revisionReason || undefined,
    });
    return steps;
  }

  // Step 4: C&C Review
  if (quote.status === 'buy_request_submitted') {
    steps.push({
      label: 'C&C Review',
      status: 'current',
    });
    return steps;
  }

  if (quote.status === 'under_cc_review') {
    steps.push({
      label: 'Under C&C Review',
      status: 'current',
      timestamp: quote.ccReviewStartedAt,
      notes: quote.ccNotes || undefined,
    });
    return steps;
  }

  steps.push({
    label: 'C&C Review Completed',
    status: 'completed',
    timestamp: quote.ccReviewStartedAt,
  });

  // Step 5: C&C Confirmed
  if (quote.status === 'cc_confirmed') {
    steps.push({
      label: 'Confirmed by C&C',
      status: 'current',
      timestamp: quote.ccConfirmedAt,
      notes: quote.ccConfirmationNotes || undefined,
    });
    return steps;
  }

  if (
    quote.status === 'po_submitted' ||
    quote.status === 'po_confirmed'
  ) {
    steps.push({
      label: 'Confirmed by C&C',
      status: 'completed',
      timestamp: quote.ccConfirmedAt,
    });
  }

  // Step 6: PO Submitted
  if (quote.status === 'po_submitted') {
    steps.push({
      label: `PO Submitted (${quote.poNumber})`,
      status: 'current',
      timestamp: quote.poSubmittedAt,
    });
    return steps;
  }

  if (quote.status === 'po_confirmed') {
    steps.push({
      label: `PO Submitted (${quote.poNumber})`,
      status: 'completed',
      timestamp: quote.poSubmittedAt,
    });

    steps.push({
      label: 'PO Confirmed',
      status: 'completed',
      timestamp: quote.poConfirmedAt,
      notes: quote.poConfirmationNotes || undefined,
    });
  }

  return steps;
};

/**
 * Display a timeline showing the quote approval workflow progress
 *
 * @example
 *   <QuoteWorkflowTimeline quote={quote} />
 */
const QuoteWorkflowTimeline = ({ quote }: QuoteWorkflowTimelineProps) => {
  const steps = getTimelineSteps(quote);

  return (
    <div className='space-y-4'>
      <h3 className='text-lg font-semibold text-text-primary'>
        Workflow Progress
      </h3>
      <div className='space-y-6'>
        {steps.map((step, index) => (
          <div key={index} className='flex gap-4'>
            {/* Timeline indicator */}
            <div className='flex flex-col items-center'>
              <div
                className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${
                  step.status === 'completed'
                    ? 'border-border-success bg-fill-success text-text-success'
                    : step.status === 'current'
                      ? 'border-border-brand bg-fill-brand text-text-brand'
                      : 'border-border-muted bg-fill-muted text-text-muted'
                }`}
              >
                {step.status === 'completed' && (
                  <svg
                    className='h-5 w-5'
                    fill='none'
                    strokeWidth={2}
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M5 13l4 4L19 7'
                    />
                  </svg>
                )}
                {step.status === 'current' && (
                  <div className='h-3 w-3 rounded-full bg-current' />
                )}
                {step.status === 'upcoming' && (
                  <div className='h-2 w-2 rounded-full bg-current' />
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-0.5 flex-1 min-h-6 ${
                    step.status === 'completed'
                      ? 'bg-border-success'
                      : 'bg-border-muted'
                  }`}
                />
              )}
            </div>

            {/* Step content */}
            <div className='flex-1 pb-8'>
              <div className='font-medium text-text-primary'>{step.label}</div>
              {step.timestamp && (
                <div className='text-sm text-text-muted'>
                  {step.timestamp.toLocaleDateString()}{' '}
                  {step.timestamp.toLocaleTimeString()}
                </div>
              )}
              {step.notes && (
                <div className='mt-2 text-sm text-text-secondary rounded-md bg-fill-muted p-2'>
                  {step.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Revision history */}
      {quote.revisionHistory &&
      Array.isArray(quote.revisionHistory) &&
      quote.revisionHistory.length > 0 ? (
        <div className='mt-6 pt-6 border-t border-border-primary'>
          <h4 className='text-sm font-semibold text-text-primary mb-3'>
            Revision History ({quote.buyRequestCount} submissions)
          </h4>
          <div className='space-y-2'>
            {(quote.revisionHistory as Array<{
              requestedAt: string;
              reason: string;
            }>).map((revision, idx) => (
              <div
                key={idx}
                className='text-sm p-3 rounded-md bg-fill-muted/50'
              >
                <div className='font-medium text-text-secondary'>
                  {new Date(revision.requestedAt).toLocaleDateString()}
                </div>
                <div className='text-text-muted mt-1'>{revision.reason}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default QuoteWorkflowTimeline;
