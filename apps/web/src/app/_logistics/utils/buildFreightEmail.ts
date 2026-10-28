import quoteUnitPrices from './quoteUnitPrices';

/** The request fields an email is written from */
export interface FreightEmailRequest {
  requestNumber: string;
  originCountry: string;
  originCity: string | null;
  originWarehouse: string | null;
  destinationCountry: string;
  destinationCity: string | null;
  destinationWarehouse: string | null;
  transportMode: 'sea_fcl' | 'sea_lcl' | 'air' | 'road' | null;
  productType: string;
  productDescription: string | null;
  totalCases: number | null;
  totalBottles: number | null;
  total75clEquivalents: number | null;
  totalPallets: number | null;
  totalWeightKg: number | null;
  totalVolumeM3: number | null;
  temperatureControlled: boolean;
  requiresThermalLiner: boolean;
  requiresTracker: boolean;
  requiresInsurance: boolean;
  minTemperature: number | null;
  maxTemperature: number | null;
  targetPickupDate: Date | null;
  targetDeliveryDate: Date | null;
  replyBy: Date | null;
  notes: string | null;
  /** How the client is greeted on their quote, as staff typed it (e.g. "Mr Smith") */
  clientName?: string | null;
}

/** A forwarder and the people its emails go to */
export interface FreightEmailForwarder {
  name: string;
  contacts: { name?: string; email: string }[];
}

/** The forwarder quote an award, decline or client quote refers to */
export interface FreightEmailQuote {
  quoteNumber: string;
  forwarderReference: string | null;
  totalPrice: number;
  currency: string;
  transitDays: number | null;
  validUntil: Date | null;
  /** Line categories on the quote, to say what the client price includes */
  categories: string[];
}

export type FreightEmailInput =
  | {
      kind: 'request' | 'chase';
      request: FreightEmailRequest;
      forwarders: FreightEmailForwarder[];
      senderName: string;
    }
  | {
      kind: 'award' | 'decline';
      request: FreightEmailRequest;
      forwarder: FreightEmailForwarder;
      quote: FreightEmailQuote;
      senderName: string;
    }
  | {
      kind: 'client_quote';
      request: FreightEmailRequest;
      quote: FreightEmailQuote;
      clientPriceUsd: number;
      senderName: string;
    };

const MODES = {
  sea_fcl: 'Sea freight (full container)',
  sea_lcl: 'Sea freight (shared container)',
  air: 'Air freight',
  road: 'Road freight',
} as const;

const CATEGORY_WORDS: Record<string, string> = {
  freight: 'freight',
  origin_handling: 'collection and origin handling',
  'origin handling': 'collection and origin handling',
  destination_handling: 'arrival handling',
  'destination handling': 'arrival handling',
  documentation: 'export documentation',
  customs: 'customs clearance',
  insurance: 'transit insurance',
  local_delivery: 'delivery to the warehouse',
  'local delivery': 'delivery to the warehouse',
};

const day = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Dubai',
  }).format(d);

const num = (n: number, digits = 0) =>
  new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);

const money = (amount: number, currency: string) =>
  `${currency.toUpperCase()} ${num(amount, 2)}`;

const place = (...parts: (string | null)[]) =>
  parts.filter((p) => p && p.trim()).join(', ');

const isUae = (country: string) =>
  /^(ae|uae|united arab emirates)$/i.test(country.trim());

const greeting = (forwarders: FreightEmailForwarder[]) => {
  const only = forwarders.length === 1 ? forwarders[0] : undefined;
  const first = only?.contacts[0]?.name?.split(' ')[0];

  // A named person first, then the forwarder's team, and only to several forwarders at once Sir or Madam
  return first
    ? `Dear ${first},`
    : only
      ? `Dear ${only.name} team,`
      : 'Dear Sir or Madam,';
};

const quantityLine = (r: FreightEmailRequest) => {
  const parts = [
    r.totalCases ? `${num(r.totalCases)} cases` : null,
    r.totalBottles ? `${num(r.totalBottles)} bottles` : null,
  ].filter(Boolean);
  const equiv =
    r.total75clEquivalents &&
    r.totalBottles &&
    Math.abs(r.total75clEquivalents - r.totalBottles) > 0.5
      ? ` (${num(r.total75clEquivalents)} × 75cl equivalent)`
      : '';

  return parts.length ? `${parts.join(', ')}${equiv}` : null;
};

const subjectRoute = (r: FreightEmailRequest) =>
  `${r.originCity || r.originCountry} to ${r.destinationCity || r.destinationCountry}${r.totalCases ? `, ${num(r.totalCases)} cases` : ''}`;

