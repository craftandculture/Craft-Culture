export interface DispatchPick {
  orderId: string | null;
  lwin18: string;
  productName: string;
  quantityCases: number;
  quantityBottles: number | null;
  fromOwnerId: string | null;
  stockId: string | null;
}

export interface DispatchOrderLine {
  orderId: string;
  lwin18: string | null;
  productName: string | null;
  quantity: number;
}

/**
 * The dispatch movements to write when a batch leaves the warehouse
 *
 * Each order's bottles leave as they were picked: one dispatch per pick, with
 * the owner and stock row the pick recorded, so the owner's statement shows
 * them as gone out rather than missing. An order with no pick on record (one
 * picked before picks were recorded, or never picked through a list) falls
 * back to its order lines, as dispatch always did, with no owner.
 *
 * @example
 *   planDispatchMovements({ orderIds: ['o1'], picks: [pick], lines: [] });
 *   // one movement copying pick's owner, stock row and quantities
 *
 * @param input - The batch's order ids, the picks recorded for them, and their lines
 * @returns The dispatch movements, without movement numbers
 */
const planDispatchMovements = ({
  orderIds,
  picks,
  lines,
}: {
  orderIds: string[];
  picks: DispatchPick[];
  lines: DispatchOrderLine[];
}) => {
  const picked = new Set(picks.map((pick) => pick.orderId).filter(Boolean));

  const fromPicks = picks
    .filter((pick) => pick.orderId && orderIds.includes(pick.orderId))
    .filter((pick) => pick.quantityCases > 0 || (pick.quantityBottles ?? 0) > 0)
    .map((pick) => ({
      orderId: pick.orderId as string,
      lwin18: pick.lwin18,
      productName: pick.productName,
      quantityCases: pick.quantityCases,
      quantityBottles: pick.quantityBottles,
      fromOwnerId: pick.fromOwnerId,
      stockId: pick.stockId,
    }));

  const fromLines = lines
    .filter((line) => orderIds.includes(line.orderId) && !picked.has(line.orderId))
    .filter((line) => line.lwin18 && line.quantity > 0)
    .map((line) => ({
      orderId: line.orderId,
      lwin18: line.lwin18 as string,
      productName: line.productName ?? 'Unknown Product',
      quantityCases: line.quantity,
      quantityBottles: null,
      fromOwnerId: null,
      stockId: null,
    }));

  return [...fromPicks, ...fromLines];
};

export default planDispatchMovements;
