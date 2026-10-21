'use client';

import type { inferRouterOutputs } from '@trpc/server';

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
  const won = request.quotes.find((q) => q.status === 'accepted');

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
  const losers = new Map<string, { name: string; contacts: { name?: string; email: string }[]; quote: Request['quotes'][number] | null }>();
  for (const q of request.quotes) {
    if (q.id === won.id || q.forwarderId === won.forwarderId) continue;
    losers.set(q.forwarderId ?? q.forwarderName, { name: q.forwarderName, contacts: contactsOf(q.forwarderId, q.forwarderEmail), quote: q });
  }
  for (const r of request.recipients) {
    if (r.forwarderId === won.forwarderId || losers.has(r.forwarderId) || !r.sentAt) continue;
    losers.set(r.forwarderId, { name: r.name, contacts: r.contacts, quote: null });
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
        defaultOpen
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
        />
      ))}
    </div>
  );
};

export default AwardEmails;
