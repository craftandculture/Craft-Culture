'use client';

import { IconGitCompare, IconPaperclip } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import Link from 'next/link';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import { card, money, pillClass, secondaryButton, sectionHeading } from '../exports/exportUi';

type Request = inferRouterOutputs<AppRouter>['logistics']['admin']['requests']['getOne'];
type Quote = Request['quotes'][number];

export interface QuoteRankingProps {
  request: Request;
  selectedQuoteId: string | null;
  onSelect: (quoteId: string) => void;
  /** Open the quote editor on this quote */
  onEdit: (quoteId: string) => void;
  /** Open the request's details at the bottle count */
  onAddBottles: () => void;
  /** The add-a-quote control, shown at the top of the card while quotes can still come in */
  addQuote?: React.ReactNode;
}

const usd2 = (n: number | null) =>
  n == null ? '—' : `USD ${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (d: Date | null) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null);

const statusPill = (q: Quote) => {
  if (q.status === 'accepted') return <span className={pillClass('emerald')}>Accepted</span>;
  if (q.status === 'rejected') return <span className={pillClass('slate')}>Not chosen</span>;
  if (q.isExpired || q.status === 'expired') return <span className={pillClass('red')}>Expired</span>;
  return null;
};

/**
 * The quotes a request has received, cheapest per 75cl first
 *
 * Every price is shown in the forwarder's currency and in USD, per bottle and
 * per 75cl equivalent, so quotes in different currencies and for loads with
 * magnums compare directly. Choosing one prices the client on it. Each quote
 * can be edited in place, or set aside as not being used; one past its
 * validity says so and offers to fix the date.
 */
const QuoteRanking = ({ request, selectedQuoteId, onSelect, onEdit, onAddBottles, addQuote }: QuoteRankingProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const setAside = useMutation({
    ...api.logistics.admin.quotes.reject.mutationOptions(),
    onSuccess: () => {
      toast.success('Quote set aside');
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests']] });
    },
    onError: (error) => toast.error(error.message || 'The quote was not changed'),
  });
  const live = request.quotes.filter((q) => q.status === 'pending' && !q.isExpired);
  const compareIds = (live.length >= 2 ? live : request.quotes).slice(0, 5).map((q) => q.id);

  return (
    <div className={card}>
      <div className="flex items-center gap-2 border-b border-border-muted px-4 py-3">
        <span className={sectionHeading}>Quotes</span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
          {request.quotes.length}
        </span>
        {!request.bottles && request.quotes.length > 0 && (
          <button type="button" className="text-xs text-amber-700 hover:underline dark:text-amber-300" onClick={onAddBottles}>
            Add the bottle count to see prices per bottle
          </button>
        )}
        {compareIds.length >= 2 && (
          <Link
            href={`/platform/admin/logistics/quotes/compare?ids=${compareIds.join(',')}`}
            className={`${secondaryButton} ml-auto`}
          >
            <IconGitCompare size={15} /> Line by line
          </Link>
        )}
      </div>

      {addQuote && <div className="border-b border-border-muted px-4 py-3">{addQuote}</div>}

      {request.quotes.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-text-muted">No quotes yet. Add each one as it arrives.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-muted text-left text-[11px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-2 font-medium">Forwarder</th>
                <th className="px-2 py-2 text-right font-medium">Quoted</th>
                <th className="px-2 py-2 text-right font-medium">USD</th>
                <th className="px-2 py-2 text-right font-medium" title="UAE customs and handling from the rate card">
                  + UAE arrival
                </th>
                <th className="px-2 py-2 text-right font-medium" title="Freight plus UAE arrival">
                  All-in / bottle
                </th>
                <th className="px-2 py-2 text-right font-medium" title="Freight plus UAE arrival">
                  All-in / 75cl
                </th>
                <th className="px-2 py-2 text-right font-medium">Transit</th>
                <th className="px-2 py-2 font-medium">Valid to</th>
                <th className="px-2 py-2 text-right font-medium">Price on</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {request.quotes.map((q, i) => {
                const choosable = q.status === 'pending' && !q.isExpired;
                const lapsed = q.status === 'expired' || (q.status === 'pending' && q.isExpired);
                const editable = q.status === 'pending' || q.status === 'expired' || q.status === 'draft';
                const best = i === 0 && choosable && live.length > 1;

                return (
                  <tr key={q.id} className={choosable ? '' : 'text-text-muted'}>
                    <td className="px-4 py-2.5">
                      <Link href={`/platform/admin/logistics/quotes/${q.id}`} className="group">
                        <span className="font-medium text-text-primary group-hover:underline">{q.forwarderName}</span>
                        <span className="ml-2 font-mono text-[11px] text-text-muted">
                          {q.forwarderReference ?? q.quoteNumber}
                        </span>
                      </Link>
                      <span className="ml-2 inline-flex gap-1 align-middle">
                        {best && <span className={pillClass('emerald')}>Cheapest</span>}
                        {statusPill(q)}
                        {q.attachments.map((a) => (
                          <a
                            key={a.id}
                            href={a.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={a.fileName}
                            className="text-text-muted hover:text-text-primary"
                          >
                            <IconPaperclip size={14} />
                          </a>
                        ))}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{money(q.totalPrice, q.currency.toUpperCase())}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{usd2(q.totalUsd)}</td>
                    <td
                      className="px-2 py-2.5 text-right tabular-nums"
                      title={
                        q.arrivalCoveredByQuote.length
                          ? `The quote already includes ${q.arrivalCoveredByQuote.join(' and ')}, so that part is not added`
                          : undefined
                      }
                    >
                      {q.arrivalUsd == null ? '—' : usd2(q.arrivalUsd)}
                      {q.arrivalCoveredByQuote.length > 0 && <span className="text-text-muted">*</span>}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{usd2(q.perBottleUsd)}</td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-text-primary">{usd2(q.per75clUsd)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{q.transitDays ? `${q.transitDays} days` : '—'}</td>
                    <td className="px-2 py-2.5">
                      {lapsed ? (
                        <button
                          type="button"
                          className="text-left text-red-700 hover:underline dark:text-red-300"
                          onClick={() => onEdit(q.id)}
                        >
                          {day(q.validUntil) ?? 'Expired'}: fix
                        </button>
                      ) : (
                        (day(q.validUntil) ?? '—')
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {choosable ? (
                        <input
                          type="radio"
                          name="client-quote"
                          aria-label={`Price the client on ${q.forwarderName}`}
                          checked={selectedQuoteId === q.id}
                          onChange={() => onSelect(q.id)}
                        />
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs">
                      {editable && (
                        <>
                          <button type="button" className="text-text-primary hover:underline" onClick={() => onEdit(q.id)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="ml-3 text-text-muted hover:text-text-primary hover:underline"
                            disabled={setAside.isPending}
                            onClick={() => setAside.mutate({ quoteId: q.id, reason: 'Not used for this request' })}
                          >
                            Not using
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default QuoteRanking;
