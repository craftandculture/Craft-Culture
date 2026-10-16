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
}

/**
 * Live post when an inbound shipment reaches the warehouse or is delivered
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
  status: 'at_warehouse' | 'delivered',
) => {
  const what = status === 'at_warehouse' ? 'arrived at the warehouse' : 'marked delivered';
  const detail = [shipment.name, route(shipment), quantities(shipment)].filter(Boolean).join(' · ');
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

interface DigestShipment {
  id: string;
  shipmentNumber: string;
  name: string | null;
  eta: Date | null;
  jobNumber: string | null;
}

export interface LogisticsDigest {
  arriving: DigestShipment[];
  overdue: DigestShipment[];
  bonds: (DigestShipment & { bondDaysLeft: number })[];
  quotes: { quoteNumber: string; forwarderName: string; validUntil: Date | null }[];
  awaitingDocs: { shipmentId: string; jobNumber: string; clientName: string }[];
}

/** At most this many references are listed per section; the rest are counted */
const LIST_LIMIT = 8;

const list = (refs: string[]) =>
  refs.length > LIST_LIMIT ? `${refs.slice(0, LIST_LIMIT).join(', ')} and ${refs.length - LIST_LIMIT} more` : refs.join(', ');

const ref = (s: DigestShipment) => s.jobNumber ?? s.shipmentNumber;

/**
 * The weekday-morning #logistics digest
 *
 * One line per section that has anything in it, with a count and the
 * shipment, job or quote numbers. When nothing needs attention it says so in
 * one line, so a quiet morning is distinguishable from a digest that failed.
 *
 * @param digest - What the board holds this morning
 * @returns Slack mrkdwn text
 */
export const logisticsDigestMessage = (digest: LogisticsDigest) => {
  const lines: string[] = [];

  if (digest.arriving.length) {
    lines.push(
      `• *Arriving in the next 3 days (${digest.arriving.length}):* ${list(
        digest.arriving.map((s) => `${ref(s)}${s.eta ? ` (${shortDate(s.eta)})` : ''}`),
      )}`,
    );
  }
  if (digest.overdue.length) {
    lines.push(
      `• *ETA passed, not received (${digest.overdue.length}):* ${list(
        digest.overdue.map((s) => `${ref(s)}${s.eta ? ` (ETA ${shortDate(s.eta)})` : ''}`),
      )}`,
    );
  }
  if (digest.bonds.length) {
    lines.push(
      `• *Bond claims due or missed (${digest.bonds.length}):* ${list(
        digest.bonds.map((b) => `${ref(b)} (${b.bondDaysLeft < 0 ? 'missed' : `${b.bondDaysLeft} days left`})`),
      )}`,
    );
  }
  if (digest.quotes.length) {
    lines.push(
      `• *Quotes expiring within 7 days (${digest.quotes.length}):* ${list(
        digest.quotes.map(
          (q) => `${q.quoteNumber} ${q.forwarderName}${q.validUntil ? ` (${shortDate(q.validUntil)})` : ''}`,
        ),
      )}`,
    );
  }
  if (digest.awaitingDocs.length) {
    lines.push(
      `• *Shipped, documents not sent (${digest.awaitingDocs.length}):* ${list(
        digest.awaitingDocs.map((j) => `${j.jobNumber} ${j.clientName}`),
      )}`,
    );
  }

  const board = `<${LOGISTICS_BOARD_URL}|Open the logistics board>`;

  if (!lines.length) return `*Logistics this morning* — Nothing needs attention today. ${board}`;

  return [`*Logistics this morning*`, ...lines, board].join('\n');
};
