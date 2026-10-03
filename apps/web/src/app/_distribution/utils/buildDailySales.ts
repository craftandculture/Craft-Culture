import classifyDrink from './classifyDrink';
import type { DrinkCategory } from './classifyDrink';

/**
 * One wine's position across one daily window, as read from the database
 *
 * `heldFrom` and `heldTo` are the outlet's counts at the opening and closing
 * snapshot; `delivered` is what we invoiced to them in between.
 */
export interface PairRow {
  closedAt: string;
  openedAt: string;
  /** The Dubai calendar day the window opened on — the day most sales fell */
  salesDate: string;
  spanHours: number;
  outletCode: string;
  productName: string;
  regime: string | null;
  code: string | null;
  heldFrom: number;
  heldTo: number;
  soldLast30d: number | null;
  delivered: number;
  bottlePrice: number | null;
  currency: string | null;
  ownerName: string | null;
}

export interface DailySaleLine {
  outletCode: string;
  /** Their code reaches a wine of ours */
  linked: boolean;
  productName: string;
  category: DrinkCategory;
  ownerName: string | null;
  regime: 'consigned' | 'bought';
  sold: number;
  heldAfter: number;
  value: number | null;
  currency: string | null;
}

export interface DailySalesDay {
  salesDate: string;
  openedAt: string;
  closedAt: string;
  /** Over 30 means a pull was missed and this window covers more than a day */
  spanHours: number;
  consigned: { bottles: number; value: number };
  bought: { bottles: number; value: number };
  lines: DailySaleLine[];
  /** Counts that rose by more than we delivered — a restock, not a sale */
  restocks: { productName: string; bottles: number }[];
  /** What the outlet held at the close of the window, grouped for the filters */
  stock: StockGroup[];
}

/**
 * Bottles the outlet held at one count, for one owner, regime and type
 *
 * Grouped rather than per wine so thirty days of positions stay small, and at
 * the grain the page filters on. `unvalued` are bottles of wines with no
 * invoice price of ours, which is to say not linked: counted, never priced.
 */
export interface StockGroup {
  ownerName: string | null;
  regime: 'consigned' | 'bought';
  category: DrinkCategory;
  bottles: number;
  value: number;
  unvalued: number;
}

/** One wine held at the latest count, valued at our invoice price */
export interface StockWine {
  outletCode: string;
  linked: boolean;
  productName: string;
  ownerName: string | null;
  regime: 'consigned' | 'bought';
  category: DrinkCategory;
  held: number;
  value: number | null;
}

export interface DailyOutletSales {
  outletId: string;
  outletName: string;
  currency: string | null;
  latestSnapshotAt: string | null;
  days: DailySalesDay[];
  /** Consigned wine still held that the outlet reports no sale of in 30 days */
  notMoving: { productName: string; ownerName: string | null; held: number; category: DrinkCategory }[];
  /** Lines on their feed that reach no wine of ours, so carry no owner or value */
  unlinked: number;
  /** Every wine held at the latest count, most valuable first */
  stockWines: StockWine[];
  /** Our derived 30 days beside the feed's own figure, once 30 days exist */
  /**
   * The outlet's own rolling 30-day sales from its latest count, beside what
   * our daily counts found over the part of those 30 days they cover
   */
  check: {
    feed30: number;
    feed30Consigned: number;
    /** The outlet's own 30-day figure split by drink type, for the filters */
    feed30ByCategory: Record<DrinkCategory, number>;
    derived30: number;
    daysCovered: number;
  } | null;
}


/**
 * Turn daily position pairs into days of sales
 *
 * The arithmetic of the daily sales view, kept apart from the query so it can
 * be tested without a database:
 *
 *     sold = held at the start + delivered since − held at the end
 *
 * A negative result is a restock we did not invoice and is listed as one,
 * never counted as a negative sale. Totals are kept in the dominant currency
 * only, so a line invoiced in another currency cannot be added to them.
 *
 * @example
 *   buildDailySales([row]).days[0].consigned.bottles;
 *
 * @param rows - One row per wine per window, any order
 * @returns Days newest first, plus what is not moving and the 30-day check
 */
/*
  A wine they bought has no owner to settle with — it was sold to them
  outright — but once its code is linked it is no longer unknown either, so it
  is named for what it is rather than lumped in with lines nobody has matched.
*/
const ownerOf = (row: PairRow) =>
  row.ownerName ?? (row.code !== null && row.regime !== 'consigned' ? 'Sold outright' : null);

