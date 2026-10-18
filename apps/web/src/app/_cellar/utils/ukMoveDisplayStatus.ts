/**
 * Where a UK move has got to, reading arrival from its shipment
 *
 * Arrival is not stored on the move. Receiving marks the linked shipment
 * delivered once the wine is in the member's UAE cellar, and that is the fact
 * worth showing, so it is read from there.
 *
 * @example
 *   ukMoveDisplayStatus('shipping', 'delivered'); // 'arrived'
 *
 * @param status - The move's stored status
 * @param shipmentStatus - The linked shipment's status, if any
 * @returns The status to show
 */
const ukMoveDisplayStatus = (
  status: string,
  shipmentStatus: string | null | undefined,
) => {
  if (status === 'shipping' && shipmentStatus === 'delivered') return 'arrived';

  return status;
};

export default ukMoveDisplayStatus;