const cargoBlock = (r: FreightEmailRequest) =>
  [
    `- Goods: ${r.productDescription || (r.productType === 'spirits' ? 'Spirits' : 'Fine wine')}`,
    quantityLine(r) && `- Quantity: ${quantityLine(r)}`,
    r.totalPallets && `- Pallets: ${num(r.totalPallets)}`,
    r.totalWeightKg &&
      `- Weight: approximately ${num(r.totalWeightKg)} kg gross`,
    r.totalVolumeM3 &&
      `- Volume: approximately ${num(r.totalVolumeM3, 1)} cubic metres`,
  ].filter(Boolean);

const requirementLines = (r: FreightEmailRequest) => {
  const range =
    r.minTemperature != null && r.maxTemperature != null
      ? ` (${num(r.minTemperature)}–${num(r.maxTemperature)}°C)`
      : '';

  return [
    (r.temperatureControlled || r.requiresThermalLiner) &&
      `- Temperature-managed throughout${range}`,
    r.requiresThermalLiner && '- Thermal liner',
    r.requiresTracker && '- Temperature tracker in the consignment',
    r.requiresInsurance && '- Transit insurance, shown as a separate line',
  ].filter(Boolean);
};

const signOff = (senderName: string) => [
  'Kind regards,',
  '',
  senderName,
  'Logistics, Craft & Culture',
  'logistics@craftculture.xyz',
  'craftculture.xyz',
];

/**
 * Write a freight email ready to copy into the sender's own mail
 *
 * Five kinds, all from the request and (where it applies) the chosen quote:
 *
 * - `request`: asks forwarders to quote; several forwarders go in Bcc on one
 *   email
 * - `chase`: a short reminder of an unanswered request
 * - `award`: tells the chosen forwarder, quoting their reference back
 * - `decline`: thanks a forwarder whose quote was not taken
 * - `client_quote`: our price to the client, which never names the forwarder,
 *   their price or our margin
 *
 * Every subject carries the QRQ number, so replies can be matched to their
 * request. The Index sends nothing; a person reads and sends each one.
 *
 * @example
 *   buildFreightEmail({
 *     kind: 'request',
 *     request,
 *     forwarders: [hillebrand],
 *     senderName: 'Jyothi',
 *   });
 *   // { to: ['ops@hillebrand.com'], bcc: [], subject: 'Freight quote request QRQ-2026-0012: …', body: '…' }
 *
 * @param input - Which email, and what it is written from
 * @returns Recipients, subject and body, as plain text
 */
