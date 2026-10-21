import workingDaysSince from './workingDaysSince';

/** Working days a forwarder has before it is due a chase */
export const CHASE_AFTER_WORKING_DAYS = 3;

export type QuoteRequestNextStep =
  | 'choose_forwarders'
  | 'send'
  | 'chase'
  | 'awaiting'
  | 'price'
  | 'send_price'
  | 'accept'
  | 'done';

/**
 * What a quote request needs next, and from whom
 *
 * Drives the "Needs action" list, so a request only appears when someone has
 * something to do. In order: forwarders to choose or email, a forwarder due a
 * chase, quotes in but no client price, a price set but the client email not
 * copied, the client quoted but no quote accepted.
 *
 * @example
 *   quoteRequestNextStep({ status: 'quoted', recipients, quotes, clientPriceUsd: null, clientQuotedAt: null }); // 'price'
 *
 * @param request - The request's status, forwarders asked, quotes and client price
 * @returns The next step
 */
const quoteRequestNextStep = (request: {
  status: string;
  recipients: { sentAt: Date | null; chasedAt: Date | null; outcome: string }[];
  quotes: { status: string }[];
  clientPriceUsd: number | null;
  clientQuotedAt: Date | null;
}, now = new Date()): QuoteRequestNextStep => {
  if (request.status === 'completed' || request.status === 'cancelled') return 'done';
  if (request.quotes.some((q) => q.status === 'accepted')) return 'done';

  const live = request.quotes.filter((q) => q.status === 'pending');

  if (request.clientQuotedAt) return 'accept';
  if (request.clientPriceUsd != null) return 'send_price';
  if (live.length > 0 && request.recipients.every((r) => r.outcome !== 'awaiting' || r.sentAt)) return 'price';
  if (request.recipients.length === 0) return live.length > 0 ? 'price' : 'choose_forwarders';
  if (request.recipients.some((r) => r.outcome === 'awaiting' && !r.sentAt)) return 'send';

  const dueChase = request.recipients.some(
    (r) =>
      r.outcome === 'awaiting' &&
      r.sentAt &&
      workingDaysSince(r.chasedAt ?? r.sentAt, now) >= CHASE_AFTER_WORKING_DAYS,
  );

  if (dueChase) return 'chase';

  return live.length > 0 ? 'price' : 'awaiting';
};

export default quoteRequestNextStep;
