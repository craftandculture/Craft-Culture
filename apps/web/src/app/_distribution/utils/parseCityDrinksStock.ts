/**
 * One product as City Drinks publish it.
 *
 * Note whose code is whose: `our_sku` is City Drinks' own code (CDR…) and
 * `their_sku` is **ours**, as they hold it. Read from our side those names are
 * inverted, which is exactly the sort of thing that gets mapped backwards once
 * and then believed.
 */
export interface CityDrinksProduct {
  our_sku: string;
  their_sku?: string | null;
  product_name: string;
  status?: string | null;
  current_stock?: number | null;
  in_transit?: number | null;
  sold_last_30d?: number | null;
  sold_last_90d?: number | null;
  forecast_3m?: number | null;
  last_purchased?: string | null;
}

export interface CityDrinksStockResponse {
  generated_at: string;
  products: CityDrinksProduct[];
}

export interface CityDrinksRow {
  /** City Drinks' code — the key their sales report is written in */
  outletCode: string;
  /** Our code, as they hold it. Null when they have never been given one. */
  ourCode: string | null;
  productName: string;
  /** `consigned` or `bought` — their word, and the QC answer */
  regime: 'consigned' | 'bought';
  bottlesOnHand: number;
  bottlesInTransit: number;
  soldLast30d: number | null;
  soldLast90d: number | null;
}

export interface ParsedCityDrinksStock {
  takenAt: Date;
  rows: CityDrinksRow[];
  /** Consigned lines carrying no code of ours — listed, never dropped */
  unmatched: CityDrinksRow[];
  counts: {
    total: number;
    consigned: number;
    bought: number;
    excluded: number;
    consignedBottles: number;
  };
}

/** Rows City Drinks use to test their own landed-cost figures */
const TEST_ROW = /^testing/i;

const toNumber = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/**
 * Read City Drinks' live stock feed
 *
 * Both regimes are kept, not just consignment. The same wine sits with them
 * under both at once — fifty codes exist as `CCW101` and `CCW101CON` — and a
 * line moving from consigned to bought is a **purchase**, not a sale to a
 * consumer. Keeping only the consigned rows would make that flip look like
 * stock vanishing, and we would bill its owner for bottles City Drinks had
 * actually bought. Filtering happens when the ledger is read, not here.
 *
 * Quantities are bottles. Established against the live feed rather than taken
 * from the header: 1,093 consigned on hand as *cases* would be 6,558+ bottles,
 * more than has ever been shipped for Crurated; and 69 of 132 stocked lines are
 * not divisible by 3, 6 or 12, where whole cases would divide cleanly.
 *
 * @param payload - The API response
 * @returns Snapshot rows, the unmatched among them, and counts worth asserting
 */
const parseCityDrinksStock = (
  payload: CityDrinksStockResponse,
): ParsedCityDrinksStock => {
  const takenAt = new Date(payload.generated_at);

  if (Number.isNaN(takenAt.getTime())) {
    throw new Error(
      `City Drinks returned an unreadable generated_at: ${payload.generated_at}`,
    );
  }

  if (!Array.isArray(payload.products)) {
    throw new Error('City Drinks returned no products array');
  }

  const rows: CityDrinksRow[] = [];
  let excluded = 0;

  for (const product of payload.products) {
    const ourCode = product.their_sku?.trim() || null;

    if (!product.our_sku?.trim()) {
      excluded += 1;
      continue;
    }

    if (ourCode && TEST_ROW.test(ourCode)) {
      excluded += 1;
      continue;
    }

    rows.push({
      outletCode: product.our_sku.trim(),
      ourCode,
      productName: product.product_name?.trim() || product.our_sku.trim(),
      regime: product.status === 'Consigned' ? 'consigned' : 'bought',
      bottlesOnHand: toNumber(product.current_stock),
      bottlesInTransit: toNumber(product.in_transit),
      soldLast30d: product.sold_last_30d ?? null,
      soldLast90d: product.sold_last_90d ?? null,
    });
  }

  const consigned = rows.filter((row) => row.regime === 'consigned');

  return {
    takenAt,
    rows,
    unmatched: consigned.filter((row) => !row.ourCode),
    counts: {
      total: rows.length,
      consigned: consigned.length,
      bought: rows.length - consigned.length,
      excluded,
      consignedBottles: consigned.reduce(
        (sum, row) => sum + row.bottlesOnHand,
        0,
      ),
    },
  };
};

export default parseCityDrinksStock;