const buildFreightEmail = (input: FreightEmailInput) => {
  const r = input.request;
  const origin = place(r.originWarehouse, r.originCity, r.originCountry);
  const destination = place(
    r.destinationWarehouse,
    r.destinationCity,
    r.destinationCountry,
  );
  const mode = r.transportMode ? MODES[r.transportMode] : null;

  if (input.kind === 'request' || input.kind === 'chase') {
    const emails = input.forwarders.flatMap((f) =>
      f.contacts.map((c) => c.email),
    );
    const single = input.forwarders.length === 1;
    const to = single ? emails : [];
    const bcc = single ? [] : emails;

    if (input.kind === 'chase') {
      return {
        to,
        bcc,
        subject: `Reminder: freight quote request ${r.requestNumber}: ${subjectRoute(r)}`,
        body: [
          greeting(input.forwarders),
          '',
          `We have not yet received your quote for our request ${r.requestNumber}, ${origin} to ${destination}${quantityLine(r) ? `, ${quantityLine(r)}` : ''}.`,
          '',
          `Please could you send your quote${r.replyBy ? ` by ${day(r.replyBy)}` : ' at your earliest convenience'}, or let us know if you are unable to quote on this occasion.`,
          '',
          ...signOff(input.senderName),
        ].join('\n'),
      };
    }

    return {
      to,
      bcc,
      subject: `Freight quote request ${r.requestNumber}: ${subjectRoute(r)}`,
      body: [
        greeting(input.forwarders),
        '',
        `Please could you quote for the consignment below. Kindly quote our reference ${r.requestNumber} in your reply, together with your own quote reference.`,
        '',
        'Route',
        `- Collection: ${origin}`,
        `- Delivery: ${destination}`,
        `- Mode: ${mode ?? 'Air and sea options, with the transit time for each'}`,
        '',
        'Cargo',
        ...cargoBlock(r),
        ...(requirementLines(r).length
          ? ['', 'Requirements', ...requirementLines(r)]
          : []),
        ...(r.targetPickupDate || r.targetDeliveryDate
          ? [
              '',
              'Timing',
              ...(r.targetPickupDate
                ? [`- Ready for collection: ${day(r.targetPickupDate)}`]
                : []),
              ...(r.targetDeliveryDate
                ? [`- Required delivery: ${day(r.targetDeliveryDate)}`]
                : []),
            ]
          : []),
        '',
        'Please itemise freight, origin and destination charges, documentation and any surcharges, and state the currency, the transit time and how long the quote is valid.',
        ...(r.notes?.trim() ? ['', r.notes.trim()] : []),
        '',
        r.replyBy
          ? `We would be grateful for your quote by ${day(r.replyBy)}.`
          : 'We would be grateful for your quote at your earliest convenience.',
        '',
        ...signOff(input.senderName),
      ].join('\n'),
    };
  }

  if (input.kind === 'award' || input.kind === 'decline') {
    const ref = input.quote.forwarderReference;
    const to = input.forwarder.contacts.map((c) => c.email);

    if (input.kind === 'decline') {
      return {
        to,
        bcc: [],
        subject: `Freight quote request ${r.requestNumber}: outcome`,
        body: [
          greeting([input.forwarder]),
          '',
          `Thank you for your quote${ref ? ` ${ref}` : ''} for our request ${r.requestNumber}, ${origin} to ${destination}.`,
          '',
          'On this occasion we have placed the shipment elsewhere. We appreciate your time and look forward to working with you on future consignments.',
          '',
          ...signOff(input.senderName),
        ].join('\n'),
      };
    }

    return {
      to,
      bcc: [],
      subject: `Quote accepted: ${ref ? `${ref} / ` : ''}${r.requestNumber}: ${subjectRoute(r)}`,
      body: [
        greeting([input.forwarder]),
        '',
        `We are pleased to accept your quote${ref ? ` ${ref}` : ''} of ${money(input.quote.totalPrice, input.quote.currency)} for our request ${r.requestNumber}: ${origin} to ${destination}${quantityLine(r) ? `, ${quantityLine(r)}` : ''}.`,
        '',
        'Please confirm the booking and send the collection details, together with any documents you need from us. Kindly quote both references on all correspondence and on your invoice.',
        '',
        ...signOff(input.senderName),
      ].join('\n'),
    };
  }

  if (input.kind !== 'client_quote') {
    throw new Error('Unknown freight email kind');
  }

  const { perBottleUsd } = quoteUnitPrices(
    input.clientPriceUsd,
    r.totalBottles,
    r.total75clEquivalents,
  );
  const clientDestination = isUae(r.destinationCountry)
    ? 'the C&C bonded warehouse, United Arab Emirates'
    : place(r.destinationCity, r.destinationCountry);
  const included = [
    ...new Set(
      input.quote.categories
        .map((c) => CATEGORY_WORDS[c.trim().toLowerCase()])
        .filter((w): w is string => Boolean(w)),
    ),
  ];
  const insured = included.includes('transit insurance');

  return {
    to: [],
    bcc: [],
    subject: `Freight quotation ${r.requestNumber}: ${r.originCity || r.originCountry} to ${isUae(r.destinationCountry) ? 'the UAE' : r.destinationCity || r.destinationCountry}`,
    body: [
      r.clientName?.trim() ? `Dear ${r.clientName.trim()},` : 'Dear Sir or Madam,',
      '',
      'Thank you for your enquiry. We are pleased to quote for moving your wine as follows.',
      '',
      `- From: ${place(r.originCity, r.originCountry)}`,
      `- To: ${clientDestination}`,
      ...(quantityLine(r) ? [`- Consignment: ${quantityLine(r)}`] : []),
      ...(mode
        ? [
            `- Service: ${mode}${r.temperatureControlled || r.requiresThermalLiner ? ', temperature-managed' : ''}`,
          ]
        : []),
      ...(input.quote.transitDays
        ? [
            `- Estimated transit time: about ${num(input.quote.transitDays)} days`,
          ]
        : []),
      `- Price: USD ${num(input.clientPriceUsd, 2)}${perBottleUsd != null ? ` (USD ${num(perBottleUsd, 2)} per bottle)` : ''}`,
      ...(included.length ? [`- Includes: ${included.join(', ')}`] : []),
      `- Excludes: import duty, VAT and any charges not listed above${insured ? '' : '; transit insurance can be arranged on request'}`,
      ...(input.quote.validUntil
        ? [`- Valid until: ${day(input.quote.validUntil)}`]
        : []),
      '',
      `To proceed, please reply to confirm, quoting reference ${r.requestNumber}, and we will arrange collection.`,
      '',
      ...signOff(input.senderName),
    ].join('\n'),
  };
};

export default buildFreightEmail;
