import parseSkuPack from './parseSkuPack';

interface PickQuantityParams {
  /** Ordered quantity, in the line's own unit. */
  quantity: number;
  /** The Zoho line unit ('Case'/'Cases'/'Bottle'). */
  unit?: string | null;
  /** The line's pack description, e.g. "1x75cl". */
  description?: string | null;
  /** The line's SKU — the authoritative pack when it parses. */
  sku?: string | null;
  /** The pack the wine is physically cased in at the chosen bay. */
  stockCaseConfig?: number | null;
}

/**
 * Work out what a pick line means physically: bottles, cases, and whether a
 * case has to be broken.
 *
 * This was written out longhand in three places — release-to-pick, create-pick-
 * list and the pick-list re-sync — and only one of them handled bottles. A
 * single-bottle line built by either of the other two became "1 case" of
 * whatever pack the wine happened to be shelved in, so an order for ONE bottle
 * printed as six on the picking sheet.
 *
 * The ordered pack comes from the line (a `…-01-…` SKU or a "1x75cl"
 * description); the stock pack is how the wine sits on the shelf. When they
 * differ the pick is measured in BOTTLES and the case is cracked at pick time.
 *
 * @example
 *   resolvePickQuantities({ quantity: 1, unit: 'Case', description: '1x75cl', stockCaseConfig: 6 });
 *   // { orderedPack: 1, stockPack: 6, orderedBottles: 1, wholeCase: false,
 *   //   quantityBottles: 1, casesNeeded: 1 }
 *
 * @param params - The order line and the pack of the stock it matched
 * @returns The physical quantities for the pick line
 */
const resolvePickQuantities = ({
  quantity,
  unit,
  description,
  sku,
  stockCaseConfig,
}: PickQuantityParams) => {
  const isBottleUnit = /^bottle/i.test((unit ?? '').trim());

  const descMatch = /^(\d+)\s*[x×]/i.exec((description ?? '').trim());
  const descPack =
    descMatch && Number(descMatch[1]) > 0 ? Number(descMatch[1]) : 0;
  const orderedPack = parseSkuPack(sku)?.pack ?? (descPack > 0 ? descPack : 1);

  const stockPack =
    stockCaseConfig && stockCaseConfig > 0 ? stockCaseConfig : orderedPack;

  // The true bottle count the customer ordered.
  const orderedBottles = isBottleUnit ? quantity : quantity * orderedPack;

  // A whole-case pick ONLY when full cases of the pack the stock is held in
  // were ordered. Otherwise the pick engine cracks the case (e.g. one bottle
  // off a 6-pack).
  const wholeCase = !isBottleUnit && orderedPack === stockPack;

  return {
    orderedPack,
    stockPack,
    orderedBottles,
    wholeCase,
    quantityBottles: wholeCase ? null : orderedBottles,
    casesNeeded: wholeCase
      ? quantity
      : Math.max(1, Math.ceil(orderedBottles / stockPack)),
  };
};

export default resolvePickQuantities;
