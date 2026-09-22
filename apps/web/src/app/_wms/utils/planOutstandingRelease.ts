import pakKeyOf from './pakKeyOf';

export interface OrderLine {
  id: string;
  /** The code the line was invoiced under. */
  sku: string | null;
  lwin18: string | null;
  name: string | null;
  /** 'Case', 'Cases' or 'Bottle' — what `quantity` counts. */
  unit: string | null;
  quantity: number;
}

export interface PickedLine {
  lwin18: string | null;
  quantityCases: number;
  /** Set on a split-case pick; the line moved bottles, not whole cases. */
  quantityBottles: number | null;
  /** Null on rows written before the column was set; treated as unpicked. */
  isPicked: boolean | null;
}

export interface OutstandingLine {
  line: OrderLine;
  orderedBottles: number;
  pickedBottles: number;
  /** Bottles still to pick. Never negative — see `overPicked`. */
  outstandingBottles: number;
  /** What to release, in the unit the line is written in. */
  releaseQuantity: number;
}

/** Bottles per case, from the code's own pack segment. */
const packOf = (code: string | null) => {
  const parts = String(code ?? '').split('-');
  if (parts.length !== 4) return 1;
  const pack = Number(parts[2]);
  return Number.isFinite(pack) && pack > 0 ? pack : 1;
};

const isBottleUnit = (unit: string | null) => /^bottle/i.test((unit ?? '').trim());

/** The wine, ignoring the pack it happens to be cased in. */
const keyOf = (line: { sku: string | null; lwin18: string | null }) => {
  const code = line.lwin18 || line.sku || '';
  return code.split('-').length === 4 ? pakKeyOf(code) : code;
};

/**
 * Work out what of an order has still not been picked.
 *
 * An order amended after its pick list was completed has no way through the
 * warehouse today: releasing refuses because a pick list already exists, so
 * the added cases are picked by hand and the system never learns of them.
 * This is the figure that makes a second release safe — not "has it been
 * released" but "what is still owed".
 *
 * **Everything is counted in bottles, keyed pack-agnostically.** A line picked
 * out of a six-pack and invoiced as a three-pack carries two different codes
 * for one wine, so a comparison by SKU reports the picked line as missing and
 * sends someone to pick it a second time. On the order this was built from,
 * a SKU comparison claimed two untouched lines; by wine, the true answer was
 * nothing outstanding.
 *
 * Only lines actually picked count as picked. A line released and abandoned is
 * still owed, so a stale pick list cannot quietly satisfy an order.
 *
 * Where one wine appears on several lines, picked bottles are consumed by the
 * earlier line first. The split between two lines of one wine is arbitrary;
 * the total is not, and the total is what decides whether anyone walks.
 *
 * @param orderLines - The order as it stands now
 * @param pickedLines - Every pick list line ever raised for it
 * @returns Per line, what is owed, plus what was picked beyond the order
 */
const planOutstandingRelease = (
  orderLines: OrderLine[],
  pickedLines: PickedLine[],
) => {
  const pickedByWine = new Map<string, number>();

  for (const picked of pickedLines) {
    if (!picked.isPicked) continue;
    const key = keyOf({ sku: null, lwin18: picked.lwin18 });
    const bottles =
      picked.quantityBottles ??
      picked.quantityCases * packOf(picked.lwin18);
    pickedByWine.set(key, (pickedByWine.get(key) ?? 0) + bottles);
  }

  // Consumed as we walk the lines, so two lines of one wine cannot both claim
  // the same picked bottles.
  const remaining = new Map(pickedByWine);

  const lines: OutstandingLine[] = orderLines.map((line) => {
    const key = keyOf(line);
    const pack = packOf(line.lwin18 || line.sku);
    const orderedBottles = isBottleUnit(line.unit)
      ? line.quantity
      : line.quantity * pack;

    const available = remaining.get(key) ?? 0;
    const pickedBottles = Math.min(available, orderedBottles);
    remaining.set(key, available - pickedBottles);

    const outstandingBottles = Math.max(0, orderedBottles - pickedBottles);

    /*
      Released in the line's own unit, because the release path reads
      `quantity` and derives cases and bottles from it exactly as it does on a
      first release. A part case of a case-priced line is released as a whole
      case: the warehouse cannot pick two-thirds of a case, and rounding down
      would ship short.
    */
    const releaseQuantity = isBottleUnit(line.unit)
      ? outstandingBottles
      : Math.ceil(outstandingBottles / pack);

    return {
      line,
      orderedBottles,
      pickedBottles,
      outstandingBottles,
      releaseQuantity,
    };
  });

  /*
    Bottles picked that the order no longer asks for — a line reduced or
    removed after picking. Reported, never acted on: putting them back is
    someone walking a case to a bay, and a silent stock write would say it had
    happened when it had not.
  */
  const overPicked = [...remaining.entries()]
    .filter(([, bottles]) => bottles > 0)
    .map(([key, bottles]) => ({ key, bottles }));

  return {
    lines,
    toRelease: lines.filter((entry) => entry.outstandingBottles > 0),
    totalOutstandingBottles: lines.reduce(
      (sum, entry) => sum + entry.outstandingBottles,
      0,
    ),
    overPicked,
  };
};

export default planOutstandingRelease;
