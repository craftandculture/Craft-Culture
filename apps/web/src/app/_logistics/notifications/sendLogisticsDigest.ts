import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsJobs, logisticsQuotes, logisticsShipmentItems, logisticsShipments } from '@/database/schema';

import {
  type DigestItem,
  type DigestSection,
  type WeeklySummary,
  digestUrl,
  logisticsDigestMessage,
  quoteRequestUrl,
  quoteUrl,
  shortDate,
  weeklySummaryMessage,
} from './logisticsSlackMessages';
import postLogisticsSlack from './postLogisticsSlack';
import expireLapsedQuotes from '../data/expireLapsedQuotes';
import getAttentionGroups from '../data/getAttentionGroups';
import getOpenQuoteRequestSteps from '../data/getOpenQuoteRequestSteps';
import NOT_ARRIVED_STATUSES from '../utils/notArrivedStatuses';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Slack member ids to mention when something needs action, comma separated
 * (Slack profile › ⋯ › Copy member ID). Unset, nobody is mentioned.
 */
export const LOGISTICS_MENTION_ENV = 'SLACK_LOGISTICS_MENTION_IDS';

const mentionText = () =>
  (process.env[LOGISTICS_MENTION_ENV] ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `<@${id}>`)
    .join(' ');

const isFridayInDubai = (now: Date) =>
  now.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Dubai' }) === 'Fri';

/**
 * The last seven days' movements, for the Friday summary
 *
 * Imports count when they arrived (ATA, else delivered), exports and mainland
 * transfers when they left (ATD, else delivered) — the same rule as the
 * monthly report. Bottles come from the line items, falling back to the
 * shipment's own count.
 *
 * @param now - The end of the week
 * @returns The week's totals
 */
export const getWeeklySummary = async (now = new Date()): Promise<WeeklySummary> => {
  const from = new Date(now.getTime() - 7 * DAY);
  const movedAt = sql`CASE WHEN ${logisticsShipments.type} = 'inbound'
    THEN COALESCE(${logisticsShipments.ata}, ${logisticsShipments.deliveredAt})
    ELSE COALESCE(${logisticsShipments.atd}, ${logisticsShipments.deliveredAt}) END`;

  const rows = await db
    .select({
      type: logisticsShipments.type,
      freightUsd: logisticsShipments.freightCostUsd,
      bottles: sql<number>`COALESCE((
        SELECT SUM(COALESCE(
          ${logisticsShipmentItems.totalBottles},
          ${logisticsShipmentItems.cases} * COALESCE(${logisticsShipmentItems.bottlesPerCase}, 12)
        ))
        FROM ${logisticsShipmentItems}
        WHERE ${logisticsShipmentItems.shipmentId} = ${logisticsShipments.id}
      ), ${logisticsShipments.totalBottles}, 0)`,
    })
    .from(logisticsShipments)
    .where(
      and(
        ne(logisticsShipments.status, 'cancelled'),
        sql`${movedAt} >= ${from.toISOString()}::timestamp`,
        sql`${movedAt} < ${now.toISOString()}::timestamp`,
      ),
    );

  const of = (types: string[]) => rows.filter((r) => types.includes(r.type));
  const sum = (rs: typeof rows) => rs.reduce((n, r) => n + Number(r.bottles ?? 0), 0);
  const imports = of(['inbound']);
  const exports = of(['outbound', 're_export']);
  const transfers = of(['mainland_transfer']);
  const costed = imports.filter((r) => r.freightUsd != null);
  const freightUsd = costed.reduce((n, r) => n + Number(r.freightUsd), 0);
  const costedBottles = sum(costed);

  return {
    from,
    to: now,
    bottlesIn: sum(imports),
    shipmentsIn: imports.length,
    bottlesOut: sum(exports),
    shipmentsOut: exports.length,
    bottlesTransferred: sum(transfers),
    shipmentsTransferred: transfers.length,
    freightUsd,
    freightPerBottle: costedBottles > 0 ? freightUsd / costedBottles : null,
  };
};

/**
 * Build the weekday-morning digest's sections
 *
 * The board's Needs attention groups (the same function feeds the dashboard),
 * plus what is arriving in the next three days and quotes expiring within a
 * week. Every reference links to its shipment, export job or quote.
 *
 * @param now - The moment to judge by
 * @returns The sections, in the order they are shown
 */
