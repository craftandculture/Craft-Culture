/**
 * The text of every #logistics Slack post, kept in one place so the live posts
 * and the morning digest read alike
 *
 * Slack mrkdwn: `*bold*`, `<url|label>` links. No client-facing wording here;
 * the channel is internal.
 */

export const LOGISTICS_BOARD_URL = 'https://wine.craftculture.xyz/platform/admin/logistics';

const shipmentUrl = (id: string) => `${LOGISTICS_BOARD_URL}/shipments/${id}`;
const exportUrl = (id: string) => `${LOGISTICS_BOARD_URL}/exports/${id}`;

const shortDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' });

const route = (s: { originCity: string | null; destinationCity: string | null }) =>
  s.originCity || s.destinationCity ? `${s.originCity ?? 'Origin'} → ${s.destinationCity ?? 'Destination'}` : null;

const quantities = (s: { totalCases?: number | null; totalBottles?: number | null }) => {
  const parts = [];
  if (s.totalCases) parts.push(`${s.totalCases} cases`);
  if (s.totalBottles) parts.push(`${s.totalBottles} bottles`);
  return parts.length ? parts.join(', ') : null;
};

export interface InboundShipmentForSlack {
  id: string;
  shipmentNumber: string;
  name: string | null;
  originCity: string | null;
  destinationCity: string | null;
  totalCases: number | null;
  totalBottles: number | null;
  eta?: Date | null;
}

/**
 * Live post when an inbound shipment departs, reaches the warehouse or is delivered
 *
 * @example
 *   inboundStatusMessage(shipment, 'at_warehouse');
 *   // '*SHP-0042* arrived at the warehouse — Bordeaux → RAK · 40 cases'
 *
 * @param shipment - The shipment after the update
 * @param status - The status it moved to
 * @returns Slack mrkdwn text
 */
export const inboundStatusMessage = (
  shipment: InboundShipmentForSlack,
  status: 'in_transit' | 'at_warehouse' | 'delivered',
) => {
  const what =
    status === 'in_transit' ? 'departed' : status === 'at_warehouse' ? 'arrived at the warehouse' : 'marked delivered';
  const eta = status === 'in_transit' && shipment.eta ? `ETA ${shortDate(shipment.eta)}` : null;
  const detail = [shipment.name, route(shipment), quantities(shipment), eta].filter(Boolean).join(' · ');
  return `<${shipmentUrl(shipment.id)}|*${shipment.shipmentNumber}*> ${what}${detail ? ` — ${detail}` : ''}`;
};

export interface ExportJobForSlack {
  shipmentId: string;
  jobNumber: string;
  clientName: string;
  originCity: string | null;
  destinationCity: string | null;
  carrierName: string | null;
  awbNumber: string | null;
  blNumber: string | null;
}

/**
 * Live post when an export job is shipped or its documents are sent
 *
 * @example
 *   exportStageMessage(job, 'shipped');
 *   // '*EXP-CNC-0007* shipped for Wynn — RAK → Dubai · DHL, AWB 123'
 *
 * @param job - The job and its shipment's details
 * @param stage - The stage it moved to
 * @returns Slack mrkdwn text
 */
export const exportStageMessage = (job: ExportJobForSlack, stage: 'shipped' | 'docs_sent') => {
  const what = stage === 'shipped' ? 'shipped' : 'documents sent';
  const ref = job.awbNumber ? `AWB ${job.awbNumber}` : job.blNumber ? `BL ${job.blNumber}` : null;
  const carrier = [job.carrierName, ref].filter(Boolean).join(', ');
  const detail = [route(job), carrier || null].filter(Boolean).join(' · ');
  return `<${exportUrl(job.shipmentId)}|*${job.jobNumber}*> ${what} for ${job.clientName}${detail ? ` — ${detail}` : ''}`;
};

