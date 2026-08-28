/**
 * Shipment statuses meaning "bought, on its way, not yet in wms_stock"
 *
 * Deliberately omits draft, partially_received, delivered and cancelled. Once a
 * shipment starts being received its bottles are in `wms_stock`, so counting
 * those here reports the same wine twice across the landed and in-transit
 * views; a draft is not bought yet and a cancelled one never will be.
 *
 * Defined once because it was defined three times. The owner filter had no copy
 * at all and counted every inbound line ever raised, so a partner with 65 wines
 * in transit was offered as "76 inbound" — the difference being shipments long
 * since delivered or cancelled.
 */
const INBOUND_SHIPMENT_STATUSES = [
  'booked',
  'picked_up',
  'in_transit',
  'arrived_port',
  'customs_clearance',
  'cleared',
  'at_warehouse',
] as const;

export default INBOUND_SHIPMENT_STATUSES;