const buildDailySales = (rows: PairRow[]) => {
  const byDay = new Map<string, DailySalesDay>();
  const currencies = new Map<string, number>();

  for (const row of rows) {
    const key = String(row.closedAt);
    let day = byDay.get(key);

    if (!day) {
      day = {
        salesDate: row.salesDate,
        openedAt: String(row.openedAt),
        closedAt: key,
        spanHours: Math.round(row.spanHours),
        consigned: { bottles: 0, value: 0 },
        bought: { bottles: 0, value: 0 },
        lines: [],
        restocks: [],
        stock: [],
      };
      byDay.set(key, day);
    }

    const movement = row.heldFrom + row.delivered - row.heldTo;

    if (movement < 0) {
      day.restocks.push({ productName: row.productName, bottles: -movement });
      continue;
    }

    if (movement === 0) continue;

    const regime = row.regime === 'consigned' ? 'consigned' : 'bought';
    const value = row.bottlePrice !== null ? movement * row.bottlePrice : null;

    day[regime].bottles += movement;

    if (value !== null) {
      day[regime].value += value;
      if (row.currency) {
        currencies.set(row.currency, (currencies.get(row.currency) ?? 0) + value);
      }
    }

    day.lines.push({
      outletCode: row.outletCode,
      linked: row.code !== null,
      productName: row.productName,
      category: classifyDrink(row.productName),
      ownerName: ownerOf(row),
      regime,
      sold: movement,
      heldAfter: row.heldTo,
      value,
      currency: row.currency,
    });
  }

  const ordered = [...byDay.values()].sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1));

  for (const day of ordered) {
    day.lines.sort(
      (a, b) =>
        (a.regime === b.regime ? 0 : a.regime === 'consigned' ? -1 : 1) || b.sold - a.sold,
    );
    day.restocks.sort((a, b) => b.bottles - a.bottles);
  }

  /*
    The latest position, read once more for what is still on their shelf and
    what the feed's own thirty days say. Taken from the closing side of the
    newest window, so it agrees with the top of the page.
  */
  const latest = ordered[0]?.closedAt ?? null;
  const latestRows = latest ? rows.filter((row) => String(row.closedAt) === latest) : [];

  const notMoving = latestRows
    .filter((row) => row.regime === 'consigned' && row.heldTo > 0 && row.soldLast30d === 0)
    .map((row) => ({
      productName: row.productName,
      ownerName: row.ownerName,
      held: row.heldTo,
      category: classifyDrink(row.productName),
    }))
    .sort((a, b) => b.held - a.held);

  const unlinked = latestRows.filter((row) => row.code === null && row.heldTo > 0).length;

  const last30 = ordered.filter(
    (day) => latest && new Date(latest).getTime() - new Date(day.closedAt).getTime() < 30 * 864e5,
  );

  /*
    Shown from the first count rather than after thirty: the outlet's own
    figure covers the whole thirty days whatever our history holds, so it is
    the check that matters most while our counts still have gaps.
  */
  const check =
    latestRows.length > 0
      ? {
          feed30: latestRows.reduce((sum, row) => sum + (row.soldLast30d ?? 0), 0),
          feed30Consigned: latestRows
            .filter((row) => row.regime === 'consigned')
            .reduce((sum, row) => sum + (row.soldLast30d ?? 0), 0),
          feed30ByCategory: latestRows.reduce<Record<DrinkCategory, number>>(
            (acc, row) => {
              acc[classifyDrink(row.productName)] += row.soldLast30d ?? 0;
              return acc;
            },
            { wine: 0, sparkling: 0, spirits: 0, rtd: 0 },
          ),
          derived30: last30.reduce((sum, day) => sum + day.consigned.bottles + day.bought.bottles, 0),
          daysCovered: Math.min(
            30,
            last30.reduce((sum, day) => sum + Math.max(1, Math.round(day.spanHours / 24)), 0),
          ),
        }
      : null;

  const currency = [...currencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  /*
    Totals in one currency only. Invoices to an outlet are nearly always in one,
    but adding a dirham line to a dollar total would be a wrong number that
    looks right, so a line in another currency keeps its own value and stays
    out of the day's total.
  */
  if (currencies.size > 1) {
    for (const day of ordered) {
      for (const regime of ['consigned', 'bought'] as const) {
        day[regime].value = day.lines
          .filter((line) => line.regime === regime && line.currency === currency)
          .reduce((sum, line) => sum + (line.value ?? 0), 0);
      }
    }
  }

  /*
    Stock held at each count, valued at our latest invoice price per bottle.
    Read from the closing side of each window, so a day's stock is what was on
    their shelf when that day's sales were worked out. Only the dominant
    currency is valued, as with sales.
  */
  const priced = (row: PairRow) =>
    row.bottlePrice !== null && (!currency || row.currency === currency);

  for (const row of rows) {
    if (row.heldTo <= 0) continue;

    const day = byDay.get(String(row.closedAt));
    if (!day) continue;

    const regime = row.regime === 'consigned' ? 'consigned' : 'bought';
    const category = classifyDrink(row.productName);
    const owner = ownerOf(row);
    let group = day.stock.find(
      (g) => g.ownerName === owner && g.regime === regime && g.category === category,
    );

    if (!group) {
      group = { ownerName: owner, regime, category, bottles: 0, value: 0, unvalued: 0 };
      day.stock.push(group);
    }

    group.bottles += row.heldTo;

    if (priced(row)) group.value += row.heldTo * (row.bottlePrice ?? 0);
    else group.unvalued += row.heldTo;
  }

  const stockWines: StockWine[] = latestRows
    .filter((row) => row.heldTo > 0)
    .map((row) => ({
      outletCode: row.outletCode,
      linked: row.code !== null,
      productName: row.productName,
      ownerName: ownerOf(row),
      regime: row.regime === 'consigned' ? ('consigned' as const) : ('bought' as const),
      category: classifyDrink(row.productName),
      held: row.heldTo,
      value: priced(row) ? row.heldTo * (row.bottlePrice ?? 0) : null,
    }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || b.held - a.held);

  return { currency, latestSnapshotAt: latest, days: ordered, notMoving, unlinked, stockWines, check };
};

export default buildDailySales;
