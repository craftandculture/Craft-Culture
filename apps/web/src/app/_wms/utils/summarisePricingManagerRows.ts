import pricePricingManagerRow from './pricePricingManagerRow';
import type { PricingManagerRates, PricingManagerRowInput } from './pricePricingManagerRow';

export interface PricingManagerSummaryRow extends PricingManagerRowInput {
  lwin18: string;
  /** Bottles on hand */
  bottles: number;
  /** The row owner's stored PC price for this wine, if any */
  ownerPcPrice?: number | null;
}

/**
 * The Pricing Manager KPI tiles, summed from the same per-row prices the table shows
 *
 * The tiles used to be worked out in SQL with their own model: margin tiers
 * picked by landed cost, and PC priced on landed rather than on the In Bond
 * price. The rows, the export and the price list never used either, so the
 * tiles and the rows disagreed. Every figure here is a row priced by
 * pricePricingManagerRow, multiplied by its bottles and added up.
 *
 * @example
 *   const tiles = summarisePricingManagerRows(rows, rates);
 *   tiles.inBondValue; // sum of bottles × In Bond
 */
const summarisePricingManagerRows = (
  rows: PricingManagerSummaryRow[],
  rates: Omit<PricingManagerRates, 'ownerPcPrice'>,
) => {
  const wines = new Set<string>();
  let stockAtCost = 0;
  let inBondValue = 0;
  let pcValue = 0;
  let potentialGrossProfit = 0;
  let unpricedCount = 0;
  let belowCostCount = 0;

  for (const row of rows) {
    wines.add(row.lwin18);
    const bottles = row.bottles > 0 ? row.bottles : 0;
    const priced = pricePricingManagerRow(row, {
      ...rates,
      ownerPcPrice: rates.ownerSelected ? (row.ownerPcPrice ?? null) : null,
    });
    const { landed, inBond, sellPrice } = priced;

    if (landed != null) stockAtCost += bottles * landed;
    if (inBond != null && landed != null) {
      inBondValue += bottles * inBond;
      potentialGrossProfit += bottles * (inBond - landed);
    }
    if (sellPrice != null && sellPrice > 0) pcValue += bottles * sellPrice;

    // No sell price; and the same below-cost test that turns a row red
    if (sellPrice == null || sellPrice <= 0) unpricedCount += 1;
    if (sellPrice != null && sellPrice > 0 && landed != null && sellPrice <= landed) {
      belowCostCount += 1;
    }
  }

  const round = (v: number) => Math.round(v * 100) / 100;

  return {
    totalProducts: wines.size,
    stockAtCost: round(stockAtCost),
    inBondValue: round(inBondValue),
    pcValue: round(pcValue),
    potentialGrossProfit: round(potentialGrossProfit),
    /** In Bond against landed, value-weighted, over the rows with an In Bond price */
    blendedMargin:
      inBondValue > 0
        ? Math.round((potentialGrossProfit / inBondValue) * 1000) / 10
        : null,
    unpricedCount,
    belowCostCount,
  };
};

export default summarisePricingManagerRows;
