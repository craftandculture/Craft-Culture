'use client';

import { IconArrowRight, IconCheck, IconChevronRight, IconLoader2, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { card, primaryButton, secondaryButton, sectionHeading } from '@/app/_logistics/components/exports/exportUi';
import AwardEmails from '@/app/_logistics/components/quotes/AwardEmails';
import ClientPriceBox from '@/app/_logistics/components/quotes/ClientPriceBox';
import EmailHistory from '@/app/_logistics/components/quotes/EmailHistory';
import QuoteDropZone from '@/app/_logistics/components/quotes/QuoteDropZone';
import QuoteEditor from '@/app/_logistics/components/quotes/QuoteEditor';
import type { QuoteEditorTarget } from '@/app/_logistics/components/quotes/QuoteEditor';
import QuoteRanking from '@/app/_logistics/components/quotes/QuoteRanking';
import RequestDetailsCard from '@/app/_logistics/components/quotes/RequestDetailsCard';
import RequestForwarders from '@/app/_logistics/components/quotes/RequestForwarders';
import type { QuoteRequestNextStep } from '@/app/_logistics/utils/quoteRequestNextStep';
import useTRPC from '@/lib/trpc/browser';

const STEPS = ['Ask forwarders', 'Quotes come in', 'Price the client', 'Client agrees', 'Booked'] as const;

type Target = 'details' | 'forwarders' | 'quotes' | 'fix' | 'price';

/** Where each next step sits on the bar, what the page says, and the one button that does it */
const STEP_OF: Record<QuoteRequestNextStep, { index: number; prompt: string; action?: string; target?: Target }> = {
  add_cargo: {
    index: 0,
    prompt: 'Forwarders cannot quote without the size of the load.',
    action: 'Add cases, bottles or weight',
    target: 'details',
  },
  choose_forwarders: {
    index: 0,
    prompt: 'Choose the forwarders to ask.',
    action: 'Choose forwarders',
    target: 'forwarders',
  },
  send: {
    index: 0,
    prompt: 'The forwarders are chosen; the request has not gone yet.',
    action: 'Send the request',
    target: 'forwarders',
  },
  awaiting: {
    index: 1,
    prompt: 'With the forwarders. Add each quote as it arrives.',
    action: 'Add a quote',
    target: 'quotes',
  },
  chase: { index: 1, prompt: 'A forwarder is due a reminder.', action: 'Send the reminder', target: 'forwarders' },
  fix_quotes: {
    index: 1,
    prompt: 'Every quote is past its validity. Check the date, or ask the forwarder to confirm it.',
    action: 'Fix the validity',
    target: 'fix',
  },
  price: {
    index: 2,
    prompt: 'Quotes are in. Choose one and set the client price.',
    action: 'Set the client price',
    target: 'price',
  },
  send_price: {
    index: 2,
    prompt: 'The price is set. Send the client their quote.',
    action: 'Send the client quote',
    target: 'price',
  },
  accept: {
    index: 3,
    prompt: 'With the client. When they agree, accept the quote.',
    action: 'Accept the quote',
    target: 'price',
  },
  done: { index: 4, prompt: 'Accepted. Tell the forwarders below; the job carries it from here.' },
};

const day = (d: Date | null) =>
  d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

const scrollTo = (id: string) =>
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

/**
 * A quote request: the one page its freight is worked from, all of it editable
 *
 * The step bar says where the request stands and carries the one button for
 * what to do next. Below it, in order: the details (edited in place), the
 * forwarders asked and their emails, the quotes (added from a PDF or an
 * email, checked and edited in place, ranked per 75cl), the client price with
 * the client's quote to copy or send, the award and decline emails once a
 * quote is accepted, and every email sent.
 */
const QuoteRequestDetailPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const requestId = params.requestId as string;
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [chosenQuoteId, setChosenQuoteId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editor, setEditor] = useState<QuoteEditorTarget | null>(null);

  const { data: request, isLoading } = useQuery(api.logistics.admin.requests.getOne.queryOptions({ requestId }));

  // Opened from a quote's own page to edit it here
  const editQuote = searchParams.get('editQuote');
  useEffect(() => {
    if (editQuote) {
      setEditor({ kind: 'edit', quoteId: editQuote });
      scrollTo('quotes');
    }
  }, [editQuote]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests']] });

  const { mutate: openJob, isPending: isOpeningJob } = useMutation({
    ...api.logistics.admin.requests.openJob.mutationOptions(),
    onSuccess: (job) => {
      toast.success(`Job ${job.shipmentNumber} opened`);
      refresh();
    },
    onError: (error) => toast.error(error.message || 'The job could not be opened'),
  });

  const { mutate: updateRequest, isPending: isUpdating } = useMutation({
    ...api.logistics.admin.requests.update.mutationOptions(),
    onSuccess: () => {
      toast.success('Request cancelled');
      setCancelling(false);
      refresh();
    },
    onError: (error) => toast.error(error.message || 'Could not cancel the request'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <IconLoader2 className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!request) {
    return (
      <p className="container mx-auto max-w-5xl px-4 py-12 text-center text-sm text-text-muted">Request not found.</p>
    );
  }

  const cancelled = request.status === 'cancelled';
  const accepted = request.quotes.some((q) => q.status === 'accepted');
  const isOpen = !cancelled && request.status !== 'completed';
  const step = STEP_OF[request.nextStep];

  // The client is priced on the quote chosen, else the one priced before, else the cheapest still live
  const liveQuotes = request.quotes.filter((q) => q.status === 'pending' && !q.isExpired);
  const pricedQuoteId =
    [chosenQuoteId, request.clientQuoteId].find((id) => id && liveQuotes.some((q) => q.id === id)) ??
    liveQuotes[0]?.id ??
    null;

  const openEditor = (target: QuoteEditorTarget) => {
    setEditor(target);
    scrollTo('quotes');
  };

  const act = (target: Target) => {
    if (target === 'details') {
      setEditingDetails(true);
      scrollTo('request-details');
    } else if (target === 'fix') {
      const lapsed = request.quotes.find((q) => q.status === 'expired' || (q.status === 'pending' && q.isExpired));
      if (lapsed) openEditor({ kind: 'edit', quoteId: lapsed.id });
    } else if (target === 'price') {
      scrollTo('client-price');
    } else {
      scrollTo(target);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
            <Link href="/platform/admin/logistics/quotes" className="hover:text-text-primary">
              Freight quotes
            </Link>
            <IconChevronRight className="size-4" />
            <span className="font-mono text-text-primary">{request.requestNumber}</span>
            {request.job ? (
              <Link
                href={`/platform/admin/logistics/shipments/${request.job.id}`}
                className="ml-2 rounded-full border border-border-muted px-2 py-0.5 font-mono text-xs text-text-primary hover:border-text-primary"
              >
                Job {request.job.shipmentNumber}
                {request.job.status === 'cancelled' ? ' (cancelled)' : ''}
              </Link>
            ) : (
              !cancelled && (
                <button
                  type="button"
                  disabled={isOpeningJob}
                  onClick={() => openJob({ requestId })}
                  className="ml-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:border-amber-500 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
                >
                  No job yet: open the job
                </button>
              )
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            {request.originCity || request.originCountry} → {request.destinationCity || request.destinationCountry}
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {[request.originWarehouse, request.destinationWarehouse].filter(Boolean).join(' to ')}
            {request.requester ? ` · requested by ${request.requester.name || request.requester.email}` : ''}
            {` · ${day(request.requestedAt)}`}
          </p>
        </div>
        {isOpen && !accepted && (
          <div className="flex items-center gap-2">
            {cancelling ? (
              <>
                <span className="text-sm text-text-muted">Cancel this request?</span>
                <button
                  type="button"
                  className={secondaryButton}
                  disabled={isUpdating}
                  onClick={() =>
                    updateRequest({ requestId, status: 'cancelled', cancellationReason: 'Cancelled from the request page' })
                  }
                >
                  <IconCheck size={15} /> Yes, cancel
                </button>
                <button
                  type="button"
                  aria-label="Keep the request"
                  className={secondaryButton}
                  onClick={() => setCancelling(false)}
                >
                  <IconX size={15} />
                </button>
              </>
            ) : (
              <button type="button" className={secondaryButton} onClick={() => setCancelling(true)}>
                Cancel request
              </button>
            )}
          </div>
        )}
      </div>

      {/* Where it stands, and the one thing to do next */}
      <div className={`${card} p-4`}>
        {cancelled ? (
          <p className="text-sm text-text-muted">
            Cancelled{request.cancellationReason ? `: ${request.cancellationReason}` : ''}.
          </p>
        ) : (
          <>
            <ol className="grid grid-cols-5 gap-1">
              {STEPS.map((label, i) => (
                <li key={label} className="space-y-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      i < step.index ? 'bg-emerald-500' : i === step.index ? 'bg-text-primary' : 'bg-surface-muted'
                    }`}
                  />
                  <span
                    className={`block text-[11px] leading-tight ${
                      i === step.index ? 'font-semibold text-text-primary' : 'text-text-muted'
                    }`}
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="text-sm font-medium text-text-primary">{step.prompt}</p>
              {step.action && step.target && (
                <button
                  type="button"
                  className={`${primaryButton} sm:ml-auto`}
                  onClick={() => act(step.target!)}
                >
                  {step.action} <IconArrowRight size={15} />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <RequestDetailsCard request={request} editing={editingDetails} onEditingChange={setEditingDetails} />

      {!cancelled && (
        <div id="forwarders" className="scroll-mt-4">
          <RequestForwarders request={request} />
        </div>
      )}

      <div id="quotes" className="scroll-mt-4 space-y-4">
        {editor && (
          <QuoteEditor
            key={editor.kind === 'edit' ? editor.quoteId : 'new'}
            request={request}
            target={editor}
            onDone={() => setEditor(null)}
          />
        )}

        <QuoteRanking
          request={request}
          selectedQuoteId={pricedQuoteId}
          onSelect={setChosenQuoteId}
          onEdit={(quoteId) => openEditor({ kind: 'edit', quoteId })}
          onAddBottles={() => act('details')}
          addQuote={
            isOpen && !accepted && !editor ? (
              <div className="space-y-2">
                <span className={sectionHeading}>Add a quote</span>
                <QuoteDropZone onRead={(draft, file) => openEditor({ kind: 'new', draft, file })} />
              </div>
            ) : undefined
          }
        />
      </div>

      {pricedQuoteId && !accepted && !cancelled && (
        <div id="client-price" className="scroll-mt-4">
          <ClientPriceBox request={request} quoteId={pricedQuoteId} />
        </div>
      )}

      <AwardEmails request={request} />

      <EmailHistory request={request} />
    </div>
  );
};

export default QuoteRequestDetailPage;
