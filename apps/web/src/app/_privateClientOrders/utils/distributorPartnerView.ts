/**
 * The wine partner on an order, as its distributor may see it
 *
 * A distributor deals with C&C and the end client, so the trade partner
 * behind an order is never named to it: no business name and no logo. C&C's
 * own orders (Private Cellar deliveries) may say they are C&C's.
 *
 * @example
 *   distributorPartnerView(row.order.partnerId, craftCultureId);
 *   // { id: '', businessName: 'Trade partner', logoUrl: null }
 *
 * @param partnerId - The order's partner
 * @param craftCulturePartnerId - C&C's own partner id (getCraftCulturePartnerId)
 * @returns A label in place of the partner, or null when there is none
 */
const distributorPartnerView = (
  partnerId: string | null,
  craftCulturePartnerId: string | null,
) => {
  if (!partnerId) return null;

  return {
    id: '',
    businessName:
      partnerId === craftCulturePartnerId ? 'Craft & Culture' : 'Trade partner',
    logoUrl: null as string | null,
  };
};

export default distributorPartnerView;
