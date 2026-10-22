'use client';

import { IconCheck } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import CopyTextCard from './CopyTextCard';
import buildFreightEmail from '../../utils/buildFreightEmail';
import { card, input, label, primaryButton, secondaryButton, sectionHeading } from '../exports/exportUi';

type Request = inferRouterOutputs<AppRouter>['logistics']['admin']['requests']['getOne'];

export interface ClientPriceBoxProps {
  request: Request;
  quoteId: string;
}

const usd = (n: number) => `USD ${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * What the client is charged for the freight, against one forwarder quote
 *
 * The price is ours to set: it starts from the last rate charged on this
 * route, and the margin over the chosen quote and its place against the other
 * quotes are shown as it is typed. Once saved, the client email is ready to
 * copy; copying it records that the client has been quoted.
 */
const ClientPriceBox = ({ request, quoteId }: ClientPriceBoxProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const quote = request.quotes.find((q) => q.id === quoteId);
  const saved = request.clientQuoteId === quoteId ? request.clientPriceUsd : null;
  const start = saved ?? request.suggestedClientPrice?.priceUsd ?? null;

  const [basis, setBasis] = useState<'total' | 'bottle'>('total');
  const [value, setValue] = useState(start != null ? String(start) : '');

  useEffect(() => {
    setValue(start != null ? String(start) : '');
    setBasis('total');
  }, [quoteId, start]);

  const [clientEmail, setClientEmail] = useState(request.clientEmail ?? '');
  useEffect(() => setClientEmail(request.clientEmail ?? ''), [request.clientEmail]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests']] });

  const sendToClient = useMutation({
    ...api.logistics.admin.requests.sendClientQuote.mutationOptions(),
    onSuccess: (r) => {
      toast.success(`Quote sent to ${r.to}`);
      refresh();
    },
    onError: (error) => toast.error(error.message || 'The quote was not sent'),
  });

  const accept = useMutation({
    ...api.logistics.admin.quotes.accept.mutationOptions(),
    onSuccess: () => {
      toast.success(`Accepted: ${request.job ? `the cost is on job ${request.job.shipmentNumber}` : 'quote accepted'}`);
      refresh();
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'quotes']] });
    },
    onError: (error) => toast.error(error.message || 'The quote was not accepted'),
  });

  const setPrice = useMutation({
    ...api.logistics.admin.requests.setClientPrice.mutationOptions(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests']] }),
    onError: (error) => toast.error(error.message || 'Could not save the price'),
  });

  if (!quote) return null;

  const typed = Number(value.replace(/,/g, ''));
  const priceUsd =
    !value || !Number.isFinite(typed) || typed <= 0
      ? null
      : basis === 'bottle'
        ? request.totalBottles
          ? Math.round(typed * request.totalBottles * 100) / 100
          : null
        : typed;
  const cost = quote.totalUsd;
  const margin = priceUsd != null && cost != null ? priceUsd - cost : null;
  const others = request.quotes.filter((q) => q.id !== quote.id && q.status === 'pending' && !q.isExpired && q.totalUsd != null);
  const cheapestOther = others.reduce<number | null>((m, q) => (m == null || q.totalUsd! < m ? q.totalUsd! : m), null);
  const isSaved = saved != null && priceUsd != null && Math.abs(saved - priceUsd) < 0.005;

  return (
    <div className={`${card} space-y-4 p-4`}>
      <div className="flex items-center gap-2">
        <span className={sectionHeading}>Client price</span>
        <span className="text-xs text-text-muted">on {quote.forwarderName}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <span className={label}>{basis === 'total' ? 'Total to the client, USD' : 'Per bottle to the client, USD'}</span>
          <input
            className={input}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={basis === 'total' ? 'e.g. 3200' : 'e.g. 3.20'}
          />
          {request.suggestedClientPrice && saved == null && (
            <p className="mt-1 text-xs text-text-muted">
              Starts from {request.suggestedClientPrice.fromRequestNumber} on this route, at{' '}
              {usd(request.suggestedClientPrice.per75clUsd)} per 75cl.
            </p>
          )}
        </div>
        <div className="flex items-end gap-1">
          <button
            type="button"
            className={secondaryButton}
            disabled={!request.totalBottles}
            onClick={() => {
              if (priceUsd != null && request.totalBottles) {
                setValue(
                  basis === 'total'
                    ? (Math.round((priceUsd / request.totalBottles) * 100) / 100).toString()
                    : priceUsd.toString(),
                );
              }
              setBasis(basis === 'total' ? 'bottle' : 'total');
            }}
          >
            {basis === 'total' ? 'Enter per bottle' : 'Enter a total'}
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-text-muted">Forwarder cost</dt>
          <dd className="tabular-nums">{cost != null ? usd(cost) : 'Rate unknown'}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Client price</dt>
          <dd className="tabular-nums">{priceUsd != null ? usd(priceUsd) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Margin</dt>
          <dd className={`font-semibold tabular-nums ${margin != null && margin < 0 ? 'text-red-600' : 'text-text-primary'}`}>
            {margin != null && priceUsd ? `${usd(margin)} · ${((margin / priceUsd) * 100).toFixed(1)}%` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Against the other quotes</dt>
          <dd className="tabular-nums">
            {cost == null || cheapestOther == null
              ? 'No other live quote'
              : cheapestOther >= cost
                ? `Cheapest by ${usd(cheapestOther - cost)}`
                : `${usd(cost - cheapestOther)} dearer than the cheapest`}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButton}
          disabled={priceUsd == null || isSaved || setPrice.isPending}
          onClick={() => setPrice.mutate({ requestId: request.id, quoteId: quote.id, clientPriceUsd: priceUsd })}
        >
          {isSaved ? <IconCheck size={15} /> : null} {isSaved ? 'Price saved' : 'Save the price'}
        </button>
        {isSaved && (
          <button
            type="button"
            className={request.clientQuotedAt ? primaryButton : secondaryButton}
            disabled={accept.isPending || !request.job}
            title={request.job ? undefined : 'Open the job first'}
            onClick={() => accept.mutate({ quoteId: quote.id })}
          >
            <IconCheck size={15} /> Client agreed: accept {quote.forwarderName}
          </button>
        )}
      </div>

      {isSaved && saved != null && request.canSendEmail && (
        <label className="block max-w-md">
          <span className={label}>Client email</span>
          <input
            className={input}
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="To send the quote from logistics@"
          />
        </label>
      )}

      {isSaved && saved != null && (
        <CopyTextCard
          title="Quote to the client"
          status={
            request.clientQuotedAt
              ? { label: `Quoted ${request.clientQuotedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, tone: 'blue' }
              : { label: 'Not sent', tone: 'amber' }
          }
          email={buildFreightEmail({
            kind: 'client_quote',
            request,
            quote: {
              quoteNumber: quote.quoteNumber,
              forwarderReference: quote.forwarderReference,
              totalPrice: quote.totalPrice,
              currency: quote.currency,
              transitDays: quote.transitDays,
              validUntil: quote.validUntil,
              categories: quote.categories,
            },
            clientPriceUsd: saved,
            senderName: request.senderName,
          })}
          onSend={
            request.canSendEmail && /^\S+@\S+\.\S+$/.test(clientEmail.trim())
              ? () => sendToClient.mutate({ requestId: request.id, to: clientEmail.trim() })
              : undefined
          }
          isSending={sendToClient.isPending}
          onCopied={() => setPrice.mutate({ requestId: request.id, quoteId: quote.id, clientPriceUsd: saved, copied: true })}
          onUndo={() => setPrice.mutate({ requestId: request.id, quoteId: quote.id, clientPriceUsd: saved, copied: false })}
          defaultOpen={!request.clientQuotedAt}
        />
      )}
    </div>
  );
};

export default ClientPriceBox;
