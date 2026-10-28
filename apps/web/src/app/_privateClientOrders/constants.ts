/**
 * Subscription box options for private client orders.
 *
 * Taken from Cru Wine's Cellar Club: two tiers, each in a case of 3 or 6 a
 * month, at an all-in AED price (taxes and delivery included). The club price
 * sits beside the order's own client total on the PCO page as a price check.
 */

/** Tiers, in the order the club presents them */
export const SUBSCRIPTION_TIERS = [
  {
    value: 'discovery',
    label: 'Discovery',
    priceAed: { 3: 570, 6: 1075 },
  },
  {
    value: 'collector',
    label: 'The Collector',
    priceAed: { 3: 1450, 6: 2710 },
  },
] as const;

/** Bottles per monthly case */
export const SUBSCRIPTION_CASE_SIZES = [3, 6] as const;

/**
 * Variants offered before any have been used. Variants already on orders are
 * added to these, so a new one typed once is offered from then on.
 */
export const SUBSCRIPTION_DEFAULT_VARIANTS = ['Mix', 'B and B'] as const;

/**
 * From client payment onwards the distributor's bundle SKU is what was
 * invoiced against: the distributor can no longer change it (C&C still can),
 * and an order in these statuses no longer asks for one.
 */
export const DISTRIBUTOR_SKU_LOCKED_STATUSES: readonly string[] = [
  'client_paid',
  'awaiting_distributor_payment',
  'distributor_paid',
  'awaiting_partner_payment',
  'partner_paid',
  'scheduling_delivery',
  'delivery_scheduled',
  'stock_in_transit',
  'with_distributor',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

/**
 * Loops transactional template for "a note was added to your PCO". Variables:
 * recipientName, orderNumber, authorParty, authorName, note, orderUrl. Null
 * until the template exists in Loops: notes then alert in-app only.
 */
export const PCO_NOTE_EMAIL_TEMPLATE_ID: string | null = null;

/** Longest note accepted on a PCO timeline */
export const PCO_NOTE_MAX_LENGTH = 2000;

/**
 * The stages of the PCO pipeline, as groups of statuses. One definition: the
 * dashboard counts with it and the order list filters with it (`?stage=`), so
 * a count and the list behind it always agree.
 */
export const PCO_STAGES = {
  review: ['submitted', 'under_cc_review', 'revision_requested'],
  verification: [
    'cc_approved',
    'awaiting_partner_verification',
    'awaiting_distributor_verification',
    'verification_suspended',
  ],
  payment: [
    'awaiting_client_payment',
    'awaiting_payment_verification',
    'client_paid',
    'awaiting_distributor_payment',
  ],
  fulfilment: [
    'distributor_paid',
    'awaiting_partner_payment',
    'partner_paid',
    'stock_in_transit',
    'with_distributor',
    'scheduling_delivery',
    'delivery_scheduled',
    'out_for_delivery',
  ],
  delivered: ['delivered'],
} as const;

export type PcoStage = keyof typeof PCO_STAGES;

/**
 * Every status a distributor can see: from C&C approval to delivery.
 *
 * The dashboard and the order list each kept their own copy, and they
 * differed — the dashboard left out the two delivery-scheduling statuses, so
 * its totals undercounted the list behind them.
 */
export const DISTRIBUTOR_VISIBLE_STATUSES = [
  'cc_approved',
  'awaiting_partner_verification',
  'awaiting_distributor_verification',
  'verification_suspended',
  'awaiting_client_payment',
  // The partner says the client has paid; the distributor confirms it
  'awaiting_payment_verification',
  'client_paid',
  'awaiting_distributor_payment',
  'distributor_paid',
  'awaiting_partner_payment',
  'partner_paid',
  'stock_in_transit',
  'with_distributor',
  'scheduling_delivery',
  'delivery_scheduled',
  'out_for_delivery',
  'delivered',
] as const;

/**
 * The distributor's pipeline, as groups of statuses. As with PCO_STAGES, the
 * dashboard counts with these and the list filters with them (`?stage=`).
 * Inbound is C&C's leg (paid → on its way); delivery is the distributor's.
 */
export const DISTRIBUTOR_STAGES = {
  verification: [
    'cc_approved',
    'awaiting_partner_verification',
    'awaiting_distributor_verification',
    'verification_suspended',
  ],
  payment: [
    'awaiting_client_payment',
    'awaiting_payment_verification',
    'client_paid',
    'awaiting_distributor_payment',
  ],
  inbound: ['distributor_paid', 'awaiting_partner_payment', 'partner_paid', 'stock_in_transit'],
  delivery: ['with_distributor', 'scheduling_delivery', 'delivery_scheduled', 'out_for_delivery'],
  delivered: ['delivered'],
} as const;

export type DistributorStage = keyof typeof DISTRIBUTOR_STAGES;

/**
 * What is waiting on the distributor right now, one queue per kind of task.
 * Opened from the dashboard as `?queue=`; the bundle SKU queue is separate
 * (`?skuMissing=1`) because it depends on the distributor, not the status.
 */
export const DISTRIBUTOR_QUEUES = {
  verify: {
    label: 'Verify client',
    hint: 'Check the client',
    statuses: ['awaiting_distributor_verification'],
  },
  clientPayment: {
    label: 'Client payment',
    hint: 'Confirm when paid',
    statuses: ['awaiting_client_payment', 'awaiting_payment_verification'],
  },
  payCc: {
    label: 'Pay C&C',
    hint: 'Client has paid',
    statuses: ['client_paid', 'awaiting_distributor_payment'],
  },
  receive: {
    label: 'Stock arriving',
    hint: 'Confirm on arrival',
    statuses: ['stock_in_transit'],
  },
  deliver: {
    label: 'To deliver',
    hint: 'With you',
    statuses: ['with_distributor', 'scheduling_delivery', 'delivery_scheduled', 'out_for_delivery'],
  },
} as const;

export type DistributorQueue = keyof typeof DISTRIBUTOR_QUEUES;

/**
 * Loops transactional id for "Order update (all PCO emails)", the one template
 * every order email to partners and distributors is sent with. Its copy,
 * progress, wines and details are written by buildOrderEmail.
 */
export const ORDER_EMAIL_TEMPLATE_ID = 'cmvqn73i502sf0jzhynk8f1m8';
