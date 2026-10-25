export interface DispatchPick {
  orderId: string | null;
  lwin18: string;
  productName: string;
  quantityCases: number;
  quantityBottles: number | null;
  fromOwnerId: string | null;
  stockId: string | null;
  performedAt?: Date | null;
}

export interface DispatchOrderLine {
  orderId: string;
  lwin18: string | null;
  productName: string | null;
  quantity: number;
}

/** Wine and vintage, any pack: `1066306-2023-06-00750` → `1066306-2023` */
const wineKey = (lwin18: string | null) => (lwin18 ?? '').split('-').slice(0, 2).join('-');

/**
 * The dispatch movements to write when a batch leaves the warehouse
 *
 * Each order's bottles leave as they were picked: one dispatch per pick, with
 * the owner and stock row the pick recorded, so the owner's statement shows
 * them as gone out rather than missing. Only picks made since the order's
 * current pick list was created count, so a list deleted part-picked and
 * picked again is not dispatched twice. An order line with no pick of its
 * wine (picked before picks were recorded, never scanned, or short) falls
 * back to the line itself, as dispatch always did, with no owner.
 *
 * @example
 *   planDispatchMovements({ orderIds: ['o1'], picks: [pick], lines: [] });
 *   // one movement copying pick's owner, stock row and quantities
 *
 * @param input - The batch's order ids, the picks recorded for them, their
 *   lines, and when each order's current pick list was created
 * @returns The dispatch movements, without movement numbers
 */
const planDispatchMovements = ({
  orderIds,
  picks,
  lines,
  pickListCreatedAt = new Map(),
}: {
  orderIds: string[];
  picks: DispatchPick[];
  lines: DispatchOrderLine[];
  pickListCreatedAt?: Map<string, Date>;
}) => {
  const current = picks.filter((pick) => {
    if (!pick.orderId || !orderIds.includes(pick.orderId)) return false;
    const since = pickListCreatedAt.get(pick.orderId);
    return !since || !pick.performedAt || pick.performedAt >= since;
  });

  const fromPicks = current
    .filter((pick) => pick.quantityCases !== 0 || (pick.quantityBottles ?? 0) !== 0)
    .map((pick) => ({
      orderId: pick.orderId as string,
      lwin18: pick.lwin18,
      productName: pick.productName,
      quantityCases: pick.quantityCases,
      quantityBottles: pick.quantityBottles,
      fromOwnerId: pick.fromOwnerId,
      stockId: pick.stockId,
    }));

  const pickedWines = new Set(current.map((pick) => `${pick.orderId}|${wineKey(pick.lwin18)}`));

  const fromLines = lines
    .filter((line) => orderIds.includes(line.orderId))
    .filter((line) => line.lwin18 && line.quantity > 0)
    .filter((line) => !pickedWines.has(`${line.orderId}|${wineKey(line.lwin18)}`))
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