export const getDigestSections = async (now = new Date()): Promise<DigestSection[]> => {
  const in3Days = new Date(now.getTime() + 3 * DAY);
  const in7Days = new Date(now.getTime() + 7 * DAY);

  const [groups, arriving, quotes, awaitingDocs, requestSteps] = await Promise.all([
    getAttentionGroups(now),
    db
      .select({
        id: logisticsShipments.id,
        shipmentNumber: logisticsShipments.shipmentNumber,
        name: logisticsShipments.name,
        eta: logisticsShipments.eta,
      })
      .from(logisticsShipments)
      .where(
        and(
          eq(logisticsShipments.type, 'inbound'),
          inArray(logisticsShipments.status, [...NOT_ARRIVED_STATUSES]),
          gte(logisticsShipments.eta, now),
          lte(logisticsShipments.eta, in3Days),
        ),
      )
      .orderBy(logisticsShipments.eta),
    db
      .select({
        id: logisticsQuotes.id,
        quoteNumber: logisticsQuotes.quoteNumber,
        forwarderName: logisticsQuotes.forwarderName,
        validUntil: logisticsQuotes.validUntil,
      })
      .from(logisticsQuotes)
      .where(
        and(
          eq(logisticsQuotes.status, 'pending'),
          gte(logisticsQuotes.validUntil, now),
          lte(logisticsQuotes.validUntil, in7Days),
        ),
      )
      .orderBy(logisticsQuotes.validUntil),
    db
      .select({
        shipmentId: logisticsJobs.shipmentId,
        jobNumber: logisticsJobs.jobNumber,
        clientName: logisticsJobs.clientName,
      })
      .from(logisticsJobs)
      .where(and(eq(logisticsJobs.kind, 'export'), eq(logisticsJobs.stage, 'shipped')))
      .orderBy(logisticsJobs.jobNumber),
    // A read that fails (a migration not yet run) leaves these sections empty, not the digest
    getOpenQuoteRequestSteps(now).catch(() => []),
  ]);
  const route = (r: (typeof requestSteps)[number]) => `${r.originCountry} to ${r.destinationCountry}`;

  type BoardRow = (typeof groups)[number]['shipments'][number];
  const fromBoard = (key: string, note?: (s: BoardRow) => string | null): DigestItem[] =>
    (groups.find((g) => g.key === key)?.shipments ?? []).map((s) => ({
      ref: s.jobNumber ?? s.shipmentNumber,
      url: digestUrl(s),
      name: ('clientName' in s && s.clientName) || s.name || null,
      note: note ? note(s) : null,
    }));

  return [
    {
      title: 'Arriving in the next 3 days',
      action: false,
      items: arriving.map((s) => ({
        ref: s.shipmentNumber,
        url: digestUrl(s),
        name: s.name,
        note: s.eta ? shortDate(s.eta) : null,
      })),
    },
    {
      title: 'ETA passed, not received',
      action: true,
      items: fromBoard('overdue', (s) => (s.eta ? `ETA ${shortDate(s.eta)}` : null)),
    },
    {
      title: 'Bond claims due or missed',
      action: true,
      items: fromBoard('bond_claims', (s) =>
        'bondDaysLeft' in s && typeof s.bondDaysLeft === 'number'
          ? s.bondDaysLeft < 0
            ? 'missed'
            : `${s.bondDaysLeft} days left`
          : null,
      ),
    },
    {
      title: 'Shipped, documents not sent',
      action: true,
      items: awaitingDocs.map((j) => ({
        ref: j.jobNumber,
        url: digestUrl({ id: j.shipmentId, jobNumber: j.jobNumber }),
        name: j.clientName,
      })),
    },
    { title: 'No cases or bottles entered', action: true, items: fromBoard('no_quantities') },
    { title: 'Export jobs with no invoice', action: true, items: fromBoard('no_invoice') },
    {
      title: 'Forwarders to chase for a quote',
      action: true,
      items: requestSteps
        .filter((r) => r.nextStep === 'chase')
        .map((r) => ({ ref: r.requestNumber, url: quoteRequestUrl(r.id), name: route(r), note: r.awaiting.join(', ') || null })),
    },
    {
      title: 'Freight priced, client not yet sent the price',
      action: true,
      items: requestSteps
        .filter((r) => r.nextStep === 'send_price')
        .map((r) => ({ ref: r.requestNumber, url: quoteRequestUrl(r.id), name: route(r) })),
    },
    {
      title: 'Quotes expiring within 7 days',
      action: false,
      items: quotes.map((q) => ({
        ref: q.quoteNumber,
        url: quoteUrl(q.id),
        name: q.forwarderName,
        note: q.validUntil ? shortDate(q.validUntil) : null,
      })),
    },
    { title: 'Draft for over 7 days', action: false, items: fromBoard('stale_draft') },
  ];
};

/**
 * Post the weekday-morning logistics digest to #logistics
 *
 * Nothing is posted on a quiet morning. On Fridays the week's summary follows,
 * quiet or not, so the channel hears from the job at least weekly.
 *
 * @param now - The moment to judge by
 * @returns What was posted, and why a post did not go if it did not
 */
const sendLogisticsDigest = async (now = new Date()) => {
  // Lapsed quotes stop being offered before the digest lists what is left
  await expireLapsedQuotes(now).catch(() => 0);
  const sections = await getDigestSections(now);
  const text = logisticsDigestMessage(sections, mentionText());
  const digestFailure = text ? await postLogisticsSlack(text) : null;

  let weeklyFailure: string | null = null;
  const friday = isFridayInDubai(now);
  if (friday) weeklyFailure = await postLogisticsSlack(weeklySummaryMessage(await getWeeklySummary(now)));

  return {
    digest: text ? (digestFailure === null ? 'posted' : 'failed') : 'quiet, not posted',
    weekly: friday ? (weeklyFailure === null ? 'posted' : 'failed') : 'not Friday',
    reason: digestFailure ?? weeklyFailure,
    counts: Object.fromEntries(sections.map((s) => [s.title, s.items.length])),
  };
};

export default sendLogisticsDigest;
