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
  /** When the line reached us. A line newer than the pick is new work. */
  createdAt?: Date | null;
}

export interface PickedLine {
  lwin18: string | null;
  quantityCases: number;
  /** Set on a split-case pick; the line moved bottles, not whole cases. */
  quantityBottles: number | null;
  /** Null on rows written before the column was set; treated as unpicked. */
  isPicked: boolean | null;
}

export interface PlanOptions {
  /**
   * When the most recent pick list for this order was raised.
   *
   * Without it every line is taken at face value, which is right on a first
   * release. With it, a line that matches nothing picked AND predates the pick
   * is treated as unverifiable rather than outstanding — see below.
   */
  lastPickListAt?: Date | null;
}

export interface OutstandingLine {
  line: OrderLine;
  orderedBottles: number;
  pickedBottles: number;
  /** Bottles still to pick. Never negative — see `overPicked`. */
  outstandingBottles: number;
  /** What to release, in the unit the line is written in. */
  releaseQuantity: number;
  /** False when we cannot tell whether this line was picked. */
  verifiable: boolean;
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
  options: PlanOptions = {},
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

    /*
      Can we believe this figure?

      An order line and the stock it was picked from need not share a code: a
      supplier SKU on the order (SOT-CAS-750-BTL-UAE-BLC) and an LWIN in the
      bay (SOTCAS750B-0000-06-00700) are one product under two names, and no
      key derived from either will match the other. Subtracting nothing from
      twenty then reports twenty bottles owed on an order that shipped
      complete — which is what SO-00135 did.

      So a line is only believed when the wine appears among the picks, or when
      it reached us AFTER the pick was raised and is therefore new work by
      date rather than by code. Anything else is unverifiable and withheld:
      sending someone to re-pick a delivered order is far worse than saying
      nothing.
    */
    const wineWasPicked = pickedByWine.has(key);
    const addedAfterPick = Boolean(
      options.lastPickListAt &&
        line.createdAt &&
        line.createdAt.getTime() > options.lastPickListAt.getTime(),
    );
    const verifiable =
      !options.lastPickListAt || wineWasPicked || addedAfterPick;

    return {
      line,
      orderedBottles,
      pickedBottles,
      outstandingBottles,
      releaseQuantity,
      verifiable,
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
    toRelease: lines.filter(
      (entry) => entry.outstandingBottles > 0 && entry.verifiable,
    ),
    /** Owed on paper but not provable — reported so it is not silent. */
    unverifiable: lines.filter(
      (entry) => entry.outstandingBottles > 0 && !entry.verifiable,
    ),
    totalOutstandingBottles: lines
      .filter((entry) => entry.verifiable)
      .reduce((sum, entry) => sum + entry.outstandingBottles, 0),
    overPicked,
  };
};

export default planOutstandingRelease;
