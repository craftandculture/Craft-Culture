export interface QuoteLineInput {
  lwin18: string;
  wine: string;
  vintage: string;
  /** Bottle volume in cl, as the quote stores it. */
  size: number;
  /** Bottles per case as offered. */
  pack: number;
  /** Bottles the client is taking. */
  qty: number;
  /** Price per bottle, USD. */
  busd: number;
  /** Overrides the derived pack when the LPO says otherwise. */
  soldPack?: number | null;
}

export interface PlannedOrderLine {
  wine: string;
  vintage: string;
  /** The pack this order sells in — a repack when it differs from the quote's. */
  soldPack: number;
  /** The code the sale needs, which may not exist in Zoho yet. */
  lwin18: string;
  /** What Zoho charges for: cases of soldPack. */
  cases: number;
  bottles: number;
  /** Price per bottle and the case rate Zoho is given. */
  pricePerBottle: number;
  ratePerCase: number;
  lineTotal: number;
  /** "3x75cl" — the string the WMS pick logic reads back off the order. */
  description: string;
  isRepack: boolean;
  /** Set when the line cannot be ordered as it stands. */
  problem: string | null;
}

/** Two digits, as an LWIN pack segment is written. */
const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Turn accepted quote lines into the sales-order lines Zoho needs.
 *
 * The step this replaces is manual: working out that six bottles taken from a
 * 12-pack is a 6-pack sale, creating that code in Zoho by hand, then keying the
 * order line by line. Everything here is derivable from the quote, so none of
 * it should be typed twice.
 *
 * The pack sold is the LPO's if given, else the largest whole case that divides
 * the quantity, else the quantity itself — six bottles of a 12-pack is a
 * 6-pack; five is a 5-pack. The code follows the pack, which is what makes it a
 * repack: `…-12-00750` becomes `…-06-00750`.
 *
 * Zoho is given CASES at a case rate, with the pack in the description, because
 * that is what the pick list reads back when the order syncs in.
 *
 * @example
 *   planOrderLines([{ lwin18: '1012781-2012-06-00750', wine: 'Ch. Margaux', vintage: '2012',
 *                     size: 75, pack: 6, qty: 3, busd: 358 }]);
 *   // -> 1 case of `1012781-2012-03-00750`, "3x75cl", $1,074/case, isRepack
 *
 * @param lines - Accepted quote lines
 * @returns One planned order line per quote line with a quantity
 */
const planOrderLines = (lines: QuoteLineInput[]): PlannedOrderLine[] =>
  lines
    .filter((line) => line.qty > 0)
    .map((line) => {
      const offeredPack = line.pack > 0 ? line.pack : 1;
      const soldPack =
        line.soldPack && line.soldPack > 0
          ? line.soldPack
          : line.qty % offeredPack === 0
            ? offeredPack
            : line.qty;

      const cases = soldPack > 0 ? line.qty / soldPack : 0;
      const parts = String(line.lwin18 ?? '').split('-');
      const canBuildCode = parts.length === 4 && !!parts[0] && !!parts[1];
      const lwin18 = canBuildCode
        ? `${parts[0]}-${parts[1]}-${pad2(soldPack)}-${parts[3]}`
        : String(line.lwin18 ?? '');

      let problem: string | null = null;
      if (!canBuildCode) {
        problem = 'No LWIN on the quote line — the Zoho code cannot be derived';
      } else if (!Number.isInteger(cases)) {
        problem = `${line.qty} bottles is not a whole number of ${soldPack}-packs`;
      } else if (!(line.busd > 0)) {
        problem = 'No price on the quote line';
      }

      const pricePerBottle = line.busd;
      const ratePerCase = Math.round(pricePerBottle * soldPack * 100) / 100;

      return {
        wine: line.wine,
        vintage: line.vintage,
        soldPack,
        lwin18,
        cases,
        bottles: line.qty,
        pricePerBottle,
        ratePerCase,
        lineTotal: Math.round(pricePerBottle * line.qty * 100) / 100,
        description: `${soldPack}x${line.size}cl`,
        isRepack: soldPack !== offeredPack,
        problem,
      };
    });

export default planOrderLines;
