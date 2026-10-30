import formatGulfDate from './formatGulfDate';
import orderEmailCopy from './orderEmailCopy';
import type { OrderEmailAudience, OrderEmailCopy, OrderEmailEvent, OrderEmailSnapshot } from './orderEmailTypes';

/*
  A wine partner's daily summary of order updates.

  A partner with several orders moving in a day was sent an email for each,
  and so was everyone on their account. Updates they need not act on (payment
  received, dispatched, delivery scheduled, delivered and the like) now wait
  for one email a day listing every order that moved. Requests to act, notes,
  changes requested and cancellations still go straight away.
*/

/** The summary goes at 17:00 Gulf time, 13:00 UTC */
const DIGEST_HOUR_UTC = 13;

/**
 * Whether this update waits for the partner's daily summary
 *
 * @param event - What happened
 * @param audience - Who it is for
 * @param copy - What it says to them
 * @returns True for a partner update that asks nothing of them
 */
export const isDigestUpdate = (event: OrderEmailEvent, audience: OrderEmailAudience, copy: OrderEmailCopy) =>
  audience === 'partner' &&
  !copy.isAction &&
  event.action !== 'note_added' &&
  event.newStatus !== 'cancelled' &&
  event.newStatus !== 'revision_requested';

/**
 * When the next daily summary goes, after a given moment
 *
 * @example
 *   nextDigestAt(new Date('2026-10-30T09:00:00Z')); // 2026-10-30T13:00:00Z
 *   nextDigestAt(new Date('2026-10-30T14:00:00Z')); // 2026-10-31T13:00:00Z
 *
 * @param from - When the update happened
 * @returns 17:00 Gulf time that day, or the next day once it has passed
 */
export const nextDigestAt = (from: Date) => {
  const at = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), DIGEST_HOUR_UTC));
  if (at.getTime() <= from.getTime()) at.setUTCDate(at.getUTCDate() + 1);
  return at;
};

/**
 * The orderUpdate template's variables for a daily summary of several orders
 *
 * Uses the same Loops template as a single update: one detail row per order,
 * and the single-order blocks (progress, wines, notes) left empty.
 *
 * @param entries - Each order's latest update and the order as it stands, at least two
 * @param ordersUrl - The partner's order list
 * @param recipientName - How the greeting addresses them
 * @param now - When the summary is written
 * @returns The template data
 */
export const buildOrderDigestEmail = (
  entries: { event: OrderEmailEvent; order: OrderEmailSnapshot }[],
  ordersUrl: string,
  recipientName: string,
  now: Date = new Date(),
) => {
  const rows = entries.map(({ event, order }) => {
    const copy = orderEmailCopy(event, 'partner', order);
    const what = copy?.eyebrow ?? 'Updated';
    return { label: order.orderNumber, value: order.clientName ? `${what} · ${order.clientName}` : what };
  });

  const count = `${entries.length} orders`;
  const day = formatGulfDate(now, 'long');

  return {
    subject: `Your order updates today: ${count}`,
    preheader: `${count} moved on ${day}.`,
    label: 'Daily summary',
    eyebrow: 'Daily summary',
    headline: 'Your order updates today',
    name: recipientName,
    body: `${count} moved on today. Each shows where it now stands; open your orders for the full detail. Anything that needs you is always emailed straight away.`,
    note: [] as { title: string; text: string }[],
    action: [] as { text: string }[],
    ctaLabel: 'View your orders',
    ctaUrl: ordersUrl,
    secondary: [] as { label: string; url: string }[],
    steps: [] as unknown[],
    winesTitle: [] as { title: string }[],
    wines: [] as { name: string; detail: string; quantity: string }[],
    winesMore: [] as { text: string }[],
    rows,
  };
};
