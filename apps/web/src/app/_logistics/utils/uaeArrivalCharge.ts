import { PEGGED } from './resolveFxToUsd';
import type { UaeArrivalRateCard } from '../schemas/uaeArrivalRateCardSchema';

const round2 = (n: number) => Math.round(n * 100) / 100;

const isUae = (country: string | null | undefined) =>
  !!country && /emirates|^uae$|^ae$/i.test(country.trim());

/**
 * What it costs to land a quoted shipment in the UAE on top of the forwarder
 *
 * Applies to shipments into the UAE only. A charge is skipped when the quote
 * already has a line of the kind that pays for it (Customs, or Destination
 * Handling), and when it belongs to the other mode.
 *
 * @example
 *   uaeArrivalCharge(card, { destinationCountry: 'United Arab Emirates', transportMode: 'air' }, ['Freight']);
 *   // { usd: 555.49, aed: 2040, coveredByQuote: [] }
 *
 * @param card - The UAE arrival rate card
 * @param request - Where the shipment goes, and how
 * @param quoteCategories - The categories of the quote's priced lines
 * @returns The charge in AED and USD and what the quote covered, or null outside the UAE
 */
const uaeArrivalCharge = (
  card: UaeArrivalRateCard,
  request: { destinationCountry: string | null; transportMode: string | null },
  quoteCategories: string[],
) => {
  if (!isUae(request.destinationCountry)) return null;

  const has = (pattern: RegExp) => quoteCategories.some((c) => pattern.test(c));
  const coveredByQuote = [
    ...(has(/customs/i) ? (['customs'] as const) : []),
    ...(has(/destination/i) ? (['handling'] as const) : []),
  ];
  const mode = request.transportMode?.startsWith('sea') ? 'sea' : request.transportMode;

  const aed = card.lines
    .filter((l) => l.modes === 'all' || l.modes === mode)
    .filter((l) => !coveredByQuote.includes(l.covers))
    .reduce((sum, l) => sum + l.amountAed, 0);

  return { aed, usd: round2(aed * (PEGGED.AED ?? 0.2723)), coveredByQuote };
};

export default uaeArrivalCharge;
