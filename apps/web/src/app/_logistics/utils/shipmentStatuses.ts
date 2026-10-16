import type { LogisticsShipment } from '@/database/schema';

export type ShipmentStatus = LogisticsShipment['status'];
export type ShipmentType = LogisticsShipment['type'];

/**
 * Every shipment status, in the order a shipment moves through them
 *
 * Defined once: the status dropdown, the server's allowed list, the stepper and
 * the Hillebrand sync all read this. They had drifted — the dropdown offered
 * "Receiving", which the server refused, and the stepper stopped at the
 * warehouse so a delivered shipment showed nothing done.
 */
export const SHIPMENT_STATUSES = [
  { key: 'draft', label: 'Draft' },
  { key: 'booked', label: 'Booked' },
  { key: 'picked_up', label: 'Collected' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'arrived_port', label: 'At port' },
  { key: 'customs_clearance', label: 'Customs' },
  { key: 'cleared', label: 'Cleared' },
  { key: 'at_warehouse', label: 'At warehouse' },
  { key: 'partially_received', label: 'Receiving' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
] as const satisfies readonly { key: ShipmentStatus; label: string }[];

export const SHIPMENT_STATUS_KEYS = SHIPMENT_STATUSES.map((s) => s.key) as [ShipmentStatus, ...ShipmentStatus[]];

export const shipmentStatusLabel = (status: ShipmentStatus) =>
  SHIPMENT_STATUSES.find((s) => s.key === status)?.label ?? status;

/**
 * The steps shown for each kind of shipment
 *
 * An import clears port and customs into the warehouse; an export or a mainland
 * transfer leaves from the warehouse, so port and customs steps mean nothing to
 * it. Each step lists the statuses that count as being at that step.
 */
export const SHIPMENT_STEPS: Record<ShipmentType, { label: string; status: ShipmentStatus; covers: ShipmentStatus[] }[]> = {
  inbound: [
    { label: 'Draft', status: 'draft', covers: ['draft'] },
    { label: 'Booked', status: 'booked', covers: ['booked'] },
    { label: 'Collected', status: 'picked_up', covers: ['picked_up'] },
    { label: 'In transit', status: 'in_transit', covers: ['in_transit'] },
    { label: 'At port', status: 'arrived_port', covers: ['arrived_port'] },
    { label: 'Customs', status: 'customs_clearance', covers: ['customs_clearance', 'cleared'] },
    { label: 'At warehouse', status: 'at_warehouse', covers: ['at_warehouse', 'partially_received'] },
    { label: 'Received', status: 'delivered', covers: ['delivered', 'dispatched'] },
  ],
  outbound: [
    { label: 'Draft', status: 'draft', covers: ['draft'] },
    { label: 'Booked', status: 'booked', covers: ['booked', 'picked_up'] },
    { label: 'Customs', status: 'customs_clearance', covers: ['customs_clearance', 'cleared', 'arrived_port', 'at_warehouse', 'partially_received'] },
    { label: 'Departed', status: 'in_transit', covers: ['in_transit', 'dispatched'] },
    { label: 'Delivered', status: 'delivered', covers: ['delivered'] },
  ],
  re_export: [
    { label: 'Draft', status: 'draft', covers: ['draft'] },
    { label: 'Booked', status: 'booked', covers: ['booked', 'picked_up'] },
    { label: 'Customs', status: 'customs_clearance', covers: ['customs_clearance', 'cleared', 'arrived_port', 'at_warehouse', 'partially_received'] },
    { label: 'Departed', status: 'in_transit', covers: ['in_transit', 'dispatched'] },
    { label: 'Delivered', status: 'delivered', covers: ['delivered'] },
  ],
  mainland_transfer: [
    { label: 'Draft', status: 'draft', covers: ['draft'] },
    { label: 'Booked', status: 'booked', covers: ['booked', 'customs_clearance', 'cleared', 'arrived_port', 'at_warehouse', 'partially_received'] },
    { label: 'Collected', status: 'picked_up', covers: ['picked_up', 'in_transit', 'dispatched'] },
    { label: 'Delivered', status: 'delivered', covers: ['delivered'] },
  ],
};

const rank = (status: ShipmentStatus) => SHIPMENT_STATUSES.findIndex((s) => s.key === status);

/**
 * The status an outside feed may move a shipment to
 *
 * A feed only ever moves a shipment forward. Once it is receiving, received,
 * delivered or cancelled — states set by the warehouse or a person — the feed
 * leaves it alone, so a sync cannot put received wine back "in transit" and
 * count it twice.
 *
 * @param current - The status the shipment has now
 * @param incoming - The status the feed reports
 * @returns The status to keep
 */
export const forwardOnlyStatus = (current: ShipmentStatus, incoming: ShipmentStatus): ShipmentStatus => {
  if (['partially_received', 'dispatched', 'delivered', 'cancelled'].includes(current)) return current;
  return rank(incoming) > rank(current) ? incoming : current;
};
