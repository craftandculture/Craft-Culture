'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import CopyTextCard from './CopyTextCard';
import buildFreightEmail from '../../utils/buildFreightEmail';
import { sectionHeading } from '../exports/exportUi';

type Request = inferRouterOutputs<AppRouter>['logistics']['admin']['requests']['getOne'];

export interface AwardEmailsProps {
  request: Request;
}

/**
 * Once a quote is accepted: the award to its forwarder and a note to the rest
 *
 * The award quotes the forwarder's reference back to them; every other
 * forwarder that was asked, or that quoted, gets a short decline.
 */
const AwardEmails = ({ request }: AwardEmailsProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const won = request.quotes.find((q) => q.status === 'accepted');

  const send = useMutation({
    ...api.logistics.admin.requests.sendEmails.mutationOptions(),
    onSuccess: (result) => {
      if (result.sent) toast.success(`Sent from logistics@ to ${result.sent} forwarder${result.sent === 1 ? '' : 's'}`);
      result.failed.forEach((f) => toast.error(`${f.name}: ${f.error ?? 'not sent'}`));
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests']] });
    },
    onError: (error) => toast.error(error.message || 'The email was not sent'),
  });

  /** "Sent 21 Oct" once this kind of email went to this forwarder */
  const sentStatus = (forwarderId: string | null, kind: 'award' | 'decline') => {
    const sent = request.emails.find((e) => e.forwarderId === forwarderId && e.kind === kind && e.status === 'sent');
    return sent
      ? { label: `Sent ${sent.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, tone: 'emerald' as const }
      : null;
  };
  const sendProps = (forwarderId: string | null, kind: 'award' | 'decline') =>
    request.canSendEmail && forwarderId
      ? { onSend: () => send.mutate({ requestId: request.id, kind, forwarderIds: [forwarderId] }), isSending: send.isPending }
      : {};

  if (!won) return null;

  const contactsOf = (forwarderId: string | null, fallbackEmail: string | null) =>
    request.recipients.find((r) => r.forwarderId === forwarderId)?.contacts ??
    (fallbackEmail ? [{ email: fallbackEmail }] : []);

  const asQuote = (q: Request['quotes'][number]) => ({
    quoteNumber: q.quoteNumber,
    forwarderReference: q.forwarderReference,
    totalPrice: q.totalPrice,
    currency: q.currency,
    transitDays: q.transitDays,
    validUntil: q.validUntil,
    categories: q.categories,
  });

  // Everyone else who was asked or who quoted, once each
  const losers = new Map<
    string,
    { forwarderId: string | null; name: string; contacts: { name?: string; email: string }[]; quote: Request['quotes'][number] | null }
  >();
  for (const q of request.quotes) {
    if (q.id === won.id || q.forwarderId === won.forwarderId) continue;
    losers.set(q.forwarderId ?? q.forwarderName, {
      forwarderId: q.forwarderId,
      name: q.forwarderName,
      contacts: contactsOf(q.forwarderId, q.forwarderEmail),
      quote: q,
    });
  }
  for (const r of request.recipients) {
    if (r.forwarderId === won.forwarderId || losers.has(r.forwarderId) || !r.sentAt) continue;
    losers.set(r.forwarderId, { forwarderId: r.forwarderId, name: r.name, contacts: r.contacts, quote: null });
  }

  return (
    <div className="space-y-2">
      <span className={sectionHeading}>Tell the forwarders</span>
      <CopyTextCard
        title={`Award to ${won.forwarderName}`}
        email={buildFreightEmail({
          kind: 'award',
          request,
          forwarder: { name: won.forwarderName, contacts: contactsOf(won.forwarderId, won.forwarderEmail) },
          quote: asQuote(won),
          senderName: request.senderName,
        })}
        status={sentStatus(won.forwarderId, 'award')}
        defaultOpen={!sentStatus(won.forwarderId, 'award')}
        {...sendProps(won.forwarderId, 'award')}
      />
      {[...losers.values()].map((l) => (
        <CopyTextCard
          key={l.name}
          title={`Note to ${l.name}`}
          email={buildFreightEmail({
            kind: 'decline',
            request,
            forwarder: { name: l.name, contacts: l.contacts },
            quote: l.quote ? asQuote(l.quote) : { ...asQuote(won), forwarderReference: null },
            senderName: request.senderName,
          })}
          status={sentStatus(l.forwarderId, 'decline')}
          {...sendProps(l.forwarderId, 'decline')}
        />
      ))}
    </div>
  );
};

export default AwardEmails;
