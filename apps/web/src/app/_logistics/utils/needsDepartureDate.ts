import type { ShipmentStatus } from './shipmentStatuses';

/** Statuses an inbound shipment can only reach once it has left */
const DEPARTED_STATUSES: ShipmentStatus[] = [
  'in_transit',
  'arrived_port',
  'customs_clearance',
  'cleared',
  'at_warehouse',
  'partially_received',
  'delivered',
];

/**
 * Whether moving an inbound shipment to a status should ask when it departed
 *
 * Members see the departure date on their incoming-wine tracker. SHP-2026-0030
 * went from Collected straight to At port, so Michael Humphreys-Davies saw
 * "On its way to the UAE" ticked with no date. Asked once, while nobody has
 * recorded a departure yet.
 *
 * @example
 *   needsDepartureDate({ type: 'inbound', atd: null }, 'arrived_port'); // true
 *   needsDepartureDate({ type: 'inbound', atd: '2026-10-28' }, 'arrived_port'); // false
 *
 * @param shipment - Its type and recorded departure
 * @param next - The status it is moving to
 * @returns True when the departure date should be asked for
 */
const needsDepartureDate = (
  shipment: { type?: string | null; atd?: Date | string | null },
  next: ShipmentStatus,
) => shipment.type === 'inbound' && !shipment.atd && DEPARTED_STATUSES.includes(next);

export default needsDepartureDate;
