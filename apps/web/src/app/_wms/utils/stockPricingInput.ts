import type { PricingManagerRowInput } from './pricePricingManagerRow';

/** One `(wine, owner)` group as `stockPricingSelect` returns it */
export interface StockPricingRaw extends PricingManagerRowInput {
  /** The newest lot's paid goods cost per bottle (ex-freight) */
  lotProductCost?: number | string | null;
  /** The newest lot's landed cost per bottle */
  lotLandedCost?: number | string | null;
  /** The newest lot's cost is its own invoice line, not a stand-in */
  lotOwnLine?: boolean | null;
}

const toNumber = (value: number | string | null | undefined) =>
  value == null ? null : Number(value);

/**
 * Turn a `(wine, owner)` group into the row the Pricing Manager prices
 *
 * The import price becomes the PAID goods cost: the newest lot's own invoice
 * line wins, then a typed import price (old stock, repacks), then the line the
 * lot was costed from. A typed price lives on the shared per-wine row, so
 * letting it win hid every owner's invoice behind one hand-entered figure.
 * System logistics is the newest lot's freight (landed − paid), never negative.
 *
 * The Pricing Manager table and the price lists both read this, so the cost a
 * wine is listed at is the cost shown beside its In Bond price.
 *
 * @example
 *   stockPricingInput({ lotProductCost: 170, lotLandedCost: 190, lotOwnLine: true });
 *   // { importPricePerBottle: 170, systemLogistics: 20, … }
 *
 * @param raw - The group's selected inputs
 * @returns The row with its paid import and system logistics resolved
 */
const stockPricingInput = <T extends StockPricingRaw>(raw: T) => {
  const productCost = toNumber(raw.lotProductCost);
  const landedCost = toNumber(raw.lotLandedCost);
  const typedImport = toNumber(raw.importPricePerBottle);

  const manualImport = typedImport != null && typedImport > 0 ? typedImport : null;
  const invoiceCost =
    raw.lotOwnLine && productCost != null && productCost > 0 ? productCost : null;
  const importPaid = invoiceCost ?? manualImport ?? productCost ?? null;
  const systemLogistics =
    landedCost != null && productCost != null
      ? Math.max(0, Math.round((landedCost - productCost) * 100) / 100)
      : 0;

  return {
    ...raw,
    // The PAID goods cost (ex-freight), no longer the typed figure alone
    importPricePerBottle: importPaid,
    // Live group/shipment freight per bottle (read-only; auto-updates)
    systemLogistics,
  };
};

export default stockPricingInput;
