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

/**
 * Of those, the ones still genuinely on the move.
 *
 * `at_warehouse` means the pallet is on our floor at goods-in, waiting to be
 * booked in. It is inbound — it is not in wms_stock, so it still has to be
 * counted somewhere — but telling a customer it is "arriving in ~7 days" is
 * wrong when it is already here, and telling them nothing is worse: until it
 * is received it appears on no list at all and falls between the two.
 *
 * Kept as a separate list rather than removed from the one above, because the
 * stock counts, owner totals and LPO preview all want everything not yet in
 * wms_stock. Only the customer-facing in-transit view wants this narrower cut.
 */
export const IN_TRANSIT_SHIPMENT_STATUSES = [
  'booked',
  'picked_up',
  'in_transit',
  'arrived_port',
  'customs_clearance',
  'cleared',
] as const;

/** At our warehouse, not yet booked in — neither in transit nor sellable. */
export const AT_WAREHOUSE_STATUSES = ['at_warehouse'] as const;

export default INBOUND_SHIPMENT_STATUSES;
