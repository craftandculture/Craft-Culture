export interface StartingLayer {
  id: string;
  docDate: string | null;
  docRef: string | null;
  bottles: number;
  /** Bottles the line held at the opening, where the payment run counted it */
  opening: number | null;
  /** Breaks a tie on one invoice: the dearer line was drawn first */
  pricePerBottle?: number;
}

export interface EarlierSales {
  bottles: number;
  /** Sold after the opening date; earlier sales are already inside it */
  afterOpening: boolean;
}

/** Oldest invoice first; on one invoice, the dearer line first */
export const startingOrder = (a: StartingLayer, b: StartingLayer) => {
  const byDate = (a.docDate ?? '').localeCompare(b.docDate ?? '');

  if (byDate !== 0) return byDate;

  const byRef = (a.docRef ?? '').localeCompare(b.docRef ?? '');

  if (byRef !== 0) return byRef;

  return (b.pricePerBottle ?? 0) - (a.pricePerBottle ?? 0);
};

/**
 * What each of one owner's invoice lines of one wine still holds as a month
 * starts
 *
 * A line the payment run counted starts from its opening (bottles left at 30
 * September) and only later months' sales come off it; a line it did not count
 * starts full and every earlier month's sales come off it. Sales come off the
 * oldest line first. Used by the sale attribution and the statement alike, so
 * the two draw the same bottles from the same lines.
 *
 * @example
 *   startingLayerBottles(
 *     [{ id: 'a', docDate: '2026-02-16', docRef: 'INV-000212', bottles: 12, opening: 1 }],
 *     [{ bottles: 1, afterOpening: true }],
 *   ); // Map { 'a' => 0 }
 *
 * @param layers - The owner's lines of the wine
 * @param earlier - Its sales in earlier months
 * @returns Bottles left on each line, by id
 */
const startingLayerBottles = (
  layers: StartingLayer[],
  earlier: EarlierSales[],
) => {
  const remaining = new Map(
    layers.map((layer) => [layer.id, layer.opening ?? layer.bottles]),
  );
  const ordered = [...layers].sort(startingOrder);

  const drawDown = (bottles: number, eligible: (layer: StartingLayer) => boolean) => {
    let left = bottles;

    for (const layer of ordered) {
      if (left <= 0) break;
      if (!eligible(layer)) continue;

      const take = Math.min(remaining.get(layer.id) ?? 0, left);

      remaining.set(layer.id, (remaining.get(layer.id) ?? 0) - take);
      left -= take;
    }
  };

  for (const sale of earlier) {
    drawDown(
      sale.bottles,
      sale.afterOpening ? () => true : (layer) => layer.opening === null,
    );
  }

  return remaining;
};

export default startingLayerBottles;
