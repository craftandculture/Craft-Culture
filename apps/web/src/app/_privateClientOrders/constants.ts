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
