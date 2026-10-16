/** Statuses a shipment has not yet reached the warehouse or client in */
const NOT_ARRIVED_STATUSES = [
  'draft',
  'booked',
  'picked_up',
  'in_transit',
  'arrived_port',
  'customs_clearance',
  'cleared',
] as const;

export default NOT_ARRIVED_STATUSES;
