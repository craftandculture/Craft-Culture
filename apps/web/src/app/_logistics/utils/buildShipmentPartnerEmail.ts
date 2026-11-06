import formatGulfDate from '@/app/_privateClientOrders/utils/formatGulfDate';

/** The moments a wine partner is emailed about an inbound shipment, in order */
export const SHIPMENT_MILESTONES = ['departed', 'arrived', 'landed', 'received'] as const;

export type ShipmentMilestone = (typeof SHIPMENT_MILESTONES)[number];

export interface ShipmentEmailInput {
  shipmentNumber: string;
  transportMode: string | null;
  eta: Date | null;
  /** When it departed, arrived in the UAE, reached our warehouse and was received, where known */
  departedAt: Date | null;
  arrivedAt: Date | null;
  landedAt: Date | null;
  receivedAt: Date | null;
  wines: { name: string; vintage: number | null; cases: number; bottlesPerCase: number; bottleSizeMl: number }[];
}

const WINES_SHOWN = 8;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const how = (mode: string | null) =>
  mode === 'air' ? 'by air' : mode === 'road' ? 'by road' : mode?.startsWith('sea') ? 'by sea' : '';

/**
 * The orderUpdate template's variables for a wine partner's shipment email
 *
 * Four emails a shipment at most: when it departs, when it arrives in the
 * UAE, when it reaches our warehouse, and when it is racked and in stock.
 * Partners kept asking where their wine was between landing and the stock
 * page filling, so the warehouse arrival is told on its own. Uses the same approved Loops template as the
 * order emails, with the shipment's own progress and wines.
 *
 * @example
 *   buildShipmentPartnerEmail('arrived', shipment, links, 'Maison Wineted').data.subject;
 *   // 'Shipment SHP-2026-0034 has arrived in the UAE'
 *
 * @param milestone - Which moment
 * @param shipment - The shipment and the partner's wines on it
 * @param links - The partner's shipment page and stock page
 * @param recipientName - How the greeting addresses them
 * @param now - Today, so an expected date already passed is left out
 * @returns The template data
 */
const buildShipmentPartnerEmail = (
  milestone: ShipmentMilestone,
  shipment: ShipmentEmailInput,
  links: { shipmentUrl: string; stockUrl: string },
  recipientName: string,
  now: Date = new Date(),
) => {
  const n = shipment.shipmentNumber;
  const cases = shipment.wines.reduce((sum, wine) => sum + wine.cases, 0);
  const bottles = shipment.wines.reduce((sum, wine) => sum + wine.cases * wine.bottlesPerCase, 0);
  const eta = shipment.eta && shipment.eta.getTime() > now.getTime() ? formatGulfDate(shipment.eta, 'long') : null;
  const by = how(shipment.transportMode);

  const copy = {
    departed: {
      subject: `Shipment ${n} has departed for the UAE`,
      eyebrow: 'Shipment update',
      headline: 'Your shipment is on its way',
      body: `Shipment ${n} has left for the UAE${by ? ` ${by}` : ''}${
        shipment.departedAt ? ` on ${formatGulfDate(shipment.departedAt, 'long')}` : ''
      }.${eta ? ` We expect it to arrive on ${eta}.` : ''} We will let you know when it lands.`,
      ctaLabel: 'View the shipment',
      ctaUrl: links.shipmentUrl,
    },
    arrived: {
      subject: `Shipment ${n} has arrived in the UAE`,
      eyebrow: 'Shipment update',
      headline: 'Your shipment has arrived',
      body: `Shipment ${n} has arrived in the UAE and is clearing customs. Once cleared, it comes to our bonded warehouse to be received into your stock.`,
      ctaLabel: 'View the shipment',
      ctaUrl: links.shipmentUrl,
    },
    landed: {
      subject: `Shipment ${n} has reached our warehouse`,
      eyebrow: 'Shipment update',
      headline: 'Your shipment is at our warehouse',
      body: `Shipment ${n} has been delivered to our bonded warehouse. The team is now checking it in and racking it, and we will let you know as soon as it is in your stock.`,
      ctaLabel: 'View the shipment',
      ctaUrl: links.shipmentUrl,
    },
    received: {
      subject: `Shipment ${n} is in stock`,
      eyebrow: 'Stock received',
      headline: 'Your wine is in stock',
      body: `${plural(shipment.wines.length, 'wine', 'wines')} from shipment ${n}, ${plural(cases, 'case', 'cases')} in all, ${
        shipment.wines.length === 1 ? 'has' : 'have'
      } been checked in and racked in our bonded warehouse and ${shipment.wines.length === 1 ? 'is' : 'are'} now available in your stock.`,
      ctaLabel: 'View your stock',
      ctaUrl: links.stockUrl,
    },
  }[milestone];

  const reached = SHIPMENT_MILESTONES.indexOf(milestone);
  const stepDates = [shipment.departedAt, shipment.arrivedAt, shipment.landedAt, shipment.receivedAt];
  const stepLabels = ['Departed', 'Arrived in the UAE', 'At our warehouse', 'In stock'];
  const steps = stepLabels.map((label, index) => {
    const at = stepDates.at(index);
    if (index <= reached) return { mark: '✓', label, when: at ? formatGulfDate(at, 'short') : '' };
    if (index === reached + 1) return { mark: '→', label, when: index === 1 && eta ? `Expected ${eta}` : 'Next' };
    return { mark: '○', label, when: '' };
  });

  const shown = shipment.wines.slice(0, WINES_SHOWN);
  const rest = shipment.wines.slice(WINES_SHOWN);
  const restCases = rest.reduce((sum, wine) => sum + wine.cases, 0);

  return {
    data: {
      subject: copy.subject,
      preheader: copy.body.split('. ')[0] + '.',
      label: n,
      eyebrow: copy.eyebrow,
      headline: copy.headline,
      name: recipientName,
      body: copy.body,
      note: [] as { title: string; text: string }[],
      action: [] as { text: string }[],
      ctaLabel: copy.ctaLabel,
      ctaUrl: copy.ctaUrl,
      secondary: [] as { label: string; url: string }[],
      steps,
      winesTitle: shipment.wines.length
        ? [{ title: `On this shipment · ${plural(shipment.wines.length, 'wine', 'wines')} · ${plural(bottles, 'bottle', 'bottles')}` }]
        : [],
      wines: shown.map((wine) => ({
        name: wine.vintage ? `${wine.vintage} ${wine.name}` : wine.name,
        detail: `${wine.bottlesPerCase} × ${wine.bottleSizeMl >= 1000 ? `${wine.bottleSizeMl / 1000}L` : `${wine.bottleSizeMl / 10}cl`}`,
        quantity: plural(wine.cases, 'case', 'cases'),
      })),
      winesMore: rest.length
        ? [{ text: `And ${plural(rest.length, 'more wine', 'more wines')}, ${plural(restCases, 'case', 'cases')}. The full list is on the shipment.` }]
        : [],
      rows: [] as { label: string; value: string }[],
    },
  };
};

export default buildShipmentPartnerEmail;