/** One line item in the digest: a reference that links to its record, and what it is */
export interface DigestItem {
  ref: string;
  url: string;
  /** Shipment name or client, shown after the reference */
  name?: string | null;
  /** A short note in brackets: a date, days left */
  note?: string | null;
}

export interface DigestSection {
  title: string;
  items: DigestItem[];
  /** Someone has to act on it, so the operator is mentioned */
  action: boolean;
}

/** At most this many items are listed per section; the rest are counted */
const LIST_LIMIT = 8;

const item = (i: DigestItem) =>
  `<${i.url}|${i.ref}>${i.name ? ` ${i.name}` : ''}${i.note ? ` (${i.note})` : ''}`;

const list = (items: DigestItem[]) => {
  const shown = items.slice(0, LIST_LIMIT).map(item).join(', ');
  return items.length > LIST_LIMIT ? `${shown} and ${items.length - LIST_LIMIT} more` : shown;
};

/** Where a digest item links: export jobs open on the job, everything else on the shipment */
export const digestUrl = (s: { id: string; jobNumber?: string | null }) =>
  s.jobNumber ? exportUrl(s.id) : shipmentUrl(s.id);

export const quoteUrl = (id: string) => `${LOGISTICS_BOARD_URL}/quotes/${id}`;

/** A quote request's own page, where its forwarders, quotes and emails are */
export const quoteRequestUrl = (id: string) => `${LOGISTICS_BOARD_URL}/requests/${id}`;

export { shortDate };

/**
 * The weekday-morning #logistics digest
 *
 * One line per section with anything in it: a count, then each reference as a
 * link with its name. When any section needs action, the operator is mentioned
 * once at the top. Returns null on a quiet morning, so nothing is posted.
 *
 * @param sections - The sections, in the order to show them
 * @param mention - Slack mention text such as `<@U123>`, or empty
 * @returns Slack mrkdwn text, or null when there is nothing to say
 */
export const logisticsDigestMessage = (sections: DigestSection[], mention = '') => {
  const live = sections.filter((s) => s.items.length > 0);
  if (!live.length) return null;

  const toAct = live.filter((s) => s.action).reduce((n, s) => n + s.items.length, 0);
  const head = `*Logistics this morning*${mention && toAct ? ` · ${mention} ${toAct} to action` : ''}`;
  const lines = live.map((s) => `• *${s.title} (${s.items.length}):* ${list(s.items)}`);

  return [head, ...lines, `<${LOGISTICS_BOARD_URL}|Open the logistics board>`].join('\n');
};

export interface WeeklySummary {
  from: Date;
  to: Date;
  bottlesIn: number;
  shipmentsIn: number;
  bottlesOut: number;
  shipmentsOut: number;
  bottlesTransferred: number;
  shipmentsTransferred: number;
  freightUsd: number;
  freightPerBottle: number | null;
}

const number = (n: number) => n.toLocaleString('en-GB');

/**
 * The Friday summary of the week's movements
 *
 * @param w - The week's totals
 * @returns Slack mrkdwn text
 */
export const weeklySummaryMessage = (w: WeeklySummary) =>
  [
    `*Logistics this week* (${shortDate(w.from)} – ${shortDate(w.to)})`,
    `• *Imports received:* ${number(w.bottlesIn)} bottles across ${w.shipmentsIn} shipment${w.shipmentsIn === 1 ? '' : 's'}`,
    `• *Exports shipped:* ${number(w.bottlesOut)} bottles across ${w.shipmentsOut} shipment${w.shipmentsOut === 1 ? '' : 's'}`,
    `• *Mainland transfers:* ${number(w.bottlesTransferred)} bottles across ${w.shipmentsTransferred} transfer${w.shipmentsTransferred === 1 ? '' : 's'}`,
    `• *Freight on imports:* $${number(Math.round(w.freightUsd))}${w.freightPerBottle != null ? ` · $${w.freightPerBottle.toFixed(2)} a bottle` : ''}`,
    `<${LOGISTICS_BOARD_URL}/reports|Open the monthly report>`,
  ].join('\n');
