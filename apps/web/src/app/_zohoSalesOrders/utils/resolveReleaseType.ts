export const RELEASE_TYPES = ['consignment', 'outright', 'pco', 'prepaid'] as const;

export type ReleaseType = (typeof RELEASE_TYPES)[number];

export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  consignment: 'Consignment',
  outright: 'Outright sale',
  pco: 'Private client order',
  prepaid: 'Prepaid by outlet',
};

/**
 * What a sales order is being released as, and whether someone must say
 *
 * Sophie's rule (19 Nov 2026): consignment, outright, PCO or prepaid is
 * decided when the goods go out, not tagged in Zoho afterwards. Most orders
 * answer themselves: a private client order is a PCO, and anything to a
 * customer other than City Drinks is an outright sale, since only City Drinks
 * hold our stock on consignment. A City Drinks order is suggested from a
 * CONSIGNMENT tag already on it, and otherwise has to be chosen; nothing is
 * assumed there, because the two choices settle in opposite directions.
 *
 * @example
 *   resolveReleaseType({ customerName: 'Centaurus', reference: null, isPco: false, stored: null });
 *   // { type: 'outright', required: false, reason: 'Not a consignment customer' }
 *
 * @param order - What is known about the order, and any type already set
 * @returns The type (null when it must be chosen) and why
 */
const resolveReleaseType = (order: {
  customerName: string | null;
  reference: string | null;
  isPco: boolean;
  stored: string | null;
}) => {
  const stored = RELEASE_TYPES.find((type) => type === order.stored);

  if (stored) {
    return { type: stored, suggested: stored, required: false, reason: 'Set at release' };
  }

  if (order.isPco || /\bPCO[-\s]?\d/i.test(order.reference ?? '')) {
    return {
      type: 'pco' as ReleaseType,
      suggested: 'pco' as ReleaseType,
      required: false,
      reason: 'Private client order',
    };
  }

  /*
    Every other release is chosen by a person (Sophie, 23 Nov 2026): the
    customer and the Zoho tag only suggest. Guessing "outright" for anyone but
    City Drinks settled a consigned case to The Bottle Store as sold.
  */
  const consignmentCustomer = /city\s*drinks/i.test(order.customerName ?? '');
  const suggested: ReleaseType | null = /CONSIGNMENT/i.test(order.reference ?? '')
    ? 'consignment'
    : consignmentCustomer
      ? null
      : 'outright';

  return {
    type: null,
    suggested,
    required: true,
    reason: suggested
      ? `Choose the type before release (suggested: ${RELEASE_TYPE_LABELS[suggested]})`
      : 'Choose consignment, outright sale or prepaid before release',
  };
};

export default resolveReleaseType;
