import type { LpoLine, ParsedLpo } from './parseLpoText';

/** The table header this layout prints, which `pdf-parse` runs together. */
const HEADER = /S\.?\s*NO\s*ITEM\s*NAME\s*VINTAGE\s*UOM\s*QTY/i;

/** A vintage, standing alone or run onto the end of the name. */
const VINTAGE_AT_END = /^(.*?)\s*((?:19|20)\d{2}|NV)$/;

/** The unit column — PCS, BTL, CS, CASE. */
const UOM = /^(PCS|PC|BTL|BTLS|BOTTLES?|CS|CASES?|CTN)$/i;

/** Quantity and price run together, then a two-decimal price: "54161.00". */
const QTY_PRICE = /^(\d+)\.(\d{2})$/;

const MONEY = /^\d{1,3}(?:,\d{3})*\.\d{2}$|^\d+\.\d{2}$/;

const toNumber = (text: string) => Number(String(text).replace(/,/g, ''));

/**
 * Whether the text is the "S.NO / ITEM NAME / VINTAGE / UOM" purchase order.
 *
 * @param text - Text extracted from the purchase-order PDF
 * @returns True for this layout
 */
export const isItemList = (text: string) => HEADER.test(text);

/**
 * Split "54161.00" into the quantity and the price it ran into.
 *
 * The extractor drops the column gap, so "54" and "161.00" arrive as one run
 * of digits and nothing in the text says where to cut. The line total does:
 * the cut whose quantity times price gives the total is the right one. Where
 * no cut gives it, null — a mis-cut is the difference between 5 bottles and
 * 54, and is not worth guessing.
 *
 * @example
 *   splitQtyPrice('54161.00', 8694); // { qty: 54, price: 161 }
 */
const splitQtyPrice = (run: string, total: number) => {
  const match = QTY_PRICE.exec(run);
  if (!match?.[1] || match[2] === undefined) return null;

  const digits = match[1];
  const fits: { qty: number; price: number }[] = [];

  for (let cut = 1; cut < digits.length; cut += 1) {
    // A price never starts with a zero the table would have printed
    if (digits[cut] === '0' && cut < digits.length - 1) continue;

    const qty = Number(digits.slice(0, cut));
    const price = Number(`${digits.slice(cut)}.${match[2]}`);

    if (qty > 0 && Math.abs(qty * price - total) < 0.01) fits.push({ qty, price });
  }

  // "11100.00" for 1,100 is 1 × 1,100 or 11 × 100 — two answers is none
  return fits.length === 1 ? fits[0]! : null;
};

/**
 * Read the "S.NO / ITEM NAME / VINTAGE / UOM / QTY / PRICE / TOTAL" order.
 *
 * As `pdf-parse` returns it, each line is a block:
 *
 * ```
 * 4                                              <- line number
 * Château Grand-Puy Ducasse, 5ème Cru Classé,    <- the name, which may wrap
 * Pauillac
 * 2022                                           <- vintage, or run onto the name
 * PCS                                            <- unit
 * 6168.00                                        <- quantity and price, run together
 * 1008.00                                        <- line total
 * ```
 *
 * The buyer is the company on the letterhead. The "SUPPLIER:" line names us,
 * which is how an earlier layout came to raise an order against ourselves.
 *
 * No bottle size is stated, so the line carries size 0 — unstated — and the
 * matcher tries 75cl first and then any size, which is what lets the 70cl
 * spirits on the same order match.
 *
 * @param text - Text extracted from the purchase-order PDF
 * @returns The order's header, its lines, and both totals for comparison
 */
const parseItemListText = (text: string): ParsedLpo => {
  const rows = text
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);

  const lines: LpoLine[] = [];
  const skipped: string[] = [];

  const start = rows.findIndex((row) => HEADER.test(row));
  let at = start + 1;
  let expected = 1;

  while (at > 0 && at < rows.length) {
    // A block opens on its line number, counted, so a stray digit cannot
    if (rows[at] !== String(expected)) {
      at += 1;
      continue;
    }

    const uomAt = rows.findIndex(
      (row, index) => index > at && index <= at + 6 && UOM.test(row),
    );

    if (uomAt === -1) {
      skipped.push(`Line ${expected}: no unit column found`);
      expected += 1;
      at += 1;
      continue;
    }

    const name = rows.slice(at + 1, uomAt).join(' ').replace(/\s+/g, ' ');
    const unit = rows[uomAt]!.toUpperCase();
    const run = rows[uomAt + 1] ?? '';
    const totalText = rows[uomAt + 2] ?? '';

    const vintageMatch = VINTAGE_AT_END.exec(name);
    const wine = (vintageMatch?.[1] ?? name).replace(/[,\s]+$/, '').trim();
    const vintage = vintageMatch?.[2] ?? '';

    const total = MONEY.test(totalText) ? toNumber(totalText) : NaN;
    const split = Number.isFinite(total) ? splitQtyPrice(run, total) : null;

    if (!wine || !split) {
      skipped.push(
        `Line ${expected}: ${wine || '(no name)'} — quantity and price could not be separated from "${run}"`,
      );
    } else {
      // Bottles throughout; a case unit is converted at the common six and
      // shown back as cases, as the case-ordering layouts do
      const isCases = /^(CS|CASES?|CTN)$/.test(unit);
      const bottles = isCases ? split.qty * 6 : split.qty;

      lines.push({
        region: 'Order',
        wine,
        vintage,
        volumeText: `${split.qty} ${unit.toLowerCase()}`,
        sizeMl: 0,
        bottles,
        unitPriceAed: isCases
          ? Math.round((split.price / 6) * 100) / 100
          : split.price,
        lineTotalAed: total,
        problem: null,
        ...(isCases
          ? { cases: split.qty, pack: 6, unitPriceCaseAed: split.price }
          : {}),
      });
    }

    expected += 1;
    at = uomAt + 3;
  }

  // "120,428.00AED" — sub total, then total, both printed after the lines
  const totals = rows
    .map((row) => /^([\d,]+\.\d{2})\s*AED$/i.exec(row)?.[1])
    .filter((value): value is string => Boolean(value));
  const declaredTotalAed =
    totals.length > 0 ? toNumber(totals[totals.length - 1]!) : null;

  const supplierAt = rows.findIndex((row) => /^SUPPLIER:/i.test(row));
  const client =
    rows
      .slice(supplierAt + 1, supplierAt + 4)
      .find((row) => /L\.?L\.?C|TRADING|FZ/i.test(row))
      ?.trim() ?? null;

  const computedTotalAed =
    Math.round(lines.reduce((sum, line) => sum + line.lineTotalAed, 0) * 100) /
    100;

  return {
    poNumber: /Order No\s*(\S+)/i.exec(text)?.[1] ?? null,
    poDate: /Doc Date\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(text)?.[1] ?? null,
    client,
    creditTerms: null,
    lines,
    totalBottles: lines.reduce((sum, line) => sum + line.bottles, 0),
    computedTotalAed,
    declaredTotalAed,
    skipped,
  };
};

export default parseItemListText;
