export interface DeliveryProgress {
  /** The private client order's status */
  orderStatus: string | null;
  /** The warehouse's pick list for the Zoho order, once released to the floor */
  pickListStatus: string | null;
  /** The Zoho order's own status in the Index: picking, picked, dispatched */
  salesOrderStatus: string | null;
  /** The dispatch batch the order left on, if it went on one */
  dispatchStatus: string | null;
}

/*
  The stages a delivery goes through in the warehouse and on the road, in the
  order they happen, with what the member is told at each. They follow the
  team's own process rather than the order's statuses, which are about
  approvals and invoicing and mean nothing to a collector.
*/
export const DELIVERY_STAGES = [
  {
    label: 'Confirmed',
    title: 'Your delivery is confirmed',
    message: 'We have your request and will begin preparing your wine.',
  },
  {
    label: 'Being picked',
    title: 'Your wine is being picked',
    message: 'Our cellar team is taking your bottles from the bond.',
  },
  {
    label: 'Packed',
    title: 'Your wine is packed',
    message: 'Your bottles are checked, packed and waiting for collection.',
  },
  {
    label: 'Collected',
    title: 'Your wine has been collected',
    message: 'Your wine has left our warehouse with the licensed distributor.',
  },
  {
    label: 'Out for delivery',
    title: 'Your wine is out for delivery',
    message: 'Your wine is on its way to you.',
  },
  {
    label: 'Delivered',
    title: 'Your wine has been delivered',
    message: 'Your delivery has arrived. We hope you enjoy it.',
  },
] as const;

/**
 * How far a delivery has got, as an index into DELIVERY_STAGES
 *
 * The furthest signal wins. The warehouse moves first (pick list, then the Zoho
 * order), the distributor after (the order's own fulfilment statuses), so each
 * source can only push the stage forward.
 *
 * @example
 *   deliveryStage({
 *     orderStatus: 'cc_approved',
 *     pickListStatus: 'completed',
 *     salesOrderStatus: 'picked',
 *     dispatchStatus: null,
 *   }); // 2
 *
 * @param progress - The statuses from the order, the pick list, the Zoho order
 *   and the dispatch
 * @returns 0 Confirmed … 5 Delivered
 */
const deliveryStage = ({
  orderStatus,
  pickListStatus,
  salesOrderStatus,
  dispatchStatus,
}: DeliveryProgress) => {
  if (
    orderStatus === 'delivered' ||
    salesOrderStatus === 'delivered' ||
    dispatchStatus === 'delivered'
  ) {
    return 5;
  }

  if (orderStatus === 'out_for_delivery') return 4;

  if (
    orderStatus === 'with_distributor' ||
    orderStatus === 'stock_in_transit' ||
    salesOrderStatus === 'dispatched' ||
    dispatchStatus === 'dispatched'
  ) {
    return 3;
  }

  if (
    pickListStatus === 'completed' ||
    salesOrderStatus === 'picked' ||
    dispatchStatus === 'staged'
  ) {
    return 2;
  }

  if (
    pickListStatus === 'pending' ||
    pickListStatus === 'in_progress' ||
    salesOrderStatus === 'picking'
  ) {
    return 1;
  }

  return 0;
};

export default deliveryStage;
