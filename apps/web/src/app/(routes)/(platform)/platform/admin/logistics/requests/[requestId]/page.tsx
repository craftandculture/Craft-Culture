'use client';

import { IconCheck, IconChevronRight, IconLoader2, IconPaperclip, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { card, pillClass, secondaryButton } from '@/app/_logistics/components/exports/exportUi';
import AwardEmails from '@/app/_logistics/components/quotes/AwardEmails';
import ClientPriceBox from '@/app/_logistics/components/quotes/ClientPriceBox';
import EmailHistory from '@/app/_logistics/components/quotes/EmailHistory';
import QuoteDropZone from '@/app/_logistics/components/quotes/QuoteDropZone';
import QuoteRanking from '@/app/_logistics/components/quotes/QuoteRanking';
import RequestForwarders from '@/app/_logistics/components/quotes/RequestForwarders';
import type { QuoteRequestNextStep } from '@/app/_logistics/utils/quoteRequestNextStep';
import useTRPC from '@/lib/trpc/browser';

const STEPS = ['Ask forwarders', 'Quotes come in', 'Price the client', 'Client agrees', 'Booked'] as const;

/** Where each next step sits on the bar, and what the page asks for */
const STEP_OF: Record<QuoteRequestNextStep, { index: number; prompt: string }> = {
  choose_forwarders: { index: 0, prompt: 'Choose the forwarders to ask for a quote.' },
  send: { index: 0, prompt: 'Send the request to the forwarders chosen.' },
  awaiting: { index: 1, prompt: 'With the forwarders. Drop each quote below as it arrives.' },
  chase: { index: 1, prompt: 'A forwarder is due a reminder; send it below.' },
  price: { index: 2, prompt: 'Quotes are in. Choose one and set the client price.' },
  send_price: { index: 2, prompt: 'The price is set. Send the client their quote.' },
  accept: { index: 3, prompt: 'Waiting for the client. When they agree, accept the quote.' },
  done: { index: 4, prompt: 'Accepted. Tell the forwarders below; the shipment carries it from here.' },
};

const MODE: Record<string, string> = {
  sea_fcl: 'Sea, full container',
  sea_lcl: 'Sea, shared container',
  air: 'Air',
  road: 'Road',
};

const day = (d: Date | null) =>
  d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
const num = (n: number | null, digits = 0) =>
  n == null ? null : n.toLocaleString('en-GB', { maximumFractionDigits: digits });

/**
 * A quote request: the one page its freight is worked from
 *
 * A step bar says where the request stands and what to do next. Below it, in
 * order: the cargo, the forwarders asked and their emails, the drop zone for
 * their quotes, the quotes ranked per 75cl, the client price, the award and
 * decline emails once a quote is accepted, and every email sent.
 */
const QuoteRequestDetailPage = () => {
  const params = useParams();
  const requestId = params.requestId as string;
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [chosenQuoteId, setChosenQuoteId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const { data: request, isLoading } = useQuery(api.logistics.admin.requests.getOne.queryOptions({ requestId }));

  const { mutate: updateRequest, isPending: isUpdating } = useMutation({
    ...api.logistics.admin.requests.update.mutationOptions(),
    onSuccess: () => {
      toast.success('Request cancelled');
      setCancelling(false);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests']] });
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
      <p className="container mx-auto max-w-5xl px-4 py-12 text-center text-sm text-text-muted">
        Request not found.
      </p>
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

  const facts = [
    { label: 'Mode', value: request.transportMode ? MODE[request.transportMode] : 'Air or sea' },
    { label: 'Cases', value: num(request.totalCases) },
    { label: 'Bottles', value: num(request.totalBottles) },
    { label: '75cl equivalent', value: num(request.total75clEquivalents) },
    { label: 'Pallets', value: num(request.totalPallets) },
    { label: 'Weight', value: request.totalWeightKg ? `${num(request.totalWeightKg)} kg` : null },
    { label: 'Volume', value: request.totalVolumeM3 ? `${num(request.totalVolumeM3, 1)} m³` : null },
    { label: 'Ready', value: day(request.targetPickupDate) },
    { label: 'Needed by', value: day(request.targetDeliveryDate) },
    { label: 'Replies by', value: day(request.replyBy) },
  ].filter((f): f is { label: string; value: string } => !!f.value);

  const range =
    request.minTemperature != null && request.maxTemperature != null
      ? ` ${request.minTemperature}–${request.maxTemperature}°C`
      : '';
  const needs = [
    (request.temperatureControlled || request.requiresThermalLiner) && `Temperature-managed${range}`,
    request.requiresThermalLiner && 'Thermal liner',
    request.requiresTracker && 'Tracker',
    request.requiresInsurance && 'Insurance quoted separately',
  ].filter((n): n is string => !!n);

  return (
    <div className="container mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href="/platform/admin/logistics/quotes" className="hover:text-text-primary">
              Freight quotes
            </Link>
            <IconChevronRight className="size-4" />
            <span className="font-mono text-text-primary">{request.requestNumber}</span>
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
                    updateRequest({
                      requestId,
                      status: 'cancelled',
                      cancellationReason: 'Cancelled from the request page',
                    })
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

      {/* Where it stands */}
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
            <p className="mt-3 text-sm font-medium text-text-primary">{step.prompt}</p>
          </>
        )}
      </div>

      {/* Cargo */}
      <div className={`${card} space-y-3 p-4`}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-[11px] text-text-muted">{f.label}</dt>
              <dd className="text-sm font-medium tabular-nums text-text-primary">{f.value}</dd>
            </div>
          ))}
        </dl>
        {(needs.length > 0 || request.productDescription) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {request.productDescription && (
              <span className="mr-1 text-sm text-text-primary">{request.productDescription}</span>
            )}
            {needs.map((n) => (
              <span key={n} className={pillClass('slate')}>
                {n}
              </span>
            ))}
          </div>
        )}
        {request.notes && <p className="whitespace-pre-wrap text-sm text-text-muted">{request.notes}</p>}
        {request.attachments.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {request.attachments.map((a) => (
              <a
                key={a.id}
                href={a.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-text-primary underline"
              >
                <IconPaperclip size={14} /> {a.fileName}
              </a>
            ))}
          </div>
        )}
      </div>

      {!cancelled && <RequestForwarders request={request} />}

      {isOpen && !accepted && <QuoteDropZone requestId={requestId} />}

      {(request.quotes.length > 0 || !cancelled) && (
        <QuoteRanking request={request} selectedQuoteId={pricedQuoteId} onSelect={setChosenQuoteId} />
      )}

      {pricedQuoteId && !accepted && !cancelled && <ClientPriceBox request={request} quoteId={pricedQuoteId} />}

      <AwardEmails request={request} />

      <EmailHistory request={request} />
    </div>
  );
};

export default QuoteRequestDetailPage;
