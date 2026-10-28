/**
 * Whether a shipment line belongs to this partner
 *
 * A line is the shipment partner's unless it names another owner: one
 * shipment can carry several owners' wine, and each sees only its own lines.
 *
 * @example
 *   isPartnerShipmentItem({ overrideOwnerId: null }, 'p1', 'p1'); // true
 *   isPartnerShipmentItem({ overrideOwnerId: 'p2' }, 'p1', 'p1'); // false
 *   isPartnerShipmentItem({ overrideOwnerId: 'p2' }, 'p1', 'p2'); // true
 *
 * @param item - The line, with its owner override
 * @param shipmentPartnerId - The partner the shipment is for
 * @param partnerId - The partner asking
 * @returns True when the line is the asking partner's
 */
const isPartnerShipmentItem = (
  item: { overrideOwnerId: string | null },
  shipmentPartnerId: string | null,
  partnerId: string,
) => (item.overrideOwnerId ? item.overrideOwnerId === partnerId : shipmentPartnerId === partnerId);

export default isPartnerShipmentItem;
